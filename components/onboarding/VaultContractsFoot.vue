<template>
  <div class="perm_foot">
    <div class="perm_foot__buttons">
      <UiLinkExternalButton
        title="View vault permissions"
        :href="gnosisPermissionsUrl"
      />

      <!-- The two contracts every permission on this page is written
           against, beside the link that opens them: reference for whoever
           needs an address, not a headline for the step. Each is shown
           truncated with the full address as its tooltip, and copied
           whole by the glyph beside it. -->
      <div class="perm_foot__contracts">
        <div
          v-for="contract in footContracts"
          :key="contract.key"
          class="perm_foot__pair"
        >
          <span class="perm_foot__label">{{ contract.label }}</span>
          <template v-if="contract.address">
            <span class="perm_foot__address" :title="contract.address">
              {{ truncateAddressEllipsis(contract.address) }}
            </span>
            <button
              type="button"
              class="perm_foot__copy"
              :class="{ 'perm_foot__copy--done': copiedAddress === contract.address }"
              :title="copiedAddress === contract.address ? 'Copied' : `Copy the ${contract.label} address`"
              :aria-label="copiedAddress === contract.address ? 'Copied' : `Copy the ${contract.label} address`"
              @click="copyAddress(contract.address)"
            >
              <Icon
                :icon="copiedAddress === contract.address ? 'material-symbols:check-rounded' : 'clarity:copy-line'"
                width="0.8125rem"
                height="0.8125rem"
              />
            </button>
          </template>
          <span v-else class="perm_foot__value">N/A</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { truncateAddressEllipsis } from "~/composables/addressUtils";
import { getGnosisPermissionsUrl } from "~/composables/permissions/getGnosisPermissionsUrl";
import { useToastStore } from "~/store/toasts/toast.store";
import { networksMap } from "~/store/web3/networksMap";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * The foot of the create flow's Permissions step: the link to
 * the vault's permissions in the Zodiac Roles app, and the two contracts
 * every permission on that step is written against.
 */
const props = defineProps<{
  chainId?: ChainId;
  safeAddress?: string;
  rolesModAddress?: string;
  /** Which Roles app generation the link opens. */
  rolesV2?: boolean;
}>();

const toastStore = useToastStore();

const gnosisPermissionsUrl = computed(() => {
  if (!props.chainId) return "";

  return getGnosisPermissionsUrl(
    networksMap[props.chainId]?.chainShort || "",
    props.rolesModAddress || "",
    !!props.rolesV2,
  );
});

/**
 * The contract pairs: label, and the address once the vault has one. The
 * Safe and the modifier exist from initialization on.
 */
const footContracts = computed(() => [
  { key: "safe", label: "Safe contract", address: props.safeAddress || "" },
  { key: "roles", label: "Roles modifier", address: props.rolesModAddress || "" },
]);

/** Which address was just copied, for its check mark. */
const copiedAddress = ref("");
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

const copyAddress = async (address: string) => {
  try {
    await navigator.clipboard.writeText(address);
  } catch {
    toastStore.errorToast("Could not copy the address.");
    return;
  }
  copiedAddress.value = address;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copiedAddress.value = "";
  }, 1500);
};

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});
</script>

<style scoped lang="scss">
.perm_foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;

  &__buttons {
    display: flex;
    align-items: center;
    gap: 0.75rem 1.25rem;
    flex-wrap: wrap;
  }

  /* Two label-and-address pairs in one quiet mono line: the same small caps
     as a field label, the address truncated, both a step dimmer than the
     button they sit beside. */
  &__contracts {
    display: flex;
    align-items: center;
    gap: 0.5rem 1.25rem;
    flex-wrap: wrap;
  }

  &__pair {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__address {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-text-irrelevant;
  }

  /* The copy control: a glyph the size of the text beside it, and a check
     mark for a moment once the address is on the clipboard. */
  &__copy {
    display: inline-flex;
    align-items: center;
    padding: 0;
    border: none;
    background: none;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-white;
    }

    &--done {
      color: $color-cyan;
    }
  }

  &__value {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
  }

}
</style>
