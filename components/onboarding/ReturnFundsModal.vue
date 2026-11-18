<template>
  <UiConfirmDialog
    :model-value="modelValue"
    title="Return flow"
    max-width="480px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #title>
      <UiStepFlowHead
        eyebrow="Return flow"
        :step="stepNumber"
        :total="steps.length"
        :amount="amountLabel"
        :symbol="symbol"
        to-label="your wallet"
      />
    </template>

    <!-- Same rail as the deposit flow: one row per wallet confirmation, each
         carrying its own state, so "where am I?" is answered at a glance. -->
    <UiStepFlow :steps="steps" />

    <div class="return_flow">
      <!-- Done: say so, or it reads as a form waiting for another signature. -->
      <template v-if="isComplete">
        <div class="return_flow__outcome">
          <Icon
            icon="material-symbols:check"
            class="return_flow__outcome_icon"
            height="1rem"
            width="1rem"
          />
          <span v-if="transferred">
            {{ amountLabel }} {{ symbol }} returned to your wallet, and the
            permission is removed.
          </span>
          <span v-else>
            The permission is removed. Nothing was transferred.
          </span>
        </div>
        <v-btn
          class="return_flow__button bg-primary text-secondary"
          @click="emit('update:modelValue', false)"
        >
          Close
        </v-btn>
      </template>

      <template v-else>
        <p class="return_flow__note" :class="{ 'return_flow__note--open': granted }">
          <Icon
            :icon="granted
              ? 'material-symbols:warning-outline-rounded'
              : 'material-symbols:shield-outline-rounded'"
            width="1rem"
            aria-hidden="true"
          />
          <span v-if="!granted">
            Your wallet cannot batch, so the return takes three confirmations.
            The permission allows only this transfer to your wallet, and step 3
            removes it.
          </span>
          <span v-else>
            The permission stays open until step 3. Finalize is locked until it
            is removed.
          </span>
        </p>

        <v-btn
          class="return_flow__button bg-primary text-secondary"
          :loading="isSending"
          @click="runCurrentStep"
        >
          {{ actionLabel }}
        </v-btn>

        <!-- The way out of a transfer that will not go through, without
             leaving the permission behind. -->
        <button
          v-if="granted && !transferred && !skippedTransfer && !isSending"
          type="button"
          class="return_flow__skip"
          @click="skipTransfer"
        >
          Skip the transfer and remove the permission
        </button>
      </template>
    </div>
  </UiConfirmDialog>
</template>

<script setup lang="ts">
import type { IStepFlowStep } from "~/components/global/ui/StepFlow.vue";
import { useToastStore } from "~/store/toasts/toast.store";
import {
  buildReturnGrantEntries,
  buildReturnRevokeEntries,
} from "~/composables/onboarding/returnTestFundsCalls";
import {
  useReturnTransactions,
  type IReturnRoute,
  type SendOutcome,
} from "~/composables/onboarding/useReturnTransactions";

/**
 * The test-funds return for wallets that cannot batch: grant, transfer and
 * revoke as three confirmations, one button at a time. Whatever happens to
 * the transfer, the flow ends by removing the permission — and if the user
 * closes it before that, the step's card and the Finalize lock take over.
 */

const props = defineProps<{
  modelValue: boolean;
  route: IReturnRoute;
  tokenAddress: string;
  symbol: string;
  /** The connected wallet: the role's member and the transfer's recipient. */
  account: string;
  amount: bigint;
  /** The amount as typed, for display. */
  amountLabel: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  /** The role is assigned (true) or removed (false). */
  (e: "role-change", open: boolean): void;
  /** The flow reached its end; balances have moved. */
  (e: "finished", transferred: boolean): void;
}>();

const toastStore = useToastStore();
const { ensureChain, submitPermissions, sendReturnTransfer } = useReturnTransactions();

const granted = ref(false);
const transferred = ref(false);
const skippedTransfer = ref(false);
const revoked = ref(false);
const isSending = ref(false);
const sendingStep = ref(-1);

// A fresh run each time the modal opens. The card blocks Return while a
// permission is open, so an unfinished run is never reopened here.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    granted.value = false;
    transferred.value = false;
    skippedTransfer.value = false;
    revoked.value = false;
    sendingStep.value = -1;
  },
);

const params = computed(() => ({
  ...props.route,
  tokenAddress: props.tokenAddress,
  member: props.account,
  recipient: props.account,
  amount: props.amount,
}));

const steps = computed<IStepFlowStep[]>(() => [
  {
    label: "Grant a permission for this transfer",
    done: granted.value,
    loading: sendingStep.value === 0,
  },
  {
    label: skippedTransfer.value
      ? "Transfer skipped"
      : `Transfer ${props.amountLabel} ${props.symbol} to your wallet`,
    done: transferred.value || skippedTransfer.value,
    loading: sendingStep.value === 1,
  },
  {
    label: "Remove the permission",
    done: revoked.value,
    loading: sendingStep.value === 2,
  },
]);

const isComplete = computed(() => revoked.value);

const currentIndex = computed(() => steps.value.findIndex((step) => !step.done));
const stepNumber = computed(() =>
  currentIndex.value === -1 ? steps.value.length : currentIndex.value + 1,
);

const actionLabel = computed(() => {
  if (!granted.value) return "Grant permission";
  if (!transferred.value && !skippedTransfer.value) {
    return `Transfer ${props.amountLabel} ${props.symbol}`;
  }
  return "Remove permission";
});

const report = (outcome: SendOutcome, failed: string) => {
  if (outcome === "rejected") toastStore.addToast("Transaction was rejected.");
  else if (outcome === "failed") toastStore.errorToast(failed);
};

const send = async (index: number, run: () => Promise<SendOutcome>) => {
  isSending.value = true;
  sendingStep.value = index;
  try {
    if (!(await ensureChain())) return "failed" as SendOutcome;
    return await run();
  } finally {
    isSending.value = false;
    sendingStep.value = -1;
  }
};

const grant = async () => {
  const outcome = await send(0, () => submitPermissions(buildReturnGrantEntries(params.value)));
  if (outcome === "confirmed") {
    granted.value = true;
    emit("role-change", true);
  } else {
    report(outcome, "Granting the permission failed. Nothing was changed.");
  }
};

const transfer = async () => {
  const outcome = await send(1, () =>
    sendReturnTransfer(props.route, props.tokenAddress, props.account, props.amount),
  );
  if (outcome === "confirmed") {
    transferred.value = true;
    // Straight on to the last confirmation: the permission has done its job.
    await revoke();
  } else {
    report(outcome, "The transfer did not go through. Try again, or skip it and remove the permission.");
  }
};

const revoke = async () => {
  const outcome = await send(2, () => submitPermissions(buildReturnRevokeEntries(params.value)));
  if (outcome === "confirmed") {
    revoked.value = true;
    emit("role-change", false);
    emit("finished", transferred.value);
    if (transferred.value) {
      toastStore.successToast(`Returned ${props.amountLabel} ${props.symbol} to your wallet.`);
    }
  } else {
    report(outcome, "Removing the permission failed. Try again — Finalize stays locked until it is removed.");
  }
};

const skipTransfer = async () => {
  skippedTransfer.value = true;
  await revoke();
};

const runCurrentStep = () => {
  if (isSending.value) return;
  if (!granted.value) return grant();
  if (!transferred.value && !skippedTransfer.value) return transfer();
  return revoke();
};
</script>

<style lang="scss" scoped>
.return_flow {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1rem;

  /* One action at a time, so it takes the width — as in the deposit flow. */
  &__button {
    width: 100%;
    min-height: 2.75rem;
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0.01em;
  }

  &__note {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin: 0;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-steel-blue;

    svg {
      flex: none;
      margin-top: 0.125rem;
      color: $color-steel-blue;
    }

    &--open svg {
      color: $color-warn;
    }
  }

  &__skip {
    align-self: center;
    padding: 0;
    border: none;
    background: none;
    font-size: 12.5px;
    color: $color-steel-blue;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-white;
    }
  }

  /* The outcome, in the accent the finished steps above it already use. */
  &__outcome {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    background: $color-accent-soft;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-light-subtitle;
  }

  &__outcome_icon {
    flex: none;
    margin-top: 0.125rem;
    color: $color-cyan;
  }
}
</style>
