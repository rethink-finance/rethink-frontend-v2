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
          <div v-if="!delegateToSomeoneElse || delegateToSomeoneElse && fundStore?.shouldUserDelegate" class="di-card" v-html="parsedDelegateMessage" />

          <div v-if="!delegateToSomeoneElse" class="di-card__button-container">
            <v-btn
              v-if="!hasDelegatedToYourself"
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
// components
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";

defineProps({ modelValue: Boolean });
const emit = defineEmits(["update:modelValue", "delegate-success"]);

const fundStore = useFundStore();
const toastStore = useToastStore();
const web3Store = useWeb3Store();

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

const hasDelegatedToYourself = computed(() => {
  return (
    fundStore?.fundUserData.fundDelegateAddress.toLowerCase() ===
    fundStore.activeAccountAddress
  );
});

const parsedDelegateMessage = computed(() => {
  const delegateAddress = fundStore?.fundUserData.fundDelegateAddress;
  console.log("delegateAddress: ", delegateAddress);
  let output = `You have delegated to ${delegateAddress}`;

  if (fundStore?.shouldUserDelegate) {
    output =
      "You have not delegated to anyone yet.<br><br><strong>NOTE: </strong>You must always delegate to yourself first, even if you want to delegate to someone else!";
  } else if (delegateAddress.toLowerCase() === fundStore.activeAccountAddress) {
    output = "You have delegated to yourself.";
  }

  return output;
});

const closeDelegateDialog = () => {
  delegateToSomeoneElse.value = false;
  delegateAddress.value = "";

  emit("update:modelValue", false);
};

const delegate = async (isMyself = false) => {
  try {
    loadingDelegates.value = true;

    const nullAddr = "0x0000000000000000000000000000000000000000";

    const delegateTo = isMyself
      ? fundStore.activeAccountAddress
      : delegateAddress.value;
    const governanceTokenAddress = fundStore.fund?.governanceToken.address;
    const fundAddress = fundStore.fund?.address;

    if(fundAddress === nullAddr) {
      toastStore.errorToast(
        "The fund address is not available. Please contact the Rethink Finance support.",
      );
      return;
    }

    let contract = fundStore.fundContract;

    if (
      governanceTokenAddress !== fundAddress &&
      governanceTokenAddress !== nullAddr
    ) {
      // external gov token
      contract = fundStore.fundGovernanceTokenContract;
    }

    await contract.methods
      .delegate(delegateTo)
      .send({
        from: fundStore.activeAccountAddress,
        // maxPriorityFeePerGas: gasPrice,
        gasPrice: "",
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
          emit("delegate-success");
          closeDelegateDialog();
          if (delegateTo) fundStore.fundUserData.fundDelegateAddress = delegateTo;
        } else {
          toastStore.errorToast(
            "The delegateTo tx has failed. Please contact the Rethink Finance support.",
          );
        }
        loadingDelegates.value = false;
      })
      .on("error", function (error: any) {
        console.error(error);
        loadingDelegates.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      })
  } catch (error) {
    console.error("Error delegating to external gov token: ", error);
    loadingDelegates.value = false;
    toastStore.errorToast(
      "There has been an error. Please contact the Rethink Finance support.",
    );
  }
};
</script>

<style scoped lang="scss">
.di-card {
  margin: 0 auto;
  padding: 1rem;
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
