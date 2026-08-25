<template>
  <div class="execution-app">
    <!--
      Only the state that permits something. Why a wallet cannot execute is
      not news at the top of a screen most people open to read: it belongs on
      the button it disables, at the moment that button is reached for, and
      every execute button on this screen carries it.
    -->
    <UiHeader v-if="canExecuteAsCurator">
      <div class="data_bar__item">
        <div class="curator_status">
          <Icon
            icon="octicon:check-circle-fill-16"
            width="1rem"
            height="1rem"
            color="var(--color-success)"
          />
          <div>
            {{
              isConnectedAsSafe
                ? "Connected as the custody Safe"
                : "Connected as a vault curator"
            }}
          </div>
        </div>
      </div>
    </UiHeader>

    <!-- The design puts the execution status first on this screen, so the
         console follows it rather than sitting above the page's own header. -->
    <ExecutionCrtConsole v-if="isCrtVault" />
    <ExecutionDocConsole v-else-if="isDocVault" />

    <!-- The raw transfer / raw-calldata / performance-fee tools. A vault with
         a console of its own does not get them: everything they reach is
         already offered there in terms the operator can check, and a free-text
         calldata box beside it is an invitation to bypass that. -->
    <div v-if="!isDocVault" class="group_title execution-app__section">
      General
    </div>

    <div
      v-if="!isDocVault"
      :class="`main_card ${!canExecuteAsCurator ? 'disabled' : ''}`"
    >
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
                :disabled="!curatorDisabledReason"
              >
                <template #activator>
                  <v-btn
                    :disabled="!formTransferIsValid || !canExecuteAsCurator"
                    color="primary"
                    variant="outlined"
                    :loading="loadingTransfer"
                    @click="handleTransfer"
                  >
                    Transfer
                  </v-btn>
                </template>
                <template #default>
                  {{ curatorDisabledReason }}
                </template>
              </v-tooltip>
            </v-col>
          </v-row>
        </v-form>
      </div>
    </div>

    <div
      v-if="!isDocVault"
      :class="`main_card ${!canExecuteAsCurator ? 'disabled' : ''}`"
    >
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
                :disabled="!curatorDisabledReason"
              >
                <template #activator>
                  <v-btn
                    :disabled="!formSubmitRawTXNIsValid || !canExecuteAsCurator"
                    color="primary"
                    variant="outlined"
                    :loading="loadingSubmitRawTXN"
                    @click="submitRawTXN"
                  >
                    Submit
                  </v-btn>
                </template>
                <template #default>
                  {{ curatorDisabledReason }}
                </template>
              </v-tooltip>
            </v-col>
          </v-row>
          <v-row>
            <v-col class="btn-submit">
              <v-btn
                :disabled="!canExecuteAsCurator"
                color="primary"
                variant="text"
                @click="prefillPerformanceFeeTx"
              >
                Execute Performance Fee (HWM)
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
import { ERC20 } from "~/assets/contracts/ERC20";
import { useCuratorExecution } from "~/composables/permissions/useCuratorExecution";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useContractAddresses } from "~/composables/useContractAddresses";

const fundStore = useFundStore();
const web3Store = useWeb3Store();
const toastStore = useToastStore();

// Every action on this page acts with the Safe's authority. A curator signs
// from their own wallet and the calldata is forwarded by the vault's Roles
// modifier; a wallet connected as the Safe still sends it unwrapped.
const {
  canExecute: canExecuteAsCurator,
  isConnectedAsSafe,
  disabledReason: curatorDisabledReason,
  sendAsCurator,
} = useCuratorExecution();

const erc20Iface = new ethers.Interface(ERC20 as any);
const CRT_VAULT_ADDRESS = "0x7890e0ff3d76f71a3d33b17fb5b3f3866512485b";
const isCrtVault = computed(
  () =>
    (fundStore.fund?.address || "").toLowerCase() === CRT_VAULT_ADDRESS &&
    fundStore.selectedFundChain === "0x3e7",
);
// DoC Treasury Protection runs a Roles v1 whitelist of its own — 1inch swaps
// between six assets and Aave DAI — so it gets its own console rather than
// being driven through the raw-transaction box below.
const DOC_VAULT_ADDRESS = "0xbe0b0c435ea1156f76d3e116fbd5606743ab179a";
const isDocVault = computed(
  () =>
    (fundStore.fund?.address || "").toLowerCase() === DOC_VAULT_ADDRESS &&
    fundStore.selectedFundChain === "0x89",
);
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

// Address of PoolPerformanceFeeBeaconProxy per chain
const { rethinkContractAddresses } = useContractAddresses();
const poolPerformanceFeeAddress = computed(() => {
  // Prefer fundStore.selectedFundChain as current chain id
  const chainId = fundStore.selectedFundChain;
  return rethinkContractAddresses.PoolPerformanceFeeBeaconProxy[chainId];
});

// Prefill the Raw TXN form with calldata for
// fundFlowsCall(mintPoolPerformanceFeeHWM(address performanceFeeCalculator))
const prefillPerformanceFeeTx = () => {
  try {
    const gfAddress = fundStore.fund?.address ?? fundStore.activeAccountAddress;
    if (!gfAddress) {
      toastStore.errorToast("Fund address is not available.");
      return;
    }
    const perfAddr = poolPerformanceFeeAddress.value;
    if (!perfAddr) {
      toastStore.errorToast(
        "Pool Performance Fee address is not configured for this chain.",
      );
      return;
    }

    // Build interface for both functions
    const iface = new ethers.Interface([
      "function fundFlowsCall(bytes data)",
      "function mintPoolPerformanceFeeHWM(address performanceFeeCalculator)",
    ]);
    const innerData = iface.encodeFunctionData("mintPoolPerformanceFeeHWM", [
      perfAddr,
    ]);
    const outerData = iface.encodeFunctionData("fundFlowsCall", [innerData]);

    submitRawTXNEntry.contractAddress = gfAddress;
    submitRawTXNEntry.txData = outerData;
    submitRawTXNEntry.amountValue = "0";

    submitRawTXN();
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to prepare transaction calldata.");
  }
};

const handleTransfer = async () => {
  loadingTransfer.value = true;

  const decimals = inputTokenDetais.value.decimals;
  const tokensWei = ethers.parseUnits(transferEntry.depositValue, decimals);

  try {
    // The tokens belong to the Safe, so the transfer calldata is what goes
    // through the modifier — not a send from the connected wallet.
    const transaction = await sendAsCurator({
      to: transferEntry.inputTokenAddress,
      data: erc20Iface.encodeFunctionData("transfer", [
        transferEntry.to,
        tokensWei,
      ]),
    });

    await transaction
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
  } catch (error: any) {
    console.error(error);
    loadingTransfer.value = false;
    // Roles pre-flight failures carry the modifier's own reason.
    toastStore.errorToast(
      error?.message ||
        "There has been an error. Please contact the Rethink Finance support.",
    );
  }
};

const submitRawTXN = async () => {
  try {
    loadingSubmitRawTXN.value = true;

    console.log("to:", submitRawTXNEntry.contractAddress);
    console.log("data:", submitRawTXNEntry.txData);
    console.log("from:", fundStore.activeAccountAddress);
    console.log("value:", submitRawTXNEntry.amountValue);

    // Amount is wei, as it always was on this form. It used to go through
    // parseInt, which silently turned anything fractional into 0 — say so
    // instead of sending a different transaction than the one typed.
    let value = "0";
    try {
      value = BigInt(submitRawTXNEntry.amountValue || "0").toString();
    } catch {
      toastStore.errorToast(
        "Amount must be a whole number of wei (no decimals).",
      );
      loadingSubmitRawTXN.value = false;
      return;
    }

    // The raw transaction is executed with the Safe's authority: the value
    // is sent by the Safe, and the modifier is what has to allow it (a
    // manager role scoped with ExecutionOptions.None will refuse any value).
    const transaction = await sendAsCurator({
      to: submitRawTXNEntry.contractAddress,
      data: submitRawTXNEntry.txData,
      value,
    });

    await transaction
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

    // Roles pre-flight failures arrive as a plain Error naming the denied
    // permission — more useful than the generic message.
    const message = error?.data?.message || error?.message;
    if (message) {
      toastStore.errorToast(message, 15000);
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
  async (_newVal) => {
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
/* Design's status pill: mono caption with a state marker. */
.curator_status {
  align-items: center;
  display: flex;
  border: 1px solid $color-line-2;
  padding: 0.5625rem 0.8125rem;
  flex-direction: row;
  border-radius: $default-border-radius;
  font-family: $font-mono;
  font-size: 12px;
  letter-spacing: 0.04em;
  font-weight: 400;
  color: $color-text-irrelevant;
  gap: 0.6rem;
}

/* Same distance from its cards as the console's own group headings keep. */
.execution-app__section {
  margin-bottom: 1rem;
}

.main_card {
  display: flex;
  flex-direction: column;
  gap: 32px;

  /* Design keeps disabled cards readable — dimmed, not interactive. */
  &.disabled {
    opacity: 0.55;
    pointer-events: none;
  }
}

// main header style — card titles as design eyebrows
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
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
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
  font-family: $font-mono;
  font-size: 11px;
  color: $color-cyan;
}
/* Field labels as the design's mono uppercase captions. */
.inputs :deep(.v-label) {
  font-family: $font-mono;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: $color-steel-blue;
  opacity: 1;
}
.btn-submit {
  display: flex;
  justify-content: flex-end;
  max-width: fit-content;
  margin-left: auto;
}
</style>
