<template>
  <div class="call_tree" :class="{ 'call_tree--nested': depth > 0 }">
    <div class="call_tree__row">
      <span class="call_tree__path">{{ call.path }}</span>
      <span class="call_tree__target" :class="{ 'call_tree__target--unknown': isUnknownTarget }">
        {{ call.targetLabel }}
      </span>
      <a
        :href="targetUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="call_tree__address"
        :title="call.target"
      >{{ truncateAddress(call.target) }}</a>
      <span v-if="call.operation === 1" class="call_tree__op">delegatecall</span>
      <span v-if="hasValue" class="call_tree__value">value {{ call.value }} wei</span>
    </div>
    <div class="call_tree__fn">
      <template v-if="call.functionName">
        <span class="call_tree__fn_name">{{ call.functionName }}</span><span class="call_tree__fn_sig">{{ signatureArgs }}</span>
        <span v-if="call.contractName" class="call_tree__contract">{{ call.contractName }}</span>
        <span v-if="call.readOnly" class="call_tree__contract">read-only</span>
      </template>
      <template v-else-if="call.selector === '0x'">
        <span class="call_tree__fn_sig">no calldata</span>
      </template>
      <template v-else>
        <span class="call_tree__fn_name call_tree__fn_name--unknown">{{ call.selector }}</span>
        <span class="call_tree__fn_sig">undecoded selector</span>
      </template>
    </div>
    <pre v-if="argsText" class="call_tree__args">{{ argsText }}</pre>
    <details v-if="!call.functionName && call.calldata.length > 10" class="call_tree__raw">
      <summary>raw calldata</summary>
      <pre>{{ call.calldata }}</pre>
    </details>
    <MonitoringCallTree
      v-for="inner in call.inner ?? []"
      :key="inner.path"
      :call="inner"
      :chain-id="chainId"
      :depth="depth + 1"
    />
  </div>
</template>

<script setup lang="ts">
import { truncateAddress } from "~/composables/addressUtils";
import type { DecodedCall } from "~/services/backend/monitoring";
import { getExplorerUrl } from "~/types/enums/chain_id";

/**
 * A decoded call and whatever it wraps — a Safe execTransaction's payload, a
 * MultiSend batch, the vault's flows delegate — indented one level per wrap,
 * so a reviewer reads the outer shell and the money-moving call beneath it in
 * one glance.
 */
const props = withDefaults(
  defineProps<{
    call: DecodedCall;
    chainId: string;
    depth?: number;
  }>(),
  { depth: 0 },
);

const targetUrl = computed(() => getExplorerUrl(props.chainId, props.call.target));
const hasValue = computed(() => props.call.value && props.call.value !== "0");
const isUnknownTarget = computed(() => props.call.targetLabel.startsWith("Unknown"));

/** "(address,uint256)" — the signature minus the name the row already shows. */
const signatureArgs = computed(() => {
  const sig = props.call.signature ?? "";
  const open = sig.indexOf("(");
  return open >= 0 ? sig.slice(open) : "()";
});

/**
 * The bytes payloads a wrapper carries are decoded into the nested rows below,
 * so they are elided here — a 2KB hex string says nothing a reviewer can use.
 */
const argsText = computed(() => {
  const args = props.call.args;
  if (!args || !Object.keys(args).length) return "";
  const trimmed = JSON.parse(
    JSON.stringify(args, (_key, value) =>
      typeof value === "string" && /^0x[0-9a-fA-F]{130,}$/.test(value)
        ? `${value.slice(0, 22)}… (${(value.length - 2) / 2} bytes, decoded below)`
        : value,
    ),
  );
  return JSON.stringify(trimmed, null, 2);
});
</script>

<style lang="scss" scoped>
.call_tree {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;
  font-family: $font-mono;
  font-size: 11.5px;

  & + & {
    margin-top: 0.5rem;
  }

  &--nested {
    margin-top: 0.5rem;
    margin-left: 1.25rem;
    border-style: dashed;
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  &__path {
    padding: 0 0.3125rem;
    border-radius: $default-border-radius;
    background: $color-badge-navy;
    font-size: 10px;
    color: $color-steel-blue;
  }

  &__target {
    font-weight: 600;
    color: $color-white;

    &--unknown {
      color: $color-warn;
    }
  }

  &__address {
    color: $color-cyan;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__op {
    padding: 0 0.3125rem;
    border-radius: $default-border-radius;
    background: $color-neg-soft;
    color: $color-neg;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  &__value {
    color: $color-neg;
  }

  &__fn {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    overflow-wrap: anywhere;
  }

  &__fn_name {
    color: $color-cyan;

    &--unknown {
      color: $color-warn;
    }
  }

  &__fn_sig {
    color: $color-steel-blue;
  }

  &__contract {
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-text-irrelevant;
  }

  &__args,
  &__raw pre {
    margin: 0.25rem 0 0;
    padding: 0.5rem 0.625rem;
    border-radius: $default-border-radius;
    background: $color-navy-gray-dark;
    color: $color-steel-blue;
    font-size: 11px;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 18rem;
    overflow: auto;
  }

  &__raw summary {
    cursor: pointer;
    color: $color-text-irrelevant;
    font-size: 10.5px;
  }
}
</style>
