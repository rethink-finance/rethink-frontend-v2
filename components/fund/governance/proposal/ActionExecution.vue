<template>
  <div class="exec">
    <p class="exec__intro">
      <template v-if="execution.isBatch">
        The Safe runs these {{ calls.length }} calls in order. If any of them fails, none of them take effect.
      </template>
      <template v-else-if="outerDelegatecall">
        The Safe <strong>delegatecalls</strong> into the target below, letting that contract's code run with the Safe's own storage and assets.
      </template>
      <template v-else>
        The Safe makes this call with its own assets.
      </template>
    </p>

    <ol class="exec__calls">
      <li
        v-for="(entry, i) in calls"
        :key="i"
        class="exec__call"
        :class="{ 'exec__call--delegate': entry.operation === 1 }"
      >
        <div class="exec__call_head">
          <span class="exec__call_index">{{ i + 1 }}</span>
          <p class="exec__call_sentence">
            <template v-if="isPlainTransfer(entry)">
              Send <strong>{{ formatEth(entry.value) }} ETH</strong> to
              <FundGovernanceProposalAddressChip :address="entry.to" />.
            </template>
            <template v-else-if="entry.call.functionName">
              {{ entry.operation === 1 ? "Delegatecall" : "Call" }}
              <code class="exec__fn">{{ callLabel(entry.call) }}</code>
              on <FundGovernanceProposalAddressChip :address="entry.to" />
              <template v-if="entry.value !== '0'">
                sending <strong>{{ formatEth(entry.value) }} ETH</strong>
              </template>
            </template>
            <template v-else>
              {{ entry.operation === 1 ? "Delegatecall" : "Call" }} an
              <strong>unrecognised function</strong>
              (selector <code class="exec__fn">{{ entry.call.selector }}</code>) on
              <FundGovernanceProposalAddressChip :address="entry.to" />
              <template v-if="entry.value !== '0'">
                sending <strong>{{ formatEth(entry.value) }} ETH</strong>
              </template>
            </template>
          </p>
        </div>

        <dl v-if="entry.call.params.length" class="exec__params">
          <template v-for="param in entry.call.params" :key="param.name">
            <dt>{{ param.name }}</dt>
            <dd>
              <FundGovernanceProposalParamValue :value="param.value" :type="param.type" />
              <span v-if="tokenAmountHint(entry, param)" class="exec__hint">
                = {{ tokenAmountHint(entry, param) }}
              </span>
            </dd>
          </template>
        </dl>

        <details v-if="!entry.call.functionName && entry.data !== '0x'" class="exec__raw">
          <summary>Raw calldata</summary>
          <pre>{{ entry.data }}</pre>
        </details>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { useFundStore } from "~/store/fund/fund.store";
import { formatTokenValue } from "~/composables/formatters";
import {
  decodeCallWithAbi,
  describeExecution,
  formatFunctionLabel,
  type IDecodedCall,
  type IDecodedParam,
  type IInnerCall,
} from "~/composables/proposal/describeProposalActions";
import type { ProposalAddressLabels } from "~/composables/proposal/useProposalAddressLabels";
import { lookupSelectorFragment } from "~/composables/proposal/lookupSelector";

/**
 * A Safe `execTransaction`, unwrapped: the direct-execution flow packs every
 * proposal step into one MultiSend delegatecall, so what a reader needs is
 * the list of calls inside it, each named and with its arguments laid out.
 *
 * Calls to contracts we ship no ABI for are named from the explorer's copy
 * when it has one, and shown as raw calldata when it does not.
 */
const props = defineProps<{
  decoded?: Record<string, any>;
}>();

const fundStore = useFundStore();
const labels = inject<ProposalAddressLabels | undefined>("proposalAddressLabels", undefined);

const execution = computed(() => describeExecution(props.decoded));
const outerDelegatecall = computed(
  () => !execution.value.isBatch && execution.value.operation === 1,
);

// Explorer-decoded copies of the calls our own ABIs could not name, keyed by
// position; the template reads through this so a late ABI still lands.
const resolved = ref<Record<number, IInnerCall>>({});

const calls = computed(() =>
  execution.value.calls.map((call, i) => resolved.value[i] ?? call),
);

watch(
  execution,
  async (value) => {
    resolved.value = {};
    labels?.resolve(value.calls.map((call) => call.to));
    await Promise.all(
      value.calls.map(async (call, i) => {
        if (call.call.functionName || call.data === "0x" || call.data.length < 10) return;
        try {
          const sourceCode = await fundStore.fetchAddressSourceCode(
            fundStore.selectedFundChain,
            call.to,
          );
          let decoded = sourceCode?.ABI ? decodeCallWithAbi(call.data, sourceCode.ABI) : undefined;
          if (!decoded) {
            // Not in the target's ABI (a diamond facet, an unverified
            // contract): the signature database may still know the shape.
            const fragment = await lookupSelectorFragment(call.data);
            if (fragment) decoded = decodeCallWithAbi(call.data, [fragment.format("full")]);
          }
          if (decoded) {
            resolved.value = {
              ...resolved.value,
              [i]: { ...call, call: { ...decoded, contractName: sourceCode?.ContractName } },
            };
          }
        } catch {
          // no ABI, the raw calldata stays visible
        }
      }),
    );
  },
  { immediate: true },
);

const callLabel = (call: IDecodedCall): string =>
  formatFunctionLabel(call.functionName ?? call.selector, call.params);

const isPlainTransfer = (entry: IInnerCall) =>
  (entry.data === "0x" || entry.data === "") && entry.value !== "0";

const formatEth = (wei: string): string => {
  try {
    return ethers.formatEther(BigInt(wei));
  } catch {
    return wei;
  }
};

/**
 * "1000000" on the denomination asset is 1 USDC; say so beside the raw
 * figure whenever the call targets one of the vault's tokens and the
 * argument looks like an amount.
 */
const AMOUNT_NAMES = new Set(["amount", "value", "_value", "_amount", "wad", "rawAmount"]);

const tokenAmountHint = (entry: IInnerCall, param: IDecodedParam): string | undefined => {
  if (!/^u?int/.test(param.type) || !AMOUNT_NAMES.has(param.name)) return undefined;
  const fund = fundStore.fund;
  const token = [fund?.baseToken, fund?.governanceToken, fund?.fundToken].find(
    (candidate) => candidate?.address?.toLowerCase() === entry.to.toLowerCase(),
  );
  if (!token?.decimals) return undefined;
  try {
    return `${formatTokenValue(BigInt(String(param.value)), token.decimals)} ${token.symbol}`;
  } catch {
    return undefined;
  }
};
</script>

<style scoped lang="scss">
.exec {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  &__intro {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: $color-text-irrelevant;

    strong {
      color: $color-white;
      font-weight: 600;
    }
  }

  &__calls {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__call {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-surface;

    &--delegate {
      border-color: $color-warn-line;
    }
  }

  &__call_head {
    display: flex;
    gap: 0.625rem;
    align-items: flex-start;
  }

  &__call_index {
    flex: 0 0 auto;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1.7;
    color: $color-steel-blue;
  }

  &__call_sentence {
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

  &__params {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.375rem 1rem;
    margin: 0 0 0 1.25rem;

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

  &__hint {
    margin-left: 0.5rem;
    font-size: 12px;
    color: $color-cyan;
    white-space: nowrap;
  }

  &__raw {
    margin-left: 1.25rem;
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
