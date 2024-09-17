<template>
  <div class="transfer">
    <div class="transfer__content">
      <div class="transfer__header">
        <div class="transfer__title">
          Transfer Base Asset to the Fund Contract
        </div>
        <div class="transfer__subtitle">
          Transfer any base asset amount from the custody to the fund contract.
        </div>
      </div>
      <div class="transfer__token">
        <div class="transfer__token_data">
          <div class="transfer__token_col">
            {{ baseToken?.symbol }}
          </div>
          <div class="transfer__token_col pa-0 transfer__token_col--dark text-end">
            <InputNumber
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

      <FundSettlementAlert v-if="!isUsingZodiacPilotExtension" class="switch_alert">
        Switch to the Zodiac Pilot extension!
      </FundSettlementAlert>
      <div class="buttons_container">
        <div>
          <v-tooltip activator="parent" location="bottom" :disabled="!transferTooltipText">
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
                Transfer To Fund
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
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import { useWeb3Store } from "~/store/web3.store";
const toastStore = useToastStore();
const fundStore = useFundStore();
const web3Store = useWeb3Store();

const { isUsingZodiacPilotExtension } = toRefs(fundStore);

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
const tokensWei = computed( () => {
  if (!baseToken.value) return 0n;
  return ethers.parseUnits(tokenValue.value || "0", baseToken.value.decimals)
})

watch(() => tokenValue.value, () => {
  tokenValueChanged.value = true;
});

const setTokenValue = (value: any) => {
  tokenValue.value = value;
}

const tokenValueRules = [
  // TODO Add rule for max decimals
  (value: string) => {
    const valueWei = ethers.parseUnits(value || "0", baseToken.value?.decimals);
    if (valueWei <= 0) {
      return "Value must be positive."
    }
    if (valueWei > safeContractBaseTokenBalance.value) {
      return "Not enough balance."
    }
    return true;
  },
];
const errorMessages = computed(() => {
  return tokenValueRules.map(rule => rule(tokenValue.value || "0")).filter(rule => rule !== true);
});
const isTransferDisabled = computed(() => {
  return errorMessages.value.length > 0 || isTransferLoading.value || !isUsingZodiacPilotExtension.value;
});
const transferTooltipText = computed(() => {
  if (!isUsingZodiacPilotExtension.value) {
    return "Switch to the Zodiac Pilot Extension to make a transfer.";
  }
  if (errorMessages.value.length && tokenValueChanged.value) return errorMessages.value[0];
  return ""
});

const safeContractBaseTokenBalance = computed(() => {
  return fundStore.fund?.safeContractBaseTokenBalance || 0n;
});
const safeContractBaseTokenBalanceFormatted = computed(() => {
  if (!baseToken.value) return "--";
  return formatTokenValue(safeContractBaseTokenBalance.value, baseToken.value?.decimals, false);
});

const transfer = async () => {
  isTransferLoading.value = true;
  const [gasPrice, gasEstimate] = await web3Store.estimateGas(
    {
      from: fundStore.activeAccountAddress,
      to: fundStore.fundBaseTokenContract.options.address,
      data: fundStore.fundBaseTokenContract.methods.transfer(fundStore?.fund?.address, tokensWei.value).encodeABI(),
    },
  );

  try {
    await fundStore.fundBaseTokenContract.methods.transfer(fundStore?.fund?.address, tokensWei.value).send({
      from: fundStore.activeAccountAddress,
      gas: gasEstimate,
      maxPriorityFeePerGas: gasPrice,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: ", hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");
    }).on("receipt", (receipt: any) => {
      console.log("receipt :", receipt);
      if (receipt.status) {
        toastStore.successToast("Transfer was successful.");
        // Refresh balances
        // TODO repeat every 1 second, 15x until the value changes, as node sync takes some time.
        fundStore.fetchFundContractBaseTokenBalance();
      } else {
        toastStore.errorToast("Your deposit request has failed. Please contact the Rethink Finance support.");
        fundStore.fetchUserBalances();
      }
      isTransferLoading.value = false;
    }).on("error", (error: any) => {
      handleError(error);
    });
  } catch (error: any) {
    handleError(error);
  }
};

const handleError = (error: any) => {
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
  if (error?.code === 4001) {
    toastStore.addToast("Transaction was rejected.")
  } else {
    toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    console.error(error);
  }
  isTransferLoading.value = false;
}
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
    color: $color-light-subtitle
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
.switch_alert{
  justify-content: flex-start !important;
}
</style>
