<template>
  <div class="flows">
    <p class="flows__sentence">
      <template v-if="inner?.functionName === 'mintToMany'">
        Mints new vault shares straight to
        <strong>{{ recipients.length }} {{ recipients.length === 1 ? "address" : "addresses" }}</strong>,
        without any deposit behind them. Existing holders are diluted by the amount minted.
      </template>
      <template v-else-if="inner?.functionName === 'sweepTokens'">
        Sweeps the denomination asset held by the vault contract to the
        <strong>Safe address in the vault's settings</strong>. Combined with a
        settings change that re-points that Safe, this moves the vault's assets
        to whatever address was set.
      </template>
      <template v-else-if="inner?.functionName">
        Runs the depositor flow
        <code class="flows__fn">{{ formatFunctionLabel(inner.functionName, inner.params) }}</code>
        through the vault's flows module.
      </template>
      <template v-else>
        Forwards bytes the app cannot name (selector
        <code class="flows__fn">{{ inner?.selector || "none" }}</code>)
        to the vault's flows module. Read the raw calldata before voting.
      </template>
    </p>

    <ul v-if="inner?.functionName === 'mintToMany'" class="flows__mints">
      <li v-for="(recipient, i) in recipients" :key="`${recipient}-${i}`" class="flows__mint">
        <FundGovernanceProposalAddressChip :address="recipient" />
        <span class="flows__mint_amount" :title="amounts[i]">
          {{ formatAmount(amounts[i]) }} shares
        </span>
      </li>
    </ul>

    <dl v-else-if="inner?.params.length" class="flows__params">
      <template v-for="param in inner.params" :key="param.name">
        <dt>{{ param.name }}</dt>
        <dd><FundGovernanceProposalParamValue :value="param.value" :type="param.type" /></dd>
      </template>
    </dl>

    <details v-if="!inner?.functionName && rawData" class="flows__raw">
      <summary>Raw calldata</summary>
      <pre>{{ rawData }}</pre>
    </details>
  </div>
</template>

<script setup lang="ts">
import { commify } from "~/composables/formatters";
import { decodeFlowsCall, formatFunctionLabel } from "~/composables/proposal/describeProposalActions";

/**
 * A `fundFlowsCall(bytes)` on the vault, unwrapped: the bytes are a call the
 * vault forwards to its flows delegate, and two of those calls — minting
 * shares to arbitrary addresses and sweeping the vault's assets to its Safe —
 * are exactly what a governance takeover uses. They get spelled out.
 *
 * Share amounts stay raw: a vault token reports 18 decimals while shares mint
 * in base units, so formatting them by decimals() would mislead.
 */
const props = defineProps<{
  decoded?: Record<string, any>;
}>();

const inner = computed(() => decodeFlowsCall(props.decoded));
const rawData = computed((): string => props.decoded?.flowCall ?? props.decoded?.data ?? "");

const paramValue = (name: string): unknown =>
  inner.value?.params.find((param) => param.name === name)?.value;

const recipients = computed((): string[] => (paramValue("recipients") as string[]) ?? []);
const amounts = computed((): string[] =>
  ((paramValue("amounts") as unknown[]) ?? []).map((amount) => String(amount)),
);

const formatAmount = (amount: string | undefined): string => {
  if (amount === undefined) return "?";
  try {
    return commify(amount);
  } catch {
    return amount;
  }
};
</script>

<style scoped lang="scss">
.flows {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &__sentence {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: $color-text-irrelevant;

    strong {
      color: $color-white;
      font-weight: 600;
    }
  }

  &__fn {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-white;
    overflow-wrap: anywhere;
  }

  &__mints {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  &__mint {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.375rem 0.625rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    font-size: 13px;
  }

  &__mint_amount {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-white;
  }

  &__params {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.375rem 1rem;
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

  &__raw {
    font-size: 12px;
    color: $color-steel-blue;

    summary {
      cursor: pointer;
      font-family: $font-mono;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    pre {
      margin: 0.5rem 0 0;
      font-family: $font-mono;
      font-size: 11.5px;
      line-height: 1.6;
      color: $color-text-irrelevant;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }
}
</style>
