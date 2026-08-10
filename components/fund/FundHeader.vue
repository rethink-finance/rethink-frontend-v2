<template>
  <div v-if="breadcrumbItems.length === 0" class="fund_header">
    <div class="fund_header__identity">
      <div class="fund_header__tile">
        <img
          v-if="fund?.photoUrl"
          :src="fund.photoUrl"
          class="fund_header__tile_img"
          alt="vault cover image"
        >
        <span v-else class="fund_header__tile_symbol">
          {{ fund?.fundToken?.symbol }}
        </span>
      </div>

      <div class="fund_header__body">
        <h1 class="fund_header__title">
          {{ fund?.title }}
          <!-- Which of the vault's sections you are in, said in the title
               rather than in a separate crumb: the vault is still the subject,
               the section is a qualifier on it. -->
          <template v-if="sectionTitle">
            <span class="fund_header__title_sep">/</span>
            <span class="fund_header__section">{{ sectionTitle }}</span>
          </template>
        </h1>

        <div class="fund_header__meta">
          <div v-if="fund?.strategistName" class="fund_header__curator">
            by
            <a
              :href="fund?.strategistUrl"
              target="_blank"
              rel="noopener noreferrer"
            >{{ fund.strategistName }}</a>
          </div>
          <span v-if="fund?.strategistName" class="fund_header__sep" />

          <!-- The design's stat strip carries only NAV, return and APR, so the
               inception date rides along here rather than being dropped. -->
          <div v-if="fund?.inceptionDate" class="fund_header__chip">
            Since {{ fund.inceptionDate }}
          </div>
          <span v-if="fund?.inceptionDate" class="fund_header__sep" />

          <!-- Both marks take the shared diameter, so the asset chip and the
               chain chip beside it line up rather than one riding taller. -->
          <div v-if="fund?.baseToken?.symbol" class="fund_header__chip">
            <IconBaseAsset
              :chain-id="fund?.chainId"
              :chain-short="fund?.chainShort"
              :token-address="fund?.baseToken?.address"
              :symbol="fund?.baseToken?.symbol"
            />
            {{ fund.baseToken.symbol }}
          </div>

          <div v-if="chainName" class="fund_header__chip">
            <IconChain :chain-short="fund?.chainShort" />
            {{ chainName }}
          </div>

          <a
            v-if="explorerUrl"
            :href="explorerUrl"
            target="_blank"
            rel="noopener noreferrer"
            title="View custody contract on explorer"
            class="fund_header__address"
          >
            {{ truncatedAddress }}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M7 17L17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        </div>
      </div>
    </div>

    <!-- The way back out of a section. Overview is no longer a tab in the
         curator row, so this is the only route to it — which is why it sits in
         the header itself rather than among the section links. -->
    <NuxtLink
      v-if="sectionTitle && overviewRoute"
      :to="overviewRoute"
      class="fund_header__overview"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
      Back to overview
    </NuxtLink>
  </div>
</template>

<script lang="ts" setup>
import type IFund from "~/types/fund";
import type BreadcrumbItem from "~/types/ui/breadcrumb";
import { getExplorerUrl } from "~/types/enums/chain_id";
import { capitalizeFirst } from "~/composables/utils";
import IconBaseAsset from "~/components/global/icon/BaseAsset.vue";
import IconChain from "~/components/global/icon/Chain.vue";

const props = defineProps<{
  fund: IFund;
  breadcrumbItems: BreadcrumbItem[];
  /** The section being viewed, empty on the overview itself. */
  sectionTitle?: string;
  overviewRoute?: string;
}>();

const chainName = computed(() => capitalizeFirst(props.fund?.chainName || ""));

// The header links to the custody contract, which is what the design labels
// as the vault address — the same target the Basics table already exposes.
const explorerUrl = computed(() =>
  props.fund?.address && props.fund?.chainId
    ? getExplorerUrl(props.fund.chainId, props.fund.address)
    : "",
);

const truncatedAddress = computed(() =>
  props.fund?.address ? truncateAddress(props.fund.address) : "",
);
</script>

<style lang="scss" scoped>
.fund_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 2.5rem;

  &__identity {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  /* Same tile treatment as the discover table's vault cell: hairline border,
     no accent fill — the logo itself supplies the colour. */
  &__tile {
    position: relative;
    display: grid;
    place-items: center;
    flex: none;
    width: 78px;
    height: 78px;
    border-radius: $default-border-radius;
    background: $color-navy-gray-light;
    border: 1px solid $color-line;
    overflow: hidden;
  }

  &__tile_img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Fallback when a vault has no cover image: its token symbol, same
     treatment the discover table uses for the same case. */
  &__tile_symbol {
    font-family: $font-mono;
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 0.03em;
    color: $color-steel-blue;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 0.6875rem;
    min-width: 220px;
  }

  &__title {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: $color-white;
  }

  /* Mono and cyan, the same treatment the curator row gives a section name, so
     the two read as naming the same thing. */
  &__title_sep {
    font-weight: 400;
    color: $color-steel-blue;
  }

  &__section {
    /* Vue drops the newline between the slash and this, so the gap is drawn
       rather than typed. */
    margin-left: 0.375rem;
    font-family: $font-mono;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-cyan;
    vertical-align: middle;
  }

  &__overview {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex: none;
    padding: 0.5rem 0.875rem;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    text-decoration: none;
    white-space: nowrap;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover {
      color: $color-white;
      border-color: $color-line-3;
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__curator {
    font-size: 15px;
    color: $color-steel-blue;

    a {
      color: $color-text-irrelevant;
      text-decoration: none;
      border-bottom: 1px solid $color-line-2;
      transition: color $default-transition-time ease;

      &:hover {
        color: $color-white;
      }
    }
  }

  &__sep {
    flex: none;
    width: 3px;
    height: 3px;
    border-radius: 999px;
    background: $color-steel-blue;
  }

  &__chip {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    font-family: $font-mono;
    font-size: 13.5px;
    color: $color-text-irrelevant;
  }

  &__address {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-family: $font-mono;
    font-size: 13.5px;
    color: $color-cyan;
    text-decoration: none;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-white;
    }
  }
}
</style>
