<template>
  <span
    v-if="text"
    class="field_chip"
    :class="{ 'field_chip--upgradable': isUpgradable }"
  >
    {{ text }}
  </span>
</template>

<script setup lang="ts">
import { FieldTag } from "~/types/enums/stepper_onboarding";

/**
 * Says what happens to a field after the vault is initialized: nothing
 * (`FIXED`), or who is allowed to change it. Sits inline next to the field
 * label rather than under it — the answer belongs to the field's name, not to
 * its helper text.
 */
const props = defineProps({
  tag: {
    type: String,
    default: "",
  },
});

const LABELS: Record<string, string> = {
  [FieldTag.Fixed]: "Fixed",
  [FieldTag.UpgradableCurator]: "Upgradable by curator",
  [FieldTag.UpgradableGovernance]: "Upgradable by governance",
};

const text = computed(() => LABELS[props.tag] ?? "");

const isUpgradable = computed(() => props.tag !== FieldTag.Fixed);
</script>

<style scoped lang="scss">
.field_chip {
  display: inline-flex;
  align-items: center;
  flex: none;
  padding: 0.125rem 0.375rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  font-family: $font-mono;
  font-size: 9.5px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  color: $color-steel-blue;

  /* An upgradable field is the one a curator can still act on later, so it
     takes the accent; fixed stays a hairline, the way a disabled control does. */
  &--upgradable {
    border-color: $color-cyan-line;
    color: $color-cyan;
  }
}
</style>
