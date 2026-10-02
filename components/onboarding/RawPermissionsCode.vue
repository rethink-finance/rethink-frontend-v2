<template>
  <div class="raw_perms">
    <p class="raw_perms__hint">
      Paste calldata for the Roles modifier: one hex entry per line, or a
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

    <OnboardingRawPermissionsQueue
      v-if="modelValue.length"
      :entries="modelValue"
      :chain-id="chainId"
      :vault-address="vaultAddress"
      :safe-address="safeAddress"
      :roles-mod-address="rolesModAddress"
      :base-token="baseToken"
      :context-role="contextRole"
      @discard="removeMany"
    />
  </div>
</template>

<script setup lang="ts">
import {
  type IRawPermissionCodeEntry,
  parseRawPermissionCode,
} from "~/composables/permissions/parseRawPermissionCode";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Power-user escape hatch for the Roles V2 creation flow, living on the
 * Protocol integrations card as one of the things that can be added: raw,
 * pre-encoded Roles modifier calldata pasted wholesale. Validated entries
 * are appended to the same submitPermissions batch as the prepopulated
 * toggles and the registry's grants; nothing is sent on-chain from here.
 */
const props = defineProps<{
  modelValue: IRawPermissionCodeEntry[];
  /** For explorer links and for naming the queued contracts and functions. */
  chainId?: ChainId;
  /** The vault's own contracts, named in the queue instead of shown as hex. */
  vaultAddress?: string;
  safeAddress?: string;
  rolesModAddress?: string;
  baseToken?: string;
  /** The role the step is showing; queued calls naming another are tagged. */
  contextRole?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: IRawPermissionCodeEntry[]): void;
}>();

const input = ref("");
const error = ref("");
const placeholder =
  "0x0c6c76b8...\n0x7508dd98...\n\nor\n\n[\"0x0c6c76b8...\", \"0x7508dd98...\"]";

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

const removeMany = (indices: number[]) => {
  const dropped = new Set(indices);
  emit(
    "update:modelValue",
    (props.modelValue || []).filter((_entry, index) => !dropped.has(index)),
  );
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

  @media (prefers-reduced-motion: reduce) {
    &__add {
      transition: none;
    }
  }
}
</style>
