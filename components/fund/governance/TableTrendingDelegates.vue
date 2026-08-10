<template>
  <div class="delegates_table">
    <div class="delegates_table__scroll">
      <div class="delegates_table__grid">
        <div class="delegates_table__row delegates_table__row--head">
          <div class="delegates_table__th">
            Delegated member
          </div>
          <div class="delegates_table__th delegates_table__th--center">
            Delegators
          </div>
          <div class="delegates_table__th delegates_table__th--right">
            Impact
          </div>
          <div class="delegates_table__th delegates_table__th--right">
            Voting power
          </div>
        </div>

        <div
          v-for="item in items"
          :key="item.delegatedMember"
          class="delegates_table__row"
        >
          <div class="delegates_table__member">
            <!-- The address is the handle for the wallet, so it is what copies;
                 there is no second control to hunt for. -->
            <UiTooltipClick location="right">
              <button
                type="button"
                class="delegates_table__address"
                :title="item.delegatedMember"
                @click="copyText(item.delegatedMember)"
              >
                {{ truncateAddressEllipsis(item.delegatedMember) }}
              </button>

              <template #tooltip>
                <div class="tooltip__content">
                  <span>Copied</span>
                </div>
              </template>
            </UiTooltipClick>

            <span v-if="isActiveAccount(item.delegatedMember)" class="delegates_table__you">
              You
            </span>
          </div>

          <button
            type="button"
            class="delegates_table__delegators"
            @click="handleRowClick(item)"
          >
            {{ pluralizeWord("member", item.delegators.length) }}
          </button>

          <div class="delegates_table__number">
            {{ item.impact }}
          </div>

          <div class="delegates_table__number">
            {{ roundToSignificantDecimals(item.votingPower) }}
          </div>
        </div>

        <div v-if="loading" class="delegates_table__row delegates_table__row--skeleton">
          <div v-for="cell in 4" :key="cell">
            <v-skeleton-loader type="text" class="delegates_table__skeleton" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="!items.length && !loading" class="delegates_table__empty">
      No delegated wallets yet.
    </div>
  </div>
</template>

<script setup lang="ts">
import { truncateAddressEllipsis } from "~/composables/addressUtils";
import { roundToSignificantDecimals } from "~/composables/formatters";
import { pluralizeWord } from "~/composables/utils";
import type ITrendingDelegate from "~/types/trending_delegate";

const emit = defineEmits(["row-click"]);

const props = defineProps({
  items: {
    type: Array as () => ITrendingDelegate[],
    default: () => [],
  },
  activeAccountAddress: {
    type: String,
    default: "",
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const isActiveAccount = (address: string) =>
  Boolean(props.activeAccountAddress) &&
  address?.toLowerCase() === props.activeAccountAddress?.toLowerCase();

const copyText = (text: string) => {
  navigator.clipboard.writeText(text);
};

const handleRowClick = (item: ITrendingDelegate) => {
  emit("row-click", item);
};
</script>

<style lang="scss" scoped>
/**
 * Only two things in a row are targets — the address and the delegator count —
 * so the row itself is not clickable. A row that highlights on hover but leads
 * nowhere reads as broken.
 */
.delegates_table {
  &__scroll {
    overflow-x: auto;
  }

  &__grid {
    min-width: 620px;
  }

  &__row {
    display: grid;
    grid-template-columns: 1.5fr 150px 110px 170px;
    align-items: center;
    gap: 1rem;
    padding: 0.8125rem 1.5rem;
    border-bottom: 1px solid $color-line;

    &--head {
      height: 40px;
      padding-top: 0;
      padding-bottom: 0;
      border-top: 1px solid $color-line;
    }
  }

  &__th {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--right {
      text-align: right;
    }

    &--center {
      text-align: center;
    }
  }

  &__member {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  &__address {
    font-family: $font-mono;
    font-size: 13px;
    color: $color-white;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-cyan;
    }
  }

  &__you {
    padding: 0.125rem 0.375rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    background: $color-accent-soft;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__delegators {
    font-family: $font-mono;
    font-size: 12.5px;
    text-align: center;
    color: $color-text-irrelevant;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-cyan;
      text-decoration: underline;
    }
  }

  &__number {
    font-family: $font-mono;
    font-size: 12.5px;
    text-align: right;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }

  &__skeleton :deep(*) {
    margin: 0;
  }

  &__empty {
    padding: 1.5rem;
    text-align: center;
    font-size: $text-sm;
    color: $color-steel-blue;
  }
}
</style>

