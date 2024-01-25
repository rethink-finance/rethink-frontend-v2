<template>
  <div class="fund pa-6">
    <div class="mb-12">
      <div class="fund__header">
        <div>
          <div class="fund__header__details">
            <v-avatar size="3.5rem" rounded="0" class="me-3">
              <img
                :src="fund.avatar_url"
                class="fund__header__avatar_img bg-cover"
                alt="fund cover image"
              >
            </v-avatar>
            <div class="fund__header__details__title_wrapper pa-1">
              <div class="fund__header__details__title">
                {{ fund.title }}
              </div>
              <div class="fund__header__details__subtitle">
                {{ fund.subtitle }}
              </div>
            </div>
          </div>
          <div class="fund__header__description">
            <p class="text-secondary">
              {{ fund.description }}
            </p>
          </div>
        </div>
        <div class="fund__header__action_buttons">
          <v-btn
            class="mb-4 d-flex justify-space-between text-secondary"
            variant="outlined"
            size="large"
          >
            DeBank - AUM
            <template #append>
              <v-icon icon="mdi-link" size="large" />
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
              <v-icon icon="mdi-link" size="large" />
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
              <v-icon icon="mdi-link" size="large" />
            </template>
            <v-tooltip activator="parent" location="bottom">
              Copy Safe address to clipboard ({{ formatSafeAddress }})
            </v-tooltip>
          </v-btn>
        </div>
      </div>
    </div>

    <div class="mb-12">
      <div class="fund__section_subtitle">
        Fund Insights
      </div>
      <FundInsights :fund="fund" />
    </div>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type IFund from "~/types/fund";

export default {
  name: "Fund",
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
    async toggleFund() {
      // this.$store.state.fund.selectedFundAddress = this.fund.address;
      // this.$store.commit("fund/setSelectedFundAddress", this.fund.address);
      await this.copyFundAddr();
    },
    async toggleSafe() {
      await this.copySafeAddr();
    },
    async toggleGovernor() {
      await this.copyGovernorAddr();
    },
    async copyFundAddr() {
      try {
        await navigator.clipboard.writeText(this.fund.address);
        // const msg = "Copied Fund Address (" + this.fund.address + ") to clipboard";
        // this.$toast.success(msg);
      } catch ($e) {}
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
.fund {
  &__section_subtitle {
    color: $color-primary;
    font-weight: 500;
    font-size: 0.875rem;
    letter-spacing: 0.025rem;
    margin-bottom: 0.75rem;
  }
  &__header {
    display: flex;
    gap: 2.5rem;

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
        color: $title-color;
        line-height: 1;
      }
      &__subtitle {
        font-size: 1rem;
        font-weight: bold;
        color: $subtitle-color;
        line-height: 1;
      }
    }
    &__action_buttons {
      display: flex;
      flex-direction: column;
      button {
        text-transform: none;
      }
    }
  }
  &__insights {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem;
    border: 1px solid #293246;
    background: rgba(246, 249, 255, 0.04);
    box-shadow: 4px 4px 16px 0 rgba(31, 95, 255, 0.16);

    &__item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;

      &__title {
        display: flex;
        font-size: 1rem;
        width: 100%;
        height: 1rem;
        line-height: 1;
        font-weight: 700;
        color: $title-color;
      }
      &__subtitle {
        font-size: 0.875rem;
        line-height: 1;
        color: #F6F9FF8F;
      }
    }
  }
}
</style>
