<template>
  <div class="field_control">
    <div class="field_control__label_row">
      <span class="field_control__label">
        {{ field.label }}<span v-if="isRequired" class="field_control__star">*</span>
      </span>
      <OnboardingFieldChip :tag="field.tag" />
      <span v-if="field.charLimit" class="field_control__counter">
        {{ charCount }} / {{ field.charLimit }}
      </span>
    </div>

    <textarea
      v-if="field.type === InputType.Textarea"
      v-model="value"
      class="field_control__input field_control__input--prose"
      :class="{ 'field_control__input--error': !!shownError }"
      rows="4"
      :placeholder="field.placeholder"
      :disabled="disabled"
      @blur="isTouched = true"
    />
    <input
      v-else
      v-model="value"
      class="field_control__input"
      :class="{ 'field_control__input--error': !!shownError }"
      :type="field.type === InputType.Number ? 'number' : 'text'"
      :min="field.min"
      :placeholder="field.placeholder"
      :disabled="disabled"
      @blur="isTouched = true"
    >

    <p v-if="field.tooltip" class="field_control__helper">
      {{ field.tooltip }}
    </p>

    <p class="field_control__error">
      {{ shownError }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { InputType, type IField } from "~/types/enums/input_type";

/**
 * One form field in the create flow: the label row (name, required marker,
 * upgradability chip, character counter), the control, its helper prose and a
 * permanently reserved error line — so a field that fails validation pushes
 * nothing below it around.
 *
 * Deliberately not a Vuetify input. v-text-field carries its own label slot,
 * details row and density scale, and every one of them had to be undone to
 * reach the design's 11px/12px field; a plain input is less code than the
 * overrides were.
 */
const props = defineProps({
  field: {
    type: Object as PropType<IField>,
    required: true,
  },
  modelValue: {
    type: [String, Number, Boolean] as PropType<any>,
    default: undefined,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  /** An error the field cannot know about — a failed on-chain read, say. */
  errorMessage: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue"]);

const isTouched = ref(false);

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const isRequired = computed(() =>
  (props.field.rules ?? []).includes(formRules.required),
);

const charCount = computed(() => String(props.modelValue ?? "").length);

/**
 * What the field is worth: what was typed, or the default the empty box is
 * showing greyed. Only the rules read it — the box itself stays empty, so the
 * default reads as a suggestion to type over rather than as an entry.
 */
const effectiveValue = computed(() =>
  effectiveFieldValue(props.field, props.modelValue),
);

/** The first rule the current value fails, or "" when it passes them all. */
const ruleError = computed(() => {
  for (const rule of props.field.rules ?? []) {
    const result = rule(effectiveValue.value);
    if (result !== true) return String(result);
  }
  return "";
});

/**
 * Held back until the field has been left once. A create form opens with every
 * required field empty, and marking all nine red before the user has typed a
 * character reads as a broken form rather than as guidance — the footer's error
 * list is what tells them what is still outstanding.
 */
const shownError = computed(() => {
  if (props.errorMessage) return props.errorMessage;
  if (props.disabled || !isTouched.value) return "";
  return ruleError.value;
});
</script>

<style scoped lang="scss">
.field_control {
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

  &__counter {
    margin-left: auto;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;
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
      cursor: default;
    }
    &--error {
      border-color: $color-neg-line;
    }

    /* Description is the one field a person writes sentences into, so it takes
       the prose face rather than the mono every value on this page uses. */
    &--prose {
      font-family: $font-sans;
      font-size: 13.5px;
      line-height: 1.6;
      resize: vertical;
    }
  }

  &__helper {
    margin-top: 0.4375rem;
    font-size: 12px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  /* Always in the layout, empty or not — a field that fails validation must not
     shove the rest of the grid down a line. */
  &__error {
    min-height: 13px;
    margin-top: 0.3125rem;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 13px;
    color: $color-neg;
  }

  @media (prefers-reduced-motion: reduce) {
    &__input {
      transition: none;
    }
  }
}
</style>
