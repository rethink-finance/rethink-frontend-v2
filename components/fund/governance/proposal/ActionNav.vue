<template>
  <div class="nav_action">
    <p class="nav_action__intro">
      <template v-if="methods.length">
        These {{ methods.length === 1 ? "is the method" : `are the ${methods.length} methods` }}
        the vault would value its positions with after this proposal executes.
        The simulated column prices them against the vault's holdings right now.
      </template>
      <template v-else>
        This call would leave the vault with no NAV methods.
      </template>
      <template v-if="processesWithdrawals">
        Pending redemptions are processed as part of the same update.
      </template>
    </p>

    <FundNavMethodsTable
      v-if="methods.length"
      :methods="methods"
      :fund-chain-id="fundStore.selectedFundChain"
      :fund-address="fundStore.fundAddress"
      :fund-contract-base-token-balance="Number(fundStore.fund?.fundContractBaseTokenBalance)"
      :safe-contract-base-token-balance="Number(fundStore.fund?.safeContractBaseTokenBalance)"
      :fee-balance="Number(fundStore.fund?.feeBalance)"
      :safe-address="fundStore.fund?.safeAddress"
      :base-symbol="fundStore.fund?.baseToken?.symbol"
      :base-decimals="fundStore.fund?.baseToken?.decimals"
      show-summary-row
      show-simulated-nav
      show-base-token-balances
      compact
      idx="proposal-action"
    />
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
import { parseNAVMethod } from "~/composables/parseNavMethodDetails";
import type INAVMethod from "~/types/nav_method";

/**
 * An `updateNav` / `storeNAVData` call as the NAV methods table every other
 * NAV screen uses, so a voter reads the proposed methods the same way they
 * read the vault's current ones.
 */
const props = defineProps<{
  decoded?: Record<string, any>;
}>();

const fundStore = useFundStore();

const methods = computed((): INAVMethod[] => {
  const entries: Record<string, any>[] = props.decoded?.navUpdateData ?? [];
  const parsed: INAVMethod[] = [];
  entries.forEach((entry, index) => {
    try {
      parsed.push(parseNAVMethod(index, entry));
    } catch (error) {
      console.warn("Failed to parse a proposed NAV method", index, error);
    }
  });
  return parsed;
});

const processesWithdrawals = computed(() => props.decoded?.processWithdraw === true);
</script>

<style scoped lang="scss">
.nav_action {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  &__intro {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: $color-text-irrelevant;
  }
}
</style>
