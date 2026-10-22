<template>
  <div class="fund_description">
    <p v-if="fund?.description" class="fund_description__text">
      {{ fundDescriptionText }}
      <UiShowMoreButton v-if="isDescriptionTooLong" v-model="showMore" />
    </p>

    <div v-if="fund?.oivChatUrl" class="fund_description__links">
      <a
        :href="fund.oivChatUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="fund_description__link"
      >
        Vault Chat
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M7 17L17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";

const MAX_DESCRIPTION_LENGTH = 300;

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

const showMore = ref(false);

const isDescriptionTooLong = computed(
  () => (props.fund?.description?.length ?? 0) > MAX_DESCRIPTION_LENGTH,
);

const fundDescriptionText = computed(() => {
  if (!props.fund?.description) return "";
  if (isDescriptionTooLong.value && !showMore.value) {
    return props.fund.description.slice(0, MAX_DESCRIPTION_LENGTH) + "...";
  }
  return props.fund.description;
});
</script>

<style lang="scss" scoped>
/**
 * The design runs the vault blurb as plain body copy on the page background —
 * no card, no "Information" heading. Vaults that publish a chat link get a
 * quiet mono chip for it underneath.
 */
.fund_description {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__text {
    margin: 0;
    max-width: 780px;
    font-size: 14px;
    line-height: 1.6;
    color: $color-text-irrelevant;
    text-wrap: pretty;
  }

  &__links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  &__link {
    display: inline-flex;
    align-items: center;
    gap: 0.4375rem;
    padding: 0.3125rem 0.6875rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: $color-steel-blue;
    white-space: nowrap;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover {
      color: $color-white;
      border-color: $color-line-3;
    }
  }
}
</style>
