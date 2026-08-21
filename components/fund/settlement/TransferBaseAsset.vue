<template>
  <div class="transfer_admin">
    <div class="transfer_admin__title">
      Transfer base asset to admin
      <UiInfoTooltip
        :text="`Move ${baseToken?.symbol ?? 'the base asset'} from the Safe to the admin contract to cover redemptions.`"
      />
    </div>

    <div
      class="transfer_admin__control"
      :class="{ 'transfer_admin__control--invalid': visibleErrorMessage }"
    >
      <div class="transfer_admin__prefix">
        {{ baseToken?.symbol }}
      </div>
      <UiInputNumber
        v-model="tokenValue"
        placeholder="0.00"
        hide-details
        class="transfer_admin__input"
      />
      <button
        type="button"
        class="transfer_admin__max"
        @click="setTokenValue(safeContractBaseTokenBalanceFormatted)"
      >
        Max
      </button>
    </div>
    <div v-if="visibleErrorMessage" class="transfer_admin__error">
      {{ visibleErrorMessage }}
    </div>

    <!-- Said on the page, not in a tooltip. A disabled button fires no mouse
         events, so a hover-only explanation is unreachable in exactly the
         state that needs explaining. -->
    <div v-if="blockedReason" class="transfer_admin__notice">
      {{ blockedReason }}
    </div>

    <div class="transfer_admin__foot">
      <div class="transfer_admin__caption">
        Safe balance · {{ safeContractBaseTokenBalanceDisplay }}
      </div>
      <span class="transfer_admin__action">
        <v-tooltip
          activator="parent"
          location="top"
          :disabled="!transferTooltipText"
        >
          {{ transferTooltipText }}
        </v-tooltip>
        <button
          type="button"
          class="transfer_admin__button"
          :disabled="isTransferDisabled"
          @click="transfer()"
        >
          <v-progress-circular
            v-if="isTransferLoading"
            size="14"
            width="2"
            indeterminate
          />
          Transfer
        </button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { ERC20 } from "~/assets/contracts/ERC20";
import { useCuratorExecution } from "~/composables/permissions/useCuratorExecution";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
const toastStore = useToastStore();
const fundStore = useFundStore();

// The transfer moves the custody Safe's base asset, so a curator sends it
// wrapped in the vault's Roles modifier rather than from a Pilot session.
const {
  canExecute: canExecuteAsCurator,
  disabledReason: curatorDisabledReason,
  sendAsCurator,
} = useCuratorExecution();

const erc20Iface = new ethers.Interface(ERC20 as any);

const baseToken = computed(() => {
  return fundStore.fund?.baseToken;
});

const emit = defineEmits(["update:modelValue"]);
const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
});

const tokenValue = computed({
  get: () => props?.modelValue ?? "",
  set: (value: string) => {
    emit("update:modelValue", value);
  },
});

const tokenValueChanged = ref(false);
const isTransferLoading = ref(false);
const tokensWei = computed(() => {
  if (!baseToken.value) return 0n;
  return ethers.parseUnits(tokenValue.value || "0", baseToken.value.decimals);
});

watch(
  () => tokenValue.value,
  () => {
    tokenValueChanged.value = true;
  },
);

const setTokenValue = (value: any) => {
  tokenValue.value = value;
};

const tokenValueRules = [
  (value: string) => {
    let valueWei;
    try {
      valueWei = ethers.parseUnits(value || "0", baseToken.value?.decimals);
    } catch {
      return `Make sure the value has max ${baseToken.value?.decimals} decimals.`;
    }
    if (valueWei <= 0) {
      return "Value must be positive.";
    }
    if (valueWei > safeContractBaseTokenBalance.value) {
      return "Not enough balance.";
    }
    return true;
  },
];
const errorMessages = computed(() => {
  return tokenValueRules
    .map((rule) => rule(tokenValue.value || "0"))
    .filter((rule) => rule !== true);
});
// An untouched field says nothing — no amount yet is the starting state, not
// a mistake to report.
const visibleErrorMessage = computed(() => {
  if (!tokenValueChanged.value || !tokenValue.value) return "";
  return (errorMessages.value[0] as string) || "";
});
const isTransferDisabled = computed(() => {
  return (
    errorMessages.value.length > 0 ||
    isTransferLoading.value ||
    !canExecuteAsCurator.value
  );
});
const transferTooltipText = computed(() => {
  if (curatorDisabledReason.value) return curatorDisabledReason.value;
  if (errorMessages.value.length && tokenValueChanged.value)
    return errorMessages.value[0];
  return "";
});

/**
 * Why the button cannot be pressed, when the reason is not the amount.
 *
 * The amount's own complaints already print above the button, and a reason
 * that only appears once the curator has typed something would leave the
 * untouched form silently dead.
 */
const blockedReason = computed(() => {
  if (isTransferLoading.value) return "";
  return curatorDisabledReason.value || "";
});

const safeContractBaseTokenBalance = computed(() => {
  return fundStore.fund?.safeContractBaseTokenBalance || 0n;
});
const safeContractBaseTokenBalanceFormatted = computed(() => {
  if (!baseToken.value) return "--";
  return formatTokenValue(
    safeContractBaseTokenBalance.value,
    baseToken.value?.decimals,
    false,
  );
});
const safeContractBaseTokenBalanceDisplay = computed(() => {
  if (!baseToken.value) return "--";
  return formatTokenValue(
    safeContractBaseTokenBalance.value,
    baseToken.value?.decimals,
  );
});

const transfer = async () => {
  isTransferLoading.value = true;

  try {
    const transaction = await sendAsCurator({
      to: fundStore.fund?.baseToken?.address ?? "",
      data: erc20Iface.encodeFunctionData("transfer", [
        fundStore.fundAddress,
        tokensWei.value,
      ]),
    });

    await transaction
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: ", hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt :", receipt);
        if (receipt.status) {
          toastStore.successToast("Transfer was successful.");
          // Both ends of the transfer, not just the receiving one: the Safe's
          // balance is what this control validates against and offers as Max,
          // so leaving it stale re-arms the form with money that has moved.
          // TODO repeat every 1 second, 15x until the value changes, as node sync takes some time.
          fundStore.fetchFundContractBaseTokenBalance();
          fundStore.fetchSafeContractBaseTokenBalance();
        } else {
          toastStore.errorToast(
            "The transfer has failed. Please contact the Rethink Finance support.",
          );
          // The transfer's own two balances, rather than the depositor's data:
          // a reverted transfer says nothing about the connected wallet.
          fundStore.fetchFundContractBaseTokenBalance();
          fundStore.fetchSafeContractBaseTokenBalance();
        }
        isTransferLoading.value = false;
      })
      .on("error", (error: any) => {
        handleError(error);
      });
  } catch (error: any) {
    handleError(error);
  }
};

const handleError = (error: any) => {
  isTransferLoading.value = false;
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
  if ([4001, 100].includes(error?.code)) {
    toastStore.addToast("Transaction was rejected.");
  } else {
    // A Roles pre-flight failure arrives as a plain Error carrying the
    // modifier's own reason — that names the missing permission, so it beats
    // the generic message.
    toastStore.errorToast(
      error?.message ||
        "There has been an error. Please contact the Rethink Finance support.",
    );
    console.error(error);
  }
};
</script>

<style lang="scss" scoped>
@import "./flows_action";

.transfer_admin {
  @include flows-action-column;
}
</style>
