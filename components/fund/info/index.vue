<template>
  <div class="fund_info">
    <div class="fund_info__header">
      <div>
        <div class="fund_info__header__details">
          <v-avatar size="3.5rem" rounded="0" class="me-3">
            <img
              :src="fund.avatar_url"
              class="fund_info__header__avatar_img bg-cover"
              alt="fund cover image"
            >
          </v-avatar>
          <div class="fund_info__header__details__title_wrapper pa-1">
            <div class="fund_info__header__details__title">
              {{ fund.title }}
            </div>
            <div class="fund_info__header__details__subtitle">
              {{ fund.subtitle }}
            </div>
          </div>
        </div>
        <div class="fund_info__header__description">
          <p class="text-secondary">
            {{ fund.description }}
          </p>
        </div>
      </div>
      <div class="fund_info__header__buttons">
        <v-btn
          class="mb-4 d-flex justify-space-between text-secondary"
          variant="outlined"
          size="large"
        >
          DeBank - AUM
          <template #append>
            <v-icon icon="mdi-link" size="1.5rem" />
          </template>
          <v-tooltip activator="parent" location="bottom">
            Copy Fund address to clipboard ({{ formatAddress }})
          </v-tooltip>
        </v-btn>
        <v-btn
          class="mb-4 d-flex justify-space-between text-secondary"
          variant="outlined"
          size="large"
        >
          Tally - Governance
          <template #append>
            <v-icon icon="mdi-link" size="1.5rem" />
          </template>
          <v-tooltip activator="parent" location="bottom">
            Copy Governance address to clipboard ({{ formatGovernanceAddress }})
          </v-tooltip>
        </v-btn>
        <v-btn
          class="mb-3 d-flex justify-space-between text-secondary"
          variant="outlined"
          size="large"
        >
          Safe - Custody
          <template #append>
            <v-icon icon="mdi-link" size="1.5rem" />
          </template>
          <v-tooltip activator="parent" location="bottom">
            Copy Safe address to clipboard ({{ formatSafeAddress }})
          </v-tooltip>
        </v-btn>
      </div>
    </div>

    <div class="fund_info__section">
      <FundInfoInsights :fund="fund" />
    </div>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type IFund from "~/types/fund";

export default {
  name: "Info",
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
    chainIconName() {
      return `cryptocurrency-color:${chainToIconName(this.fund?.chain)}`;
    },
  },
  methods: {
    toggleFund() {
      // this.$store.state.fund.selectedFundAddress = this.fund.address;
      // this.$store.commit("fund/setSelectedFundAddress", this.fund.address);
      this.copyFundAddr();
    },
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
        // const msg = "Copied Governor Address (" + th|is.fund.governor + ") to clipboard";
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
.fund_info {
  &__header {
    display: flex;
    gap: 2.5rem;
    margin-bottom: 2rem;

    &__avatar_img {
      border-radius: 0.25rem;
    }
    &__details {
      display: flex;
      margin-bottom: 1.5rem;
      &__title_wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
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
    }
    &__buttons {
      display: flex;
      flex-direction: column;
      button {
        text-transform: none;
      }
    }
  }
}
</style>
