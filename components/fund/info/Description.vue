<template>
  <div class="fund_description">
    <div class="fund_description__header">
      <div>
        <div class="fund_description__info subtitle_white">
          Information
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
    <p class="text-secondary">
      {{ fundDescriptionText }}
      <UiShowMoreButton
        v-if="isDescriptionToLong"
        v-model="showMore"
      />
    </p>
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
    return {
      maxDescriptionLength: 300,
      showMore: false,
    };
  },
  computed: {
    buttonLinks() {
      return [
        {
          title: "DeBank - AUM",
          href: this.deBankUrl,
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
    custodyUrl(): string {
      /** Example:
       * https://app.safe.global/balances?safe=matic:0x54b491bb5e59CD974dDc9b5a52478f54c07Aee78
       * **/
      return `https://app.safe.global/balances?safe=${this.fund.chainShort}:${this.fund.safeAddress}`;
    },
    isDescriptionToLong(): boolean {
      if (!this.fund?.description) return false;
      return this.fund.description.length > this.maxDescriptionLength
    },
    fundDescriptionText(): string {
      if (!this.fund?.description) return "";
      if (this.isDescriptionToLong && !this.showMore) {
        return this.fund?.description?.slice(0, this.maxDescriptionLength) + "...";
      }
      return this.fund?.description;
    },
  },
};
</script>

<style lang="scss" scoped>
.fund_description {
  display: flex;
  gap: 1.5rem;
  flex-direction: column;
  justify-content: space-between;

  &__header{
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: none;

    @include sm{
      flex-direction: row;
      align-items: center;
    }
  }

  &__info{
    margin-bottom: 0.75rem;
    
    @include sm{
      margin-bottom: 0
    }
  }

  &__buttons {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    @include sm{
      flex-direction: row;
    }

    button {
      text-transform: none;
    }
  }



}
</style>
