<template>
  <div class="sweep_admin">
    <div class="sweep_admin__title">
      Sweep admin contract
      <UiInfoTooltip
        :text="`Return excess ${baseToken?.symbol ?? 'base asset'} liquidity above pending redemptions back to the Safe.`"
      />
    </div>

    <!-- Mirrors the transfer input's geometry, but it is a readout: the
         sweepable excess is what the contract computes, not a choice. -->
    <div class="sweep_admin__control sweep_admin__control--readonly">
      <div class="sweep_admin__prefix sweep_admin__prefix--label">
        Excess
      </div>
      <div
        class="sweep_admin__readout"
        :class="{ 'sweep_admin__readout--zero': isExcessZero }"
      >
        {{ excessDisplay }}
      </div>
    </div>

    <div class="sweep_admin__foot">
      <div class="sweep_admin__caption">
        Pending redemptions · {{ pendingRedemptionsDisplay }}
      </div>
      <span class="sweep_admin__action">
        <v-tooltip
          activator="parent"
          location="top"
          :disabled="!sweepContractTooltipText"
        >
          {{ sweepContractTooltipText }}
        </v-tooltip>
        <button
          type="button"
          class="sweep_admin__button"
          :disabled="isSweepContractDisabled"
          @click="sweepFundContract()"
        >
          <v-progress-circular
            v-if="isSweepLoading"
            size="14"
            width="2"
            indeterminate
          />
          Sweep to Safe
        </button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FixedNumber } from "ethers";
import { eth } from "web3";
import { commify, roundToSignificantDecimals } from "~/composables/formatters";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";

const accountStore = useAccountStore();
const toastStore = useToastStore();
const fundStore = useFundStore();

/**
 * Both figures are the page's simulated-NAV estimates — the same ones the
 * funding gap is computed from, so the two readings can never disagree.
 */
const props = defineProps({
  /** Admin balance minus pending redemptions, in base; excess is its positive part. */
  fundingGap: {
    type: FixedNumber,
    default: undefined,
  },
  /** Pending redemptions valued in the base asset. */
  pendingRedemptionsInBase: {
    type: FixedNumber,
    default: undefined,
  },
});

// No curator gate here on purpose: fundFlowsCall(sweepTokens()) is
// permissionless on the deployed vaults — verified by eth_call from an
// unrelated EOA — so the only requirement is a connected wallet to pay gas.
const { isConnected } = storeToRefs(accountStore);
const isSweepLoading = ref(false);

const baseToken = computed(() => {
  return fundStore.fund?.baseToken;
});

const isExcessZero = computed(() => {
  return !props.fundingGap || props.fundingGap.isNegative() || props.fundingGap.isZero();
});
const excessDisplay = computed(() => {
  if (isExcessZero.value || !props.fundingGap) return "0";
  return commify(roundToSignificantDecimals(props.fundingGap.toString()));
});
const pendingRedemptionsDisplay = computed(() => {
  if (!props.pendingRedemptionsInBase) return "N/A";
  return commify(
    roundToSignificantDecimals(props.pendingRedemptionsInBase.toString()),
  );
});

const isSweepContractDisabled = computed(() => {
  return (
    !!sweepContractTooltipText.value ||
    isSweepLoading.value ||
    !isConnected.value
  );
});
const sweepContractTooltipText = computed(() => {
  if (!isConnected.value) {
    return "Connect your wallet to sweep the admin contract.";
  } else if (!fundContractBaseTokenBalance.value) {
    // TODO actually we need to check if there are excess OIVs to sweep.
    return "Currently there are no base assets in the admin contract to sweep.";
  }
  return "";
});

const fundContractBaseTokenBalance = computed(() => {
  return fundStore.fund?.fundContractBaseTokenBalance || 0n;
});

const sweepFundContract = async () => {
  isSweepLoading.value = true;

  try {
    const functionSignatureHash =
      eth.abi.encodeFunctionSignature("sweepTokens()");

    await fundStore.fundContract
      .send("fundFlowsCall", {}, functionSignatureHash)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: ", hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt :", receipt);
        if (receipt.status) {
          toastStore.successToast("Admin contract sweep was successful.");
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
        isSweepLoading.value = false;
      })
      .on("error", (error: any) => {
        handleError(error);
      });
  } catch (error: any) {
    handleError(error);
  }
};

const handleError = (error: any) => {
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
  isSweepLoading.value = false;
};
</script>

<style lang="scss" scoped>
@import "./flows_action";

.sweep_admin {
  @include flows-action-column;
}
</style>
