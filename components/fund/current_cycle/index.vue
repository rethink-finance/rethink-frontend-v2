<template>
  <div class="fund_settlement">
    <div class="card_header">
      <div class="card_header__title subtitle_white">
        Pending Requests
      </div>
      <div
        v-if="userDepositRequestExists || userRedemptionRequestExists"
        class="fund_settlement__buttons"
      >
        <v-tooltip
          :disabled="
            !(depositDisabledTooltipText || redemptionDisabledTooltipText)
          "
          activator="parent"
          location="bottom"
        >
          <template #activator="props">
            <v-btn
              v-bind="props"
              :disabled="isProcessRequestDisabled"
              @click="processRequest"
            >
              <template #prepend>
                <v-progress-circular
                  v-if="isAnythingLoading"
                  class="d-flex"
                  size="20"
                  width="3"
                  indeterminate
                />
              </template>
              Process Request
            </v-btn>
          </template>
          <template v-if="userDepositRequestExists">
            {{ depositDisabledTooltipText }}
          </template>
          <br v-if="userDepositRequestExists && userRedemptionRequestExists">
          <template v-if="userRedemptionRequestExists">
            {{ redemptionDisabledTooltipText }}
          </template>
        </v-tooltip>
      </div>
    </div>
    <div
      v-if="!accountStore.isConnected"
      class="fund_settlement__no_pending_requests"
    >
      Connect your wallet to view deposit or redemption requests.
    </div>
    <div v-else-if="isLoadingFetchUserFundDepositRedemptionRequestsAction">
      <v-skeleton-loader type="list-item-two-line" />
      <v-skeleton-loader type="list-item-two-line" />
    </div>
    <div
      v-else-if="userDepositRequestExists || userRedemptionRequestExists"
      class="fund_settlement__pending_requests"
    >
      <FundCurrentCyclePendingRequest
        v-if="userDepositRequestExists"
        :fund-transaction-request="userDepositRequest"
        :exchange-rate="baseToFundTokenExchangeRate"
        :token0="fund.baseToken"
        :token1="fund.fundToken"
      />
      <FundCurrentCyclePendingRequest
        v-if="userRedemptionRequestExists"
        :fund-transaction-request="userRedemptionRequest"
        :exchange-rate="fundToBaseTokenExchangeRate"
        :token1="fund.baseToken"
        :token0="fund.fundToken"
      />
    </div>
    <div v-else class="fund_settlement__no_pending_requests">
      Currently there are no deposit or redemption requests.
    </div>
    <UiNotification>
      The deposit and redeem requests are settled within the planned Settlement
      Cycle of
      <span class="text-primary">{{
        fund?.plannedSettlementPeriod || "N/A"
      }}</span>. You can learn more about how settlements work
      <a
        href="https://docs.rethink.finance/rethink.finance"
        target="_blank"
      >here</a>.
    </UiNotification>
  </div>
</template>

<script setup lang="ts">
import { ethers, FixedNumber } from "ethers";
import { computed, ref } from "vue";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import type IFund from "~/types/fund";

import { createDelegateBySigMessage, encodeFundFlowsCallFunctionData } from "assets/contracts/fundFlowsCallAbi";
import { useAccountStore } from "~/store/account/account.store";
import { useActionStateStore } from "~/store/actionState.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ActionState } from "~/types/enums/action_state";
const emit = defineEmits(["deposit-success"]);

const web3Store = useWeb3Store();
const toastStore = useToastStore();
const actionStateStore = useActionStateStore();
const fundStore = useFundStore();
const accountStore = useAccountStore();
const {
  fundUserData,
  userDepositRequest,
  userRedemptionRequest,
  baseToFundTokenExchangeRate,
  fundToBaseTokenExchangeRate,
  shouldUserWaitSettlementOrCancelDeposit,
  shouldUserWaitSettlementOrCancelRedemption,
  userDepositRequestExists,
  userRedemptionRequestExists,
} = storeToRefs(fundStore);

const isLoadingFetchUserFundDepositRedemptionRequestsAction = computed(() =>
  actionStateStore.isActionState(
    "fetchUserFundDepositRedemptionRequests",
    ActionState.Loading,
  ),
);

defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});
const isProcessRequestDisabled = computed(() => {
  if (isAnythingLoading.value) return true;

  // Do not disable process request button if the user can do either deposit or redemption.
  if (
    !depositDisabledTooltipText.value ||
    !redemptionDisabledTooltipText.value
  ) {
    return false;
  }
  return true;
});

const processRequest = () => {
  if (userDepositRequestExists.value) {
    deposit();
  }
  if (userRedemptionRequestExists.value) {
    redeem();
  }
};

const loadingDeposit = ref(false);
const loadingRedemption = ref(false);

const isAnythingLoading = computed(() => {
  return loadingDeposit.value || loadingRedemption.value;
});
const depositDisabledTooltipText = computed(() => {
  if (!userDepositRequestExists.value) {
    return "There is no deposit request.";
  }
  if (
    fundUserData.value.fundAllowance < (userDepositRequest?.value?.amount || 0n)
  ) {
    return "Not enough allowance to process the deposit request.";
  }
  if (shouldUserWaitSettlementOrCancelDeposit.value) {
    return "Wait for settlement or cancel the deposit request.";
  }
  if (!fundStore.isUserWalletWhitelisted) {
    return "Your wallet address is not whitelisted to allow deposits into this OIV."
  }
  return "";
});
const redemptionDisabledTooltipText = computed(() => {
  const redemptionRequestAmount = userRedemptionRequest?.value?.amount || 0n;

  if (!userRedemptionRequestExists.value) {
    return "There is no redemption request.";
  }
  if (fundUserData.value.fundTokenBalance < redemptionRequestAmount) {
    return "Not enough OIV tokens to process the redemptions request."
  }
  if (shouldUserWaitSettlementOrCancelRedemption.value) {
    return "Wait for settlement or cancel the redemption request.";
  }

  // Check if there is even enough liquidity in the OIV contract to redeem the requested amount.
  const fundContractBaseTokenBalance = fundStore.fund?.fundContractBaseTokenBalance || 0n;
  // Get the last NAV update exchange rate.
  const lastNAVExchangeRate = FixedNumber.fromString(
    fundStore.fundToBaseTokenExchangeRate.toString(),
  );
  const redemptionRequestAmountFN = FixedNumber.fromString(
    ethers.formatUnits(
      redemptionRequestAmount,
      fundStore.fund?.fundToken.decimals,
    ),
  );
  const redemptionRequestAmountInBaseFN = lastNAVExchangeRate.mul(
    redemptionRequestAmountFN,
  );
  const fundContractBaseTokenBalanceFN = FixedNumber.fromString(
    ethers.formatUnits(
      fundContractBaseTokenBalance,
      fundStore.fund?.baseToken.decimals,
    ),
  );
  // console.log("NSS lastNAVExchangeRate", lastNAVExchangeRate.toString())
  // console.log("NSS redemptionRequestAmountFN", redemptionRequestAmountFN.toString());
  // console.log("NSS redemptionRequestAmountInBaseFN", redemptionRequestAmountInBaseFN.toString());
  // console.log("NSS fundContractBaseTokenBalanceFN", fundContractBaseTokenBalanceFN.toString())
  if (fundContractBaseTokenBalanceFN.lt(redemptionRequestAmountInBaseFN)) {
    // Check if there is enough base token liquidity to perform withdrawal.
    return "Not enough liquidity in the OIV contract."
  }
  if (!fundStore.isUserWalletWhitelisted) {
    return "Your wallet address is not whitelisted to allow deposits into this OIV."
  }
  return "";
});

const signDepositAndDelegateBySigTransaction = async () => {
  const activeAccountAddress = fundStore.activeAccountAddress ?? "";
  const fundChainId = fundStore.selectedFundChain;
  if (!activeAccountAddress) {
    toastStore.errorToast("No active account, try re-authenticating.");
    return;
  }
  // Get contract domain data (name, verifyingContract, chainId, version) that
  // will be used to create the EIP-712 message.
  const [domainDataResult, nonceResult] = await Promise.allSettled(
    [
      () => fundStore.fundGovernanceTokenContract.methods.eip712Domain().call(),
      () =>
        fundStore.fundGovernanceTokenContract.methods
          .nonces(activeAccountAddress)
          .call(),
    ].map((fn) =>
      accountStore.requestConcurrencyLimit(() => web3Store.callWithRetry(fundChainId, fn)),
    ),
  );
  const domainData =
    domainDataResult.status === "fulfilled"
      ? domainDataResult.value
      : undefined;
  const nonce =
    nonceResult.status === "fulfilled" ? nonceResult.value : undefined;
  console.log("depositAndDelegateBySig domain data ", domainData);

  const expiry = Math.floor(Date.now() / 1000) + 3600; // expiry 1 hour from now;
  // Create the EIP-712 message
  const dataToSign = createDelegateBySigMessage(
    activeAccountAddress,
    expiry,
    nonce,
    domainData.name,
    domainData.verifyingContract,
    domainData.chainId,
    domainData.version,
  );
  console.log("dataToSign", JSON.stringify(dataToSign, null, 2));
  let signature;

  try {
    const web3Provider = web3Store.chainProviders[fundStore.selectedFundChain];
    const hexSignature = await web3Provider?.eth.signTypedData(
      activeAccountAddress ?? "",
      dataToSign,
    );
    signature = ethers.Signature.from(hexSignature);
  } catch (error) {
    console.error("Error signing message:", error);
    return;
  }

  // If user has not delegated to himself yet, just use the depositAndDelegateBySig
  return encodeFundFlowsCallFunctionData("depositAndDelegateBySig", [
    activeAccountAddress, // delegatee, delegate to self first
    nonce, // nonce
    expiry, // expiry
    signature.v, // v
    signature.r, // r
    signature.s, // s
  ]);
};

const deposit = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to deposit tokens to the OIV.")
    return;
  }
  if (!fundStore.fund) {
    toastStore.errorToast("OIV data is missing.")
    return;
  }
  if (!userDepositRequest?.value?.amount) {
    toastStore.errorToast("Deposit request data is missing.");
    return;
  }
  console.log(
    "DEPOSIT tokensWei: ",
    userDepositRequest?.value?.amount,
    "from : ",
    fundStore.activeAccountAddress,
  );
  loadingDeposit.value = true;
  let encodedFunctionCall;

  if (fundStore.fundUserData?.fundDelegateAddress === ethers.ZeroAddress) {
    // If the user has not delegated to anyone, delegate to himself after deposit.
    // Use a combination of deposit + delegate to himself in one transaction.
    // Metamask will popup twice, first to sign the delegate trx then to submit the depositAndDelegateBySig trx.
    let delegateBySigData;
    try {
      encodedFunctionCall = await signDepositAndDelegateBySigTransaction();
      console.warn("signed delegateBySigData", delegateBySigData);
    } catch (error: any) {
      console.error("failed signing delegate by sig data", error);

      // Only use the deposit call as a fallback, and delegate to self later.
      encodedFunctionCall = encodeFundFlowsCallFunctionData("deposit");
    }
  } else {
    // Just deposit.
    encodedFunctionCall = encodeFundFlowsCallFunctionData("deposit");
  }

  try {
    await fundStore.fundContract
      .send("fundFlowsCall", {}, encodedFunctionCall)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);

        // Refresh user balances & allowance & refresh pending requests.
        fundStore.fetchUserFundData(
          fundStore.selectedFundChain,
          fundStore.selectedFundAddress,
        );

        if (receipt.status) {
          toastStore.successToast("Your deposit was successful.");

          // emit event to open the delegate votes modal
          emit("deposit-success");
        } else {
          toastStore.errorToast(
            "The transaction has failed. Please contact the Rethink Finance support.",
          );
        }

        loadingDeposit.value = false;
      })
      .on("error", (error: any) => {
        loadingDeposit.value = false;
        console.error(error);
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error: any) {
    loadingDeposit.value = false;
    handleError(error);
  }
};

const redeem = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to redeem tokens from the OIV.")
    return;
  }
  if (!fundStore.fund) {
    toastStore.errorToast("OIV data is missing.")
    return;
  }
  if (!userRedemptionRequest?.value?.amount) {
    toastStore.errorToast("Redemption request data is missing.");
    return;
  }
  console.log("[REDEEM]");
  loadingRedemption.value = true;
  console.log(
    "[REDEEM] tokensWei: ",
    userRedemptionRequest?.value?.amount,
    "from : ",
    fundStore.activeAccountAddress,
  );

  const encodedFunctionCall = encodeFundFlowsCallFunctionData("withdraw");

  try {
    await fundStore.fundContract
      .send("fundFlowsCall", {}, encodedFunctionCall)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);

        // Refresh user balances & allowance.
        fundStore.fetchUserFundData(
          fundStore.selectedFundChain,
          fundStore.selectedFundAddress,
        );

        if (receipt.status) {
          toastStore.successToast(
            "Your redemption was successful. It may take 10 seconds or more for values to update.",
          );
        } else {
          toastStore.errorToast(
            "The transaction has failed. Please contact the Rethink Finance support.",
          );
        }

        loadingRedemption.value = false;
      })
      .on("error", (error: any) => {
        handleError(error);
      });
  } catch (error: any) {
    handleError(error);
  }
};

const handleError = (error: any) => {
  loadingRedemption.value = false;

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
.fund_settlement {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;

  &__buttons {
    display: flex;
    gap: 1rem;
  }
  &__pending_requests {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  &__no_pending_requests {
    display: flex;
    flex-grow: 1;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
}

.card_header {
  &__title {
    margin-bottom: 0.75rem;

    @include sm {
      margin-bottom: 0;
    }
  }
}
</style>
