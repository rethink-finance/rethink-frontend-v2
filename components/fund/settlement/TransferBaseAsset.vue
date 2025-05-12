<template>
  <div class="transfer">
    <div class="transfer__content">
      <div class="transfer__header">
        <div class="transfer__title">
          Transfer Base Asset to the Vault Contract
        </div>
        <div class="transfer__subtitle">
          Transfer any base asset amount from the custody to the vault contract.
        </div>
      </div>
      <div class="transfer__token">
        <div class="transfer__token_data">
          <div class="transfer__token_col">
            {{ baseToken?.symbol }}
          </div>
          <div
            class="transfer__token_col pa-0 transfer__token_col--dark text-end"
          >
            <UiInputNumber
              v-model="tokenValue"
              :rules="tokenValueRules"
              class="transfer__input_amount"
            />
          </div>
        </div>
        <div class="transfer__balance">
          Balance:
          <strong
            class="set_token_value_button mx-1"
            @click="setTokenValue(safeContractBaseTokenBalanceFormatted)"
          >
            {{ safeContractBaseTokenBalanceFormatted }} {{ baseToken?.symbol }}
          </strong>
        </div>
      </div>

      <FundSettlementAlert
        v-if="!isUsingZodiacPilotExtension"
        class="switch_alert"
      >
        Switch to the Zodiac Pilot extension!
      </FundSettlementAlert>
      <div class="buttons_container">
        <div>
          <v-tooltip
            activator="parent"
            location="bottom"
            :disabled="!transferTooltipText"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                class="bg-primary text-secondary"
                :disabled="isTransferDisabled"
                @click="transfer()"
              >
                <template #prepend>
                  <v-progress-circular
                    v-if="isTransferLoading"
                    class="d-flex"
                    size="20"
                    width="3"
                    indeterminate
                  />
                </template>
                Transfer To Vault
              </v-btn>
            </template>
            <template #default>
              {{ transferTooltipText }}
            </template>
          </v-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";
const toastStore = useToastStore();
const fundStore = useFundStore();
const web3Store = useWeb3Store();

const { isUsingZodiacPilotExtension } = storeToRefs(fundStore);

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
const isTransferDisabled = computed(() => {
  return (
    errorMessages.value.length > 0 ||
    isTransferLoading.value ||
    !isUsingZodiacPilotExtension.value
  );
});
const transferTooltipText = computed(() => {
  if (!isUsingZodiacPilotExtension.value) {
    return "Switch to the Zodiac Pilot Extension to make a transfer.";
  }
  if (errorMessages.value.length && tokenValueChanged.value)
    return errorMessages.value[0];
  return "";
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

const transfer = async () => {
  isTransferLoading.value = true;

  try {
    await fundStore.fundBaseTokenContract
      .send("transfer", {}, fundStore?.fundAddress, tokensWei.value)
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
          // Refresh balances
          // TODO repeat every 1 second, 15x until the value changes, as node sync takes some time.
          fundStore.fetchFundContractBaseTokenBalance();
        } else {
          toastStore.errorToast(
            "Your deposit request has failed. Please contact the Rethink Finance support.",
          );
          fundStore.fetchUserFundData(
            fundStore.selectedFundChain,
            fundStore.selectedFundAddress,
          );
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
    toastStore.errorToast(
      "There has been an error. Please contact the Rethink Finance support.",
    );
    console.error(error);
  }
};
</script>

<style lang="scss" scoped>
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  margin-top: 0.5rem;
}
.transfer {
  width: 100%;
  display: flex;
  flex-direction: column;
  font-size: $text-sm;
  line-height: 1;
  gap: 1rem;

  &__content {
    gap: 1.5rem;
    display: flex;
    flex-direction: column;
    height: 100%;
    flex-grow: 1;
    justify-content: space-between;
  }
  &__token {
    font-weight: 500;
    width: 100%;
  }
  &__title {
    font-size: $text-md;
    font-weight: 500;
    color: $color-title;
    margin-bottom: 0.5rem;
  }
  &__subtitle {
    font-size: $text-md;
    color: $color-light-subtitle;
  }
  &__token_header {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    color: $color-light-subtitle;
  }
  &__token_data {
    @include borderGray;
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-bottom: 0.5rem;
    color: $color-white;
  }
  &__token_col {
    padding: 0.75rem;
    height: 2.5rem;
    background: $color-navy-gray;

    &:first-of-type {
      @include borderGray("border-right", false);
    }
    &--dark {
      background: $color-navy-gray-dark;
    }
  }
  &__balance {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.15rem;
  }
}

.set_token_value_button {
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}
.switch_alert {
  justify-content: flex-start !important;
}
</style>
