<template>
  <div class="role_members">
    <div class="role_members__head">
      <div class="role_members__title">
        Role members &#183; {{ roleLabel }}
      </div>
      <div class="role_members__controls">
        <input
          v-model="addressInput"
          class="role_members__input"
          type="text"
          placeholder="0x0000000000000000000000000000000000000000"
          @keyup.enter="queueChange('ADD')"
        >
        <button
          type="button"
          class="role_members__button"
          :disabled="!canQueue"
          @click="queueChange('ADD')"
        >
          Add member
        </button>
      </div>
    </div>

    <p v-if="error" class="role_members__error">
      {{ error }}
    </p>

    <div
      v-for="(item, index) in modelValue"
      :key="item.address + '-' + index"
      class="role_members__row"
    >
      <span class="role_members__address">{{ item.address }}</span>
      <span class="role_members__tag">{{ item.action === "ADD" ? "to add" : "to remove" }}</span>
      <button
        type="button"
        class="role_members__action"
        @click="removeAt(index)"
      >
        Discard
      </button>
    </div>

    <div v-if="!modelValue?.length" class="role_members__empty">
      No member changes queued. The wallet that initialized the vault already
      holds the role.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";

type ChangeAction = "ADD" | "REMOVE";
type ChangeItem = { address: string; action: ChangeAction };

/**
 * Queues membership changes for the manager role; they are sent with the rest
 * of the permissions when the step is finalized. Nothing here touches the chain
 * on its own, so a row is a pending intent rather than a member.
 */
const props = defineProps<{
  modelValue: ChangeItem[];
  roleLabel?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: ChangeItem[]): void;
}>();

const addressInput = ref("");
const error = ref("");

const roleLabel = computed(() => props.roleLabel || "manager");

const canQueue = computed(() => !!addressInput.value.trim());

const queueChange = (action: ChangeAction) => {
  const address = addressInput.value.trim();
  error.value = "";

  if (!ethers.isAddress(address)) {
    error.value = "Address is not valid.";
    return;
  }
  if (
    props.modelValue?.some(
      (item) =>
        item.address.toLowerCase() === address.toLowerCase() &&
        item.action === action,
    )
  ) {
    error.value = "That change is already queued.";
    return;
  }

  emit("update:modelValue", [...(props.modelValue || []), { address, action }]);
  addressInput.value = "";
};

const removeAt = (index: number) => {
  const value = [...(props.modelValue || [])];
  value.splice(index, 1);
  emit("update:modelValue", value);
};
</script>

<style scoped lang="scss">
.role_members {
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.875rem 1.125rem;
  }

  &__title {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__controls {
    display: flex;
    gap: 0.625rem;
  }

  &__input {
    width: 340px;
    max-width: 100%;
    padding: 11px 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.3;
    color: $color-white;

    &::placeholder {
      color: $color-steel-blue;
    }
    &:focus {
      outline: none;
      border-color: $color-accent-line;
    }
  }

  &__button {
    flex: none;
    padding: 0 14px;
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

    &:hover:not(:disabled) {
      border-color: $color-line-3;
    }
    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  &__error {
    padding: 0 1.125rem 0.75rem;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-neg;
  }

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 130px 90px;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.125rem;
    border-top: 1px solid $color-line;
    font-family: $font-mono;
    font-size: 12px;
    color: $color-white;
  }

  &__address {
    word-break: break-all;
  }

  &__tag {
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
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

  &__empty {
    padding: 28px;
    border-top: 1px solid $color-line;
    text-align: center;
    font-size: 13px;
    color: $color-steel-blue;
  }

  @media (prefers-reduced-motion: reduce) {
    &__action {
      transition: none;
    }
  }
}
</style>
