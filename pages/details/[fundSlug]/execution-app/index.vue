<template>
  <div class="execution-app">
    <UiHeader>
      <div class="data_bar__item">
        <div class="switch_to_zodiac_notification">
          <img
            src="@/assets/images/zodiac_pilot.svg"
            class="img_zodiac_pilot"
          >
          <template v-if="isUsingZodiacPilotExtension">
            <div>Connected to the Zodiac Pilot</div>
            <Icon
              icon="octicon:check-circle-fill-16"
              width="1rem"
              height="1rem"
              color="var(--color-success)"
            />
          </template>
          <div v-else>
            Switch to the Zodiac Pilot extension to complete the transfer and
            settle flows.
          </div>
        </div>
      </div>
    </UiHeader>

    <div class="main_card">
      <UiHeader>
        <div class="main_header__title">
          Transfer
          <UiTooltipClick location="right" :hide-after="6000">
            <Icon
              icon="material-symbols:info-outline"
              :class="'main_header__info-icon'"
              width="1.5rem"
            />

            <template #tooltip>
              Transfer any token from Custody Contract to approved destination
              <a
                class="tooltip__link"
                href="https://docs.rethink.finance/rethink.finance"
                target="_blank"
              >
                Learn More
                <Icon icon="maki:arrow" color="primary" width="1rem" />
              </a>
            </template>
          </UiTooltipClick>
        </div>
      </UiHeader>
      <div class="inputs">
        <v-form ref="form" v-model="formTransferIsValid">
          <v-row>
            <v-col cols="12" sm="4">
              <v-label class="label_required mb-2">
                To
              </v-label>
              <v-text-field
                v-model="transferEntry.to"
                placeholder="E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
                :rules="[rules.required, rules.isValidAddress]"
                required
              />
            </v-col>
            <!-- TODO impelement input token address -->
            <!-- <v-col cols="12" sm="4">
              <v-label class="label_required mb-2">
                Input Token Address
              </v-label>
              <v-text-field
                v-model="transferEntry.inputTokenAddress"
                placeholder="E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
                :rules="[rules.required, rules.isValidAddress]"
                required
              />
            </v-col> -->
            <v-col cols="12" sm="4">
              <v-label class="label_required mb-2">
                Amount
              </v-label>
              <v-text-field
                v-model="transferEntry.depositValue"
                placeholder="E.g. 10"
                :rules="[rules.required, rules.enoughBalance]"
                required
              />
              <v-label>
                Available Balance:
                {{ userBaseTokenBalanceFormatted }}
                {{ fundStore.fund?.baseToken?.symbol }}
              </v-label>
            </v-col>
          </v-row>
          <v-row>
            <v-col class="d-flex justify-end">
              <v-btn
                :disabled="!formTransferIsValid"
                color="primary"
                variant="outlined"
                @click="handleTransfer"
              >
                Transfer
              </v-btn>
            </v-col>
          </v-row>
        </v-form>
      </div>
    </div>

    <div class="main_card">
      <UiHeader>
        <div class="main_header__title">
          Submit Raw TXN
          <UiTooltipClick location="right" :hide-after="6000">
            <Icon
              icon="material-symbols:info-outline"
              :class="'main_header__info-icon'"
              width="1.5rem"
            />

            <template #tooltip>
              Submit any approved Raw TXN on behalf of Custody Contract
              <a
                class="tooltip__link"
                href="https://docs.rethink.finance/rethink.finance"
                target="_blank"
              >
                Learn More
                <Icon icon="maki:arrow" color="primary" width="1rem" />
              </a>
            </template>
          </UiTooltipClick>
        </div>
      </UiHeader>
      <div class="inputs">
        <v-form ref="form" v-model="formSubmitRawTXNIsValid">
          <v-row>
            <v-col cols="12" sm="4">
              <v-label class="label_required mb-2">
                To
              </v-label>
              <v-text-field
                v-model="submitRawTXNEntry.contractAddress"
                placeholder="E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
                :rules="[rules.required, rules.isValidAddress]"
                required
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-label class="label_required mb-2">
                Submit (Calldata)
              </v-label>
              <v-text-field
                v-model="submitRawTXNEntry.txData"
                placeholder="E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
                :rules="[rules.required]"
                required
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-label class="label_required mb-2">
                Amount
              </v-label>
              <v-text-field
                v-model="submitRawTXNEntry.amountValue"
                placeholder="E.g. 10"
                :rules="[rules.required]"
                required
              />
              <!-- :rules="[rules.required, rules.isPositiveNumber]" -->
            </v-col>
          </v-row>
          <v-row>
            <v-col class="d-flex justify-end">
              <v-btn
                :disabled="!formSubmitRawTXNIsValid"
                color="primary"
                variant="outlined"
                :loading="loadingSubmitRawTXN"
                @click="handleSubmitRawTXN"
              >
                Submit
              </v-btn>
            </v-col>
          </v-row>
        </v-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund/fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useToastStore } from "~/store/toasts/toast.store";

const fundStore = useFundStore();
const web3Store = useWeb3Store();
const toastStore = useToastStore();

const fund = useAttrs().fund as IFund;
const { isUsingZodiacPilotExtension } = toRefs(fundStore);

const loadingSubmitRawTXN = ref(false);
const formSubmitRawTXNIsValid = ref(false);
const submitRawTXNEntry = reactive({
  contractAddress: "",
  txData: "",
  amountValue: "",
});

const loadingTransfer = ref(false);
const formTransferIsValid = ref(false);
const transferEntry = reactive({
  to: "",
  // inputTokenAddress: "",
  depositValue: "",
});

const userBaseTokenBalanceFormatted = computed(() => {
  return formatTokenValue(
    fundStore.fundUserData?.baseTokenBalance,
    fundStore.fund?.baseToken.decimals,
    false,
  );
});

const rules = {
  required: formRules.required,
  isValidAddress: formRules.isValidAddress,
  isPositiveNumber: formRules.isPositiveNumber,

  enoughBalance: (value: string) => {
    if (!fundStore.fund) return "Fund data is missing.";

    let valueWei;
    try {
      valueWei = ethers.parseUnits(value, fundStore.fund?.baseToken.decimals);
    } catch {
      return `Make sure the value has max ${fundStore.fund?.baseToken.decimals} decimals.`;
    }

    if (valueWei <= 0) return "Value must be positive.";

    console.log("decimals: ", fundStore.fund.baseToken.decimals);
    console.log("valueWei: ", valueWei);
    console.log("userBaseTokenBalance: ", fundStore.fundUserData?.baseTokenBalance);
    console.log(
      "valueWei > userBaseTokenBalance: ",
      valueWei > fundStore.fundUserData?.baseTokenBalance,
    );

    if (fundStore.fundUserData?.baseTokenBalance < valueWei) {
      const userBaseTokenBalanceFormatted = formatTokenValue(
        fundStore.fundUserData?.baseTokenBalance,
        fundStore.fund.baseToken.decimals,
        false,
      );
      return `Your ${fundStore.fund.baseToken.symbol} balance is too low: ${userBaseTokenBalanceFormatted}.`;
    }

    return true;
  },
};

// TODO: if we want to input a custom token address for transfer
// we need to adjust this function
const handleTransfer = async () => {
  loadingTransfer.value = true;

  const decimals = fundStore.fund?.baseToken.decimals;
  const tokensWei = ethers.parseUnits(transferEntry.depositValue, decimals);

  // call the transfer method
  await fundStore.fundBaseTokenContract.methods
    .transfer(transferEntry.to, tokensWei)
    .send({
      from: fundStore.activeAccountAddress,
      gas: 200000,
    })
    .on("transactionHash", (hash: any) => {
      console.log("tx hash: " + hash);
      toastStore.addToast(
        "The transaction has been submitted. Please wait for it to be confirmed.",
      );
    })
    .on("receipt", (receipt: any) => {
      console.log(receipt);
      if (receipt.status) {
        toastStore.successToast("The transfer was successfull.");
      } else {
        toastStore.errorToast(
          "The transaction has failed. Please contact the Rethink Finance support.",
        );
      }
      loadingTransfer.value = false;
    })
    .on("error", (error: any) => {
      console.log("error: ", error);
      loadingTransfer.value = false;
      toastStore.errorToast(
        "There has been an error. Please contact the Rethink Finance support.",
      );
    });
};

const handleSubmitRawTXN = async () => {
  try {
    loadingSubmitRawTXN.value = true;

    console.log("to:", submitRawTXNEntry.contractAddress);
    console.log("data:", submitRawTXNEntry.txData);
    console.log("from:", fundStore.activeAccountAddress);
    console.log("value:", parseInt(submitRawTXNEntry.amountValue));

    if (!web3Store.web3) {
      toastStore.errorToast("Web3 is not initialized. Please try again later.");
      return;
    }

    await web3Store.web3.eth
      .sendTransaction({
        to: submitRawTXNEntry.contractAddress,
        data: submitRawTXNEntry.txData,
        from: fundStore.activeAccountAddress,
        maxPriorityFeePerGas: "",
        maxFeePerGas: "",
        value: parseInt(submitRawTXNEntry.amountValue),
      })
      .on("transactionHash", (hash: string) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);

        if (receipt.status) {
          toastStore.successToast("The transaction was successfull.");
        } else {
          toastStore.errorToast(
            "The transaction has failed. Please contact the Rethink Finance support.",
          );
        }

        loadingSubmitRawTXN.value = false;
      })
      .on("error", (error: any) => {
        loadingSubmitRawTXN.value = false;
        console.log(error);
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error: any) {
    console.error(error);
    loadingSubmitRawTXN.value = false;

    if (error?.data?.message) {
      toastStore.errorToast(error.data.message, 15000);

    } else {
      toastStore.errorToast(
        "There has been an error. Please contact the Rethink Finance support.",
      );
    }
  }
};
</script>

<style scoped lang="scss">
.switch_to_zodiac_notification {
  align-items: center;
  display: flex;
  border: 1px solid $color-border-dark;
  background: $color-gray-light-transparent;
  padding: 1rem;
  flex-direction: row;
  border-radius: $default-border-radius;
  font-weight: 600;
  gap: 0.6rem;
}

.main_card:not(.main_grid) {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

// main header style
.main_header {
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 14px;

  &__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    align-content: center;
    gap: 20px;
  }
  &__info-icon {
    cursor: pointer;
    display: flex;
    color: $color-text-irrelevant;
  }
}
// tooltip style
.tooltip {
  &__link {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    color: $color-primary;
  }
}
</style>
