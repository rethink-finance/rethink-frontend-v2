<template>
  <div class="raw_perms">
    <p class="raw_perms__hint">
      Paste calldata for the Roles modifier — one hex entry per line, or a
      JSON array of hex strings (encoded scopeTarget / scopeFunction /
      allowFunction calls). Every entry is checked against the Roles V2 ABI
      and submitted with the rest of this step's permissions.
    </p>

    <textarea
      v-model="input"
      class="raw_perms__code"
      rows="6"
      spellcheck="false"
      :placeholder="placeholder"
      aria-label="Raw Roles modifier calldata"
      @keydown.meta.enter.prevent="addEntries"
      @keydown.ctrl.enter.prevent="addEntries"
    />

    <div class="raw_perms__actions">
      <p v-if="error" class="raw_perms__error">
        {{ error }}
      </p>
      <button
        type="button"
        class="raw_perms__add"
        :disabled="!input.trim()"
        @click="addEntries"
      >
        Add to batch
      </button>
    </div>

    <template v-if="modelValue.length">
      <div class="raw_perms__queued">
        Queued for submission
      </div>
      <div
        v-for="(entry, index) in modelValue"
        :key="entry.data.slice(0, 18) + '-' + index"
        class="raw_perms__row"
      >
        <span class="raw_perms__label">{{ entry.label }}</span>
        <span class="raw_perms__data">{{ shortData(entry.data) }}</span>
        <button
          type="button"
          class="raw_perms__action"
          @click="removeAt(index)"
        >
          Discard
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  type IRawPermissionCodeEntry,
  parseRawPermissionCode,
} from "~/composables/permissions/parseRawPermissionCode";

/**
 * Power-user escape hatch for the Roles V2 creation flow, living on the
 * Protocol integrations card as one of the things that can be added: raw,
 * pre-encoded Roles modifier calldata pasted wholesale. Validated entries
 * are appended to the same submitPermissions batch as the prepopulated
 * toggles and the registry's grants; nothing is sent on-chain from here.
 */
const props = defineProps<{
  modelValue: IRawPermissionCodeEntry[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: IRawPermissionCodeEntry[]): void;
}>();

const input = ref("");
const error = ref("");
const placeholder =
  "0x0c6c76b8...\n0x7508dd98...\n\nor\n\n[\"0x0c6c76b8...\", \"0x7508dd98...\"]";

const shortData = (data: string) =>
  data.length > 24 ? `${data.slice(0, 14)}…${data.slice(-8)}` : data;

const addEntries = () => {
  error.value = "";
  if (!input.value.trim()) return;
  let entries: IRawPermissionCodeEntry[];
  try {
    entries = parseRawPermissionCode(input.value);
  } catch (e: any) {
    // Keep the pasted text so the entry can be fixed in place.
    error.value = e.message;
    return;
  }
  emit("update:modelValue", [...(props.modelValue || []), ...entries]);
  input.value = "";
};

const removeAt = (index: number) => {
  const value = [...(props.modelValue || [])];
  value.splice(index, 1);
  emit("update:modelValue", value);
};
</script>

<style scoped lang="scss">
.raw_perms {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &__hint {
    font-size: 12px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__code {
    display: block;
    width: 100%;
    padding: 11px 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    font-size: 12px;
    line-height: 1.5;
    color: $color-white;
    resize: vertical;

    &::placeholder {
      color: $color-steel-blue;
    }
    &:focus {
      outline: none;
      border-color: $color-accent-line;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
  }

  &__error {
    flex: 1;
    min-width: 0;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1.5;
    color: $color-neg;
    word-break: break-word;
  }

  &__add {
    flex: none;
    padding: 9px 14px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-white;
    cursor: pointer;
    transition:
      border-color $default-transition-time ease,
      opacity $default-transition-time ease;

    &:hover:not(:disabled) {
      border-color: $color-line-3;
    }

    &:disabled {
      cursor: default;
      opacity: 0.45;
    }
  }

  &__queued {
    margin-top: 0.25rem;
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 90px;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0;
    border-top: 1px solid $color-line;
    font-family: $font-mono;
    font-size: 12px;
    color: $color-white;
  }

  &__label {
    word-break: break-word;
  }

  &__data {
    color: $color-steel-blue;
  }

  &__action {
    justify-self: end;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-neg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &__add,
    &__action {
      transition: none;
    }
  }
}
</style>
