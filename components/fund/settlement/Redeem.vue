<template>
  <FundSettlementBaseForm
    v-if="fund"
    v-model="tokenValue"
    :token0="fund.fundToken"
    :token1="fund.baseToken"
    :token0-user-balance="fundStore.userFundTokenBalance"
    :token1-user-balance="fundStore.userBaseTokenBalance"
    :exchange-rate="fundStore.fundToBaseTokenExchangeRate"
  >
    <template #buttons>
      <div v-if="accountStore.isConnected">
        <div class="deposit_button_group">
          <template v-if="shouldUserWaitSettlementOrCancelRedemption">
            <h3>
              Wait for settlement or cancel the redemption request.
            </h3>
          </template>
          <template v-else-if="userRedemptionRequestExists">
            <h3>
              You can now process or cancel the redemption request.
            </h3>
          </template>
          <template v-for="button in buttons">
            <v-tooltip
              v-if="button.isVisible"
              location="bottom"
              :disabled="!button.tooltipText"
              bottom
            >
              <template #default>
                {{ button.tooltipText }}
              </template>
              <template #activator="{ props }">
                <!-- Wrap it in the span to show the tooltip even if the button is disabled. -->
                <span v-bind="props">
                  <v-btn
                    class="bg-primary text-secondary"
                    :disabled="button.disabled"
                    @click="button.onClick"
                  >
                    <template #prepend>
                      <v-progress-circular
                        v-if="button.loading"
                        class="d-flex"
                        size="20"
                        width="3"
                        indeterminate
                      />
                    </template>
                    {{ button.name }}
                  </v-btn>
                </span>
              </template>
            </v-tooltip>
          </template>
        </div>
        <div v-if="visibleErrorMessages && tokenValueChanged" class="text-red mt-4 text-center">
          <div v-for="(error, index) in visibleErrorMessages" :key="index">
            {{ error.message }}
          </div>
        </div>
      </div>
      <template v-else>
        <v-btn class="bg-primary text-secondary" @click="accountStore.connectWallet()">
          Connect Wallet
        </v-btn>
      </template>
    </template>
  </FundSettlementBaseForm>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { useAccountStore } from "~/store/account.store";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";

const toastStore = useToastStore();
const accountStore = useAccountStore();
const fundStore = useFundStore();
const tokenValue = ref("");
const tokenValueChanged = ref(false);
const fund = computed(() => fundStore.fund);

const loadingRequestRedeem = ref(false);
const loadingCancelRedeem = ref(false);
const loadingRedeem = ref(false);
const {
  shouldUserWaitSettlementOrCancelRedemption,
  userRedemptionRequestExists,
} = toRefs(fundStore);

watch(() => tokenValue.value, () => {
  tokenValueChanged.value = true;
});

interface IError {
  message: string,
  display: boolean,
}
const rules = [
  (value: string): boolean | IError => {
    if (!fund.value) return { message: "Fund data is missing.", display: true }
    const valueWei = ethers.parseUnits(value, fund.value?.baseToken.decimals);
    if (valueWei <= 0) return { message: "Value must be positive.", display: false }

    console.log("[REDEEM] check user fund token balance wei: ", valueWei, fundStore.userFundTokenBalance);
    if (fundStore.userFundTokenBalance < valueWei) {
      const userFundTokenBalanceFormatted = formatTokenValue(fundStore.userFundTokenBalance, fund.value.fundToken.decimals);
      return {
        message: `Your ${fund.value.fundToken.symbol} balance is too low: ${userFundTokenBalanceFormatted}.`,
        display: true,
      }
    }
    return true;
  },
];

const isRequestRedeemDisabled = computed(() => {
  // Disable redeem button if any of rules is false.
  return errorMessages.value.length > 0 || loadingRequestRedeem.value  || !fundStore.isUserWalletWhitelisted;
});

const errorMessages = computed<IError[]>(() => {
  // Disable Redeem button if any of rules is false.
  return rules.map(rule => rule(tokenValue.value || "0")).filter(rule => rule !== true) as IError[];
});
const visibleErrorMessages = computed<IError[]>( () => {
  return errorMessages.value.filter((error: IError) => error.display)
})

const handleError = (error: any) => {
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
  if (error?.code === 4001) {
    toastStore.addToast("Redeem transaction was rejected.")
  } else {
    toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    console.error(error);
  }
  loadingRequestRedeem.value = false;
  loadingCancelRedeem.value = false;
  loadingRedeem.value = false;
}


const requestRedemption = async () => {
  if (!accountStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to redeem tokens from the fund.")
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.")
    return;
  }
  console.log("[REQUEST REDEMPTION]");
  loadingRequestRedeem.value = true;

  const tokensWei = ethers.parseUnits(tokenValue.value || "0", fund.value.fundToken.decimals)
  console.log("[REDEEM] tokensWei: ", tokensWei, "from : ", accountStore.activeAccount.address);

  const ABI = [ "function requestWithdraw(uint256 amount)" ];
  const iface = new ethers.Interface(ABI);
  const encodedFunctionCall = iface.encodeFunctionData("requestWithdraw", [ tokensWei ]);
  const [gasPrice, gasEstimate] = await fundStore.estimateGasFundFlowsCall(encodedFunctionCall);

  try {
    await fundStore.fundContract.methods.fundFlowsCall(encodedFunctionCall).send({
      from: accountStore.activeAccount.address,
      gas: gasEstimate,
      gasPrice,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log(receipt);

      // TODO takes 15-20 sec for node to sync .. fix
      // fundStore.fetchUserFundDepositRedemptionRequests();
      if (receipt.status) {
        toastStore.successToast(
          "Your withdrawal request was successful. It may take 10 seconds or more for values to update.",
        );
        fundStore.userRedemptionRequest = {
          amount: tokensWei,
          timestamp: Date.now(),
          type: FundTransactionType.Redemption,
        }
        tokenValue.value = "0.0";
      } else {
        toastStore.errorToast("The transaction has failed. Please contact the Rethink Finance support.");
      }

      loadingRequestRedeem.value = false;
    }).on("error", (error: any) => {
      handleError(error);
    });
  } catch (error: any) {
    handleError(error);
  }
}

const buttons = ref([
  {
    name: "Request Redemption",
    onClick: requestRedemption,
    disabled: isRequestRedeemDisabled,
    loading: loadingRequestRedeem,
    isVisible: computed(() => !userRedemptionRequestExists.value),
    tooltipText: computed(() => {
      if (userRedemptionRequestExists.value) {
        return "Redemption request already exists. To change it, you first have to cancel the existing one."
      }
      if (!fundStore.isUserWalletWhitelisted) {
        return "Your wallet address is not whitelisted to allow deposits into this fund."
      }
      return ""
    }),
  },
]);

</script>

<style lang="scss" scoped>
.deposit_button_group {
  gap: 1rem;
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
}
</style>
