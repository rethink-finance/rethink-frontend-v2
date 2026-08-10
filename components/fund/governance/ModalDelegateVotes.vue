<template>
  <div class="page-governance">
    <v-dialog
      :model-value="modelValue"
      max-width="520"
      @update:model-value="closeDelegateDialog"
    >
      <div class="brand_modal">
        <div class="brand_modal__head">
          <div class="brand_modal__heading">
            <div class="brand_modal__eyebrow">
              Governance
            </div>
            <h2 class="brand_modal__title">
              {{ delegateToSomeoneElse ? "Delegate to an address" : "Delegate votes" }}
            </h2>
          </div>

          <button
            type="button"
            class="brand_modal__close"
            :aria-label="delegateToSomeoneElse ? 'Back' : 'Close'"
            @click="
              delegateToSomeoneElse
                ? (delegateToSomeoneElse = false)
                : closeDelegateDialog()
            "
          >
            <Icon
              :icon="
                delegateToSomeoneElse
                  ? 'material-symbols:arrow-back'
                  : 'material-symbols:close'
              "
              width="1.125rem"
            />
          </button>
        </div>

        <div class="brand_modal__body">
          <div
            v-if="
              !delegateToSomeoneElse ||
                (delegateToSomeoneElse && fundStore?.shouldUserDelegate)
            "
            v-html="parsedDelegateMessage"
          />

          <div v-if="delegateToSomeoneElse" class="brand_modal__form delegate__form">
            <v-label class="brand_modal__label label_required">
              Address
            </v-label>
            <v-text-field
              v-model="delegateAddress"
              placeholder="Enter the address of the delegate"
              :rules="rules"
              required
            />
          </div>
        </div>

        <div class="brand_modal__footer brand_modal__footer--stacked">
          <template v-if="!delegateToSomeoneElse">
            <v-btn
              v-if="!hasDelegatedToYourself"
              :disabled="loadingDelegates"
              :loading="loadingDelegates"
              color="primary"
              @click="delegate(true)"
            >
              Delegate to myself
            </v-btn>

            <v-btn
              v-if="!fundStore?.shouldUserDelegate"
              :disabled="loadingDelegates"
              variant="outlined"
              @click="delegateToSomeoneElse = true"
            >
              Someone else
            </v-btn>
          </template>

          <v-btn
            v-else
            :disabled="!isDelegatedAddressValid || loadingDelegates"
            :loading="loadingDelegates"
            color="primary"
            @click="delegate()"
          >
            Delegate votes
          </v-btn>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
// components
import { ethers } from "ethers";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";

defineProps({ modelValue: Boolean });
const emit = defineEmits(["update:modelValue", "delegate-success"]);

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

    const delegateTo = isMyself
      ? fundStore.activeAccountAddress
      : delegateAddress.value;
    const governanceTokenAddress = fundStore.fund?.governanceToken.address;
    const fundAddress = fundStore.fund?.address;

    if (fundAddress === ethers.ZeroAddress) {
      toastStore.errorToast(
        "The vault address is not available. Please contact the Rethink Finance support.",
      );
      return;
    }

    let contract = fundStore.fundContract;

    if (
      governanceTokenAddress !== fundAddress &&
      governanceTokenAddress !== ethers.ZeroAddress
    ) {
      // external gov token
      contract = fundStore.fundGovernanceTokenContract;
    }

    await contract
      .send("delegate", {}, delegateTo)
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
/* The form follows the standing-delegation note when there is one, so it needs
   the gap the note would otherwise leave. */
.delegate__form {
  margin-top: 1.25rem;

  &:first-child {
    margin-top: 0;
  }
}
</style>
