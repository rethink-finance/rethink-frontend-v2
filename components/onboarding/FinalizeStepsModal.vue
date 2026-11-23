<template>
  <UiConfirmDialog
    :model-value="modelValue"
    title="Finalize vault"
    max-width="480px"
    @update:model-value="requestClose"
  >
    <template #title>
      <UiStepFlowHead
        eyebrow="Finalize vault"
        :step="stepNumber"
        :total="steps.length"
      />
    </template>

    <!-- The rail every multi-confirmation flow draws: one row per wallet
         prompt, so each prompt is announced before the wallet opens. -->
    <UiStepFlow :steps="steps" />

    <div class="finalize_steps">
      <!-- Why this is two confirmations and not one. Said once, before the
           first signature; after it the only thing that matters is step 2. -->
      <p v-if="!finalized" class="finalize_steps__note">
        <Icon
          icon="material-symbols:info-outline-rounded"
          width="1rem"
          aria-hidden="true"
        />
        <span v-if="reason === 'declined'">
          The wallet did not switch this account to a smart account, so
          nothing was sent. To send both in one transaction instead, close
          this and accept the switch when you finalize again.
        </span>
        <span v-else-if="reason === 'refused'">
          The wallet would not send both together, so nothing was sent.
          Finalizing now takes two confirmations.
        </span>
        <span v-else>
          This wallet cannot batch for this account, so finalizing takes two
          confirmations.
        </span>
      </p>

      <p class="finalize_steps__note finalize_steps__note--warn">
        <Icon
          icon="material-symbols:warning-outline-rounded"
          width="1rem"
          aria-hidden="true"
        />
        <span v-if="!finalized">
          Between the two steps deposits settle instantly: a depositor can
          take the voting supply and a claim on anything already in the Safe.
          Step 2 is prompted the moment step 1 confirms.
        </span>
        <span v-else>
          The vault is finalized. Deposits settle instantly until this NAV
          update confirms, so confirm it now.
        </span>
      </p>

      <v-btn
        class="finalize_steps__button bg-primary text-secondary"
        :loading="isSending"
        @click="runCurrentStep"
      >
        {{ finalized ? "Record first NAV update" : "Finalize vault" }}
      </v-btn>
    </div>
  </UiConfirmDialog>
</template>

<script setup lang="ts">
import type { IStepFlowStep } from "~/components/global/ui/StepFlow.vue";
import { useToastStore } from "~/store/toasts/toast.store";

/**
 * Finalize and the first NAV update as two confirmations, for when the
 * wallet does not send them as one: it cannot batch for this account, or it
 * would not switch the account to a smart account. One button at a time, so
 * no wallet prompt arrives that this dialog has not named first.
 *
 * The parent owns the sends; this owns the order. Once step 1 has confirmed
 * the vault is live, so the dialog reports back however it ends — with the
 * NAV update recorded, or closed without it.
 */

/**
 * Why the flow is split: "wallet" — it reported no batching; "declined" — it
 * did not make the account switch a batch needs; "refused" — it turned the
 * batch down some other way.
 */
export type FinalizeStepsReason = "wallet" | "declined" | "refused";

const props = defineProps<{
  modelValue: boolean;
  reason: FinalizeStepsReason;
  /** Sends finalizeCreateFund; resolves true once it is mined. */
  sendFinalize: () => Promise<boolean>;
  /** Sends the first NAV update; resolves true once it is mined. */
  sendFirstNav: () => Promise<boolean>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  /** The vault is finalized; `navRecorded` says whether step 2 landed too. */
  (e: "finished", navRecorded: boolean): void;
}>();

const toastStore = useToastStore();

const finalized = ref(false);
const navRecorded = ref(false);
const sendingStep = ref(-1);
const isSending = computed(() => sendingStep.value !== -1);

// A fresh run each time it opens. It cannot reopen past step 1: the parent
// leaves the step for good once the vault is finalized.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    finalized.value = false;
    navRecorded.value = false;
    sendingStep.value = -1;
  },
);

const steps = computed<IStepFlowStep[]>(() => [
  {
    label: "Finalize the vault",
    done: finalized.value,
    loading: sendingStep.value === 0,
  },
  {
    label: "Record the first NAV update",
    done: navRecorded.value,
    loading: sendingStep.value === 1,
  },
]);

const stepNumber = computed(() => (finalized.value ? 2 : 1));

const send = async (index: number, run: () => Promise<boolean>) => {
  sendingStep.value = index;
  try {
    return await run();
  } catch (error) {
    console.error("Finalize step failed", error);
    return false;
  } finally {
    sendingStep.value = -1;
  }
};

const recordFirstNav = async () => {
  if (await send(1, props.sendFirstNav)) {
    navRecorded.value = true;
    emit("finished", true);
    emit("update:modelValue", false);
    return;
  }
  toastStore.errorToast(
    "The vault is finalized, but its first NAV update was not confirmed. Deposits settle instantly until one is recorded — confirm it now.",
  );
};

const finalize = async () => {
  if (!(await send(0, props.sendFinalize))) {
    return toastStore.errorToast(
      "The finalize was not confirmed. Nothing has changed.",
    );
  }
  finalized.value = true;
  // Straight on to the second confirmation: the gap is open until it lands.
  await recordFirstNav();
};

const runCurrentStep = () => {
  if (isSending.value) return;
  return finalized.value ? recordFirstNav() : finalize();
};

/**
 * Closing is refused while a confirmation is in flight, so a transaction
 * cannot land behind a dialog that is no longer there. Closed after step 1,
 * the vault is live without its NAV update and the parent is told so.
 */
const requestClose = (open: boolean) => {
  if (open || isSending.value) return;
  if (finalized.value && !navRecorded.value) emit("finished", false);
  emit("update:modelValue", false);
};
</script>

<style lang="scss" scoped>
.finalize_steps {
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

    &--warn svg {
      color: $color-warn;
    }
  }
}
</style>
