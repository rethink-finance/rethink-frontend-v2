<template>
  <div class="period_control">
    <div class="period_control__label_row">
      <span class="period_control__label">
        {{ field.label }}<span v-if="isRequired" class="period_control__star">*</span>
      </span>
      <OnboardingFieldChip :tag="field.tag" />
    </div>

    <div class="period_control__pair" :class="{ 'period_control__pair--wide': wide }">
      <input
        v-model="amount"
        class="period_control__input"
        :class="{ 'period_control__input--error': !!shownError }"
        type="number"
        min="0"
        :placeholder="field.placeholder"
        :disabled="disabled"
        @blur="isTouched = true"
      >
      <OnboardingSelectMenu
        v-model="unit"
        :options="unitOptions"
        :disabled="disabled"
      />
    </div>

    <p v-if="field.tooltip" class="period_control__helper">
      {{ field.tooltip }}
    </p>

    <p class="period_control__error">
      <span v-if="shownError" class="period_control__error_text">{{ shownError }}</span>
      <span v-else-if="blocksHint" class="period_control__blocks">{{ blocksHint }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ChainId } from "~/types/enums/chain_id";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";
import { PeriodUnits, TimeInSeconds, type IField } from "~/types/enums/input_type";

/**
 * A duration, entered as a number plus a unit and stored as a block count —
 * which is what the governor and the vault metadata both hold.
 *
 * `blocks` is offered as a unit of its own so a value that came back from the
 * chain, or one a curator wants to set exactly, does not have to be laundered
 * through a time conversion that rounds it.
 */
const props = defineProps({
  field: {
    type: Object as PropType<IField>,
    required: true,
  },
  /** The stored value: a number of blocks. */
  modelValue: {
    type: [String, Number] as PropType<any>,
    default: undefined,
  },
  chainId: {
    type: String as PropType<ChainId>,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  /** The settlement period gets a roomier pair than the governor's three. */
  wide: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);

const BLOCKS_UNIT = "blocks";

const unitOptions = [
  { value: BLOCKS_UNIT, label: "Blocks" },
  { value: PeriodUnits.Seconds, label: "Seconds" },
  { value: PeriodUnits.Minutes, label: "Minutes" },
  { value: PeriodUnits.Hours, label: "Hours" },
  { value: PeriodUnits.Days, label: "Days" },
];

const blockTimeStore = useBlockTimeStore();

const amount = ref<string>("");
const unit = ref<string>(PeriodUnits.Days);
const blockTime = ref(0);
const isTouched = ref(false);
/** The chain's block time could not be read, so a time unit cannot be converted. */
const isBlockTimeUnavailable = ref(false);
/** The last value this control emitted, so its own echo does not re-derive it. */
const emittedBlocks = ref<number | undefined>(undefined);

const isRequired = computed(() =>
  (props.field.rules ?? []).includes(formRules.required),
);

const loadBlockTime = async () => {
  if (!props.chainId) {
    blockTime.value = 0;
    return;
  }
  const context = await blockTimeStore.initializeBlockTimeContext(props.chainId);
  blockTime.value = context?.averageBlockTime || 0;
};

const toBlocks = (value: number, selectedUnit: string): number | undefined => {
  if (isNaN(value)) return undefined;
  if (selectedUnit === BLOCKS_UNIT) return Math.floor(value);
  if (blockTime.value <= 0) return undefined;

  const seconds = TimeInSeconds[selectedUnit as PeriodUnits];
  return Math.floor((value * seconds) / blockTime.value);
};

const emitFromInput = async () => {
  if (amount.value === "" || amount.value == null) {
    isBlockTimeUnavailable.value = false;
    emittedBlocks.value = undefined;
    emit("update:modelValue", undefined);
    return;
  }

  await loadBlockTime();
  const blocks = toBlocks(Number(amount.value), unit.value);
  // A time unit is worthless without a block time to divide by, and the
  // conversion silently yielding nothing left the field looking filled in while
  // the footer insisted it was empty. Say so, and point at the way through.
  isBlockTimeUnavailable.value =
    blocks === undefined && unit.value !== BLOCKS_UNIT;
  emittedBlocks.value = blocks;
  emit("update:modelValue", blocks);
};

/** Fills the pair from a stored block count — a loaded draft, or the cache. */
const deriveFromModel = async () => {
  const stored = Number(props.modelValue);
  if (props.modelValue == null || props.modelValue === "" || isNaN(stored)) {
    amount.value = "";
    return;
  }

  await loadBlockTime();
  if (blockTime.value <= 0) {
    amount.value = String(stored);
    unit.value = BLOCKS_UNIT;
    return;
  }

  const totalSeconds = stored * blockTime.value;
  // Largest unit that still leaves a number at or above one, so a two-day
  // period reads "2 days" rather than "172800 seconds".
  const candidates = [PeriodUnits.Days, PeriodUnits.Hours, PeriodUnits.Minutes, PeriodUnits.Seconds];
  const best = candidates.find((u) => totalSeconds / TimeInSeconds[u] >= 1);

  if (!best) {
    amount.value = String(stored);
    unit.value = BLOCKS_UNIT;
    return;
  }

  amount.value = String(parseFloat((totalSeconds / TimeInSeconds[best]).toFixed(3)));
  unit.value = best;
};

const blocksHint = computed(() => {
  if (unit.value === BLOCKS_UNIT || props.modelValue == null) return "";
  const blocks = Number(props.modelValue);
  if (isNaN(blocks)) return "";
  return `≈ ${blocks.toLocaleString("en-US")} blocks`;
});

const shownError = computed(() => {
  if (props.disabled) return "";
  if (isBlockTimeUnavailable.value) {
    return "Could not read this chain's block time. Switch the unit to Blocks to set it directly.";
  }
  if (!isTouched.value) return "";
  for (const rule of props.field.rules ?? []) {
    const result = rule(props.modelValue);
    if (result !== true) return String(result);
  }
  return "";
});

watch([amount, unit], () => {
  emitFromInput();
});

watch(
  () => props.modelValue,
  (newValue) => {
    if (Number(newValue) === emittedBlocks.value) return;
    deriveFromModel();
  },
  { immediate: true },
);

// A different chain means a different block time, so the same stored block
// count is a different duration and the pair has to be re-read.
watch(() => props.chainId, () => deriveFromModel());
</script>

<style scoped lang="scss">
.period_control {
  display: flex;
  flex-direction: column;
  min-width: 0;

  &__label_row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.375rem;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    line-height: 1.4;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__star {
    margin-left: 0.25em;
    color: $color-cyan;
  }

  &__pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 120px;
    gap: 0.625rem;
    align-items: start;

    &--wide {
      grid-template-columns: 180px 160px;
    }
  }

  &__input {
    width: 100%;
    padding: 11px 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.3;
    color: $color-white;
    transition: border-color $default-transition-time ease;

    &::placeholder {
      color: $color-steel-blue;
    }
    &:hover:not(:disabled) {
      border-color: $color-line-3;
    }
    &:focus {
      outline: none;
      border-color: $color-accent-line;
    }
    &:disabled {
      color: $color-steel-blue;
    }
    &--error {
      border-color: $color-neg-line;
    }
  }

  &__helper {
    margin-top: 0.4375rem;
    font-size: 12px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__error {
    min-height: 13px;
    margin-top: 0.3125rem;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 13px;
  }
  &__error_text {
    color: $color-neg;
  }
  /* The derived block count sits in the error line's slot: it is the same
     one-line footnote, and only one of the two is ever worth showing. */
  &__blocks {
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    &__input {
      transition: none;
    }
  }
}
</style>
