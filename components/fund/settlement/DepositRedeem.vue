<template>
  <div class="request_deposit">
    <div class="request_deposit__token">
      <div class="request_deposit__token_header">
        Token
        <span>
          <Icon name="IconQuestionCircle" size="1rem" />
          <v-tooltip v-if="token0" activator="parent" location="right">
            {{ token0.symbol }} ({{ token0.address }}).
          </v-tooltip>
        </span>
      </div>

      <div class="request_deposit__token_data">
        <div class="request_deposit__token_col">
          {{ token0.symbol }}
        </div>
        <div class="request_deposit__token_col pa-0 request_deposit__token_col--dark text-end">
          <InputNumber
            v-model="tokenValue"
            :rules="rules"
            class="request_deposit__input_amount"
          />
        </div>
      </div>
      <div class="request_deposit__balance">
        Balance: {{ token0 }} {{ token0.symbol }}
      </div>
    </div>

    <div class="request_deposit__token">
      <div class="request_deposit__token_header">
        Token
        <span>
          <Icon name="IconQuestionCircle" size="1rem" />
          <v-tooltip v-if="token1" activator="parent" location="right">
            {{ token1.symbol }} ({{ token1.address }}).
          </v-tooltip>
        </span>
      </div>

      <div class="request_deposit__token_data">
        <div class="request_deposit__token_col">
          {{ token1.symbol }}
        </div>
        <div class="request_deposit__token_col text-end">
          ≈ {{ calculatedToken1Value }}
        </div>
      </div>
      <div class="request_deposit__balance">
        <div v-if="accountsStore.isConnected">
          Balance: {{ userBaseTokenBalanceFormatted }} {{ token1.symbol }}
        </div>
        <div>
          Last NAV Update Value: {{ exchangeRateText }}
        </div>
      </div>
    </div>
    <div class="buttons_container">
      <template v-if="accountsStore.isConnected">
        <div class="request_deposit__button">
          <v-btn class="bg-primary text-secondary" :disabled="!isTokenValueValid">
            Request {{ buttonText }}
          </v-btn>
        </div>
      </template>
      <template v-else>
        <div class="request_deposit__button">
          <v-btn class="bg-primary text-secondary" @click="accountsStore.connectWallet()">
            Connect Wallet
          </v-btn>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { ethers } from "ethers";
import { useAccountsStore } from "~/store/accounts.store";
import { useFundStore } from "~/store/fund.store";
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

    const loading = ref<boolean>(false);
    const selectedToken = ref<string>("DAI");
    const tokenValue = ref(0);

    const rules = [
      // TODO Add rule for max decimals
      (value: number) => {
        const valueWei = ethers.parseUnits(value.toString(), props.token0.decimals);
        if (valueWei <= 0) return "Value must be positive."
        if (userBaseTokenBalance.value < valueWei) return "Your " + props.token0.symbol + " balance is too low."
        return true;
      },
    ];

    const isTokenValueValid = computed(() => {
      // Check each rule and return true if all rules are valid, or false if any rule fails
      return rules.every(rule => rule(tokenValue.value));
    });

    const userBaseTokenBalance = computed(() => {
      return fundStore.userBaseTokenBalance;
    });
    const userBaseTokenBalanceFormatted = computed(() => {
      return "#TODO";
    });

    const exchangeRateText = computed(() => {
      // Make sure to handle potential reactivity or null checks as needed
      // TODO to fix
      return "#TODO ";
      // return `1 ${props.token0.symbol} = ${exchangeRate.value.toFixed(2)} ${props.token1.symbol}`;
    });

    const calculatedToken1Value = computed(() => {
      // Continue to use your trimTrailingZeros utility function as needed
      // TODO to fix
      return "#TODO";
      // return trimTrailingZeros((tokenValue.value * exchangeRate.value).toFixed(4));
    });

    const buttonText = computed(() => {
      // Assuming 'action' is a prop or reactive reference
      return props.action === "deposit" ? "Deposit" : "Redeem";
    });


    return {
      loading,
      selectedToken,
      isTokenValueValid,
      userBaseTokenBalance,
      userBaseTokenBalanceFormatted,
      rules,
      tokenValue,
      exchangeRateText,
      calculatedToken1Value,
      buttonText,
      accountsStore,
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
  //     return `1 ${this.token0.symbol} = ${this.exchangeRate.toFixed(2)} ${this.token1.symbol}`;
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
  //   //     const tokensWei = ethers.parseUnits(tokenValue.value.toString() || "0", unit);
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
  //   //       tokenValue.value = null;
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
