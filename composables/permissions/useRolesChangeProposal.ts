import { useProposalDelegation } from "~/composables/governance/useProposalDelegation";
import {
  toProposalCalls,
  useProposalPreflight,
} from "~/composables/governance/useProposalPreflight";
import { wrapProposalThroughSafe } from "~/composables/governance/safeExecution";
import { useRolesModifierProfile } from "~/composables/permissions/rolesModifierProfile";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { RolesVersion } from "~/types/enums/roles_version";

/**
 * Ready Roles-modifier calldata (revocations, library grants, pasted raw
 * calls) sent as one governance proposal, routed the way the
 * delegated-permissions page routes its own: straight to the modifier while
 * the governor owns it, through the Safe after activation, simulated from
 * the governor before anything is signed.
 */
export const useRolesChangeProposal = () => {
  const fundStore = useFundStore();
  const toastStore = useToastStore();
  const { canCreateProposal, assertCanCreateProposal } = useProposalDelegation();
  const { runPreflight } = useProposalPreflight();
  const { ensureProfile } = useRolesModifierProfile();
  const isProposing = ref(false);

  /** Resolves true once the proposal transaction is confirmed. */
  const propose = async (
    calls: string[],
    meta: { title: string; description: string },
  ): Promise<boolean> => {
    if (!calls.length) return false;
    if (!(await assertCanCreateProposal())) return false;

    const profile = await ensureProfile();
    const rolesModAddress = profile?.address ?? "";
    if (!rolesModAddress || profile?.version !== RolesVersion.V2) {
      toastStore.errorToast(
        "The vault's Roles V2 modifier could not be resolved, so no permission proposal can be encoded for it.",
        10000,
      );
      return false;
    }
    if (profile.owner && !profile.governorOwned && !profile.safeOwnedAndControlled) {
      toastStore.errorToast(
        "The Roles modifier is owned by neither the governor nor a Safe the " +
          "governor controls, so a governance proposal cannot change its permissions.",
        10000,
      );
      return false;
    }

    let proposal = {
      targets: calls.map(() => rolesModAddress),
      gasValues: calls.map(() => 0),
      calldatas: calls,
    };
    if (!profile.governorOwned) {
      proposal = wrapProposalThroughSafe(
        proposal,
        profile.safe,
        fundStore.fund?.governorAddress ?? "",
      );
    }

    if (
      !(await runPreflight(toProposalCalls(proposal.targets, proposal.calldatas), {
        address: rolesModAddress,
        version: profile.version,
      }))
    ) {
      return false;
    }

    isProposing.value = true;
    return await new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        isProposing.value = false;
        resolve(ok);
      };
      try {
        fundStore.fundGovernorContract
          .send(
            "propose",
            {},
            proposal.targets,
            proposal.gasValues,
            proposal.calldatas,
            JSON.stringify(meta),
          )
          .on("transactionHash", () => {
            toastStore.addToast(
              "The proposal transaction has been submitted. Please wait for it to be confirmed.",
            );
          })
          .on("receipt", (receipt: any) => {
            if (receipt.status) {
              toastStore.successToast(
                "Permissions proposal created. You can now vote on it in the governance page.",
              );
              done(true);
            } else {
              toastStore.errorToast("The proposal transaction failed.");
              done(false);
            }
          })
          .on("error", (error: any) => {
            console.error(error);
            toastStore.errorToast(error?.message || "The proposal could not be created.");
            done(false);
          });
      } catch (error: any) {
        console.error(error);
        toastStore.errorToast(error?.message || "The proposal could not be created.");
        done(false);
      }
    });
  };

  return { propose, isProposing, canCreateProposal };
};
