<template>
  <!-- One end of a test-funds transfer, as its balance caption names it:
       "From your wallet 0x8EB8…ab28" or "To the Safe 0x4eDB…8Fb4 ⧉". -->
  <span class="party">
    {{ label }}
    <span
      v-if="address"
      class="party__address"
      :title="address"
    >
      {{ truncateAddressEllipsis(address) }}
    </span>
    <button
      v-if="copyable && address"
      type="button"
      class="party__copy"
      :aria-label="copied ? 'Copied' : `Copy ${address}`"
      :title="copied ? 'Copied' : 'Copy address'"
      @click="copy"
    >
      <Icon
        :icon="copied
          ? 'material-symbols:check-rounded'
          : 'material-symbols:content-copy-outline-rounded'"
        width="0.8125rem"
        aria-hidden="true"
      />
    </button>
  </span>
</template>

<script setup lang="ts">
import { truncateAddressEllipsis } from "~/composables/addressUtils";

const props = defineProps<{
  label: string;
  address?: string;
  /** The Safe can be funded from any wallet, so its address is offered. */
  copyable?: boolean;
}>();

const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

const copy = () => {
  if (!props.address) return;
  navigator.clipboard.writeText(props.address);
  copied.value = true;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = false;
  }, 1500);
};

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});
</script>

<style scoped lang="scss">
.party {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;

  &__address {
    color: $color-white;
  }

  &__copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: none;
    color: $color-steel-blue;
    cursor: pointer;
    transition:
      color $default-transition-time ease,
      background-color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-cyan;
      background: $color-gray-light-transparent;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &__copy {
      transition: none;
    }
  }
}
</style>
