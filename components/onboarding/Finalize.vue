<template>
  <div class="onboarding_finalize">
    <template v-if="isFundCreateFinalized">
      <div class="onboarding_finalize__state">
        <span class="onboarding_finalize__badge">Created</span>
        <p class="onboarding_finalize__lead">
          <span class="onboarding_finalize__name">{{ fundSettings?.fundName }}</span>
          was created successfully.
        </p>
        <p class="onboarding_finalize__body">
          You will be redirected to the vault details page after the node gets
          synced.
        </p>
        <v-progress-circular
          class="onboarding_finalize__spinner"
          size="30"
          width="3"
          indeterminate
        />
        <nuxt-link class="onboarding_finalize__link" to="/">
          Go to discover
        </nuxt-link>
      </div>
    </template>

    <template v-else-if="isFinalizingFundCreation">
      <div class="onboarding_finalize__state">
        <p class="onboarding_finalize__body">
          Finalizing vault creation.
        </p>
        <v-progress-circular
          class="onboarding_finalize__spinner"
          size="30"
          width="3"
          indeterminate
        />
      </div>
    </template>

    <!--
      The last thing anyone sees before the vault goes live, so it carries the
      one recommendation that cannot be made afterwards: take the vault for a
      drive first. Permissions and NAV methods are still a signature away from
      being changed here; after finalizing, both take a governance vote.
    -->
    <template v-else>
      <div class="preflight">
        <header class="preflight__head">
          <span class="preflight__eyebrow">Last step</span>
          <h2 class="preflight__title">
            Finalize vault creation
          </h2>
          <p class="preflight__lead">
            Finalizing opens the vault for deposits. Changing permissions or NAV
            methods then takes a governance vote.
          </p>
          <!--
            What the button is about to send. The first NAV update belongs in
            the same transaction as the finalize (see finalizeCalls.ts); when
            the wallet or its role cannot deliver that, the step says so
            before anything is signed rather than after.
          -->
          <p
            v-if="firstNavPlan"
            class="preflight__nav"
            :class="{ 'preflight__nav--warn': firstNavPlan.mode !== 'atomic' }"
          >
            <Icon
              :icon="firstNavPlan.mode === 'atomic'
                ? 'material-symbols:verified-user-outline-rounded'
                : 'material-symbols:warning-outline-rounded'"
              width="1.125rem"
              aria-hidden="true"
            />
            <span v-if="firstNavPlan.mode === 'atomic'">
              The first NAV update runs in the same transaction, so nobody can
              deposit and take voting control ahead of it.
            </span>
            <span v-else-if="firstNavPlan.mode === 'sequential'">
              This wallet cannot batch transactions, so the first NAV update
              follows as a second confirmation. Until it confirms, deposits
              settle instantly — a wallet with smart-account batching closes
              that gap.
            </span>
            <span v-else-if="firstNavPlan.mode === 'none'">
              The first NAV update will not be included: {{ firstNavPlan.reason }}
              Deposits settle instantly until a NAV update is recorded, so run
              one right after finalizing.
            </span>
          </p>
          <p v-if="hasBatchFailed" class="preflight__nav preflight__nav--warn">
            <Icon
              icon="material-symbols:warning-outline-rounded"
              width="1.125rem"
              aria-hidden="true"
            />
            <span>
              Finalizing together with the first NAV update did not go
              through, most likely because a NAV method reverts. Check the
              simulated values, or
              <button
                type="button"
                class="paths__link paths__link--button"
                @click="finalizeCreateFund({ skipFirstNav: true })"
              >
                finalize without the NAV update
              </button>
            </span>
          </p>
        </header>

        <div class="preflight__notice">
          <span class="preflight__notice_glyph" aria-hidden="true">
            <Icon icon="material-symbols:experiment-outline" width="1.25rem" />
          </span>
          <p class="preflight__notice_text">
            <strong>Test the vault before you finalize.</strong>
            We strongly recommend testing execution and checking if valuation
            methods return the correct value of test positions.
          </p>
        </div>

        <!--
          Three steps in two columns: the test funds on the left, for the
          whole height; on the right, what to do with them and then how to
          check the result. One column, in order, on narrow screens.
        -->
        <ol class="preflight__steps">
          <li class="preflight__step preflight__step--funds">
            <span class="preflight__step_number">1</span>
            <div class="preflight__step_body">
              <h3 class="preflight__step_title">
                Move test {{ baseSymbol || "funds" }}
              </h3>
              <p class="preflight__step_text">
                Send a small amount to the vault's Safe on {{ chainName }}.
                Return it from here when you are done.
              </p>

              <OnboardingTestFunds
                class="preflight__step_content"
                @return-role-change="isReturnRoleLeftOpen = $event"
              />
            </div>
          </li>

          <li class="preflight__step">
            <span class="preflight__step_number">2</span>
            <div class="preflight__step_body">
              <h3 class="preflight__step_title">
                Test run the strategy
              </h3>
              <p class="preflight__step_text">
                Make a few trades as the vault, by hand or in code.
              </p>

              <!-- Two ways in, as rows of one card: neither is the default. -->
              <div class="paths preflight__step_content">
                <!-- By hand, through Zodiac's own app: the wordmark is the
                     name, as on the permissions step's library. -->
                <div class="paths__row">
                  <div class="paths__head">
                    <img
                      class="paths__logo"
                      src="@/assets/images/logo-zodiac.png"
                      alt="Zodiac"
                    >
                    <a
                      class="paths__link"
                      :href="ZODIAC_APP_URL"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Zodiac
                      <Icon
                        icon="material-symbols:arrow-outward-rounded"
                        width="0.9375rem"
                        aria-hidden="true"
                      />
                    </a>
                  </div>
                  <p class="paths__text">
                    Connect to the protocols' own frontends and execute as the
                    vault.
                  </p>
                  <!-- The same instruction the permissions step's Zodiac
                       walkthrough gives, with the address ready to paste. -->
                  <div class="paths__safe">
                    <span class="paths__safe_lead">
                      Open
                      <span class="paths__nav">
                        <svg
                          class="paths__nav_icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="3"
                          />
                          <path d="M8.5 8.5l7 7" />
                          <path d="M15.5 8.5l-7 7" />
                        </svg>
                        Vaults
                      </span>
                      and import the Safe:
                    </span>
                    <span class="paths__safe_row">
                      <span
                        class="paths__safe_address"
                        :class="{ 'paths__safe_address--pending': !safeAddress }"
                      >
                        {{ safeAddress || "available once the vault is initialized" }}
                      </span>
                      <button
                        v-if="safeAddress"
                        type="button"
                        class="paths__copy"
                        :aria-label="safeCopied ? 'Copied' : 'Copy the Safe address'"
                        @click="copySafeAddress"
                      >
                        <Icon
                          :icon="safeCopied
                            ? 'material-symbols:check-rounded'
                            : 'material-symbols:content-copy-outline-rounded'"
                          width="0.875rem"
                          aria-hidden="true"
                        />
                        {{ safeCopied ? "Copied" : "Copy" }}
                      </button>
                    </span>
                  </div>
                </div>

                <!-- Or by code, against the same role. -->
                <div class="paths__row">
                  <div class="paths__head">
                    <span class="paths__mark">
                      <span class="paths__glyph" aria-hidden="true">
                        <Icon icon="material-symbols:code-rounded" width="1rem" />
                      </span>
                      Algorithmic
                    </span>
                    <a
                      class="paths__link"
                      :href="ALGO_DOCS_URL"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Read the docs
                      <Icon
                        icon="material-symbols:arrow-outward-rounded"
                        width="0.9375rem"
                        aria-hidden="true"
                      />
                    </a>
                  </div>
                  <p class="paths__text">
                    Integrate and execute the strategy programmatically.
                  </p>
                </div>
              </div>
            </div>
          </li>

          <li class="preflight__step preflight__step--check">
            <span class="preflight__step_number">3</span>
            <div class="preflight__step_body">
              <h3 class="preflight__step_title">
                Check the NAV values
              </h3>
              <p class="preflight__step_text">
                With dust in the test positions, confirm each NAV method
                returns the right simulated value.
              </p>
              <button
                type="button"
                class="preflight__back preflight__step_content"
                @click="emit('go-to-step', OnboardingStep.NavMethods)"
              >
                <Icon
                  icon="material-symbols:arrow-back-rounded"
                  width="1rem"
                  aria-hidden="true"
                />
                Back to NAV methods
              </button>
            </div>
          </li>
        </ol>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from "~/store/toasts/toast.store";
import { useAccountStore } from "~/store/account/account.store";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useFundStore } from "~/store/fund/fund.store";
import { networksMap } from "~/store/web3/networksMap";
import { usePageNavigation } from "~/composables/routing/usePageNavigation";
import { OnboardingStep } from "~/types/enums/stepper_onboarding";
import type { ChainId } from "~/types/enums/chain_id";
import {
  buildFinalizeWithFirstNavCalls,
  encodeFirstNavUpdate,
  firstNavRoleCandidates,
  pickFirstNavRole,
  type IFirstNavRoute,
} from "~/composables/onboarding/finalizeCalls";
import { isReturnRoleOpen } from "~/composables/onboarding/returnRoleProbe";
import {
  RolesVersion,
  detectRolesVersion,
  fetchMemberRoles,
  sendRoleExecution,
  simulateRoleExecution,
} from "~/composables/permissions/useRoleExecution";
import {
  getAtomicBatchStatus,
  isBatchUnsupportedError,
  isUpgradeRejectionError,
  isUserRejectionError,
  isWalletCallsSuccess,
  isWalletRpcHealthError,
  sendWalletCalls,
  waitForWalletCalls,
  WALLET_RPC_HEALTH_MESSAGE,
  WalletCallsTimeoutError,
} from "~/services/eip5792";

const emit = defineEmits<{
  /** Back to an earlier step of the flow, to re-check it before launching. */
  (e: "go-to-step", step: OnboardingStep): void;
}>();

const fundStore = useFundStore();
const toastStore = useToastStore();
const createFundStore = useCreateFundStore();
const accountStore = useAccountStore();

const { fundChainId, fundSettings, fundFactoryContract } =
  storeToRefs(createFundStore);
const { navigateToFundDetails } = usePageNavigation();

/** Zodiac's own app: permissions and manual execution for any protocol. */
const ZODIAC_APP_URL = "https://app.zodiac.eco/";
/** Running the strategy in code: the docs page on algorithmic and AI execution. */
const ALGO_DOCS_URL = "https://docs.rethink.finance/execution/algo-ai";

const isFetchingNewlyCreatedFundSettings = ref(false);
const isFinalizingFundCreation = ref(false);
const isFundCreateFinalized = ref(false);

/**
 * A test-funds return that stopped after granting its role. Finalizing then
 * would hand the live vault a way to move that amount out — the factory can
 * revoke it only until finalize — so the button waits until it is removed.
 */
const isReturnRoleLeftOpen = ref(false);
const RETURN_ROLE_OPEN_MESSAGE =
  "A test-funds return permission is still open. Remove it in step 1 before finalizing.";

/**
 * The same check at click time, straight from the chain. "unknown" when no
 * RPC answers: that blocks too, since finalizing over an open permission
 * cannot be undone.
 */
const returnRoleStateOnChain = async (): Promise<"open" | "closed" | "unknown"> => {
  const account = accountStore.activeAccountAddress;
  const rolesModAddress = createFundStore.fundInitCache?.rolesModifier;
  const tokenAddress = fundSettings?.value?.baseToken;
  if (!account || !tokenAddress || !rolesModAddress || isZeroAddress(rolesModAddress)) {
    // No modifier yet means no permission could have been granted.
    return "closed";
  }
  try {
    const version = await detectRolesVersion(
      fundChainId.value as ChainId,
      rolesModAddress,
      createFundStore.fundFactoryContractV2Used ? RolesVersion.V2 : RolesVersion.V1,
    );
    const open = await isReturnRoleOpen({
      chainId: fundChainId.value as ChainId,
      version: version === RolesVersion.V1 ? "V1" : "V2",
      rolesModAddress,
      member: account,
      tokenAddress,
    });
    return open ? "open" : "closed";
  } catch (error) {
    console.warn("Could not check for an open return permission", error);
    return "unknown";
  }
};

const safeAddress = computed(() => fundSettings?.value?.safe ?? "");
const baseSymbol = computed(() => fundSettings?.value?.baseSymbol ?? "");
/** Named in the funding step, so the asset is not sent on the wrong network. */
const chainName = computed(
  () => networksMap[fundChainId.value as ChainId]?.chainName ?? "this network",
);

const safeCopied = ref(false);
let safeCopiedTimer: ReturnType<typeof setTimeout> | undefined;

const copySafeAddress = () => {
  if (!safeAddress.value) return;
  navigator.clipboard.writeText(safeAddress.value);
  safeCopied.value = true;
  if (safeCopiedTimer) clearTimeout(safeCopiedTimer);
  safeCopiedTimer = setTimeout(() => {
    safeCopied.value = false;
  }, 1500);
};

onBeforeUnmount(() => {
  if (safeCopiedTimer) clearTimeout(safeCopiedTimer);
});

/**
 * How the first NAV update travels with the finalize:
 *
 *   "atomic"      one EIP-5792 batch — finalize and NAV update land together
 *                 or not at all.
 *   "sequential"  the wallet cannot batch; the NAV update is a second
 *                 transaction sent the moment the finalize confirms.
 *   "none"        the connected wallet cannot run the NAV update at all, so
 *                 only the finalize goes out.
 */
type FirstNavPlan =
  | { mode: "atomic" | "sequential"; route: IFirstNavRoute }
  | { mode: "none"; reason: string };

const { getNAVExecutorBeaconProxyAddress } = useContractAddresses();

const firstNavPlan = ref<FirstNavPlan | undefined>(undefined);
/** Set when an atomic batch reverted, to offer the way out. */
const hasBatchFailed = ref(false);

const fundAddress = computed(
  () =>
    createFundStore.fundInitCache?.fundContractAddr ||
    fundSettings?.value?.fundAddress ||
    "",
);
const navExecutorAddress = computed(() =>
  fundChainId.value ? getNAVExecutorBeaconProxyAddress(fundChainId.value) : "",
);

const resolveFirstNavPlan = async (): Promise<FirstNavPlan> => {
  const chainId = fundChainId.value as ChainId;
  const account = accountStore.activeAccountAddress;
  const rolesModAddress = createFundStore.fundInitCache?.rolesModifier;

  if (!account) return { mode: "none", reason: "no wallet is connected." };
  if (!fundAddress.value || !rolesModAddress || isZeroAddress(rolesModAddress)) {
    return { mode: "none", reason: "the vault's Roles modifier is not known." };
  }
  if (!navExecutorAddress.value) {
    return {
      mode: "none",
      reason: "there is no NAV executor configured for this network.",
    };
  }

  const version = await detectRolesVersion(
    chainId,
    rolesModAddress,
    createFundStore.fundFactoryContractV2Used
      ? RolesVersion.V2
      : RolesVersion.V1,
  );

  // Membership is a log scan some RPCs refuse; the default keys are tried
  // either way, so a failed read only costs the custom-named roles.
  let heldRoles: string[] = [];
  try {
    heldRoles = await fetchMemberRoles(chainId, rolesModAddress, account, version);
  } catch (error) {
    console.warn("Could not read role membership before finalizing", error);
  }

  const navCall = {
    to: fundAddress.value,
    data: encodeFirstNavUpdate(navExecutorAddress.value),
  };
  const role = await pickFirstNavRole(
    firstNavRoleCandidates(version, heldRoles),
    (candidate) =>
      simulateRoleExecution(chainId, rolesModAddress, navCall, candidate, version),
  );
  if (!role) {
    return {
      mode: "none",
      reason:
        "the connected wallet holds no role that is allowed to update the vault's NAV.",
    };
  }
  const route: IFirstNavRoute = { rolesModAddress, role, version };

  const provider = accountStore.connectedWallet?.provider;
  let canBatch = false;
  if (provider) {
    try {
      canBatch =
        (await getAtomicBatchStatus(provider, account, chainId)) !==
        "unsupported";
    } catch (error) {
      // The wallet's RPC is failing; the send will surface that on its own.
      console.warn("Batch capability probe failed", error);
    }
  }
  return { mode: canBatch ? "atomic" : "sequential", route };
};

const refreshFirstNavPlan = async () => {
  try {
    firstNavPlan.value = await resolveFirstNavPlan();
  } catch (error) {
    console.error("Failed resolving the first NAV update plan", error);
    firstNavPlan.value = undefined;
  }
  return firstNavPlan.value;
};

watch(
  () => [
    accountStore.activeAccountAddress,
    accountStore.connectedWallet?.label,
    fundChainId.value,
    fundAddress.value,
    createFundStore.fundInitCache?.rolesModifier,
  ],
  () => {
    hasBatchFailed.value = false;
    refreshFirstNavPlan();
  },
  { immediate: true },
);

const SUBMITTED_TOAST =
  "The transaction has been submitted. Please wait for it to be confirmed.";
const FINALIZE_FAILED_TOAST =
  "The Create Fund tx has failed. Please contact the Rethink Finance community for support.";

/** Resolves once a plain send is mined (true) or has failed (false). */
const settle = (transaction: any): Promise<boolean> =>
  new Promise((resolve) => {
    Promise.resolve(
      transaction
        .on("transactionHash", (hash: any) => {
          console.log("tx hash: " + hash);
          toastStore.addToast(SUBMITTED_TOAST);
        })
        .on("receipt", (receipt: any) => {
          console.log("receipt: ", receipt);
          resolve(!!receipt.status);
        })
        .on("error", (error: any) => {
          console.error("transaction error", error);
          resolve(false);
        }),
    ).catch((error: any) => {
      // The PromiEvent rejects with the error its "error" event carried, and
      // on its own for failures before a wallet prompt.
      console.error(error);
      resolve(false);
    });
  });

const markFinalized = (message: string) => {
  toastStore.successToast(message);
  isFundCreateFinalized.value = true;
  // Clear local storage for this chain.
  createFundStore.clearFundLocalStorage();
};

type BatchOutcome = "success" | "unsupported" | "stopped";

/** Finalize and the first NAV update as one atomic wallet batch. */
const sendFinalizeBatch = async (route: IFirstNavRoute): Promise<BatchOutcome> => {
  const chainId = fundChainId.value as ChainId;
  const account = accountStore.activeAccountAddress;
  const provider = accountStore.connectedWallet?.provider;
  const factoryAddress = fundFactoryContract.value?.options?.address;
  if (!account || !provider || !factoryAddress) return "unsupported";

  try {
    if (chainId !== accountStore.connectedWalletChainId) {
      await accountStore.switchNetwork(chainId);
    }
  } catch (error) {
    // switchNetwork has raised its own toast.
    console.error("Network switch failed before finalizing", error);
    return "stopped";
  }

  let batchId: string;
  try {
    batchId = await sendWalletCalls(provider, {
      chainId,
      from: account,
      calls: buildFinalizeWithFirstNavCalls({
        factoryAddress,
        fundAddress: fundAddress.value,
        navExecutorAddress: navExecutorAddress.value,
        route,
      }),
    });
  } catch (error: any) {
    // Declining the account upgrade is declining to batch, not to finalize.
    if (isUpgradeRejectionError(error) || isBatchUnsupportedError(error)) {
      return "unsupported";
    }
    if (isUserRejectionError(error)) {
      toastStore.addToast("Transaction was rejected.");
      return "stopped";
    }
    console.error("Finalize batch was not sent", error);
    if (isWalletRpcHealthError(error)) {
      toastStore.errorToast(WALLET_RPC_HEALTH_MESSAGE);
    } else {
      // Wallets that simulate the batch refuse it here when a call reverts.
      hasBatchFailed.value = true;
      toastStore.errorToast(
        "The wallet could not send the finalize and NAV update together.",
      );
    }
    return "stopped";
  }

  toastStore.addToast(SUBMITTED_TOAST);
  try {
    const result = await waitForWalletCalls(provider, batchId);
    if (isWalletCallsSuccess(result)) return "success";
    // Atomic: a reverted NAV update took the finalize with it.
    hasBatchFailed.value = true;
    toastStore.errorToast(
      "Finalizing with the first NAV update has failed. The vault is not finalized.",
    );
  } catch (error: any) {
    if (error instanceof WalletCallsTimeoutError) {
      toastStore.addToast(
        "The transaction is taking longer than expected. Reload this page once it confirms.",
      );
    } else if (isWalletRpcHealthError(error)) {
      toastStore.errorToast(WALLET_RPC_HEALTH_MESSAGE);
    } else {
      console.error("Finalize batch failed", error);
      toastStore.errorToast(
        "There has been an error. Please contact the Rethink Finance community for support.",
      );
    }
  }
  return "stopped";
};

const finalizeCreateFund = async ({ skipFirstNav = false } = {}) => {
  console.warn("finalizeCreateFund");
  if (isFinalizingFundCreation.value) return;
  if (!fundChainId.value) {
    return toastStore.errorToast("Fund chain ID not set.");
  }

  if (!fundFactoryContract.value) {
    console.error("No fund factory contract value");
    return toastStore.errorToast(
      `Cannot create fund on chain ${fundChainId.value}.`,
    );
  }
  isFinalizingFundCreation.value = true;
  hasBatchFailed.value = false;

  if (isReturnRoleLeftOpen.value) {
    isFinalizingFundCreation.value = false;
    return toastStore.errorToast(RETURN_ROLE_OPEN_MESSAGE);
  }
  const returnRoleState = await returnRoleStateOnChain();
  if (returnRoleState !== "closed") {
    isFinalizingFundCreation.value = false;
    if (returnRoleState === "open") {
      isReturnRoleLeftOpen.value = true;
      return toastStore.errorToast(RETURN_ROLE_OPEN_MESSAGE);
    }
    return toastStore.errorToast(
      "Could not confirm that the test-funds return permission is removed. Check your connection and try again.",
    );
  }

  try {
    // Resolved again at click time: the wallet may have changed since mount.
    const plan = skipFirstNav ? undefined : await refreshFirstNavPlan();
    const route = plan && plan.mode !== "none" ? plan.route : undefined;

    if (route && plan?.mode === "atomic") {
      const outcome = await sendFinalizeBatch(route);
      if (outcome === "success") {
        return markFinalized(
          "Fund was created and its first NAV update recorded in one transaction.",
        );
      }
      if (outcome === "stopped") return;
      toastStore.addToast(
        "This wallet cannot batch. Finalize first, then confirm the NAV update right after.",
      );
    }

    const isFinalized = await settle(
      fundFactoryContract.value.send("finalizeCreateFund", {}, []),
    );
    if (!isFinalized) return toastStore.errorToast(FINALIZE_FAILED_TOAST);
    if (!route) return markFinalized("Fund was created successfully.");

    // Not atomic, so make the gap as short as it can be: the NAV update is
    // prompted the moment the finalize is mined.
    const isNavRecorded = await settle(
      sendRoleExecution(
        fundChainId.value as ChainId,
        route.rolesModAddress,
        { to: fundAddress.value, data: encodeFirstNavUpdate(navExecutorAddress.value) },
        route.role,
        route.version as RolesVersion,
      ),
    );
    if (!isNavRecorded) {
      toastStore.errorToast(
        "The vault is finalized, but its first NAV update did not go through. Deposits settle instantly until one is recorded — update NAV from the vault's NAV page now.",
      );
    }
    markFinalized(
      isNavRecorded
        ? "Fund was created and its first NAV update recorded."
        : "Fund was created successfully.",
    );
  } catch (error: any) {
    console.error(error);
    toastStore.errorToast("There was an error finalizing the vault");
  } finally {
    isFinalizingFundCreation.value = false;
  }
};

// TODO to be safe we could already start doing this check after: isFinalizingFundCreation
watch(
  () => isFundCreateFinalized.value,
  (isFinalized: boolean) => {
    if (!isFinalized) return;
    // If fund was finalized, we can try fetching fund settings and if the node
    // is synced already we can redirect the user to the fund details page.
    navigateToFundDetailsAfterFinalizedSuccessfully();
  },
);

const navigateToFundDetailsAfterFinalizedSuccessfully = async () => {
  if (!isFundCreateFinalized.value) return;
  // If fund was finalized, we can try fetching fund settings and if the node
  // is synced already we can redirect the user to the fund details page.
  isFetchingNewlyCreatedFundSettings.value = true;
  const fundSettingsData = await fundStore.fetchFundSettings(
    fundChainId.value,
    fundSettings?.value?.fundAddress || "",
  );
  console.log("fundSettingsData", fundSettingsData);

  // If fund address is set already in the fund settings, it means that
  // node has data already, and we can redirect to fund details.
  if (isZeroAddress(fundSettingsData?.fundAddress)) {
    // Sleep for 1 second before continuing
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await navigateToFundDetailsAfterFinalizedSuccessfully();
  } else {
    isFetchingNewlyCreatedFundSettings.value = false;

    // Redirect to fund details page.
    navigateToFundDetails(
      fundChainId.value,
      fundSettings?.value?.fundSymbol || "",
      fundSettings?.value?.fundAddress || "",
    );
  }
};

// The button lives in the page's sticky footer with every other step's primary.
defineExpose({
  finalize: () => finalizeCreateFund(),
  isFinalizing: isFinalizingFundCreation,
  isDone: isFundCreateFinalized,
  isBlocked: isReturnRoleLeftOpen,
});
</script>

<style scoped lang="scss">
.onboarding_finalize {
  /* The two transient states are a line and a spinner and stay centred; the
     pre-launch read is a full-width column, so the centring lives on the
     state block rather than on the step. */
  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 0;
    text-align: center;
  }

  &__badge {
    padding: 0.25rem 0.5rem;
    border: 1px solid $color-yield-line;
    border-radius: $default-border-radius;
    background: $color-yield-soft;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-yield;
  }

  &__lead {
    margin-top: 1rem;
    font-size: 15px;
    line-height: 1.5;
    color: $color-white;
  }

  &__name {
    color: $color-cyan;
  }

  &__body {
    max-width: 56ch;
    margin-top: 0.625rem;
    font-size: 13.5px;
    line-height: 1.6;
    color: $color-steel-blue;
  }

  &__spinner {
    margin-top: 1.25rem;
    color: $color-cyan;
  }

  &__link {
    margin-top: 1.25rem;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;

    &:visited,
    &:hover,
    &:active {
      color: $color-cyan;
    }
  }
}

.preflight {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0.5rem 0 0.25rem;

  &__head {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__eyebrow {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__title {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  &__lead {
    max-width: 72ch;
    font-size: 13.5px;
    line-height: 1.6;
    color: $color-steel-blue;
  }

  /* The recommendation itself, in the one tone the flow reserves for "this
     is your last chance to change it". */
  /* One line on what the Finalize button will send. */
  &__nav {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin: 0.75rem 0 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: $color-steel-blue;

    svg {
      flex: none;
      margin-top: 0.15rem;
    }

    &--warn svg {
      color: $color-warn;
    }
  }

  &__notice {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
    border: 1px solid $color-warn-line;
    border-radius: $default-border-radius;
    background: $color-warn-soft;
  }

  &__notice_glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: $color-gray-light-transparent;
    color: $color-warn;
  }

  &__notice_text {
    min-width: 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: $color-steel-blue;

    strong {
      font-weight: 600;
      color: $color-white;
    }
  }

  /* Step 1 holds the left column for its whole height; steps 2 and 3 stack
     on the right. The funds form needs no more width than its amount and
     button, so that column is capped and the other takes the rest. */
  &__steps {
    display: grid;
    grid-template-columns: minmax(0, 23rem) minmax(0, 1fr);
    grid-template-areas:
      "funds run"
      "funds check";
    // Spare height from a tall step 1 goes under step 3, not between 2 and 3.
    grid-template-rows: auto 1fr;
    align-items: start;
    gap: 1.75rem 2.5rem;
    margin: 0;
    padding: 0;
    list-style: none;

    @media (max-width: 900px) {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        "funds"
        "run"
        "check";
      grid-template-rows: none;
      gap: 1.75rem;
    }
  }

  &__step {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    grid-area: run;

    &--funds {
      grid-area: funds;
    }

    &--check {
      grid-area: check;
    }
  }

  /* Same disc the Zodiac walkthrough numbers its steps with. */
  &__step_number {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 24px;
    height: 24px;
    margin-top: 1px;
    border: 1px solid $color-cyan-line;
    border-radius: 999px;
    background: $color-cyan-tint;
    font-family: $font-mono;
    font-size: 12px;
    color: $color-cyan;
  }

  &__step_body {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
    flex: 1;
  }

  /* Whatever the step hands the user — a form, a card, a button — sits a
     beat below its title and line of text. */
  &__step_content {
    margin-top: 0.625rem;
  }

  /* The way back to NAV methods: a real button, not a link in a sentence,
     because going back is the step. */
  &__back {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    gap: 0.5rem;
    height: 36px;
    padding: 0 0.875rem 0 0.75rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-size: 13px;
    font-weight: 500;
    color: $color-white;
    cursor: pointer;
    transition:
      border-color $default-transition-time ease,
      color $default-transition-time ease;

    svg {
      color: $color-cyan;
    }

    &:hover,
    &:focus-visible {
      outline: none;
      border-color: $color-cyan-line;
      color: $color-cyan;
    }
  }

  &__step_title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: $color-white;
  }

  &__step_text {
    font-size: 13.5px;
    line-height: 1.6;
    color: $color-steel-blue;
  }

}

/* The two ways to run the test, as rows of one card. */
.paths {
  display: flex;
  flex-direction: column;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.125rem;

    + .paths__row {
      border-top: 1px solid $color-line;
    }
  }

  /* The card's name on the left, its way out on the right. */
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  /* A wordmark, not a disc: the file is the name set wide. */
  &__logo {
    width: auto;
    height: 18px;
  }

  /* The monochrome white PNG inverts to ink on the light theme. :global
     because data-theme sits on <html>, outside this component's scope. */
  :global([data-theme="light"] .paths__logo) {
    filter: invert(1);
  }

  /* The other card has no wordmark, so it sets its name to the same height. */
  &__mark {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    height: 18px;
    font-size: 14px;
    font-weight: 600;
    color: $color-white;
  }

  &__glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 18px;
    height: 18px;
    color: $color-cyan;
  }

  &__text {
    flex: 1;
    font-size: 13px;
    line-height: 1.6;
    color: $color-steel-blue;
  }

  /* Where to paste the Safe in Zodiac: the sentence, then the address on
     its own row with its copy action — set like the walkthrough's step 2. */
  &__safe {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 13px;
    line-height: 1.6;
    color: $color-steel-blue;
  }

  &__safe_lead {
    color: $color-white;
  }

  &__nav {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    vertical-align: baseline;
    margin: 0 0.125rem;
    padding: 0.0625rem 0.4375rem 0.0625rem 0.3125rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-gray-light-transparent;
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.4;
    color: $color-white;
    white-space: nowrap;
  }

  &__nav_icon {
    flex: none;
    width: 14px;
    height: 14px;
    color: $color-secondary;
  }

  &__safe_row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
  }

  &__safe_address {
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-cyan;
    word-break: break-all;

    &--pending {
      color: $color-steel-blue;
    }
  }

  &__copy {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    flex: none;
    padding: 0;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-white;
    }
  }

  &__link {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.375rem;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
    text-decoration: none;
    transition: color $default-transition-time ease;

    &--button {
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
    }

    &:visited {
      color: $color-cyan;
    }

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-white;
    }
  }

}

@media (prefers-reduced-motion: reduce) {
  .preflight__back,
  .paths__copy,
  .paths__link {
    transition: none;
  }
}
</style>
