<script lang="ts">
import { ethers } from "ethers";
import { computed, defineComponent, onMounted, ref } from "vue";
import { useAccountsStore } from "~/store/accounts.store";
import { useFundStore } from "~/store/fund.store";
import { useDaiStore } from "~/store/tokens/dai.store";
import { useUsdcStore } from "~/store/tokens/usdc.store";

// @dev This component is used as a placeholder for the old logic for FundDeposit component.
// Used AI to convert the logic to Vue 3 Composition API.
// Can be deleted or refactored as needed.(This is not used in the current version of the app)
// The logic here is moved inside the DepositRedeem file
export default defineComponent({
  name: "FundDeposit",
  setup() {
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

      const stablecoinContract = getStablecoinContract.value; // Make sure this is an ethers Contract instance
      if(!stablecoinContract) return "No stablecoin contract found";

      try {
        const tokensWei = ethers.parseUnits(depositValue.value || "0", unit);
        // const transaction = await (stablecoinContract.connect(signer) as ContractMethod).approve(fundStore.getFundAddress, tokensWei);
        // const transaction = await (stablecoinContract.connect(signer) as ContractMethod).approve(address,uint256)(fundStore.getFundAddress, tokensWei);
        const approveFunction = stablecoinContract.connect(signer).getFunction("approve(address,uint256)");
        const transaction = await approveFunction(fundStore.getFundAddress, tokensWei);


        console.log("tx hash: " + transaction.hash);
        // Use your toast notification system to display the message
        // For example, using Vue 3's globalProperties
        // app.config.globalProperties.$toast.info("The transaction has been submitted. Please wait for it to be confirmed.");

        const receipt = await transaction.wait();
        console.log(receipt);

        if (receipt.status) {
          // Use your toast notification system to display the success message
          // app.config.globalProperties.$toast.success("The approval was successful. You can make the deposit now.");

          // Refresh allowance values
          if (selectedToken.value === "DAI") {
            daiStore.fetchFundAllowance();
          } else if (selectedToken.value === "USDC") {
            usdcStore.fetchFundAllowance();
          }
        } else {
          // Use your toast notification system to display the error message
          // app.config.globalProperties.$toast.error("The transaction has failed. Please contact the Rethink Finance support.");
        }
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

      const signer = accountsStore.ethersProvider?.getSigner();
      const fundContract = fundStore.fundContract; // Make sure this is an ethers Contract instance

      try {
        const transaction = await fundContract.connect(signer).deposit({
          // Gas settings can be adjusted as needed
        });

        console.log("tx hash: " + transaction.hash);
        // Use your toast notification system to display the message
        // For example, using Vue 3's globalProperties
        // app.config.globalProperties.$toast.info("The transaction has been submitted. Please wait for it to be confirmed.");

        const receipt = await transaction.wait();
        console.log(receipt);

        if (receipt.status) {
          // Use your toast notification system to display the success message
          // app.config.globalProperties.$toast.success("Your deposit was successful.");

          // Refresh fund and user balances
          fundStore.fetchFundBalance();
          fundStore.fetchUserBalance();
          fundStore.fetchUserFundUsdValue();

          // Refresh token balances and allowances
          if (selectedToken.value === "DAI") {
            daiStore.fetchUserBalance();
            daiStore.fetchFundAllowance();
          } else if (selectedToken.value === "USDC") {
            usdcStore.fetchUserBalance();
            usdcStore.fetchFundAllowance();
          }

          depositValue.value = null;
        } else {
          // Use your toast notification system to display the error message
          // app.config.globalProperties.$toast.error("The transaction has failed. Please contact the Rethink Finance support.");
        }
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

      const signer = accountsStore.ethersProvider?.getSigner();
      const fundContract = fundStore.fundContract; // Make sure this is an ethers Contract instance

      try {
        const tokensWei = ethers.parseUnits(depositValue.value || "0", unit);
        const transaction = await fundContract.connect(signer).requestDeposit(tokensWei, {
          // Gas settings can be adjusted as needed
        });

        console.log("tx hash: " + transaction.hash);
        // Use your toast notification system to display the message
        // For example, using Vue 3's globalProperties
        // app.config.globalProperties.$toast.info("The transaction has been submitted. Please wait for it to be confirmed.");

        const receipt = await transaction.wait();
        console.log(receipt);

        if (receipt.status) {
          // Use your toast notification system to display the success message
          // app.config.globalProperties.$toast.success("Your deposit request was successful.");
          depositValue.value = null;
        } else {
          // Use your toast notification system to display the error message
          // app.config.globalProperties.$toast.error("Your deposit request has failed. Please contact the Rethink Finance support.");
        }
      } catch (error) {
        console.error(error);
        // Use your toast notification system to display the error message
        // app.config.globalProperties.$toast.error("There has been an error. Please contact the Rethink Finance support.");
      } finally {
        loading.value = false;
      }
    };

    const cancelDeposit = async () => {
      loading.value = true;

      const signer = accountsStore.ethersProvider?.getSigner();
      const fundContract = fundStore.fundContract; // Make sure this is an ethers Contract instance

      try {
        const transaction = await fundContract.connect(signer).revokeDepositWithdrawal(1);

        console.log("tx hash: " + transaction.hash);
        // Use your toast notification system to display the message
        // For example, using Vue 3's globalProperties
        // app.config.globalProperties.$toast.info("The transaction has been submitted. Please wait for it to be confirmed.");

        const receipt = await transaction.wait();
        console.log(receipt);

        if (receipt.status) {
          // Use your toast notification system to display the success message
          // app.config.globalProperties.$toast.success("Your deposit request was successful.");
          depositValue.value = null;
        } else {
          // Use your toast notification system to display the error message
          // app.config.globalProperties.$toast.error("Your deposit request has failed. Please contact the Rethink Finance support.");
        }
      } catch (error) {
        console.error(error);
        // Use your toast notification system to display the error message
        // app.config.globalProperties.$toast.error("There has been an error. Please contact the Rethink Finance support.");
      } finally {
        loading.value = false;
      }
    };

    return {
      depositValue,
      loading,
      selectedToken,
      isDepositValueNotValid,
      isEnoughAllowance,
      getStablecoinContract,
      getUserStablecoinBalance,
      approveAllowance,
      changeStablecoin,
      depositIntoFund,
      requestDeposit,
      cancelDeposit,
    };
  },
});
</script>
