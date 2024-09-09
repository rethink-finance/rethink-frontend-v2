<template>
  <div class="page-governance">
    <v-dialog
      :model-value="modelValue"
      scrim="black"
      opacity="0.3"
      max-width="600"
      @update:model-value="closeDelegateDialog"
    >
      <div class="main_card di-card">
        <div class="di-card__header-container">
          <div class="di-card__header">
            Delegate
          </div>

          <Icon
            icon="material-symbols:close"
            class="di-card__close-icon"
            width="1.5rem"
            @click="
              delegateToSomeoneElse
                ? (delegateToSomeoneElse = false)
                : closeDelegateDialog()
            "
          />
        </div>

        <div class="di-card__content">
          <div class="di-card">
            <strong>NOTE:</strong>
            You must always delegate to yourself first, even if you want to delegate to someone else!
          </div>

          <div v-if="!delegateToSomeoneElse" class="di-card__button-container">
            <v-btn
              :disabled="loadingDelegates"
              class="di-card__submit-button"
              variant="outlined"
              @click="delegate(true)"
            >
              <template #prepend>
                <v-progress-circular
                  v-if="loadingDelegates"
                  class="d-flex"
                  size="20"
                  width="3"
                  indeterminate
                />
              </template>
              Myself
            </v-btn>

            <v-btn
              :disabled="loadingDelegates"
              class="di-card__submit-button"
              variant="outlined"
              @click="delegateToSomeoneElse = true"
            >
              Someone else
            </v-btn>
          </div>

          <div v-else class="di-card__someone-else-container">
            <v-label class="di-card__label label_required">
              Address
            </v-label>
            <v-text-field
              v-model="delegateAddress"
              placeholder="Enter the address of the delegate"
              :rules="rules"
              required
            />

            <v-btn
              :disabled="!isDelegatedAddressValid || loadingDelegates"
              class="di-card__delegate-votes"
              variant="flat"
              color="rgba(210, 223, 255, 1)"
              @click="delegate()"
            >
              <template #prepend>
                <v-progress-circular
                  v-if="loadingDelegates"
                  class="d-flex"
                  size="20"
                  width="3"
                  indeterminate
                />
              </template>
              Delegate votes
            </v-btn>
          </div>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
// contract
import ERC20Votes from "~/assets/contracts/ERC20Votes.json";
// components
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";

defineProps({ modelValue: Boolean });
const emit = defineEmits(["update:modelValue"]);

const fundStore = useFundStore();
const toastStore = useToastStore();

// delegate dialog
const loadingDelegates = ref(false);
const delegateToSomeoneElse = ref(false);

const delegateAddress = ref("");
const rules = [formRules.required, formRules.isValidAddress];

const isDelegatedAddressValid = computed(() => {
  return rules.every((rule) => {
    return rule(delegateAddress.value) === true;
  });
});

const closeDelegateDialog = () => {
  delegateToSomeoneElse.value = false;
  delegateAddress.value = "";

  emit("update:modelValue", false);
};

const delegate = async (isMyself = false) => {
  const nullAddr = "0x0000000000000000000000000000000000000000";

  const delegateTo = isMyself
    ? fundStore.activeAccountAddress
    : delegateAddress.value;
  const governanceTokenAddress = fundStore.fund?.governanceToken.address;
  const fundAddress = fundStore.fund?.address;

  console.log("delegateTo: ", delegateTo);
  console.log("fundAddress: ", fundAddress);
  console.log("governanceTokenAddress: ", governanceTokenAddress);

  if (fundAddress != null) {
    loadingDelegates.value = true;

    // external gov token
    if (governanceTokenAddress !== fundAddress && governanceTokenAddress != nullAddr) {
      const externalGovToken = new fundStore.web3.eth.Contract(
        ERC20Votes.abi,
        governanceTokenAddress,
      );

      try {
        // const estimatedGas = await fundStore.fundContract.methods
        //   .delegate(delegateTo)
        //   .estimateGas();
        // console.log("estimatedGas: ", estimatedGas);

        await externalGovToken.methods
          .delegate(delegateTo)
          .send({
            from: fundStore.activeAccountAddress,
            // gas: estimatedGas,
          })
          .on("transactionHash", function (hash: any) {
            console.log("tx hash: " + hash);
            toastStore.addToast(
              "The transaction has been submitted. Please wait for it to be confirmed.",
            );
          })
          .on("receipt", function (receipt: any) {
            console.log(receipt);
            if (receipt.status) {
              toastStore.successToast(
                "Delegation of Governance Tokens Succeeded",
              );
            } else {
              toastStore.errorToast(
                "The delegateTo tx has failed. Please contact the Rethink Finance support.",
              );
            }
            loadingDelegates.value = false;
          })
          .on("error", function (error: any) {
            console.log(error);
            loadingDelegates.value = false;
            toastStore.errorToast(
              "There has been an error. Please contact the Rethink Finance support.",
            );
          });
      } catch (error) {
        console.error("Error delegating to external gov token: ", error);
        loadingDelegates.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      }
    } else {
      try {
        //  gov contract
        // const estimatedGas = await fundStore.fundContract.methods
        //   .delegate(delegateTo)
        //   .estimateGas();
        // console.log("estimatedGas: ", estimatedGas);

        await fundStore.fundContract.methods
          .delegate(delegateTo)
          .send({
            from: fundStore.activeAccountAddress,
            // gas: estimatedGas,
          })
          .on("transactionHash", function (hash: any) {
            console.log("tx hash: " + hash);
            toastStore.addToast(
              "The transaction has been submitted. Please wait for it to be confirmed.",
            );
          })
          .on("receipt", function (receipt: any) {
            console.log(receipt);
            if (receipt.status) {
              toastStore.successToast(
                "Delegation of Governance Tokens Succeeded",
              );
            } else {
              toastStore.errorToast(
                "The delegateTo tx has failed. Please contact the Rethink Finance support.",
              );
            }
            loadingDelegates.value = false;
          })
          .on("error", function (error: any) {
            console.log(error);
            loadingDelegates.value = false;
            toastStore.errorToast(
              "There has been an error. Please contact the Rethink Finance support.",
            );
          });
      } catch (error: any) {
        console.error("Error delegating to fund contract: ", error);
        loadingDelegates.value = false;
        toastStore.errorToast(error.message);
      }
    }
  }
};
</script>

<style scoped lang="scss">
.di-card {
  margin: 0 auto;
  padding: 2rem;
  margin-bottom: 2rem;
  width: 100%;
  max-width: 500px;
  color: white;

  @include borderGray;

  &__header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  &__header {
    font-size: $text-lg;
    font-weight: 700;
  }
  &__close-icon {
    cursor: pointer;
    color: $color-steel-blue;
  }
  &__content {
    margin-top: 2rem;
  }
  &__button-container {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;
  }
  &__submit-button {
    width: 100%;
    margin: 0 auto;
    max-width: 350px;

    color: $color-light-subtitle !important;
  }
  &__label {
    color: $color-light-subtitle;
    margin-bottom: 0.25rem;
  }
  &__delegate-votes {
    width: 100%;
    margin-top: 1rem;
  }
}
</style>
