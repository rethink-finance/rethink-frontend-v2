<template>
  <FundPermissionsActivationLine
    v-if="message"
    class="settings_activation"
    v-bind="message"
  />
</template>

<script setup lang="ts">
import {
  fetchSettingsPermissionGranted,
  useActivationProposals,
} from "~/composables/permissions/useActivationProposals";
import { useFundStore } from "~/store/fund/fund.store";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Above a curator page that saves through updateSettings (whitelist,
 * profile): why saving cannot work yet, in one quiet line. The vault only
 * takes settings changes from the Safe once governance has made the Safe
 * its governor, and only from a role granted the permission.
 */
const props = defineProps<{
  chainId: ChainId;
  fundAddress: string;
  rolesModifier: string;
  safe: string;
  /** Whether the Safe is not yet the vault's governor. */
  needsActivation: boolean;
  /** The vault operation that grants this page's permission, by its create-flow name. */
  operation: string;
}>();

const { selectedFundSlug } = storeToRefs(useFundStore());
const permissionsLink = computed(() => `/details/${selectedFundSlug.value}/permissions`);

const granted = ref<boolean | null>(null);
// Nothing is said until the roles have been read: the two messages differ.
const checked = ref(false);
const { proposals, refresh } = useActivationProposals(() => ({
  chainId: props.chainId,
  fundAddress: props.fundAddress,
  rolesModifier: props.rolesModifier || null,
  safe: props.safe,
}));

watch(
  () => [props.needsActivation, props.rolesModifier] as const,
  async ([needed, modifier]) => {
    if (!needed || !modifier) return;
    const [isGranted] = await Promise.all([
      fetchSettingsPermissionGranted(props.chainId, props.fundAddress, modifier),
      refresh(),
    ]);
    granted.value = isGranted;
    checked.value = true;
  },
  { immediate: true },
);

const message = computed(() => {
  if (!props.needsActivation || !checked.value) return null;
  const pending = proposals.value.settings;
  if (pending) return { proposal: pending };
  if (granted.value === false) {
    return {
      text: "No role can save changes here yet",
      action: `Turn on ${props.operation} in Permissions`,
      to: permissionsLink.value,
    };
  }
  return {
    text: "Saves revert until the one-time activation passes",
    action: "Create the activation proposal",
    to: permissionsLink.value,
  };
});
</script>

<style scoped lang="scss">
.settings_activation {
  margin-bottom: 1.125rem;
}
</style>
