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
        </header>

        <!--
          What the deployed contracts hold, read off the chain rather than off
          the form. The form refuses these values on the way in; this is the
          net under it, for a build that got a conversion wrong or a form that
          was bypassed. Nothing finalizes until every line passes.
        -->
        <section class="checks" aria-live="polite">
          <header class="checks__head">
            <div class="checks__titles">
              <span class="preflight__eyebrow">Contract checks</span>
              <h3 class="checks__title">
                What the deployed contracts hold
              </h3>
              <p class="checks__lead">
                Read from the vault's governor and settings on {{ chainName }},
                not from this form. Finalizing stays off until every line passes.
              </p>
            </div>
            <span
              class="checks__summary"
              :class="`checks__summary--${checksSummary.tone}`"
            >
              {{ checksSummary.label }}
            </span>
          </header>

          <ul v-if="checks?.length" class="checks__list">
            <li
              v-for="check in checks"
              :key="check.key"
              class="checks__row"
              :class="`checks__row--${check.status}`"
            >
              <span class="checks__glyph" aria-hidden="true">
                <Icon :icon="CHECK_ICONS[check.status]" width="1rem" />
              </span>
              <span class="checks__label">{{ check.label }}</span>
              <span class="checks__actual">{{ check.actual }}</span>
              <span class="checks__requirement">{{ check.requirement }}</span>
            </li>
          </ul>

          <p v-else-if="checksLoading" class="checks__pending">
            <v-progress-circular size="14" width="2" indeterminate />
            Reading the governor and the vault…
          </p>

          <div v-if="checksError && !checksLoading" class="checks__problem">
            <p class="checks__problem_text">
              <strong>The contracts could not be read.</strong>
              {{ checksError }}
            </p>
            <button
              type="button"
              class="paths__link paths__link--button"
              @click="emit('retry-checks')"
            >
              <Icon
                icon="material-symbols:refresh-rounded"
                width="0.9375rem"
                aria-hidden="true"
              />
              Read again
            </button>
          </div>

          <div v-else-if="hasFailedCheck" class="checks__problem checks__problem--fail">
            <p class="checks__problem_text">
              <strong>Finalizing is disabled.</strong>
              The vault was deployed with a value outside the limits above.
              Those values are fixed once the vault is live, so correct them on
              their step and initialize the vault again — the steps have been
              reopened for editing.
            </p>
            <div class="checks__problem_actions">
              <button
                v-if="failedStepKeys.includes(OnboardingStep.Governance)"
                type="button"
                class="paths__link paths__link--button"
                @click="emit('go-to-step', OnboardingStep.Governance)"
              >
                <Icon
                  icon="material-symbols:arrow-back-rounded"
                  width="0.9375rem"
                  aria-hidden="true"
                />
                Back to governance
              </button>
              <button
                v-if="failedStepKeys.includes(OnboardingStep.Fee)"
                type="button"
                class="paths__link paths__link--button"
                @click="emit('go-to-step', OnboardingStep.Fee)"
              >
                <Icon
                  icon="material-symbols:arrow-back-rounded"
                  width="0.9375rem"
                  aria-hidden="true"
                />
                Back to fees
              </button>
            </div>
          </div>

          <div v-else-if="hasUnknownCheck && !checksLoading" class="checks__problem">
            <p class="checks__problem_text">
              <strong>One of the values could not be decided.</strong>
              Finalizing stays off until it reads. Usually the chain's block
              time did not come back; reading again tends to settle it.
            </p>
            <button
              type="button"
              class="paths__link paths__link--button"
              @click="emit('retry-checks')"
            >
              <Icon
                icon="material-symbols:refresh-rounded"
                width="0.9375rem"
                aria-hidden="true"
              />
              Read again
            </button>
          </div>
        </section>

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

        <ol class="preflight__steps">
          <li class="preflight__step">
            <span class="preflight__step_number">1</span>
            <div class="preflight__step_body">
              <h3 class="preflight__step_title">
                Send test {{ baseSymbol || "denomination asset" }}
              </h3>
              <p class="preflight__step_text">
                A small amount from your wallet to the vault's Safe on
                {{ chainName }}.
              </p>

              <!--
                The transfer itself, from the connected wallet: a plain ERC20
                transfer to the Safe, so the test position can be opened
                without leaving the flow. The address stays on the panel —
                a wallet that is not the one connected here still needs it.
              -->
              <div class="send">
                <div class="send__main">
                  <label class="send__field">
                    <input
                      v-model="amount"
                      class="send__input"
                      type="text"
                      inputmode="decimal"
                      placeholder="0.00"
                      aria-label="Amount to send"
                      :disabled="isSending"
                    >
                    <span class="send__symbol">{{ baseSymbol || "Token" }}</span>
                  </label>

                  <div class="send__presets" role="group" aria-label="Preset amounts">
                    <button
                      v-for="preset in presets"
                      :key="preset"
                      type="button"
                      class="send__preset"
                      :class="{ 'send__preset--on': amount === preset }"
                      :disabled="isSending"
                      @click="amount = preset"
                    >
                      {{ preset }}
                    </button>
                  </div>

                  <v-btn
                    class="send__button bg-primary text-white"
                    :loading="isSending"
                    :disabled="!canSend"
                    @click="sendDenominationAsset"
                  >
                    Send
                  </v-btn>
                </div>

                <div class="send__meta">
                  <span class="send__meta_item">
                    <span class="send__meta_label">Balance</span>
                    <span class="send__meta_value">
                      {{ walletBalance !== undefined ? `${walletBalanceDisplay} ${baseSymbol}` : "—" }}
                    </span>
                    <button
                      v-if="walletBalance !== undefined"
                      type="button"
                      class="send__meta_action"
                      :disabled="isSending"
                      @click="amount = walletBalanceFormatted"
                    >
                      Max
                    </button>
                  </span>

                  <span class="send__meta_item">
                    <span class="send__meta_label">To Safe</span>
                    <span
                      class="send__meta_value send__meta_value--address"
                      :class="{ 'send__meta_value--pending': !safeAddress }"
                      :title="safeAddress"
                    >
                      {{ safeAddress ? truncateAddressEllipsis(safeAddress) : "not initialized" }}
                    </span>
                    <button
                      v-if="safeAddress"
                      type="button"
                      class="send__meta_action"
                      :aria-label="safeCopied ? 'Copied' : 'Copy the Safe address'"
                      @click="copySafeAddress"
                    >
                      {{ safeCopied ? "Copied" : "Copy" }}
                    </button>
                  </span>
                </div>
              </div>
            </div>
          </li>

          <li class="preflight__step">
            <span class="preflight__step_number">2</span>
            <div class="preflight__step_body">
              <h3 class="preflight__step_title">
                Test run the strategy
              </h3>

              <div class="paths">
                <!-- By hand, through Zodiac's own app: the wordmark is the
                     name, as on the permissions step's library. -->
                <div class="paths__card">
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
                      and import the Safe contract:
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
                        :aria-label="safeCopied ? 'Copied' : 'Copy the Safe contract address'"
                        @click="copySafeAddress"
                      >
                        {{ safeCopied ? "Copied" : "Copy" }}
                      </button>
                    </span>
                  </div>
                </div>

                <!-- Or by code, against the same role. -->
                <div class="paths__card">
                  <div class="paths__head">
                    <span class="paths__mark">
                      <span class="paths__glyph" aria-hidden="true">
                        <Icon icon="material-symbols:code-rounded" width="1rem" />
                      </span>
                      Algorithmic
                    </span>
                    <a
                      class="paths__link"
                      :href="DOCS_URL"
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

          <li class="preflight__step">
            <span class="preflight__step_number">3</span>
            <div class="preflight__step_body">
              <h3 class="preflight__step_title">
                Check the simulated values
              </h3>
              <p class="preflight__step_text">
                With dust amounts sitting in the test positions, go back to
                NAV methods and confirm each method returns the right value.
              </p>
              <button
                type="button"
                class="paths__link paths__link--button"
                @click="emit('go-to-step', OnboardingStep.NavMethods)"
              >
                <Icon
                  icon="material-symbols:arrow-back-rounded"
                  width="0.9375rem"
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
import { ethers } from "ethers";
import { ERC20 } from "assets/contracts/ERC20";
import { useToastStore } from "~/store/toasts/toast.store";
import { useAccountStore } from "~/store/account/account.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useFundStore } from "~/store/fund/fund.store";
import { networksMap } from "~/store/web3/networksMap";
import { usePageNavigation } from "~/composables/routing/usePageNavigation";
import { truncateAddressEllipsis } from "~/composables/addressUtils";
import { OnboardingStep } from "~/types/enums/stepper_onboarding";
import type { ChainId } from "~/types/enums/chain_id";
import {
  allVaultLaunchChecksPass,
  type IVaultLaunchCheck,
  type VaultLaunchCheckKey,
} from "~/composables/vaultLaunchChecks";

const props = defineProps({
  /**
   * The contract checks the page ran against the initialized vault; undefined
   * until they have been read once.
   */
  checks: {
    type: Array as PropType<IVaultLaunchCheck[]>,
    default: undefined,
  },
  checksLoading: {
    type: Boolean,
    default: false,
  },
  /** Why the checks could not be read at all, when they could not. */
  checksError: {
    type: String,
    default: "",
  },
});

const emit = defineEmits<{
  /** Back to an earlier step of the flow, to re-check it before launching. */
  (e: "go-to-step", step: OnboardingStep): void;
  /** Read the contracts again, after a failed or undecided read. */
  (e: "retry-checks"): void;
}>();

const fundStore = useFundStore();
const toastStore = useToastStore();
const createFundStore = useCreateFundStore();
const accountStore = useAccountStore();
const web3Store = useWeb3Store();

const { fundChainId, fundSettings, fundFactoryContract } =
  storeToRefs(createFundStore);
const { navigateToFundDetails } = usePageNavigation();

/** Zodiac's own app: permissions and manual execution for any protocol. */
const ZODIAC_APP_URL = "https://app.zodiac.eco/";
const DOCS_URL = "https://docs.rethink.finance/rethink.finance";

const CHECK_ICONS: Record<IVaultLaunchCheck["status"], string> = {
  pass: "material-symbols:check-rounded",
  fail: "material-symbols:close-rounded",
  unknown: "material-symbols:question-mark-rounded",
};

/** Which step each check's value was typed on, for the way back to it. */
const CHECK_STEPS: Record<VaultLaunchCheckKey, OnboardingStep> = {
  quorum: OnboardingStep.Governance,
  votingPeriod: OnboardingStep.Governance,
  performanceFee: OnboardingStep.Fee,
  managementFee: OnboardingStep.Fee,
  depositFee: OnboardingStep.Fee,
  withdrawFee: OnboardingStep.Fee,
};

const checksPassed = computed(
  () => !!props.checks && allVaultLaunchChecksPass(props.checks),
);
const hasFailedCheck = computed(
  () => !!props.checks?.some((check) => check.status === "fail"),
);
const hasUnknownCheck = computed(
  () => !!props.checks?.some((check) => check.status === "unknown"),
);
const failedStepKeys = computed(() =>
  (props.checks ?? [])
    .filter((check) => check.status === "fail")
    .map((check) => CHECK_STEPS[check.key]),
);

const checksSummary = computed<{ label: string; tone: string }>(() => {
  if (props.checksLoading) return { label: "Reading", tone: "pending" };
  if (props.checksError) return { label: "Not read", tone: "unknown" };
  if (!props.checks) return { label: "Not read", tone: "unknown" };
  if (hasFailedCheck.value) {
    const count = props.checks.filter((check) => check.status === "fail").length;
    return { label: `${count} failed`, tone: "fail" };
  }
  if (hasUnknownCheck.value) return { label: "Undecided", tone: "unknown" };
  return { label: "All passed", tone: "pass" };
});

const isFetchingNewlyCreatedFundSettings = ref(false);
const isFinalizingFundCreation = ref(false);
const isFundCreateFinalized = ref(false);

const safeAddress = computed(() => fundSettings?.value?.safe ?? "");
const baseSymbol = computed(() => fundSettings?.value?.baseSymbol ?? "");
/** Named in the funding step, so the asset is not sent on the wrong network. */
const chainName = computed(
  () => networksMap[fundChainId.value as ChainId]?.chainName ?? "this network",
);

/**
 * The amounts offered as one click. A test position is meant to be small, so
 * the ladder is set by what the denomination asset is worth per unit rather
 * than by its decimals — three digits of USDC and three digits of WBTC are not
 * the same test.
 */
const PRESETS_BY_SYMBOL: Record<string, string[]> = {
  btc: ["0.001", "0.005", "0.01"],
  eth: ["0.01", "0.05", "0.1"],
  stable: ["1", "5", "10"],
};

const presetGroup = (symbol: string): keyof typeof PRESETS_BY_SYMBOL => {
  const ticker = symbol.toUpperCase();
  if (ticker.includes("BTC")) return "btc";
  if (ticker.includes("ETH")) return "eth";
  return "stable";
};

const presets = computed(() => PRESETS_BY_SYMBOL[presetGroup(baseSymbol.value)]);

const amount = ref("");
const isSending = ref(false);
const walletBalance = ref<bigint | undefined>(undefined);

const baseTokenAddress = computed(() => fundSettings?.value?.baseToken ?? "");
const baseDecimals = computed<number | undefined>(
  () => fundSettings?.value?.baseDecimals,
);

const baseTokenContract = computed(() => {
  if (!baseTokenAddress.value || !fundChainId.value) return undefined;
  return web3Store.getCustomContract(
    fundChainId.value,
    ERC20,
    baseTokenAddress.value,
  );
});

/** Uncommified and exact, so Max types a value the input accepts. */
const walletBalanceFormatted = computed(() =>
  formatTokenValue(walletBalance.value, baseDecimals.value, false),
);

/** What the line reads: commified, rounded — a balance, not a calldata. */
const walletBalanceDisplay = computed(() =>
  formatTokenValue(walletBalance.value, baseDecimals.value, true, true),
);

const amountWei = computed(() => {
  if (baseDecimals.value === undefined) return 0n;
  try {
    return ethers.parseUnits(amount.value || "0", baseDecimals.value);
  } catch {
    // Mid-typing values ("0.", "1.2.3") land here; the button just stays off.
    return 0n;
  }
});

const canSend = computed(
  () =>
    !isSending.value &&
    !!safeAddress.value &&
    !!baseTokenContract.value &&
    amountWei.value > 0n &&
    (walletBalance.value === undefined || amountWei.value <= walletBalance.value),
);

const fetchWalletBalance = async () => {
  const account = accountStore.activeAccountAddress;
  if (!account || !baseTokenContract.value) {
    walletBalance.value = undefined;
    return;
  }
  try {
    walletBalance.value = BigInt(
      await web3Store.callWithRetry(fundChainId.value, () =>
        baseTokenContract.value?.methods.balanceOf(account).call(),
      ),
    );
  } catch (error: any) {
    console.error("Failed reading the denomination asset balance", error);
    walletBalance.value = undefined;
  }
};

watch(
  () => [accountStore.activeAccountAddress, baseTokenAddress.value],
  () => fetchWalletBalance(),
  { immediate: true },
);

const sendDenominationAsset = async () => {
  if (!canSend.value || !baseTokenContract.value) return;
  isSending.value = true;

  try {
    await baseTokenContract.value
      .send("transfer", {}, safeAddress.value, amountWei.value)
      .on("transactionHash", () => {
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        if (receipt.status) {
          toastStore.successToast(
            `Sent ${amount.value} ${baseSymbol.value} to the vault's Safe.`,
          );
          amount.value = "";
          fetchWalletBalance();
        } else {
          toastStore.errorToast("The transfer has failed.");
        }
        isSending.value = false;
      })
      .on("error", (error: any) => {
        console.error("error sending the denomination asset", error);
        isSending.value = false;
        if (error?.code !== 4001) {
          toastStore.errorToast("The transfer has failed.");
        }
      });
  } catch (error: any) {
    console.error(error);
    isSending.value = false;
  }
};

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

const finalizeCreateFund = async () => {
  console.warn("finalizeCreateFund");
  if (!fundChainId.value) {
    return toastStore.errorToast("Fund chain ID not set.");
  }

  if (!fundFactoryContract.value) {
    console.error("No fund factory contract value");
    return toastStore.errorToast(
      `Cannot create fund on chain ${fundChainId.value}.`,
    );
  }

  // The footer's button is off until the checks pass, but this is where the
  // transaction is sent, so the refusal is repeated here rather than trusted
  // to the button's off state: what finalizes cannot be changed afterwards.
  if (!checksPassed.value) {
    return toastStore.errorToast(
      "The contract checks have not all passed, so the vault cannot be finalized yet.",
    );
  }
  isFinalizingFundCreation.value = true;

  try {
    await fundFactoryContract.value
      .send("finalizeCreateFund", {}, [])
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("Fund was created successfully.");
          isFundCreateFinalized.value = true;

          // Clear local storage for this chain.
          createFundStore.clearFundLocalStorage();
        } else {
          toastStore.errorToast(
            "The Create Fund tx has failed. Please contact the Rethink Finance community for support.",
          );
        }
      })
      .on("error", (error: any) => {
        console.error("error when initializing", error);
        isFinalizingFundCreation.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance community for support.",
        );
      });
  } catch (error: any) {
    console.error(error);
    toastStore.errorToast("There was an error initializing the vault");
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
  finalize: finalizeCreateFund,
  isFinalizing: isFinalizingFundCreation,
  isDone: isFundCreateFinalized,
  checksPassed,
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

  &__steps {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__step {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
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
    font-family: $font-mono;
    font-size: 12px;
    color: $color-cyan;
  }

  &__step_body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    flex: 1;
  }

  &__step_title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: $color-white;
  }

  &__step_text {
    max-width: 78ch;
    font-size: 13.5px;
    line-height: 1.6;
    color: $color-steel-blue;
  }

}

/* The contract checks: one line per rule, the value read beside the value
   wanted, with the pass/fail tone on the glyph rather than on the text. */
.checks {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1rem 1.125rem;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  &__titles {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: $color-white;
  }

  &__lead {
    max-width: 72ch;
    font-size: 13px;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__summary {
    flex: none;
    padding: 0.25rem 0.5rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--pass {
      border-color: $color-yield-line;
      background: $color-yield-soft;
      color: $color-yield;
    }

    &--fail {
      border-color: $color-error;
      color: $color-error;
    }

    &--unknown {
      border-color: $color-warn-line;
      background: $color-warn-soft;
      color: $color-warn;
    }
  }

  &__list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid $color-line;
  }

  &__row {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    grid-template-areas:
      "glyph label"
      "glyph values";
    align-items: center;
    column-gap: 0.75rem;
    row-gap: 0.125rem;
    padding: 0.625rem 0;
    border-bottom: 1px solid $color-line;

    @include md {
      grid-template-columns: 24px minmax(0, 1.2fr) minmax(0, 1.4fr) minmax(0, 1fr);
      grid-template-areas: "glyph label actual requirement";
    }
  }

  &__glyph {
    grid-area: glyph;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: $color-gray-light-transparent;
    color: $color-steel-blue;

    .checks__row--pass & {
      color: $color-yield;
    }

    .checks__row--fail & {
      color: $color-error;
    }

    .checks__row--unknown & {
      color: $color-warn;
    }
  }

  &__label {
    grid-area: label;
    font-size: 13.5px;
    font-weight: 600;
    color: $color-white;
  }

  /* Below the breakpoint the two values share one line under the label. */
  &__actual {
    grid-area: values;
    justify-self: start;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;

    .checks__row--fail & {
      color: $color-error;
    }

    @include md {
      grid-area: actual;
    }
  }

  &__requirement {
    grid-area: values;
    justify-self: end;
    font-size: 12.5px;
    color: $color-steel-blue;

    @include md {
      grid-area: requirement;
      justify-self: start;
    }
  }

  &__pending {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 13px;
    color: $color-steel-blue;
  }

  &__problem {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.875rem 1rem;
    border: 1px solid $color-warn-line;
    border-radius: $default-border-radius;
    background: $color-warn-soft;

    &--fail {
      border-color: $color-error;
      background: $color-gray-light-transparent;
    }
  }

  &__problem_text {
    max-width: 78ch;
    font-size: 13.5px;
    line-height: 1.6;
    color: $color-steel-blue;

    strong {
      font-weight: 600;
      color: $color-white;
    }
  }

  &__problem_actions {
    display: flex;
    gap: 1.25rem;
    flex-wrap: wrap;
  }
}

/* The transfer panel: an amount, three sizes of "small", and where it goes.
   The Safe reads truncated but copies whole — it is also the way to send
   from a wallet that is not the one connected here. */
.send {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.875rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__main {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 180px;
    max-width: 260px;
    height: 40px;
    padding: 0 0.875rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-gray-light-transparent;
    cursor: text;
    transition: border-color $default-transition-time ease;

    &:focus-within {
      border-color: $color-cyan-line;
    }
  }

  /* The global `:root input` rule sets a 2.5rem min-height and its own
     padding, so height, min-height and padding are all restated here. */
  &__input {
    width: 100%;
    min-width: 0;
    height: 38px;
    min-height: 38px;
    padding: 0;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 15px;
    color: $color-white;

    &::placeholder {
      color: $color-steel-blue;
      opacity: 0.6;
    }

    &:focus,
    &:focus-visible {
      outline: none;
    }
  }

  &__symbol {
    flex: none;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    color: $color-steel-blue;
  }

  &__presets {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  &__preset {
    height: 32px;
    padding: 0 0.75rem;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    background: none;
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-steel-blue;
    cursor: pointer;
    transition:
      border-color $default-transition-time ease,
      background-color $default-transition-time ease,
      color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      border-color: $color-cyan-line;
      color: $color-white;
    }

    &--on {
      border-color: $color-cyan-line;
      background: $color-cyan-tint;
      color: $color-cyan;
    }
  }

  &__button {
    height: 40px !important;
    min-width: 96px;
    margin-left: auto;
    font-size: 13px;
    letter-spacing: 0.02em;
    text-transform: none;
  }

  /* Two facts under the form, pushed to the corners: what the wallet has,
     where it goes. */
  &__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1.5rem;
    flex-wrap: wrap;
    padding-top: 0.75rem;
    border-top: 1px solid $color-line;
  }

  &__meta_item {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  &__meta_label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__meta_value {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-white;

    &--address {
      color: $color-cyan;
    }

    &--pending {
      color: $color-steel-blue;
    }
  }

  &__meta_action {
    flex: none;
    padding: 0.125rem 0.4375rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: none;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;
    transition:
      border-color $default-transition-time ease,
      color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      border-color: $color-cyan-line;
      color: $color-white;
    }
  }

  @media (max-width: 720px) {
    &__field {
      max-width: none;
      flex-basis: 100%;
    }

    &__button {
      margin-left: 0;
    }
  }
}

/* The two ways to run the test, side by side because neither is the
   default — one proves the permissions, the other the valuation. */
.paths {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.25rem;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
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
  .send__field,
  .send__preset,
  .send__meta_action,
  .paths__copy,
  .paths__link {
    transition: none;
  }
}
</style>
