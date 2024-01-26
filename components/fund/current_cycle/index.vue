<template>
  <div class="fund_settlement">
    <div class="card_header">
      <div>
        <div class="section_title">
          Current Cycle
        </div>
      </div>
      <div class="fund_settlement__buttons">
        <v-btn
          class="bg-primary text-secondary"
        >
          Claim
          <v-tooltip activator="parent" location="bottom">
            Claim tokens.
          </v-tooltip>
        </v-btn>
      </div>
    </div>
    <div class="fund_settlement__pending_requests">
      <FundCurrentCyclePendingRequest
        v-for="pendingRequest in fund.cycle_pending_requests"
        :key="pendingRequest.id"
        :pending-request="pendingRequest"
      />
    </div>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type IFund from "~/types/fund";

export default {
  name: "CurrentCycle",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  methods: {
    claimTokens() {
      return 1
    },
  },
};
</script>

<style lang="scss" scoped>
.fund_settlement {
  &__buttons {
    display: flex;
    gap: 1rem;
  }

  &__pending_requests {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
