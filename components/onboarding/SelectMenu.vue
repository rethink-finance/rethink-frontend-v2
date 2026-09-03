<template>
  <div ref="rootRef" class="select_menu" :class="{ 'select_menu--open': isOpen }">
    <button
      type="button"
      class="select_menu__trigger"
      :disabled="disabled"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown.down.prevent="open"
      @keydown.esc="close"
    >
      <span class="select_menu__value">
        <slot name="trigger" :option="selectedOption">
          <Icon
            v-if="selectedOption?.icon"
            class="select_menu__option_icon"
            :icon="selectedOption.icon"
            width="1rem"
            height="1rem"
          />
          {{ selectedOption?.label ?? placeholder }}
        </slot>
      </span>
      <Icon
        class="select_menu__chevron"
        icon="material-symbols:keyboard-arrow-down-rounded"
        width="1.125rem"
        height="1.125rem"
      />
    </button>

    <div v-if="isOpen" class="select_menu__panel" role="listbox">
      <button
        v-for="option in options"
        :key="String(option.value)"
        type="button"
        role="option"
        :aria-selected="option.value === modelValue"
        class="select_menu__option"
        :class="{ 'select_menu__option--selected': option.value === modelValue }"
        @click="pick(option)"
      >
        <slot name="option" :option="option">
          <Icon
            v-if="option.icon"
            class="select_menu__option_icon"
            :icon="option.icon"
            width="1rem"
            height="1rem"
          />
          <span class="select_menu__option_label">{{ option.label }}</span>
          <span v-if="option.meta" class="select_menu__option_meta">{{ option.meta }}</span>
        </slot>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ISelectMenuOption {
  value: string | number;
  label: string;
  /** Right-aligned mono detail — a chain's short code, a token's address. */
  meta?: string;
  /** Iconify name drawn before the label, in the panel and on the trigger. */
  icon?: string;
  [key: string]: any;
}

/**
 * The create flow's dropdown. Vuetify's select teleports its menu into an
 * overlay root, which puts it outside every scoped block on this page and out
 * of reach of the flow's own surface treatment; this one renders the panel in
 * place, so a chain row and an asset row are styled where they are written.
 */
const props = defineProps({
  modelValue: {
    type: [String, Number] as PropType<string | number | undefined>,
    default: undefined,
  },
  options: {
    type: Array as PropType<ISelectMenuOption[]>,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: "Select",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);

const rootRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);

const selectedOption = computed(() =>
  props.options.find((option) => option.value === props.modelValue),
);

const open = () => {
  if (props.disabled) return;
  isOpen.value = true;
};
const close = () => {
  isOpen.value = false;
};
const toggle = () => (isOpen.value ? close() : open());

const pick = (option: ISelectMenuOption) => {
  emit("update:modelValue", option.value);
  close();
};

const onDocumentPointerDown = (event: MouseEvent) => {
  if (!isOpen.value) return;
  if (rootRef.value?.contains(event.target as Node)) return;
  close();
};

const onDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") close();
};

onMounted(() => {
  document.addEventListener("mousedown", onDocumentPointerDown);
  document.addEventListener("keydown", onDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeydown);
});

// A disabled step must not leave a panel hanging over the fields it locked.
watch(() => props.disabled, (disabled) => {
  if (disabled) close();
});
</script>

<style scoped lang="scss">
.select_menu {
  position: relative;
  width: 100%;

  &__trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 11px 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.2;
    text-align: left;
    color: $color-white;
    cursor: pointer;
    transition: border-color $default-transition-time ease;

    &:hover:not(:disabled) {
      border-color: $color-line-3;
    }
    &:focus-visible {
      outline: none;
      border-color: $color-accent-line;
    }
    &:disabled {
      cursor: default;
      color: $color-steel-blue;
    }
  }

  &--open &__trigger {
    border-color: $color-accent-line;
  }

  &__value {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__chevron {
    flex: none;
    color: $color-steel-blue;
    transition: transform $default-transition-time ease;
  }
  &--open &__chevron {
    transform: rotate(180deg);
  }

  &__panel {
    position: absolute;
    z-index: 30;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 17rem;
    overflow-y: auto;
    padding: 6px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-navy-gray-light;
    box-shadow: var(--shadow-float-lg);
  }

  &__option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.3;
    text-align: left;
    color: $color-white;
    cursor: pointer;
    transition: background-color $default-transition-time ease;

    &:hover {
      background: $color-hover;
    }
    &--selected {
      background: $color-cyan-tint;
      color: $color-cyan;
    }
  }

  &__option_icon {
    flex: none;
    color: currentcolor;
  }

  &__option_label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__option_meta {
    flex: none;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: $color-steel-blue;
  }

  @media (prefers-reduced-motion: reduce) {
    &__trigger,
    &__chevron,
    &__option {
      transition: none;
    }
  }
}
</style>
