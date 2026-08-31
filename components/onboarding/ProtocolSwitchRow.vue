<template>
  <div class="row" :class="{ 'row--bordered': bordered }">
    <div class="row__text">
      <p class="row__head">
        <span class="row__label">{{ label }}</span>
        <span
          v-if="summary"
          class="row__count"
          :class="{ 'row__count--muted': muted }"
        >{{ summary }}</span>
      </p>
      <p v-if="hint" class="row__hint">
        {{ hint }}
      </p>
    </div>
    <OnboardingToggle
      :model-value="open"
      :label="switchLabel"
      @update:model-value="(v: boolean) => emit('update:open', v)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * A labelled row with a switch, used by the Protocol permissions card for
 * the two things that are only ever on or off: a part of the card that
 * waits behind a disclosure, and an action with nothing to pick for it.
 *
 * A disclosure row always carries the count of what is selected inside, so
 * a collapsed section can never hide a grant — the one thing a permissions
 * form must not do.
 */
withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    /** What is granted inside, e.g. "2 of 5 selected"; empty hides it. */
    summary?: string;
    /** Dims the summary when it reports nothing granted. */
    muted?: boolean;
    open: boolean;
    /** What the switch controls, for anyone not reading the label beside it. */
    switchLabel: string;
    /** Off when a container already draws the border around this row. */
    bordered?: boolean;
  }>(),
  { hint: "", summary: "", muted: false, bordered: true },
);

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();
</script>

<style scoped lang="scss">
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0.75rem;

  &--bordered {
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
  }

  &__text {
    min-width: 0;
    flex: 1;
  }

  &__head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  &__label {
    font-size: 13px;
    line-height: 1.4;
    color: $color-white;
  }

  &__count {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-cyan;

    &--muted {
      color: $color-steel-blue;
      opacity: 0.75;
    }
  }

  &__hint {
    margin-top: 0.125rem;
    font-size: 11.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }
}
</style>
