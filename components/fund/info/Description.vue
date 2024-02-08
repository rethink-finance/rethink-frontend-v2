<template>
  <div class="fund_description">
    <div>
      <div class="fund_description__details">
        <v-avatar size="3.5rem" rounded="0">
          <img
            :src="fund.avatar_url"
            class="fund_description__avatar_img bg-cover"
            alt="fund cover image"
          >
        </v-avatar>
        <div class="fund_description__title_wrapper">
          <div class="fund_description__title">
            {{ fund.title }}
          </div>
          <div class="fund_description__subtitle">
            {{ fund.subtitle }}
          </div>
        </div>
      </div>
      <div class="fund_description__description">
        <p class="text-secondary">
          {{ fund.description }}
        </p>
      </div>
    </div>
    <div class="fund_description__buttons">
      <UiCopyButton
        title="DeBank - AUM"
        :value="fund.address"
        :tooltip-text="`Copy Fund address to clipboard (${ formatAddress })`"
      />
      <UiCopyButton
        title="Tally - Governance"
        :value="fund.governor_address"
        :tooltip-text="`Copy Governance address to clipboard (${ formatGovernanceAddress })`"
      />
      <UiCopyButton
        title="Safe - Custody"
        :value="fund.safe_address"
        :tooltip-text="`Copy Safe address to clipboard (${ formatSafeAddress })`"
      />
    </div>
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";

export default {
  name: "FundInfoDescription",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  data() {
    return {};
  },
  computed: {
    formatAddress() {
      return truncateAddress(this.fund?.address);
    },
    formatGovernanceAddress() {
      return truncateAddress(this.fund?.governor_address);
    },
    formatSafeAddress() {
      return truncateAddress(this.fund?.safe_address);
    },
  },
  methods: {
    async copyFundAddr() {
      try {
        await navigator.clipboard.writeText(this.fund.address);
        // const msg = "Copied Fund Address (" + this.fund.address + ") to clipboard";
        // this.$toast.success(msg);
      } catch ($e) {console.error($e);}
    },
    async copyGovernorAddr() {
      try {
        await navigator.clipboard.writeText(this.fund?.governor_address);
        // const msg = "Copied Governor Address (" + this.fund.governor + ") to clipboard";
        // this.$toast.success(msg);
      } catch ($e) {}
    },
    async copySafeAddr() {
      try {
        await navigator.clipboard.writeText(this.fund?.safe_address);
        // const msg = "Copied Safe Address (" + this.fund.safe + ") to clipboard";
        // this.$toast.success(msg);
      } catch ($e) {}
    },
  },
};
</script>

<style lang="scss" scoped>
.fund_description {
  display: flex;
  gap: 2.5rem;
  flex-direction: column;

  @include sm {
    flex-direction: row;
  }
  &__avatar_img {
    border-radius: 0.25rem;
  }
  &__details {
    display: flex;
    margin-bottom: 1.5rem;
  }
  &__title_wrapper {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    margin-left: 1rem;
  }
  &__title {
    font-size: 1.5rem;
    color: $color-title;
    line-height: 1;
  }
  &__subtitle {
    font-size: 1rem;
    font-weight: bold;
    color: $color-subtitle;
    line-height: 1;
  }
  &__buttons {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    //justify-content: space-around;

    button {
      text-transform: none;
    }
  }
}
</style>
