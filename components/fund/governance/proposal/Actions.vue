<template>
  <div class="actions">
    <div class="actions__head">
      <div class="actions__intro">
        <div class="brand_card__eyebrow">
          Executable code
        </div>
        <p class="actions__lede">
          {{ lede }}
        </p>
      </div>
      <UiSegmented v-model="view" :options="VIEW_OPTIONS" />
    </div>

    <pre v-if="view === 'raw'" class="actions__raw">{{ rawCode }}</pre>

    <div v-else class="actions__list">
      <FundGovernanceProposalAction
        v-for="action in actions"
        :key="action.index"
        :action="action"
      />
      <p v-if="!actions.length" class="actions__empty">
        This proposal makes no on-chain calls.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ProposalCalldataType } from "~/types/enums/proposal_calldata_type";
import type IGovernanceProposal from "~/types/governance_proposal";
import type { IProposalAction } from "~/types/proposal/proposalAction";
import { useProposalAddressLabels } from "~/composables/proposal/useProposalAddressLabels";

/**
 * What a proposal will do, call by call, in words — with the raw
 * targets/values/calldatas a click away for anyone who wants to check.
 *
 * The decoding happened in the store when the proposal was loaded; this only
 * lays the decoded calls out and hands each to the component that knows how
 * to explain its kind.
 */
const props = defineProps<{
  proposal: IGovernanceProposal;
}>();

const VIEW_OPTIONS = [
  { key: "readable", label: "Readable" },
  { key: "raw", label: "Raw" },
];
const view = ref<"readable" | "raw">("readable");

// One label resolver for the whole list, so the same address is looked up
// once no matter how many calls mention it.
const addressLabels = useProposalAddressLabels();
provide("proposalAddressLabels", addressLabels);

const WHITELIST_RESET_NOTE =
  "Technical step: re-submits the vault's current settings so the deposit whitelist can be replaced by the next call. Nothing changes here.";

const actions = computed((): IProposalAction[] => {
  const proposal = props.proposal;
  const calldatas = proposal?.calldatas ?? [];
  const types = proposal?.calldataTypes ?? [];
  return calldatas.map((calldata, index) => {
    const decoded = proposal.calldatasDecoded?.[index];
    const type = types[index];
    // The settings flow submits two updateSettings calls when the whitelist
    // changes: the first repeats the current settings to clear the list, the
    // second carries the new one. The first is noise to a reader.
    const isWhitelistReset =
      type === ProposalCalldataType.FUND_SETTINGS &&
      types[index + 1] === ProposalCalldataType.FUND_SETTINGS &&
      proposal.targets?.[index + 1]?.toLowerCase() === proposal.targets?.[index]?.toLowerCase();
    return {
      index,
      target: proposal.targets?.[index] ?? "",
      value: String(proposal.values?.[index] ?? "0"),
      calldata,
      type,
      functionName: decoded?.functionName,
      contractName: decoded?.contractName,
      decoded: decoded?.calldataDecoded,
      note: isWhitelistReset ? WHITELIST_RESET_NOTE : undefined,
    };
  });
});

const lede = computed(() => {
  const count = actions.value.length;
  if (!count) return "Nothing runs on-chain when this proposal is executed.";
  if (count === 1) return "One on-chain call runs when this proposal is executed.";
  return `${count} on-chain calls run, in order, when this proposal is executed.`;
});

const rawCode = computed(() =>
  JSON.stringify(
    {
      targets: props.proposal?.targets ?? [],
      values: props.proposal?.values ?? [],
      signatures: props.proposal?.signatures ?? [],
      calldatas: props.proposal?.calldatas ?? [],
    },
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);
</script>

<style scoped lang="scss">
.actions {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__intro {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__lede {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: $color-text-irrelevant;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  &__empty {
    margin: 0;
    font-size: 13px;
    color: $color-steel-blue;
  }

  &__raw {
    margin: 0;
    padding: 1rem 1.125rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-navy-gray-light;
    font-family: $font-mono;
    font-size: 12px;
    line-height: 1.6;
    color: $color-text-irrelevant;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
