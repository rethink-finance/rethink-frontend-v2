<template>
  <div class="fund_description">
    <div>
      <div class="fund_description__details">
        <v-avatar size="3.5rem" rounded="0">
          <img
            :src="fund.photoUrl"
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
      <UiLinkExternalButton
        v-for="buttonLink in buttonLinks"
        :title="buttonLink.title"
        :href="buttonLink.href"
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
    buttonLinks() {
      return [
        {
          title: "DeBank - AUM",
          href: this.deBankUrl,
        },
        {
          title: "Tally - Governance",
          href: this.governanceUrl,
        },
        {
          title: "Safe - Custody",
          href: this.custodyUrl,
        },
      ]
    },
    deBankUrl(): string {
      /** Example:
       * https://debank.com/profile/0x54b491bb5e59CD974dDc9b5a52478f54c07Aee78
       * **/
      return `https://debank.com/profile/${this.fund.safeAddress}`;
    },
    governanceUrl(): string {
      /** Example:
       * https://www.tally.xyz/gov/tfd3-0xface6562d7e39ea73b67404a6454fbbbefeca553
       * **/
      return `https://www.tally.xyz/gov/${this.fund.fundToken.symbol}-${this.fund.governorAddress}`;
    },
    custodyUrl(): string {
      /** Example:
       * https://app.safe.global/balances?safe=matic:0x54b491bb5e59CD974dDc9b5a52478f54c07Aee78
       * **/
      return `https://app.safe.global/balances?safe=${this.fund.chainShort}:${this.fund.safeAddress}`;
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
        await navigator.clipboard.writeText(this.fund?.governorAddress);
        // const msg = "Copied Governor Address (" + this.fund.governor + ") to clipboard";
        // this.$toast.success(msg);
      } catch ($e) {}
    },
    async copySafeAddr() {
      try {
        await navigator.clipboard.writeText(this.fund?.safeAddress);
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
  justify-content: space-between;

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
