<template>
  <!--
    A HyperEVM vault's Hyperliquid account, set up without a script: is it
    activated, which API wallets trade it, and does it carry the RETHINK
    referral. Registering goes through the vault's Roles modifier like every
    other button on this page; the referral is signed in this tab with an
    API wallet's key (hyperliquidSetup.ts).
  -->
  <div class="hl_setup">
    <div class="group_title hl_setup__section">
      Hyperliquid
      <v-btn
        variant="text"
        size="small"
        class="hl_setup__refresh"
        :loading="isLoading"
        @click="loadAll"
      >
        Refresh
      </v-btn>
    </div>

    <!-- 1 · The account the API wallets trade -->
    <div class="main_card hl_setup__card">
      <UiHeader>
        <div class="main_header__title">
          Account
        </div>
      </UiHeader>
      <p v-if="accountError" class="hl_setup__error">
        {{ accountError }}
      </p>
      <p v-else-if="!account" class="hl_setup__muted">
        Reading the vault's Hyperliquid account…
      </p>
      <dl v-else-if="account.activated" class="hl_setup__facts">
        <div>
          <dt>Status</dt>
          <dd class="hl_setup__ok">
            Active
          </dd>
        </div>
        <div>
          <dt>Spot USDC</dt>
          <dd>{{ usdc(account.spotUsdc) }}</dd>
        </div>
        <div>
          <dt>Perp account value</dt>
          <dd>{{ usdc(account.perpValue) }}</dd>
        </div>
      </dl>
      <div v-else class="hl_setup__todo">
        <p>
          Not activated yet. From any Hyperliquid account, send 2 USDC to the
          vault Safe's address on Hyperliquid (app.hyperliquid.xyz → Send).
          Hyperliquid keeps 1 USDC as its fee for a new account, and until the
          account exists it ignores everything below.
        </p>
        <span class="hl_setup__mono">
          {{ safe }}
          <ExecutionCopyAddress :address="safe" what="the vault Safe's address" />
        </span>
      </div>
    </div>

    <!-- 2 · API wallets -->
    <div class="main_card hl_setup__card">
      <UiHeader>
        <div class="main_header__title">
          API wallets
        </div>
      </UiHeader>
      <p class="hl_setup__lead">
        API wallets trade this account through Hyperliquid's API: they place
        and cancel orders, and can never withdraw. The manager can register
        the API wallet entered in the vault's Hyperliquid permission; an admin
        whose role may rotate API wallets can register any address. Each
        registration lasts {{ API_WALLET_MIN_DAYS }} to
        {{ API_WALLET_MAX_DAYS }} days.
      </p>

      <div class="hl_setup__slots">
        <p v-if="walletsError" class="hl_setup__error">
          {{ walletsError }}
        </p>
        <p v-else-if="!wallets" class="hl_setup__muted">
          Reading the API wallets…
        </p>
        <p v-else-if="!wallets.length" class="hl_setup__muted">
          No API wallet registered.
        </p>
        <div v-for="slot in wallets ?? []" :key="slot.name" class="hl_setup__slot">
          <span
            class="hl_setup__dot"
            :class="{ 'hl_setup__dot--warn': expiresSoon(slot) }"
          />
          <span class="hl_setup__slot_name">{{ slot.name || "unnamed" }}</span>
          <span class="hl_setup__mono" :title="slot.address">
            {{ short(slot.address) }}
            <ExecutionCopyAddress :address="slot.address" what="this API wallet's address" />
          </span>
          <span class="hl_setup__dim">{{ expiryText(slot) }}</span>
          <v-btn
            variant="text"
            size="small"
            class="hl_setup__slot_action"
            :disabled="!canExecute || isBusy"
            :title="disabledReason"
            :loading="removing === slot.name"
            @click="remove(slot)"
          >
            Remove
          </v-btn>
        </div>
      </div>

      <div class="inputs">
        <v-row>
          <v-col cols="12" sm="6">
            <v-label class="mb-2">
              API wallet address
            </v-label>
            <v-text-field
              v-model="form.address"
              placeholder="0x…"
              :error-messages="addressProblem"
              autocomplete="off"
              spellcheck="false"
            />
          </v-col>
          <v-col cols="6" sm="3">
            <v-label class="mb-2">
              Name
            </v-label>
            <v-text-field
              v-model="form.name"
              :error-messages="nameProblem"
              :hint="replacesHint"
              persistent-hint
              autocomplete="off"
            />
          </v-col>
          <v-col cols="6" sm="3">
            <v-label class="mb-2">
              Valid for
            </v-label>
            <v-text-field
              v-model="form.days"
              type="number"
              suffix="days"
              :min="API_WALLET_MIN_DAYS"
              :max="API_WALLET_MAX_DAYS"
              step="1"
              :error-messages="daysProblem"
            />
          </v-col>
        </v-row>
        <div class="hl_setup__actions">
          <p v-if="registerNote" :class="registerFailed ? 'hl_setup__error' : 'hl_setup__note'">
            {{ registerNote }}
          </p>
          <v-tooltip location="bottom" :disabled="!registerBlockedReason">
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps">
                <v-btn
                  color="primary"
                  variant="outlined"
                  :disabled="!!registerBlockedReason"
                  :loading="isRegistering"
                  @click="register"
                >
                  Register
                </v-btn>
              </span>
            </template>
            {{ registerBlockedReason }}
          </v-tooltip>
        </div>
      </div>
    </div>

    <!-- 3 · The RETHINK referral -->
    <div class="main_card hl_setup__card">
      <UiHeader>
        <div class="main_header__title">
          RETHINK referral
        </div>
      </UiHeader>
      <p v-if="referralError" class="hl_setup__error">
        {{ referralError }}
      </p>
      <p v-else-if="!referral" class="hl_setup__muted">
        Reading the account's referral…
      </p>
      <p v-else-if="referral.isRethink" class="hl_setup__ok">
        Set. This account trades under the {{ RETHINK_CODE }} referral.
      </p>
      <template v-else>
        <p v-if="referral.code" class="hl_setup__warn">
          This account is referred by {{ referral.code }}, not {{ RETHINK_CODE }}.
          Hyperliquid does not document whether a referral can be changed;
          trying below shows what it answers.
        </p>
        <p class="hl_setup__lead">
          Every rethink vault's Hyperliquid account carries the {{ RETHINK_CODE }}
          referral, set once, before the first trade. Hyperliquid only accepts
          it signed by one of the account's API wallets, so paste that wallet's
          private key. It signs this one request in this tab and is then
          dropped: it is never stored, and only the signature goes to
          Hyperliquid.
        </p>
        <div class="inputs">
          <v-label class="mb-2">
            API wallet private key
          </v-label>
          <!-- Masked, but deliberately not a password field: browsers offer
               to save what is typed into one, and a private key must not end
               up in a password manager. -->
          <v-text-field
            v-model="referralKey"
            class="hl_setup__secret"
            placeholder="0x…"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="hl_setup__actions">
          <p v-if="referralNote" :class="referralFailed ? 'hl_setup__error' : 'hl_setup__note'">
            {{ referralNote }}
          </p>
          <v-btn
            color="primary"
            variant="outlined"
            :disabled="!referralKey.trim() || isSettingReferral"
            :loading="isSettingReferral"
            @click="setReferral"
          >
            Set {{ RETHINK_CODE }} referral
          </v-btn>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RETHINK_HYPERLIQUID_REFERRAL_CODE } from "@rethink-finance/positions-registry";
import { ethers } from "ethers";
import {
  API_WALLET_MAX_DAYS,
  API_WALLET_MIN_DAYS,
  apiWalletNameProblem,
  apiWalletValidUntil,
  daysLeft,
  fetchApiWallets,
  fetchHyperliquidAccount,
  fetchReferral,
  registerApiWalletCall,
  removeApiWalletCall,
  setRethinkReferral,
  waitForApiWallet,
  type IApiWalletSlot,
  type IHyperliquidAccount,
  type IReferralState,
} from "~/composables/execution/hyperliquidSetup";
import { useCuratorExecution } from "~/composables/permissions/useCuratorExecution";
import type { IRoleCall } from "~/composables/permissions/useRoleExecution";
import { describeRailError } from "~/composables/useTransactionRail";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";

const RETHINK_CODE = RETHINK_HYPERLIQUID_REFERRAL_CODE;

const fundStore = useFundStore();
const toastStore = useToastStore();
const { canExecute, disabledReason, sendAsCurator } = useCuratorExecution();

const safe = computed(() => fundStore.fund?.safeAddress ?? "");

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const usdc = (amount: number) =>
  `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`;
const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const describeRead = (error: any) =>
  `Could not read it from Hyperliquid: ${error?.message ?? error}`;

/* ---- Reads ---------------------------------------------------------------- */

const account = ref<IHyperliquidAccount | null>(null);
const accountError = ref("");
const wallets = ref<IApiWalletSlot[] | null>(null);
const walletsError = ref("");
const referral = ref<IReferralState | null>(null);
const referralError = ref("");
const isLoading = ref(false);

const loadWallets = async () => {
  try {
    wallets.value = await fetchApiWallets(safe.value);
    walletsError.value = "";
  } catch (error) {
    walletsError.value = describeRead(error);
  }
};

const loadAll = async () => {
  if (!safe.value) return;
  isLoading.value = true;
  const [accountRead, , referralRead] = await Promise.allSettled([
    fetchHyperliquidAccount(safe.value),
    loadWallets(),
    fetchReferral(safe.value),
  ]);
  if (accountRead.status === "fulfilled") {
    account.value = accountRead.value;
    accountError.value = "";
  } else {
    accountError.value = describeRead(accountRead.reason);
  }
  if (referralRead.status === "fulfilled") {
    referral.value = referralRead.value;
    referralError.value = "";
  } else {
    referralError.value = describeRead(referralRead.reason);
  }
  isLoading.value = false;
};

watch(safe, loadAll, { immediate: true });

/* ---- Registering and removing API wallets --------------------------------- */

const expiresSoon = (slot: IApiWalletSlot) =>
  !!slot.validUntil && daysLeft(slot.validUntil) < API_WALLET_MIN_DAYS;
const expiryText = (slot: IApiWalletSlot) =>
  slot.validUntil
    ? `until ${formatDate(slot.validUntil)} · ${daysLeft(slot.validUntil)} days`
    : "no expiry";

const form = reactive({
  address: "",
  name: "main",
  days: String(API_WALLET_MAX_DAYS),
});
const isRegistering = ref(false);
const registerNote = ref("");
const registerFailed = ref(false);
// The name of the slot being emptied, while it is.
const removing = ref("");
const isBusy = computed(() => isRegistering.value || removing.value !== "");

const addressProblem = computed(() =>
  form.address.trim() && !ethers.isAddress(form.address.trim()) ? "Not an address." : "",
);
const nameProblem = computed(() => (form.name ? apiWalletNameProblem(form.name) : ""));
const daysProblem = computed(() => {
  const days = Number(form.days);
  return Number.isInteger(days) && days >= API_WALLET_MIN_DAYS && days <= API_WALLET_MAX_DAYS
    ? ""
    : `${API_WALLET_MIN_DAYS} to ${API_WALLET_MAX_DAYS} days.`;
});
/** A name in use is Hyperliquid's way of swapping keys: say so before it happens. */
const replacesHint = computed(() => {
  const taken = wallets.value?.find((slot) => slot.name === form.name.trim());
  return taken
    ? `Replaces ${short(taken.address)}, registered under this name.`
    : "A name already in use replaces that wallet.";
});

const registerBlockedReason = computed(() => {
  if (!canExecute.value) return disabledReason.value;
  if (account.value && !account.value.activated) {
    return "Activate the vault's Hyperliquid account first.";
  }
  if (!form.address.trim() || addressProblem.value) return "Enter the API wallet's address.";
  return apiWalletNameProblem(form.name) || daysProblem.value;
});

/**
 * Send `call` through the vault's Roles modifier and wait for its block. The
 * modifier is dry-run first (useCuratorExecution), so an address the
 * vault's permission does not allow is refused before the wallet opens.
 */
const sendThroughRole = (call: IRoleCall) =>
  new Promise<void>((resolve, reject) => {
    sendAsCurator(call)
      .on("transactionHash", () =>
        toastStore.addToast("Sent. Waiting for it to be confirmed."),
      )
      .then(
        (receipt: any) =>
          receipt?.status ? resolve() : reject(new Error("The transaction reverted.")),
        reject,
      );
  });

const register = async () => {
  if (registerBlockedReason.value || isBusy.value) return;
  isRegistering.value = true;
  registerFailed.value = false;
  try {
    const address = ethers.getAddress(form.address.trim());
    const validUntil = apiWalletValidUntil(Number(form.days));
    registerNote.value = "Confirm the transaction in your wallet.";
    await sendThroughRole(registerApiWalletCall(address, form.name, validUntil));
    registerNote.value = "Confirmed on HyperEVM. Waiting for Hyperliquid to list it…";
    if (await waitForApiWallet(address, safe.value)) {
      registerNote.value = `Registered: ${short(address)} trades this account until ${formatDate(validUntil)}.`;
      form.address = "";
    } else {
      registerFailed.value = true;
      registerNote.value =
        "The transaction went through, but Hyperliquid has not listed the wallet. " +
        "It drops a request it refuses without a word, most often because the " +
        "account is not activated yet.";
    }
    await loadWallets();
  } catch (error) {
    registerFailed.value = true;
    registerNote.value = describeRailError(error);
  } finally {
    isRegistering.value = false;
  }
};

const remove = async (slot: IApiWalletSlot) => {
  if (isBusy.value) return;
  removing.value = slot.name;
  try {
    await sendThroughRole(removeApiWalletCall(slot.name));
    const removed = await waitForApiWallet(slot.address, safe.value, { listed: false });
    if (removed) toastStore.successToast(`Removed ${short(slot.address)}.`);
    else toastStore.warningToast("Sent, but Hyperliquid still lists the wallet. Refresh in a minute.");
  } catch (error) {
    toastStore.errorToast(describeRailError(error));
  } finally {
    removing.value = "";
    await loadWallets();
  }
};

/* ---- The referral --------------------------------------------------------- */

const referralKey = ref("");
const isSettingReferral = ref(false);
const referralNote = ref("");
const referralFailed = ref(false);

const setReferral = async () => {
  // Off the screen at once; the function below is the only holder now.
  const key = referralKey.value;
  referralKey.value = "";
  isSettingReferral.value = true;
  referralFailed.value = false;
  referralNote.value = "Signing and sending…";
  try {
    await setRethinkReferral(key, safe.value);
    referralNote.value = "Sent. Reading it back from Hyperliquid…";
    for (let attempt = 0; attempt < 5; attempt++) {
      referral.value = await fetchReferral(safe.value);
      if (referral.value.isRethink) break;
      await sleep(1500);
    }
    referralNote.value = referral.value?.isRethink
      ? ""
      : "Hyperliquid took the request but does not show the referral on the account yet. Refresh in a minute.";
  } catch (error) {
    referralFailed.value = true;
    referralNote.value = describeRailError(error);
  } finally {
    isSettingReferral.value = false;
  }
};
</script>

<style scoped lang="scss">
.hl_setup {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;

  &__section {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__refresh {
    color: $color-text-irrelevant !important;
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  &__lead,
  &__muted,
  &__note,
  &__todo p {
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__muted {
    color: $color-text-irrelevant;
  }

  &__ok {
    color: $color-cyan;
  }

  &__warn {
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-warn;
  }

  &__error {
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-neg;
    word-break: break-word;
  }

  &__facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 1rem;

    dt {
      font-family: $font-mono;
      font-size: 10.5px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: $color-steel-blue;
    }

    dd {
      margin-top: 0.25rem;
      font-family: $font-mono;
      font-size: $text-sm;
    }
  }

  &__todo {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__mono {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-family: $font-mono;
    font-size: $text-sm;
    word-break: break-all;
  }

  &__dim {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-text-irrelevant;
  }

  &__slots {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__slot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
  }

  &__slot_name {
    font-weight: 600;
  }

  &__slot_action {
    margin-left: auto;
  }

  &__dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background: $color-cyan;

    &--warn {
      background: $color-warn;
    }
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;

    p {
      flex: 1 1 16rem;
    }
  }

  &__secret :deep(input) {
    -webkit-text-security: disc;
  }
}
</style>
