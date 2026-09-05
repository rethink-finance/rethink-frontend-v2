<template>
  <FundGovernanceProposalAddressChip v-if="shape === 'address'" :address="String(value)" />
  <span v-else-if="shape === 'bool'" class="param_value">{{ value ? "yes" : "no" }}</span>
  <span v-else-if="shape === 'number'" class="param_value param_value--mono" :title="String(value)">
    {{ formattedNumber }}
  </span>
  <span v-else-if="shape === 'bytes'" class="param_value param_value--mono" :title="String(value)">
    {{ shortHex }}
  </span>
  <span v-else-if="shape === 'empty'" class="param_value param_value--muted">empty</span>
  <ul v-else-if="shape === 'array'" class="param_value param_value--list">
    <li v-for="(item, i) in (value as unknown[])" :key="i">
      <FundGovernanceProposalParamValue :value="item" :type="elementType" />
    </li>
  </ul>
  <dl v-else-if="shape === 'tuple'" class="param_value param_value--tuple">
    <template v-for="(item, key) in (value as Record<string, unknown>)" :key="key">
      <dt>{{ key }}</dt>
      <dd><FundGovernanceProposalParamValue :value="item" /></dd>
    </template>
  </dl>
  <span v-else class="param_value">{{ value === "" ? "(empty)" : String(value) }}</span>
</template>

<script setup lang="ts">
import { commify } from "~/composables/formatters";

/**
 * One decoded ABI value, shown by what it is rather than how it was encoded:
 * addresses become named links, numbers get thousands separators, arrays and
 * tuples nest. The ABI type steers it when known; otherwise the value's shape
 * does, which is what a tuple's members fall back to.
 */
defineOptions({ name: "FundGovernanceProposalParamValue" });

const props = defineProps<{
  value: unknown;
  type?: string;
}>();

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX = /^0x[0-9a-fA-F]*$/;

const baseType = computed(() => (props.type ?? "").replace(/\[\d*\]$/, ""));
const isArrayType = computed(() => /\[\d*\]$/.test(props.type ?? ""));
const elementType = computed(() => baseType.value);

const shape = computed(() => {
  const value = props.value;
  const type = props.type ?? "";
  if (Array.isArray(value)) return value.length ? "array" : "empty";
  if (value && typeof value === "object") return "tuple";
  if (typeof value === "boolean" || type === "bool") return "bool";
  if (typeof value === "string") {
    if (type === "address" || (!type && ADDRESS.test(value))) return "address";
    if (/^u?int/.test(type) || (!type && /^-?\d+$/.test(value))) return "number";
    if (type.startsWith("bytes") || (!type && HEX.test(value) && value.length > 2)) return "bytes";
    return "text";
  }
  if (typeof value === "number" || typeof value === "bigint") return "number";
  return isArrayType.value ? "empty" : "text";
});

const formattedNumber = computed(() => {
  try {
    return commify(String(props.value));
  } catch {
    return String(props.value);
  }
});

const shortHex = computed(() => {
  const hex = String(props.value);
  return hex.length > 22 ? `${hex.slice(0, 12)}…${hex.slice(-8)}` : hex;
});
</script>

<style scoped lang="scss">
.param_value {
  font-size: 13px;
  color: $color-white;
  overflow-wrap: anywhere;

  &--mono {
    font-family: $font-mono;
    font-size: 12px;
  }

  &--muted {
    color: $color-steel-blue;
  }

  &--list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &--tuple {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.25rem 0.75rem;
    margin: 0;

    dt {
      font-family: $font-mono;
      font-size: 11px;
      letter-spacing: 0.04em;
      color: $color-steel-blue;
    }

    dd {
      margin: 0;
      min-width: 0;
    }
  }
}
</style>
