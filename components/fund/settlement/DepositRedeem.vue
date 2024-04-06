<template>
  <div class="request_deposit">
    <div class="request_deposit__token">
      <div class="request_deposit__token_header">
        Token
        <span>
          <Icon name="IconQuestionCircle" size="1rem" />
          <v-tooltip v-if="token0" activator="parent" location="right">
            {{ token0.name }} ({{ token0.address }}).
          </v-tooltip>
        </span>
      </div>

      <div class="request_deposit__token_data">
        <div class="request_deposit__token_col">
          {{ token0.name }}
        </div>
        <div class="request_deposit__token_col pa-0 request_deposit__token_col--dark text-end">
          <InputNumber
            v-model="tokenValue"
            class="request_deposit__input_amount"
          />
        </div>
      </div>
      <div class="request_deposit__balance">
        Balance: {{ token0.balance }} {{ token0.name }}
      </div>
    </div>

    <div class="request_deposit__token">
      <div class="request_deposit__token_header">
        Token
        <span>
          <Icon name="IconQuestionCircle" size="1rem" />
          <v-tooltip v-if="token1" activator="parent" location="right">
            {{ token1.name }} ({{ token1.address }}).
          </v-tooltip>
        </span>
      </div>

      <div class="request_deposit__token_data">
        <div class="request_deposit__token_col">
          {{ token1.name }}
        </div>
        <div class="request_deposit__token_col text-end">
          ≈ {{ calculatedToken1Value }}
        </div>
      </div>
      <div class="request_deposit__balance">
        <div>
          Balance: {{ token1.balance }} {{ token1.name }}
        </div>
        <div>
          Last NAV Update Value: {{ exchangeRateText }}
        </div>
      </div>
    </div>
    <div class="buttons_container">
      <div>
        <div class="request_deposit__button">
          <v-btn class="bg-primary text-secondary" @click="cancelDeposit">
            Cancel {{ buttonText }}
          </v-btn>
        </div>
        <div class="request_deposit__button">
          <v-btn class="bg-primary text-secondary" @click="approveAllowance">
            Approve {{ buttonText }}
          </v-btn>
        </div>
      </div>
      <div>
        <div class="request_deposit__button">
          <v-btn class="bg-primary text-secondary" @click="requestDeposit">
            Request {{ buttonText }}
          </v-btn>
        </div>
        <div class="request_deposit__button">
          <v-btn class="bg-primary text-secondary" @click="depositIntoFund">
            {{ buttonText }}
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ethers } from "ethers";
import { computed, onMounted, ref } from "vue";
import GovernableFund from "~/assets/contracts/GovernableFund.json";
import { trimTrailingZeros } from "~/composables/utils";
import { useAccountsStore } from "~/store/accounts.store";
import type { FundContract } from "~/store/fund.store";
import { useFundStore } from "~/store/fund.store";
import { useDaiStore } from "~/store/tokens/dai.store";
import { useUsdcStore } from "~/store/tokens/usdc.store";
import type IToken from "~/types/token";

export default {
  name: "DepositRedeem",
  props: {
    action: {
      type: String,
      validator: function (value: string) {
        // Validate that the value is one of the allowed values
        return ["deposit", "redeem", "cancelDeposit", "approveDeposit", "requestDeposit"].includes(value);
      },
      default: "deposit",
    },
    token0: {
      type: Object as PropType<IToken>,
      default: () => {},
    },
    token1: {
      type: Object as PropType<IToken>,
      default: () => {},
    },
  },
  setup(props) {
    const accountsStore = useAccountsStore();
    const fundStore = useFundStore();
    const daiStore = useDaiStore();
    const usdcStore = useUsdcStore();

    const depositValue = ref<string | null>(null);
    const loading = ref<boolean>(false);
    const selectedToken = ref<string>("DAI");

    // Fetch balances and allowances when the component is mounted
    onMounted(() => {
      daiStore.fetchUserBalance();
      daiStore.fetchFundAllowance();
      usdcStore.fetchUserBalance();
      usdcStore.fetchFundAllowance();
    });

    const tokenValue = ref(0);
    const rules = [
      (value: number) => value <= 0 ? "Value must be positive." : true,
    ];

    const isDepositValueNotValid = computed(() => {
      // too many digits
      if (String(depositValue.value).length > 14) {
        return { status: true, message: "Please reduce the number of digits." };
      }

      // negative number
      if (Number(depositValue.value) < 0) {
        return { status: true, message: "Deposit value must not be negative!" };
      }

      // not a number
      if (isNaN(Number(depositValue.value))) {
        return { status: true, message: "Please enter a number." };
      }

      // deposit value bigger than balance
      if (Number(depositValue.value) > Number(getUserStablecoinBalance.value)) {
        return { status: true, message: `Your ${selectedToken.value} balance is too low.` };
      }

      return { status: false, message: "Valid deposit value" };
    });

    const isEnoughAllowance = computed(() => {
      if (selectedToken.value === "DAI") {
        return Number(depositValue.value) <= Number(daiStore.getFundDaiAllowance);
      } else if (selectedToken.value === "USDC") {
        return Number(depositValue.value) <= Number(usdcStore.getFundUsdcAllowance);
      }

      return false;
    });

    const getStablecoinContract = computed(() => {
      if (selectedToken.value === "DAI") {
        return daiStore.getDaiContract;
      } else if (selectedToken.value === "USDC") {
        return usdcStore.getUsdcContract;
      }

      return null;
    });

    const getUserStablecoinBalance = computed(() => {
      if (selectedToken.value === "DAI") {
        return daiStore.getUserDaiBalance;
      } else if (selectedToken.value === "USDC") {
        return usdcStore.getUserUsdcBalance;
      }

      return null;
    });
    const exchangeRate = computed(() => {
      // Assuming token0 and token1 are reactive references or props
      return props.token0.balance / props.token1.balance;
    });

    const exchangeRateText = computed(() => {
      // Make sure to handle potential reactivity or null checks as needed
      return `1 ${props.token0.name} = ${exchangeRate.value.toFixed(2)} ${props.token1.name}`;
    });

    const calculatedToken1Value = computed(() => {
      // Continue to use your trimTrailingZeros utility function as needed
      return trimTrailingZeros((tokenValue.value * exchangeRate.value).toFixed(4));
    });

    const buttonText = computed(() => {
      // Assuming 'action' is a prop or reactive reference
      return props.action === "deposit" ? "Deposit" : "Redeem";
    });

    // deposit approval
    const approveAllowance = async () => {
      loading.value = true;

      let unit = "ether"; // DAI - 18 decimals

      if (selectedToken.value === "USDT") {
        unit = "kwei"; // USDT (Tether) - 4 decimals
      }

      if (selectedToken.value === "USDC") {
        unit = "mwei"; // USDC - 6 decimals
      }

      const signer = await accountsStore.ethersProvider?.getSigner();
      if (!signer) return "No signer found";

      // todo something wrong when getting contracts from store, couldn't find the solution yet
      // it causes to functions fail with the error: "Cannot access private method"
      // so I'm using the contract directly here, didn't find a better solution yet
      // didn't do the same for the stable contracts.
      const stablecoinContract = getStablecoinContract.value;
      if(!stablecoinContract) return "No stablecoin contract found";
      // console.log("Stablecoin contract: " + await stablecoinContract.getAddress());

      try {
        const tokensWei = ethers.parseUnits(depositValue.value || "0", unit);
        // const transaction = await (stablecoinContract.connect(signer) as ContractMethod).approve(fundStore.getFundAddress, tokensWei);
        // const transaction = await (stablecoinContract.connect(signer) as ContractMethod).approve(address,uint256)(fundStore.getFundAddress, tokensWei);
        // const approveFunction = stablecoinContract.connect(signer).getFunction("approve(address,uint256)");
        // const transaction = await approveFunction(fundStore.getFundAddress, tokensWei);
        const transaction = await (stablecoinContract.connect(signer) as FundContract).approve(fundStore.getFundAddress,tokensWei);


        console.log("TX: " + transaction);
        // console.log("tx hash: " + transaction.hash);
        // Use your toast notification system to display the message
        // For example, using Vue 3's globalProperties
        // app.config.globalProperties.$toast.info("The transaction has been submitted. Please wait for it to be confirmed.");

        // const receipt = await transaction.wait();
        // console.log(receipt);

        // if (receipt.status) {
        //   // Use your toast notification system to display the success message
        //   // app.config.globalProperties.$toast.success("The approval was successful. You can make the deposit now.");

        //   // Refresh allowance values
        //   if (selectedToken.value === "DAI") {
        //     daiStore.fetchFundAllowance();
        //   } else if (selectedToken.value === "USDC") {
        //     usdcStore.fetchFundAllowance();
        //   }
        // } else {
        //   // Use your toast notification system to display the error message
        //   // app.config.globalProperties.$toast.error("The transaction has failed. Please contact the Rethink Finance support.");
        // }
      } catch (error) {
        console.error(error);
        // Use your toast notification system to display the error message
        // app.config.globalProperties.$toast.error("There has been an error. Please contact the Rethink Finance support.");
      } finally {
        loading.value = false;
      }
    };

    const changeStablecoin = (token: string) => {
      selectedToken.value = token;
    };

    // deposit
    const depositIntoFund = async () => {
      loading.value = true;

      // const signer = accountsStore.ethersProvider?.getSigner();
      // const fundContract = fundStore.getFundContract;
      const [ fundContract, signer ] = await fethFundContract() as [FundContract, ethers.JsonRpcSigner];
      try {
        const transaction = await (fundContract.connect(signer)as FundContract).deposit();
        console.log("TX: " + transaction);
        // console.log("tx hash: " + transaction.hash);
        // Use your toast notification system to display the message
        // For example, using Vue 3's globalProperties
        // app.config.globalProperties.$toast.info("The transaction has been submitted. Please wait for it to be confirmed.");

        // const receipt = await transaction.wait();
        // console.log(receipt);

        // if (receipt.status) {
        //   // Use your toast notification system to display the success message
        //   // app.config.globalProperties.$toast.success("Your deposit was successful.");

        //   // Refresh fund and user balances
        //   fundStore.fetchFundBalance();
        //   fundStore.fetchUserBalance();
        //   fundStore.fetchUserFundUsdValue();

        //   // Refresh token balances and allowances
        //   if (selectedToken.value === "DAI") {
        //     daiStore.fetchUserBalance();
        //     daiStore.fetchFundAllowance();
        //   } else if (selectedToken.value === "USDC") {
        //     usdcStore.fetchUserBalance();
        //     usdcStore.fetchFundAllowance();
        //   }

        //   depositValue.value = null;
        // } else {
        //   // Use your toast notification system to display the error message
        //   // app.config.globalProperties.$toast.error("The transaction has failed. Please contact the Rethink Finance support.");
        // }
      } catch (error) {
        console.error(error);
        // Use your toast notification system to display the error message
        // app.config.globalProperties.$toast.error("There has been an error. Please contact the Rethink Finance support.");
      } finally {
        loading.value = false;
      }
    };

    const requestDeposit = async () => {
      console.log("Request deposit");
      loading.value = true;

      let unit = "ether"; // DAI
      if (selectedToken.value === "USDC") {
        unit = "mwei"; // USDC
      }

      const [ fundContract, signer ] = await fethFundContract() as [FundContract, ethers.JsonRpcSigner];
      if(!fundContract) return console.error("No fund contract found");
      try {
        const tokensWei = ethers.parseUnits(depositValue.value || "0", unit);
        console.log("Request deposit: " + tokensWei);
        const transaction = await (fundContract.connect(signer as ethers.JsonRpcSigner) as FundContract).requestDeposit(tokensWei);
        console.log("TX: " + transaction);
        console.log("tx hash: " + transaction.data);

        // Use your toast notification system to display the message
        // For example, using Vue 3's globalProperties
        // app.config.globalProperties.$toast.info("The transaction has been submitted. Please wait for it to be confirmed.");

        const receipt = await transaction;
        console.log(receipt);

        // if (receipt.status) {
        //   // Use your toast notification system to display the success message
        //   // app.config.globalProperties.$toast.success("Your deposit request was successful.");
        //   depositValue.value = null;
        // } else {
        //   // Use your toast notification system to display the error message
        //   // app.config.globalProperties.$toast.error("Your deposit request has failed. Please contact the Rethink Finance support.");
        // }
      } catch (error) {
        console.error("ERROR in request deposit",error);
        // Use your toast notification system to display the error message
        // app.config.globalProperties.$toast.error("There has been an error. Please contact the Rethink Finance support.");
      } finally {
        loading.value = false;
      }
    };

    const cancelDeposit = async () => {
      loading.value = true;

      const [ fundContract, signer ] = await fethFundContract() as [FundContract, ethers.JsonRpcSigner];

      try {
        const transaction = await (fundContract.connect(signer) as FundContract).revokeDepositWithrawal(true);
        console.log("TX: " + transaction);
        // console.log("tx hash: " + transaction.hash);
        // Use your toast notification system to display the message
        // For example, using Vue 3's globalProperties
        // app.config.globalProperties.$toast.info("The transaction has been submitted. Please wait for it to be confirmed.");

        // const receipt = await transaction.wait();
        // console.log(receipt);

        // if (receipt.status) {
        //   // Use your toast notification system to display the success message
        //   // app.config.globalProperties.$toast.success("Your deposit request was successful.");
        //   depositValue.value = null;
        // } else {
        //   // Use your toast notification system to display the error message
        //   // app.config.globalProperties.$toast.error("Your deposit request has failed. Please contact the Rethink Finance support.");
        // }
      } catch (error) {
        console.error(error);
        // Use your toast notification system to display the error message
        // app.config.globalProperties.$toast.error("There has been an error. Please contact the Rethink Finance support.");
      } finally {
        loading.value = false;
      }
    };

    const fethFundContract = async () => {
      const fundAddress = fundStore.selectedFundAddress;
      const signer = await accountsStore.ethersProvider?.getSigner();
      const fundContract = new ethers.Contract(fundAddress, GovernableFund.abi) as unknown as FundContract;
      return [fundContract, signer];
    };

    return {
      depositValue,
      loading,
      selectedToken,
      isDepositValueNotValid,
      isEnoughAllowance,
      getStablecoinContract,
      getUserStablecoinBalance,
      rules,
      tokenValue,
      exchangeRateText,
      calculatedToken1Value,
      buttonText,
      approveAllowance,
      changeStablecoin,
      depositIntoFund,
      requestDeposit,
      cancelDeposit,
    };
  },

  // data() {
  //   return {
  //     tokenValue: 0,
  //     rules: [
  //       (value: number) => {
  //         if (value <= 0) {
  //           return "Value must be positive."
  //         }
  //         return true
  //       },
  //     ],
  //   }
  // },

  // computed: {
  //   exchangeRate() {
  //     // TODO @dev probably better to get this data from the API.
  //     return this.token0.balance / this.token1.balance;
  //   },
  //   exchangeRateText() {
  //     // TODO @dev edit this if needed & format.
  //     return `1 ${this.token0.name} = ${this.exchangeRate.toFixed(2)} ${this.token1.name}`;
  //   },
  //   calculatedToken1Value() {
  //     // Round to 4 decimals and cut trailing zeros.
  //     return trimTrailingZeros((this.tokenValue * this.exchangeRate).toFixed(4));
  //   },
  //   buttonText() {
  //     if (this.action === "deposit") {
  //       return "Request Deposit"
  //     }
  //     return "Request Redeem"
  //   },
  // },
  // methods :{
  //   // requestDeposit() {
  //   //   const fundDeposit = new FundDeposit;
  //   //   fundDeposit.requestDeposit();
  //   // },
  //   // requestDeposit = async () => {
  //   //   loading.value = true;

  //   //   let unit = "ether"; // DAI
  //   //   if (selectedToken.value === "USDC") {
  //   //     unit = "mwei"; // USDC
  //   //   }

  //   //   // Assuming you have an ethersProvider in your accounts store
  //   //   const signer = accountsStore.ethersProvider?.getSigner();
  //   //   const fundContract = fundStore.getFundContract; // Make sure this is an ethers Contract instance

  //   //   try {
  //   //     const tokensWei = ethers.parseUnits(depositValue.value || "0", unit);
  //   //     const transaction = await fundContract.connect(signer).requestDeposit(tokensWei, {
  //   //       // Gas settings can be adjusted as needed
  //   //     });

  //   //     console.log("tx hash: " + transaction.hash);
  //   //     // Use your toast notification system to display the message
  //   //     // For example, using Vue 3's globalProperties
  //   //     // app.config.globalProperties.$toast.info("The transaction has been submitted. Please wait for it to be confirmed.");

  //   //     const receipt = await transaction.wait();
  //   //     console.log(receipt);

  //   //     if (receipt.status) {
  //   //       // Use your toast notification system to display the success message
  //   //       // app.config.globalProperties.$toast.success("Your deposit request was successful.");
  //   //       depositValue.value = null;
  //   //     } else {
  //   //       // Use your toast notification system to display the error message
  //   //       // app.config.globalProperties.$toast.error("Your deposit request has failed. Please contact the Rethink Finance support.");
  //   //     }
  //   //   } catch (error) {
  //   //     console.error(error);
  //   //     // Use your toast notification system to display the error message
  //   //     // app.config.globalProperties.$toast.error("There has been an error. Please contact the Rethink Finance support.");
  //   //   } finally {
  //   //     loading.value = false;
  //   //   }
  //   // },
  //   // async requestRedeem() {
  //   //   // TODO @dev implement this method.
  //   //   console.log("Request redeem");
  //   // },
  // },
};
</script>

<style lang="scss" scoped>
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
}
.request_deposit {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-size: $text-sm;
  line-height: 1;

  &__token {
    font-weight: 500;
    width: 100%;
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
    flex-direction: column;
    gap: 0.5rem;
  }
  &__button {
    margin: auto;
    margin-top: 0.5rem;
  }
}
</style>
