<template>
  <article
    class="mon_proposal"
    :class="[`mon_proposal--${proposal.level}`, { 'mon_proposal--open': isOpen }]"
  >
    <button
      type="button"
      class="mon_proposal__head"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <div class="mon_proposal__grade">
        <MonitoringThreatBadge :level="proposal.level" />
      </div>

      <div class="mon_proposal__main">
        <div class="mon_proposal__vault">
          <IconChain :chain-id="proposal.chainId" :size="16" />
          <span class="mon_proposal__vault_name">{{ proposal.fundName || truncateAddress(proposal.fundAddress) }}</span>
          <span class="mon_proposal__vault_symbol">{{ proposal.fundSymbol }}</span>
        </div>
        <div class="mon_proposal__title">
          {{ proposal.title }}
        </div>
        <div class="mon_proposal__badges">
          <FundGovernanceStateBadge :value="proposal.state" />
          <span class="mon_proposal__timing">{{ timing }}</span>
        </div>
        <ul v-if="headlineFlags.length" class="mon_proposal__headline">
          <li
            v-for="flag in headlineFlags"
            :key="flag.code + flag.title"
            class="mon_proposal__headline_item"
            :class="`mon_proposal__headline_item--${flag.severity}`"
          >
            {{ flag.title }}<span v-if="(flag.count ?? 1) > 1" class="mon_proposal__count">×{{ flag.count }}</span>
          </li>
        </ul>
      </div>

      <div class="mon_proposal__votes">
        <div class="mon_proposal__vote_row">
          <span class="mon_proposal__vote_label">For</span>
          <span class="mon_proposal__vote_value">{{ votes.for }}</span>
        </div>
        <div class="mon_proposal__vote_row">
          <span class="mon_proposal__vote_label">Against</span>
          <span class="mon_proposal__vote_value">{{ votes.against }}</span>
        </div>
        <div class="mon_proposal__vote_row">
          <span class="mon_proposal__vote_label">Quorum</span>
          <span
            class="mon_proposal__vote_value"
            :class="proposal.quorumReached ? 'mon_proposal__vote_value--ok' : 'mon_proposal__vote_value--short'"
          >
            {{ quorumText }}
          </span>
        </div>
        <div class="mon_proposal__voters">
          {{ proposal.voterCount }} {{ proposal.voterCount === 1 ? "voter" : "voters" }}
          <span v-if="proposal.isLive"> · {{ proposal.isPassing ? "passing" : "not passing" }}</span>
        </div>
      </div>

      <Icon
        icon="octicon:chevron-down-16"
        class="mon_proposal__chevron"
        width="1rem"
        height="1rem"
      />
    </button>

    <div v-if="isOpen" class="mon_proposal__body">
      <section class="mon_proposal__section">
        <div class="mon_proposal__eyebrow">
          Threat flags
        </div>
        <div v-if="!proposal.flags.length" class="mon_proposal__muted">
          Nothing raised. Every call decoded to a known, harmless function.
        </div>
        <ul v-else class="mon_proposal__flags">
          <li
            v-for="flag in proposal.flags"
            :key="flag.code + flag.title"
            class="mon_proposal__flag"
            :class="`mon_proposal__flag--${flag.severity}`"
          >
            <span class="mon_proposal__flag_severity">{{ flag.severity }}</span>
            <div class="mon_proposal__flag_text">
              <div class="mon_proposal__flag_title">
                {{ flag.title }}
                <span v-if="(flag.count ?? 1) > 1" class="mon_proposal__count">×{{ flag.count }}</span>
                <span v-if="flag.callPaths?.length" class="mon_proposal__flag_path">call {{ flag.callPaths.join(", ") }}</span>
                <span v-else class="mon_proposal__flag_path">vault</span>
              </div>
              <div v-if="flag.detail" class="mon_proposal__flag_detail">
                {{ flag.detail }}
              </div>
            </div>
          </li>
        </ul>
      </section>

      <section class="mon_proposal__section">
        <div class="mon_proposal__eyebrow">
          What it executes
        </div>
        <div v-if="!proposal.calls.length" class="mon_proposal__muted">
          No calls — a signalling proposal.
        </div>
        <MonitoringCallTree
          v-for="call in proposal.calls"
          :key="call.path"
          :call="call"
          :chain-id="proposal.chainId"
        />
      </section>

      <section v-if="proposal.description" class="mon_proposal__section">
        <div class="mon_proposal__eyebrow">
          Proposer's description
        </div>
        <p class="mon_proposal__description">
          {{ proposal.description }}
        </p>
      </section>

      <section class="mon_proposal__section mon_proposal__links">
        <nuxt-link :to="appUrl" class="mon_proposal__link">
          Open in app
          <Icon icon="octicon:arrow-up-right-16" width="0.75rem" height="0.75rem" />
        </nuxt-link>
        <a
          :href="proposerUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mon_proposal__link"
        >
          Proposer {{ truncateAddress(proposal.proposer) }}
          <Icon icon="octicon:link-external-16" width="0.75rem" height="0.75rem" />
        </a>
        <a
          v-if="proposal.createdTxHash"
          :href="createdTxUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mon_proposal__link"
        >
          Creation tx
          <Icon icon="octicon:link-external-16" width="0.75rem" height="0.75rem" />
        </a>
        <a
          :href="governorUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mon_proposal__link"
        >
          Governor {{ truncateAddress(proposal.governor) }}
          <Icon icon="octicon:link-external-16" width="0.75rem" height="0.75rem" />
        </a>
        <span class="mon_proposal__id" :title="proposal.proposalId">
          #{{ proposal.proposalId.slice(0, 10) }}…
        </span>
      </section>
    </div>
  </article>
</template>

<script setup lang="ts">
import { truncateAddress } from "~/composables/addressUtils";
import { formatApproximateDuration, formatDate, formatNumberShort } from "~/composables/formatters";
import {
  SEVERITY_RANK,
  shareDecimals,
  type MonitoredProposal,
  type MonitoredVault,
} from "~/services/backend/monitoring";
import { getExplorerUrl } from "~/types/enums/chain_id";

/**
 * One proposal across the whole platform: which vault, what it does, how the
 * vote stands, and — first — whether the threat rules found anything. Collapsed
 * it is one scan line; open it shows every flag with its evidence and the
 * decoded call tree, so a reviewer never has to leave the page to decide.
 */
const props = defineProps<{
  proposal: MonitoredProposal;
  vault?: MonitoredVault;
  /** Open on first paint — for the few rows that need reading right away. */
  defaultOpen?: boolean;
}>();

const isOpen = ref(props.defaultOpen ?? false);

/** Flags worth a line in the collapsed row: anything medium or above. */
const headlineFlags = computed(() =>
  props.proposal.flags
    .filter((flag) => SEVERITY_RANK[flag.severity] >= SEVERITY_RANK.medium)
    .slice(0, 4),
);

/**
 * Vault shares mint in base-token units while the token's decimals() says 18,
 * so a vault governed by its own shares is read at the base token's scale.
 * An external governance token is read at its own.
 */
const decimals = computed(() => shareDecimals(props.vault));

const fromUnits = (raw: string): number => {
  try {
    const value = BigInt(raw || "0");
    const base = 10n ** BigInt(decimals.value);
    const whole = value / base;
    const frac = Number(value % base) / Number(base);
    return Number(whole) + frac;
  } catch {
    return 0;
  }
};

/** formatNumberShort has no answer for a dust amount; say "<0.01" rather than NaN. */
const shortNumber = (value: number) =>
  value > 0 && value < 0.01 ? "<0.01" : formatNumberShort(value);

const votes = computed(() => ({
  for: shortNumber(fromUnits(props.proposal.forVotes)),
  against: shortNumber(fromUnits(props.proposal.againstVotes)),
}));

const quorumText = computed(() => {
  const p = props.proposal;
  const needed = fromUnits(p.quorumVotes);
  const have = fromUnits(p.forVotes) + fromUnits(p.abstainVotes);
  if (needed === 0) return "none needed";
  const pct = Math.min((have / needed) * 100, 999);
  return `${pct.toFixed(0)}% of ${shortNumber(needed)}`;
});

const nowSeconds = () => Math.floor(Date.now() / 1000);

const timing = computed(() => {
  const p = props.proposal;
  const now = nowSeconds();
  const at = (seconds?: number) => (seconds ? formatDate(new Date(seconds * 1000)) : undefined);
  switch (p.state) {
    case "Pending":
      return p.voteStartAt ? `voting opens in ${formatApproximateDuration(Math.max(p.voteStartAt - now, 0))}` : "voting not open yet";
    case "Active":
      return p.voteEndAt
        ? p.voteEndAt > now
          ? `ends in ${formatApproximateDuration(p.voteEndAt - now)}`
          : "closing"
        : "voting open";
    case "Succeeded":
      return `passed ${at(p.voteEndAt) ?? ""} · executable by anyone`.trim();
    case "Queued":
      return `queued ${at(p.queuedAt) ?? ""}`.trim();
    case "Executed":
      return `executed ${at(p.executedAt) ?? ""}`.trim();
    case "Canceled":
      return `canceled ${at(p.canceledAt) ?? ""}`.trim();
    case "Defeated":
      return `defeated ${at(p.voteEndAt) ?? ""}`.trim();
    default:
      return p.state.toLowerCase();
  }
});

const appUrl = computed(() => {
  const p = props.proposal;
  return `/details/${p.chainId}-${p.fundSymbol}-${p.fundAddress}/governance/proposal/${p.createdBlockNumber}-${p.proposalId}`;
});
const proposerUrl = computed(() => getExplorerUrl(props.proposal.chainId, props.proposal.proposer));
const createdTxUrl = computed(() => getExplorerUrl(props.proposal.chainId, props.proposal.createdTxHash));
const governorUrl = computed(() => getExplorerUrl(props.proposal.chainId, props.proposal.governor));
</script>

<style lang="scss" scoped>
.mon_proposal {
  border: 1px solid $color-line;
  border-left-width: 3px;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &--critical,
  &--high {
    border-left-color: $color-neg;
  }

  &--medium {
    border-left-color: $color-warn;
  }

  &--none {
    border-left-color: $color-success-light;
  }

  &__head {
    display: grid;
    grid-template-columns: 108px minmax(0, 1fr) 190px 1rem;
    align-items: start;
    gap: 1rem;
    width: 100%;
    padding: 0.875rem 1rem 0.875rem 0.875rem;
    text-align: left;
    background: none;
    border: 0;
    color: inherit;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background: $color-navy-gray-light;
    }
  }

  &__grade {
    padding-top: 0.125rem;
  }

  &__main {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__vault {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    color: $color-steel-blue;
  }

  &__vault_name {
    color: $color-white;
    font-weight: 600;
  }

  &__vault_symbol {
    text-transform: uppercase;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: $color-white;
    overflow-wrap: anywhere;
  }

  &__badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  &__timing {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-text-irrelevant;
  }

  &__headline {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin: 0.125rem 0 0;
    padding: 0;
    list-style: none;
  }

  &__headline_item {
    font-size: 12.5px;
    color: $color-steel-blue;

    &::before {
      content: "▸ ";
      color: $color-text-irrelevant;
    }

    &--critical,
    &--high {
      color: $color-neg;
    }

    &--medium {
      color: $color-warn;
    }
  }

  &__count {
    margin-left: 0.375rem;
    font-family: $font-mono;
    font-size: 10px;
    color: $color-text-irrelevant;
  }

  &__votes {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding-top: 0.125rem;
  }

  &__vote_row {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-family: $font-mono;
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
  }

  &__vote_label {
    color: $color-steel-blue;
  }

  &__vote_value {
    color: $color-white;

    &--ok {
      color: $color-success-light;
    }

    &--short {
      color: $color-steel-blue;
    }
  }

  &__voters {
    margin-top: 0.25rem;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.04em;
    color: $color-text-irrelevant;
  }

  &__chevron {
    margin-top: 0.25rem;
    color: $color-steel-blue;
    transition: transform 0.2s ease;
  }

  &--open &__chevron {
    transform: rotate(180deg);
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 0.25rem 1rem 1.125rem 1.25rem;
    border-top: 1px solid $color-line;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 1rem;
  }

  &__eyebrow {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__muted {
    font-size: $text-sm;
    color: $color-steel-blue;
  }

  &__flags {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__flag {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 0.75rem;
    align-items: start;
    padding: 0.625rem 0.75rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;

    &--critical {
      border-color: $color-neg-line;
      background: $color-neg-soft;
    }

    &--high {
      border-color: $color-neg-line;
    }

    &--medium {
      border-color: $color-warn-line;
      background: $color-warn-soft;
    }
  }

  &__flag_severity {
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    padding-top: 0.125rem;

    .mon_proposal__flag--critical &,
    .mon_proposal__flag--high & {
      color: $color-neg;
    }

    .mon_proposal__flag--medium & {
      color: $color-warn;
    }
  }

  &__flag_text {
    min-width: 0;
  }

  &__flag_title {
    font-size: 13px;
    font-weight: 600;
    color: $color-white;
  }

  &__flag_path {
    margin-left: 0.5rem;
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.06em;
    color: $color-text-irrelevant;
  }

  &__flag_detail {
    margin-top: 0.25rem;
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;
    overflow-wrap: anywhere;
  }

  &__description {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    white-space: pre-wrap;
    color: $color-steel-blue;
    overflow-wrap: anywhere;
  }

  &__links {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 1.25rem;
  }

  &__link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-family: $font-mono;
    font-size: 11.5px;
    letter-spacing: 0.04em;
    color: $color-cyan;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__id {
    margin-left: auto;
    font-family: $font-mono;
    font-size: 10.5px;
    color: $color-text-irrelevant;
  }

  @media (max-width: 860px) {
    &__head {
      grid-template-columns: minmax(0, 1fr) 1rem;
    }

    &__grade {
      grid-column: 1;
    }

    &__votes {
      grid-column: 1;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    &__chevron {
      grid-column: 2;
      grid-row: 1;
    }
  }
}
</style>
