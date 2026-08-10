<template>
  <div v-if="pageCount > 1" class="pager">
    <div class="pager__label">
      Page {{ page }} of {{ pageCount }}
    </div>
    <div class="pager__buttons">
      <button
        type="button"
        class="pager__button"
        aria-label="Previous page"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        class="pager__button"
        aria-label="Next page"
        :disabled="page >= pageCount"
        @click="emit('update:page', page + 1)"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Paging for a list that reads top to bottom: the count on the left of a pair
 * of chevrons, and nothing at all when everything already fits on one page.
 *
 * `page` is 1-based, matching how it reads to a person.
 */
defineProps<{
  page: number;
  pageCount: number;
}>();

const emit = defineEmits<{
  (e: "update:page", value: number): void;
}>();
</script>

<style lang="scss" scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid $color-line;

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__buttons {
    display: flex;
    gap: 0.5rem;
  }

  &__button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    color: $color-text-irrelevant;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover:not(:disabled) {
      border-color: $color-line-3;
    }

    /* At the end of the list the arrow fades rather than vanishing, so the
       control keeps its shape and the remaining direction stands out. */
    &:disabled {
      color: $color-hover;
      cursor: default;
    }
  }
}
</style>
