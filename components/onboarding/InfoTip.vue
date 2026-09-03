<template>
  <span ref="rootRef" class="info_tip">
    <button
      ref="triggerRef"
      type="button"
      class="info_tip__trigger"
      :class="{ 'info_tip__trigger--open': isOpen }"
      :aria-label="label"
      :aria-expanded="isOpen"
      @click="isPinned = !isPinned"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
      @focus="isFocused = true"
      @blur="isFocused = false"
    >
      <Icon
        icon="material-symbols:info-outline"
        width="1.125rem"
        height="1.125rem"
      />
    </button>

    <span
      v-if="isOpen"
      class="info_tip__bubble"
      :class="`info_tip__bubble--${align}`"
      role="tooltip"
    >
      <slot>{{ text }}</slot>
    </span>
  </span>
</template>

<script setup lang="ts">
/**
 * The create flow's hint bubble: an info mark beside a control, holding the
 * sentence that used to sit under it as permanent helper text.
 *
 * Hovering shows it and clicking pins it open, so a long hint can be read
 * without keeping the pointer still — and a keyboard reaches it by tabbing.
 */
defineProps({
  /** The hint itself. A slot overrides it when the text needs markup. */
  text: {
    type: String,
    default: "",
  },
  /** What the mark announces to a screen reader before the hint is read. */
  label: {
    type: String,
    default: "More information",
  },
  /** Which edge of the bubble is pinned to the mark. */
  align: {
    type: String as PropType<"left" | "right">,
    default: "right",
  },
});

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const isHovered = ref(false);
const isFocused = ref(false);
const isPinned = ref(false);

const isOpen = computed(() => isHovered.value || isFocused.value || isPinned.value);

const onDocumentPointerDown = (event: MouseEvent) => {
  if (!isPinned.value) return;
  if (rootRef.value?.contains(event.target as Node)) return;
  isPinned.value = false;
};

const onDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape" || !isPinned.value) return;
  isPinned.value = false;
  triggerRef.value?.blur();
};

onMounted(() => {
  document.addEventListener("mousedown", onDocumentPointerDown);
  document.addEventListener("keydown", onDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeydown);
});
</script>

<style scoped lang="scss">
.info_tip {
  position: relative;
  display: inline-flex;
  flex: none;

  &__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 2px;
    border: none;
    background: none;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover,
    &--open {
      color: $color-white;
    }
    &:focus-visible {
      outline: 1px solid $color-accent-line;
      outline-offset: 2px;
      border-radius: $default-border-radius;
    }
  }

  &__bubble {
    position: absolute;
    z-index: 30;
    top: calc(100% + 8px);
    width: max-content;
    max-width: 17rem;
    padding: 10px 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-navy-gray-light;
    box-shadow: var(--shadow-float-lg);
    font-size: 12px;
    line-height: 1.5;
    text-align: left;
    text-transform: none;
    letter-spacing: normal;
    color: $color-steel-blue;

    /* The mark usually sits at the end of a row, so the bubble opens inward. */
    &--right {
      right: 0;
    }
    &--left {
      left: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &__trigger {
      transition: none;
    }
  }
}
</style>
