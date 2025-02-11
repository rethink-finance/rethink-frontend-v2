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
            Switch to the Zodiac Pilot extension to activate the execution app
          </div>
        </div>
      </div>
    </UiHeader>

    <div :class="`main_card ${!isUsingZodiacPilotExtension ? 'disabled' : ''}`">
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
              Transfer any token from Safe Contract to approved destination
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
            <v-col cols="12" sm="4">
              <v-label class="label_required mb-2">
                Input Token Address
              </v-label>
              <v-text-field
                v-model="transferEntry.inputTokenAddress"
                placeholder="E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
                :rules="[rules.required, rules.isValidAddress]"
                required
              />
            </v-col>
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
              <v-label
                v-if="
                  inputTokenDetais.formattedBalance && inputTokenDetais.symbol
                "
                class="available_balance"
              >
                Available Balance:
                {{ inputTokenDetais.formattedBalance }}
                {{ inputTokenDetais.symbol }}
              </v-label>
            </v-col>
          </v-row>
          <v-row>
            <v-col class="btn-submit">
              <v-tooltip
                activator="parent"
                location="bottom"
                :disabled="isUsingZodiacPilotExtension"
              >
                <template #activator="{ props }">
                  <v-btn
                    :disabled="
                      !formTransferIsValid || !isUsingZodiacPilotExtension
                    "
                    color="primary"
                    variant="outlined"
                    @click="handleTransfer"
                  >
                    Transfer
                  </v-btn>
                </template>
                <template #default>
                  Switch to the Zodiac Pilot Extension to Update NAV and Settle
                  Flows.
                </template>
              </v-tooltip>
            </v-col>
          </v-row>
        </v-form>
      </div>
    </div>

    <div :class="`main_card ${!isUsingZodiacPilotExtension ? 'disabled' : ''}`">
      <UiHeader>
        <div class="main_header__title">
          Submit Raw Transaction
          <UiTooltipClick location="right" :hide-after="6000">
            <Icon
              icon="material-symbols:info-outline"
              :class="'main_header__info-icon'"
              width="1.5rem"
            />

            <template #tooltip>
              Submit any approved Raw TXN on behalf of Safe Contract
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
                :rules="[rules.required, rules.isNonNegativeNumber]"
                required
              />
            </v-col>
          </v-row>
          <v-row>
            <v-col class="btn-submit">
              <v-tooltip
                activator="parent"
                location="bottom"
                :disabled="isUsingZodiacPilotExtension"
              >
                <template #activator="{ props }">
                  <v-btn
                    :disabled="
                      !formSubmitRawTXNIsValid || !isUsingZodiacPilotExtension
                    "
                    color="primary"
                    variant="outlined"
                    :loading="loadingSubmitRawTXN"
                    @click="submitRawTXN"
                  >
                    Submit
                  </v-btn>
                </template>
                <template #default>
                  Switch to the Zodiac Pilot Extension to Update NAV and Settle
                  Flows.
                </template>
              </v-tooltip>
            </v-col>
          </v-row>
        </v-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { DEFAULT_RETURN_FORMAT } from "web3";
import { ERC20 } from "~/assets/contracts/ERC20";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type IFund from "~/types/fund";
import { useAccountStore } from "~/store/account/account.store";

const fundStore = useFundStore();
const web3Store = useWeb3Store();
const toastStore = useToastStore();
const accountStore = useAccountStore();

const { isUsingZodiacPilotExtension } = storeToRefs(fundStore);
const loadingSubmitRawTXN = ref(false);
const formSubmitRawTXNIsValid = ref(false);
const submitRawTXNEntry = reactive({
  contractAddress: "0xeECa9AB62c474d8C94f55f7026495eeBe1542501",
  txData: "0x",
  amountValue: "1",
});

const loadingTransfer = ref(false);
const formTransferIsValid = ref(false);
const transferEntry = reactive({
  to: "",
  inputTokenAddress: "",
  depositValue: "",
});

const rules = {
  required: formRules.required,
  isValidAddress: formRules.isValidAddress,
  isNonNegativeNumber: formRules.isNonNegativeNumber,

  enoughBalance: (value: string) => {
    if (!inputTokenDetais.value.name)
      return "Please enter valid token address first.";

    let valueWei;
    try {
      valueWei = ethers.parseUnits(value, inputTokenDetais.value.decimals);
    } catch {
      return `Make sure the value has max ${inputTokenDetais.value.decimals} decimals.`;
    }

    if (valueWei <= 0) return "Value must be positive.";

    console.log("decimals: ", inputTokenDetais.value.decimals);
    console.log("valueWei: ", valueWei);
    console.log("userBaseTokenBalance: ", inputTokenDetais.value.balance);
    console.log(
      "valueWei > userBaseTokenBalance: ",
      valueWei > inputTokenDetais.value.balance,
    );

    if (inputTokenDetais.value.balance < valueWei) {
      const userBaseTokenBalanceFormatted = formatTokenValue(
        inputTokenDetais.value.balance,
        inputTokenDetais.value.decimals,
        false,
      );
      return `Your ${inputTokenDetais.value.symbol} balance is too low: ${userBaseTokenBalanceFormatted}.`;
    }

    return true;
  },
};

const handleTransfer = async () => {
  loadingTransfer.value = true;

  const decimals = inputTokenDetais.value.decimals;
  const tokensWei = ethers.parseUnits(transferEntry.depositValue, decimals);

  // call the transfer method
  await inputTokenContract.value
    .send("transfer", {}, transferEntry.to, tokensWei)
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

const submitRawTXN = async () => {
  try {
    loadingSubmitRawTXN.value = true;

    console.log("to:", submitRawTXNEntry.contractAddress);
    console.log("data:", submitRawTXNEntry.txData);
    console.log("from:", fundStore.activeAccountAddress);
    console.log("value:", parseInt(submitRawTXNEntry.amountValue));

    if (!accountStore.connectedWalletWeb3) {
      console.log("Send trx raw no connected wallet");
      toastStore.errorToast(
        "Connect your wallet.",
      );
      return;
    }
    await accountStore.connectedWalletWeb3.eth.sendTransaction({
      to: submitRawTXNEntry.contractAddress,
      data: submitRawTXNEntry.txData,
      from: fundStore.activeAccountAddress,
      // maxPriorityFeePerGas: "",
      maxFeePerGas: "",
      value: parseInt(submitRawTXNEntry.amountValue),
    },
    DEFAULT_RETURN_FORMAT,
    {
      // Disable revert check
      checkRevertBeforeSending: false,
    },
    )
      .on("transactionHash", (hash: any) => {
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

const inputTokenContract = ref();
const inputTokenDetais = ref({
  name: "",
  symbol: "",
  decimals: 0,
  balance: 0n,
  formattedBalance: "",
});

// fetch entered token details
const fetchTokenDetails = async () => {
  if (!transferEntry.inputTokenAddress) return;
  // e.g. for testing inputTokenAddresses (POLYGON):
  // 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063 DAI
  // 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 USDC
  // 0x7ceb23fd6bc0add59e62ac25578270cff1b9f619 WETH
  // 0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6 WBTC

  try {
    const tokenContract = web3Store.getCustomContract(
      fundStore.selectedFundChain,
      ERC20,
      transferEntry.inputTokenAddress,
    );

    inputTokenContract.value = tokenContract;

    const name = (await tokenContract.methods.name().call()) as string;
    const symbol = (await tokenContract.methods.symbol().call()) as string;
    const decimals = (await tokenContract.methods.decimals().call()) as bigint;
    const balance = (await tokenContract.methods
      .balanceOf(fundStore.activeAccountAddress ?? "")
      .call()) as bigint;

    const formattedBalance = formatTokenValue(balance, Number(decimals), false);

    console.log("name: ", name);
    console.log("symbol: ", symbol);
    console.log("decimals: ", decimals);
    console.log("balance: ", balance);
    console.log("formattedBalance: ", formattedBalance);

    // set the token details
    inputTokenDetais.value = {
      name,
      symbol,
      decimals: Number(decimals),
      balance,
      formattedBalance,
    };
  } catch (error) {
    console.error(error);
  }
};

// check if the inputTokenAddress is valid
const validateInputTokenAddress = computed(() => {
  const requiredValid =
    rules.required(transferEntry.inputTokenAddress) === true;
  const addressValid =
    rules.isValidAddress(transferEntry.inputTokenAddress) === true;

  return requiredValid && addressValid;
});

// watch the inputTokenAddress and fetch token details if it is valid
watch(
  () => transferEntry.inputTokenAddress,
  async (newVal) => {
    if (validateInputTokenAddress.value) {
      await fetchTokenDetails();
    } else {
      inputTokenDetais.value = {
        name: "",
        symbol: "",
        decimals: 0,
        balance: 0n,
        formattedBalance: "",
      };
    }
  },
);
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

.main_card {
  display: flex;
  flex-direction: column;
  gap: 32px;

  &.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
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
.available_balance {
  white-space: wrap;
}
.btn-submit {
  display: flex;
  justify-content: flex-end;
  max-width: fit-content;
  margin-left: auto;
}
</style>
