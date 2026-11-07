<template>
  <div class="activity_list">
    <div v-if="!items.length" class="activity_list__empty">
      <slot name="empty">
        Nothing here.
      </slot>
    </div>
    <article
      v-for="(item, index) in items"
      :key="itemKey(item, index)"
      class="activity_item"
      :class="[`activity_item--${item.severity}`, { 'activity_item--open': isOpen(item, index) }]"
    >
      <div
        class="activity_item__head"
        :class="{ 'activity_item__head--expandable': hasBody(item) }"
        :role="hasBody(item) ? 'button' : undefined"
        :tabindex="hasBody(item) ? 0 : undefined"
        :aria-expanded="hasBody(item) ? isOpen(item, index) : undefined"
        @click="hasBody(item) && toggle(item, index)"
        @keydown.enter.prevent="hasBody(item) && toggle(item, index)"
        @keydown.space.prevent="hasBody(item) && toggle(item, index)"
      >
        <div class="activity_item__grade">
          <MonitoringThreatBadge :level="item.severity" />
        </div>

        <div class="activity_item__main">
          <div v-if="showVault" class="activity_item__vault">
            <IconChain :chain-id="item.chainId" :size="16" />
            <span class="activity_item__vault_name">{{ item.fundName || truncateAddress(item.fundAddress ?? '') }}</span>
            <span v-if="item.fundSymbol" class="activity_item__vault_symbol">{{ item.fundSymbol }}</span>
          </div>
          <div class="activity_item__title">
            {{ item.title }}
            <span v-if="(item.count ?? 1) > 1" class="activity_item__count">×{{ item.count }}</span>
          </div>
          <div v-if="item.detail" class="activity_item__detail">
            {{ item.detail }}
          </div>
          <div class="activity_item__meta">
            <span class="activity_item__time" :title="exactTime(item)">{{ timeText(item) }}</span>
            <span v-if="item.eventName" class="activity_item__event">{{ item.eventName }}</span>
            <span v-if="isPolled(item)" class="activity_item__event">polled</span>
            <a
              v-if="item.sender"
              :href="getExplorerUrl(item.chainId, item.sender)"
              target="_blank"
              rel="noopener noreferrer"
              class="activity_item__link"
              :title="item.sender"
              @click.stop
            >
              sender {{ truncateAddress(item.sender) }}
              <Icon icon="octicon:link-external-16" width="0.6875rem" height="0.6875rem" />
            </a>
            <a
              v-if="txUrl(item)"
              :href="txUrl(item)"
              target="_blank"
              rel="noopener noreferrer"
              class="activity_item__link"
              :title="item.txHash"
              @click.stop
            >
              tx {{ truncateAddress(item.txHash) }}
              <Icon icon="octicon:link-external-16" width="0.6875rem" height="0.6875rem" />
            </a>
            <a
              v-else-if="item.contractAddress"
              :href="getExplorerUrl(item.chainId, item.contractAddress)"
              target="_blank"
              rel="noopener noreferrer"
              class="activity_item__link"
              :title="item.contractAddress"
              @click.stop
            >
              contract {{ truncateAddress(item.contractAddress) }}
              <Icon icon="octicon:link-external-16" width="0.6875rem" height="0.6875rem" />
            </a>
          </div>
        </div>

        <Icon
          v-if="hasBody(item)"
          icon="octicon:chevron-down-16"
          class="activity_item__chevron"
          width="1rem"
          height="1rem"
        />
      </div>

      <div v-if="hasBody(item) && isOpen(item, index)" class="activity_item__body">
        <section v-if="item.call" class="activity_item__section">
          <div class="activity_item__eyebrow">
            What it executed
          </div>
          <MonitoringCallTree :call="item.call" :chain-id="item.chainId" />
        </section>
        <section v-if="item.callPaths?.length" class="activity_item__section">
          <div class="activity_item__eyebrow">
            Call paths
          </div>
          <div class="activity_item__paths">
            {{ item.callPaths.join(", ") }}
          </div>
        </section>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { truncateAddress } from "~/composables/addressUtils";
import { formatApproximateDuration, formatDate } from "~/composables/formatters";
import { isTxHash, type ActivityFlag } from "~/services/backend/monitoring";
import { getExplorerUrl, type ChainId } from "~/types/enums/chain_id";

/**
 * One row per activity flag, newest first as the backend sends them. Each
 * says who did what to which vault and when, with the graded severity up
 * front — the same chip the proposal cards use. A decoded execution opens
 * into its call tree; everything else is a single scan line with the
 * explorer links a reviewer needs to verify it.
 */
export interface ActivityRow extends ActivityFlag {
  chainId: ChainId;
  fundAddress?: string;
  fundName?: string;
  fundSymbol?: string;
}

withDefaults(
  defineProps<{
    items: ActivityRow[];
    /** The cross-vault list names the vault on every row; a vault's own list need not. */
    showVault?: boolean;
  }>(),
  { showVault: true },
);

const openKeys = ref(new Set<string>());

/**
 * Two flags can share a transaction (an execution graded twice, say), so the
 * key takes the code and the position as well. The position only matters
 * within one render; the overview rebuilds the list newest first anyway.
 */
const itemKey = (item: ActivityRow, index: number) =>
  `${item.chainId}-${item.fundAddress ?? ""}-${item.txHash}-${item.code}-${item.blockNumber}-${index}`;

const hasBody = (item: ActivityRow) => Boolean(item.call || item.callPaths?.length);
const isOpen = (item: ActivityRow, index: number) => openKeys.value.has(itemKey(item, index));
const toggle = (item: ActivityRow, index: number) => {
  const key = itemKey(item, index);
  const next = new Set(openKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  openKeys.value = next;
};

const isPolled = (item: ActivityRow) => item.txHash?.startsWith("poll:");
const txUrl = (item: ActivityRow) => (isTxHash(item.txHash) ? getExplorerUrl(item.chainId, item.txHash) : undefined);

const exactTime = (item: ActivityRow) =>
  item.blockTimestamp ? new Date(item.blockTimestamp * 1000).toISOString() : "";

/** "3 Nov 26 · ≈ 2 days ago" — the date to place it, the distance to weigh it. */
const timeText = (item: ActivityRow) => {
  if (!item.blockTimestamp) return "time unknown";
  const date = new Date(item.blockTimestamp * 1000);
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - item.blockTimestamp);
  const ago = elapsed < 60 ? "just now" : `${formatApproximateDuration(elapsed)} ago`;
  return `${formatDate(date)} · ${ago}`;
};
</script>

<style lang="scss" scoped>
.activity_list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;

  &__empty {
    padding: 1.5rem 0;
    text-align: center;
    font-size: $text-sm;
    color: $color-steel-blue;
  }
}

.activity_item {
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

  &--low,
  &--info {
    border-left-color: $color-line-2;
  }

  &__head {
    display: grid;
    grid-template-columns: 108px minmax(0, 1fr) 1rem;
    align-items: start;
    gap: 1rem;
    padding: 0.75rem 1rem 0.75rem 0.875rem;
    transition: background-color 0.2s ease;

    &--expandable {
      cursor: pointer;

      &:hover {
        background: $color-navy-gray-light;
      }

      &:focus-visible {
        outline: 1px solid $color-accent-line;
        outline-offset: -1px;
      }
    }
  }

  &__grade {
    padding-top: 0.125rem;
  }

  &__main {
    display: flex;
    flex-direction: column;
    gap: 0.3125rem;
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
    font-size: 13.5px;
    font-weight: 600;
    color: $color-white;
    overflow-wrap: anywhere;
  }

  &__count {
    margin-left: 0.375rem;
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 400;
    color: $color-text-irrelevant;
  }

  &__detail {
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;
    overflow-wrap: anywhere;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 1rem;
    margin-top: 0.125rem;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: $color-text-irrelevant;
  }

  &__time {
    font-variant-numeric: tabular-nums;
  }

  &__event {
    padding: 0.0625rem 0.375rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-size: 10px;
    color: $color-steel-blue;
  }

  &__link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: $color-cyan;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
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
    gap: 1rem;
    padding: 0.25rem 1rem 1rem 1.25rem;
    border-top: 1px solid $color-line;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.875rem;
  }

  &__eyebrow {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__paths {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-text-irrelevant;
  }

  @media (max-width: 860px) {
    &__head {
      grid-template-columns: minmax(0, 1fr) 1rem;
    }

    &__grade {
      grid-column: 1;
    }

    &__chevron {
      grid-column: 2;
      grid-row: 1;
    }
  }
}
</style>
