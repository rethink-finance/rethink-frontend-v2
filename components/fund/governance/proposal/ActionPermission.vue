<template>
  <div class="perm" :class="`perm--${description.tone}`">
    <p class="perm__sentence">
      <!-- Target-level -->
      <template v-if="description.action === 'allow-target'">
        Role <strong>{{ description.role }}</strong> may call
        <strong>any function</strong> on
        <FundGovernanceProposalAddressChip :address="description.target ?? ''" />.
      </template>
      <template v-else-if="description.action === 'scope-target'">
        Role <strong>{{ description.role }}</strong> gets restricted access to
        <FundGovernanceProposalAddressChip :address="description.target ?? ''" />:
        only functions allowed one by one may be called.
      </template>
      <template v-else-if="description.action === 'revoke-target'">
        Role <strong>{{ description.role }}</strong> loses all access to
        <FundGovernanceProposalAddressChip :address="description.target ?? ''" />.
      </template>

      <!-- Function-level -->
      <template v-else-if="description.action === 'allow-function'">
        Role <strong>{{ description.role }}</strong> may call
        <code class="perm__fn">{{ functionLabel }}</code> on
        <FundGovernanceProposalAddressChip :address="description.target ?? ''" />
        with any arguments.
      </template>
      <template v-else-if="description.action === 'scope-function'">
        Role <strong>{{ description.role }}</strong> may call
        <code class="perm__fn">{{ functionLabel }}</code> on
        <FundGovernanceProposalAddressChip :address="description.target ?? ''" />
        <template v-if="conditionLines.length || description.v1Params?.length">
          only when:
        </template>
        <template v-else>
          with any arguments.
        </template>
      </template>
      <template v-else-if="description.action === 'revoke-function'">
        Role <strong>{{ description.role }}</strong> may no longer call
        <code class="perm__fn">{{ functionLabel }}</code> on
        <FundGovernanceProposalAddressChip :address="description.target ?? ''" />.
      </template>
      <template v-else-if="description.action === 'scope-parameter' || description.action === 'unscope-parameter'">
        For role <strong>{{ description.role }}</strong> calling
        <code class="perm__fn">{{ functionLabel }}</code> on
        <FundGovernanceProposalAddressChip :address="description.target ?? ''" />:
      </template>
      <template v-else-if="description.action === 'set-execution-options'">
        When role <strong>{{ description.role }}</strong> calls
        <code class="perm__fn">{{ functionLabel }}</code> on
        <FundGovernanceProposalAddressChip :address="description.target ?? ''" />,
        it {{ description.executionOption }}.
      </template>

      <!-- Membership -->
      <template v-else-if="description.action === 'assign-roles'">
        Role membership of
        <FundGovernanceProposalAddressChip :address="description.module ?? ''" />
        changes:
      </template>
      <template v-else-if="description.action === 'set-default-role'">
        <FundGovernanceProposalAddressChip :address="description.module ?? ''" />
        will act as role <strong>{{ description.role }}</strong> by default.
      </template>

      <!-- Allowances and modules -->
      <template v-else-if="description.action === 'set-allowance'">
        Allowance <strong>{{ description.allowance?.key }}</strong> is set:
      </template>
      <template v-else-if="description.action === 'enable-module'">
        <FundGovernanceProposalAddressChip :address="description.module ?? ''" />
        becomes a module of the Roles modifier and can execute through it.
      </template>
      <template v-else-if="description.action === 'disable-module'">
        <FundGovernanceProposalAddressChip :address="description.module ?? ''" />
        is removed as a module of the Roles modifier.
      </template>

      <!-- Ownership -->
      <template v-else-if="description.action === 'transfer-ownership'">
        Ownership of the Roles modifier moves to
        <FundGovernanceProposalAddressChip :address="description.newOwner ?? ''" />.
      </template>
      <template v-else-if="description.action === 'renounce-ownership'">
        Ownership of the Roles modifier is renounced.
      </template>

      <!-- Anything else on the modifier -->
      <template v-else>
        Calls <code class="perm__fn">{{ action.functionName ?? selectorShort }}</code>
        on the Roles modifier with these arguments:
      </template>
    </p>

    <!-- Details -->
    <ul v-if="description.memberships?.length" class="perm__memberships">
      <li
        v-for="membership in description.memberships"
        :key="membership.role"
        :class="membership.added ? 'perm__member--added' : 'perm__member--removed'"
      >
        {{ membership.added ? "Added to" : "Removed from" }} role
        <strong>{{ membership.role }}</strong>
      </li>
    </ul>

    <ul v-if="conditionLines.length" class="perm__conditions">
      <li
        v-for="(line, i) in conditionLines"
        :key="i"
        class="perm__condition"
        :class="{ 'perm__condition--muted': line.muted }"
        :style="{ paddingLeft: `${line.depth * 1.125}rem` }"
      >
        <span class="perm__condition_label">{{ line.label }}</span>
        <span class="perm__condition_text">
          {{ textBeforeAddress(line.text) }}
          <FundGovernanceProposalAddressChip
            v-if="addressIn(line.text)"
            :address="addressIn(line.text) ?? ''"
          />
        </span>
      </li>
    </ul>

    <ul v-if="description.v1Params?.length" class="perm__conditions">
      <li v-for="param in description.v1Params" :key="param.index" class="perm__condition">
        <span class="perm__condition_label">{{ paramName(param.index) }}</span>
        <span class="perm__condition_text">
          {{ param.comparison }}
          <template v-for="(value, i) in param.values" :key="i">
            <template v-if="i > 0">, </template>
            <FundGovernanceProposalAddressChip
              v-if="addressIn(formatCompValue(value))"
              :address="addressIn(formatCompValue(value)) ?? ''"
            />
            <template v-else>{{ formatCompValue(value) }}</template>
          </template>
        </span>
      </li>
    </ul>

    <dl v-if="description.allowance" class="perm__params">
      <dt>Balance</dt>
      <dd>{{ description.allowance.balance }}</dd>
      <dt>Refill</dt>
      <dd>{{ description.allowance.refill }} every {{ description.allowance.period }} seconds</dd>
      <dt>Max refill</dt>
      <dd>{{ description.allowance.maxRefill }}</dd>
      <dt>Starts at</dt>
      <dd>{{ description.allowance.timestamp }}</dd>
    </dl>

    <dl v-if="description.action === 'other' || description.action === 'rewire'" class="perm__params">
      <template v-for="param in rawParams" :key="param.name">
        <dt>{{ param.name }}</dt>
        <dd><FundGovernanceProposalParamValue :value="param.value" :type="param.type" /></dd>
      </template>
    </dl>

    <p v-if="description.executionOption && showsExecutionOption" class="perm__execution">
      Execution: {{ description.executionOption }}.
    </p>

    <p v-if="description.warning" class="perm__warning">
      {{ description.warning }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import type { AbiParameter } from "web3";
import type { IProposalAction } from "~/types/proposal/proposalAction";
import { useFundStore } from "~/store/fund/fund.store";
import { resolveKnownFunction } from "~/composables/proposal/decodeProposalCallData";
import {
  decodeCallWithKnownAbis,
  describeConditionTree,
  describePermission,
  findFragmentInputs,
  formatCompValue,
  formatFunctionLabel,
  v1ParamLabel,
} from "~/composables/proposal/describeProposalActions";
import { lookupSelectorFragment } from "~/composables/proposal/lookupSelector";
import type { ProposalAddressLabels } from "~/composables/proposal/useProposalAddressLabels";

/**
 * One Roles modifier call as a sentence: who gets (or loses) what on which
 * contract, and under which conditions. Works for both Roles v1 and v2
 * entries — the description layer already normalised the two.
 *
 * The function a permission names is only a 4-byte selector on-chain. We
 * name it from the ABIs we ship where we can, and otherwise ask the explorer
 * for the target's ABI, which also lets the condition lines carry parameter
 * names instead of "parameter 3".
 */
const props = defineProps<{
  action: IProposalAction;
}>();

const fundStore = useFundStore();
const labels = inject<ProposalAddressLabels | undefined>("proposalAddressLabels", undefined);

const description = computed(() =>
  describePermission(props.action.functionName, props.action.decoded),
);

const selectorShort = computed(() => (props.action.calldata ?? "").slice(0, 10));

const rawParams = computed(() => decodeCallWithKnownAbis(props.action.calldata).params);

const showsExecutionOption = computed(() =>
  ["allow-target", "allow-function", "scope-function"].includes(description.value.action),
);

/* ---- Naming the scoped function ---------------------------------------- */

const explorerAbi = ref<string | undefined>();
// The signature database's answer, for a selector no ABI could name.
const lookedUpFragment = ref<ethers.FunctionFragment | undefined>();

const explorerFragment = computed((): ethers.FunctionFragment | undefined => {
  const selector = description.value.selector;
  if (!selector || !explorerAbi.value) return undefined;
  try {
    return new ethers.Interface(JSON.parse(explorerAbi.value)).getFunction(selector) ?? undefined;
  } catch {
    return undefined;
  }
});

watch(
  () => [description.value.target, description.value.selector],
  async ([target, selector]) => {
    explorerAbi.value = undefined;
    lookedUpFragment.value = undefined;
    labels?.resolve([target, description.value.module, description.value.newOwner]);
    if (!target || !selector || resolveKnownFunction(selector)) return;
    try {
      const sourceCode = await fundStore.fetchAddressSourceCode(
        fundStore.selectedFundChain,
        target,
      );
      explorerAbi.value = sourceCode?.ABI;
    } catch {
      explorerAbi.value = undefined;
    }
    if (!explorerFragment.value) {
      lookedUpFragment.value = await lookupSelectorFragment(selector);
    }
  },
  { immediate: true },
);

const fragmentInputs = computed((): ethers.ParamType[] | undefined => {
  const selector = description.value.selector;
  if (!selector) return undefined;
  const known = resolveKnownFunction(selector);
  if (known) {
    try {
      return ((known.function.inputs ?? []) as AbiParameter[]).map((input) => ethers.ParamType.from(input as any));
    } catch {
      return undefined;
    }
  }
  const fragment = explorerFragment.value ?? lookedUpFragment.value;
  return fragment ? [...fragment.inputs] : findFragmentInputs(explorerAbi.value, selector);
});

const functionLabel = computed(() => {
  const selector = description.value.selector;
  if (!selector) return "";
  const known = resolveKnownFunction(selector);
  if (known) {
    return formatFunctionLabel(known.function.name, (known.function.inputs ?? []) as AbiParameter[]);
  }
  const fragment = explorerFragment.value ?? lookedUpFragment.value;
  if (fragment) return formatFunctionLabel(fragment.name, [...fragment.inputs]);
  return `function ${selector}`;
});

const paramName = (index: number): string => v1ParamLabel(fragmentInputs.value, index);

const conditionLines = computed(() =>
  describeConditionTree(description.value.conditions, fragmentInputs.value),
);

/* ---- Addresses inside condition text ----------------------------------- */

const ADDRESS_AT_END = /(0x[0-9a-fA-F]{40})$/;

const addressIn = (text: string): string | undefined =>
  text.match(ADDRESS_AT_END)?.[1];

const textBeforeAddress = (text: string): string =>
  text.replace(ADDRESS_AT_END, "").trimEnd();
</script>

<style scoped lang="scss">
.perm {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-left: 0.875rem;
  border-left: 2px solid $color-line-2;

  &--grant {
    border-left-color: $color-yield-line;
  }

  &--revoke,
  &--danger {
    border-left-color: rgba(230, 106, 96, 0.5);
  }

  &--restrict {
    border-left-color: $color-accent-line;
  }

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

  &__memberships,
  &__conditions {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  &__member--added {
    color: $color-success-light;
  }

  &__member--removed {
    color: $color-error;
  }

  &__memberships li {
    font-size: 13px;

    strong {
      color: $color-white;
    }
  }

  &__condition {
    display: flex;
    gap: 0.625rem;
    flex-wrap: wrap;
    font-size: 13px;
    color: $color-white;

    &--muted {
      color: $color-steel-blue;
    }
  }

  &__condition_label {
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-steel-blue;
  }

  &__condition_text {
    overflow-wrap: anywhere;
  }

  &__params {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.375rem 1rem;
    margin: 0;
    font-size: 13px;
    color: $color-white;

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

  &__execution {
    margin: 0;
    font-size: 12.5px;
    color: $color-steel-blue;
  }

  &__warning {
    margin: 0;
    padding: 0.625rem 0.875rem;
    border: 1px solid $color-warn-line;
    border-radius: $default-border-radius;
    background: $color-warn-soft;
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-warn;
  }
}
</style>
