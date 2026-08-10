<template>
  <div class="fee">
    <div
      v-for="group in groups"
      :key="group.label"
      class="fee__group"
    >
      <div class="fee__head">
        <div class="fee__titles">
          <div class="fee__title_row">
            <span class="fee__title">{{ group.label }}</span>
            <OnboardingFieldChip :tag="group.tag" />
          </div>
          <p class="fee__description">
            {{ group.tooltip }}
          </p>
        </div>

        <OnboardingToggle
          v-model="group.isToggleOn"
          :disabled="isDisabled"
          :label="`Enable the ${group.label.toLowerCase()}`"
        />
      </div>

      <div
        v-if="group.isToggleOn"
        class="fee__body"
      >
        <OnboardingFieldControl
          v-for="field in group.fields"
          :key="field.key"
          v-model="field.value"
          :field="field"
          :disabled="isDisabled"
        />
      </div>
    </div>

    <div class="fee__note">
      Read about fee types and alternatives in the
      <a
        class="fee__note_link"
        :href="FeesDocs"
        target="_blank"
        rel="noopener"
      >documentation</a>.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IField } from "~/types/enums/input_type";
import { FeesDocs } from "~/types/enums/stepper_onboarding";

/**
 * A fee group is off until a curator turns it on — a vault charging nothing is
 * the common case, and an off group sends 0 and the zero address rather than
 * whatever was half-typed into it.
 */
interface IFeeGroup {
  label: string;
  tag?: string;
  tooltip?: string;
  isToggleOn: boolean;
  fields: IField[];
}

defineProps({
  groups: {
    type: Array as PropType<IFeeGroup[]>,
    default: () => [],
  },
  isDisabled: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped lang="scss">
.fee {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__group {
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.125rem;
  }

  &__title_row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  &__description {
    margin-top: 0.25rem;
    font-size: 12px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding: 1.125rem;
    border-top: 1px solid $color-line;

    @include md {
      grid-template-columns: 1fr 2fr;
    }
  }

  &__note {
    padding: 0.875rem 1.125rem;
    border: 1px solid $color-cyan-line;
    border-radius: $default-border-radius;
    background: $color-cyan-tint;
    font-size: 13px;
    line-height: 1.55;
    color: $color-white;
  }

  &__note_link {
    color: $color-cyan;
    text-decoration: underline;

    &:visited,
    &:hover,
    &:active {
      color: $color-cyan;
    }
  }
}
</style>
