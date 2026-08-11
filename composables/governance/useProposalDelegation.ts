import { useFundStore } from "~/store/fund/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance-proposals/governance_proposals.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { DelegatesSource } from "~/types/enums/delegates_source";

/**
 * Whether we have established how much voting power is delegated in a vault.
 * "unknown" is a real answer: every delegates source can fail, and a failed
 * read must never read as "nobody has delegated".
 */
type DelegationCheckState = "idle" | "checking" | "known" | "unknown";

/**
 * Shared per vault rather than per component: a page shows the notice and the
 * disabled submit button side by side, and both ask the same question. The
 * on-chain fallback walks DelegateChanged logs, so a second fetch is not free.
 */
const checkStates = reactive<Record<string, DelegationCheckState>>({});
const pendingChecks: Record<string, Promise<void>> = {};

export const NO_DELEGATES_TITLE =
  "No voting power is delegated in this vault";

export const NO_DELEGATES_MESSAGE =
  "Only delegated tokens can vote, so a proposal created now could not " +
  "reach quorum and would be defeated. Delegate voting power first, then " +
  "create the proposal.";

/**
 * Gate for every "create proposal" flow.
 *
 * A governance token holder has no votes until the balance is delegated —
 * to themselves or to somebody else. With nothing delegated anywhere in the
 * vault, every proposal is dead on arrival: no vote can be cast, quorum is
 * unreachable, and the proposal ends Defeated. So the submit button is held
 * shut while that is *positively known* to be the case.
 *
 * It stays open while the check is still running or when it failed: an
 * unavailable subgraph is not evidence of an empty delegate set, and a gate
 * that fires on a failed read would lock proposals out of a healthy vault.
 */
export const useProposalDelegation = () => {
  const fundStore = useFundStore();
  const governanceProposalStore = useGovernanceProposalsStore();
  const toastStore = useToastStore();

  const fundKey = computed(() => {
    const address = fundStore.fund?.address;
    if (!address) return "";
    return `${fundStore.selectedFundChain}-${address}`;
  });

  const checkState = computed<DelegationCheckState>(
    () => (fundKey.value && checkStates[fundKey.value]) || "idle",
  );

  const delegates = computed(() =>
    governanceProposalStore.getDelegates(
      fundStore.selectedFundChain,
      fundStore.fundAddress,
    ),
  );

  const hasDelegates = computed(() => delegates.value.length > 0);

  const isDelegationUnknown = computed(
    () =>
      checkState.value === "unknown" ||
      governanceProposalStore.getDelegatesSource(
        fundStore.selectedFundChain,
        fundStore.fundAddress,
      ) === DelegatesSource.Unavailable,
  );

  const isCheckingDelegation = computed(
    () => checkState.value === "idle" || checkState.value === "checking",
  );

  /** Positively established: nobody in this vault holds voting power. */
  const hasNoDelegates = computed(
    () =>
      checkState.value === "known" &&
      !hasDelegates.value &&
      !isDelegationUnknown.value,
  );

  const canCreateProposal = computed(() => !hasNoDelegates.value);

  const runCheck = async (key: string): Promise<void> => {
    checkStates[key] = "checking";
    try {
      await governanceProposalStore.fetchDelegates();
      checkStates[key] = "known";
    } catch (error) {
      // Every source failed. Leave proposal creation open — see the note above.
      console.warn(
        "Could not read the vault's delegates; leaving proposal creation open.",
        error,
      );
      checkStates[key] = "unknown";
    }
  };

  /** Reads the delegate set once per vault; later callers await that read. */
  const checkDelegation = async (): Promise<void> => {
    const key = fundKey.value;
    // The fund is still loading; the watcher below runs this again once the
    // governance token is known.
    if (!key || !fundStore.fund?.governanceToken?.address) return;
    if (checkStates[key] === "known" || checkStates[key] === "unknown") return;

    pendingChecks[key] ??= runCheck(key).finally(() => {
      delete pendingChecks[key];
    });
    await pendingChecks[key];
  };

  /** Re-reads after a delegation transaction lands. */
  const refreshDelegation = async (): Promise<void> => {
    const key = fundKey.value;
    if (!key) return;
    delete checkStates[key];
    await checkDelegation();
  };

  /**
   * Call this first in every submit handler. Waits out an in-flight check so
   * a fast click cannot slip a doomed proposal past the disabled button.
   */
  const assertCanCreateProposal = async (): Promise<boolean> => {
    await checkDelegation();
    if (hasNoDelegates.value) {
      toastStore.errorToast(
        `${NO_DELEGATES_TITLE}. ${NO_DELEGATES_MESSAGE}`,
        10000,
      );
      return false;
    }
    return true;
  };

  watch(
    () => [fundStore.fund?.address, fundStore.fund?.governanceToken?.address],
    () => {
      checkDelegation();
    },
    { immediate: true },
  );

  return {
    delegates,
    hasDelegates,
    hasNoDelegates,
    canCreateProposal,
    isCheckingDelegation,
    isDelegationUnknown,
    checkDelegation,
    refreshDelegation,
    assertCanCreateProposal,
  };
};
