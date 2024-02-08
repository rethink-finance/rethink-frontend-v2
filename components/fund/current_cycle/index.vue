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
          @click="claimTokens"
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
import type IFund from "~/types/fund";
import { useToastStore } from "~/store/toast.store";

export default {
  name: "CurrentCycle",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  setup() {
    const toastStore = useToastStore();
    return {
      toastStore,
    }
  },
  methods: {
    claimTokens() {
      this.toastStore.addToast("Claim");
    },
  },
};
</script>

<style lang="scss" scoped>
.fund_settlement {
  width: 100%;

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
