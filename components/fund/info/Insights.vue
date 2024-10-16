<template>
  <div class="fund_insights">
    <UiDataBar class="data_bar">
      <div class="data_bar__item">
        <div class="data_bar__title">
          <Icon
            :icon="fundChainIcon.name"
            :width="fundChainIcon.size"
            :height="fundChainIcon.size"
            class="mr-2"
          />
          {{ capitalizeFirst(fund.chainName) || "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Chain
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title" :class="{'justify-center': fundStore.loadingNavUpdates}">
          <v-progress-circular
            v-if="fundStore.loadingNavUpdates"
            class="d-flex"
            size="18"
            width="2"
            indeterminate
          />
          <template v-else>
            {{ fundStore.fundTotalNAVFormattedShort ?? "N/A" }}
          </template>
        </div>
        <div class="data_bar__subtitle">
          AUM
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ fund.inceptionDate }}
        </div>
        <div class="data_bar__subtitle">
          Inception Date
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title" :class="{'justify-center': fundStore.loadingNavUpdates}">
          <v-progress-circular
            v-if="fundStore.loadingNavUpdates"
            class="d-flex"
            size="18"
            width="2"
            indeterminate
          />
          <template v-else>
            <div
              class="data_bar__title"
              :class="numberColorClass(fundStore.fundLastNAVUpdate?.timestamp ? fund.cumulativeReturnPercent  : 0)"
            >
              {{ formatPercent(fundStore.fundLastNAVUpdate?.timestamp ? fund.cumulativeReturnPercent  : 0, true) || "N/A" }}
            </div>
          </template>
        </div>
        <div class="data_bar__subtitle">
          Cumulative
        </div>
      </div>
      <div class="data_bar__item">
        <div
          class="data_bar__title"
          :class="numberColorClass(fund.monthlyReturnPercent)"
        >
          {{ fund.monthlyReturnPercent ? formatPercent(fund.monthlyReturnPercent, true) : "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Monthly Return
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          {{ fund.sharpeRatio ||  "N/A" }}
        </div>
        <div class="data_bar__subtitle">
          Sharpe Ratio
        </div>
      </div>
      <div class="data_bar__item">
        <div class="data_bar__title">
          <FundInfoPositionTypesBar
            :position-type-counts="fund?.positionTypeCounts ?? []"
          />
        </div>
        <div class="data_bar__subtitle">
          Position Types
        </div>
      </div>
    </UiDataBar>
  </div>
</template>

<script setup lang="ts">
import { formatPercent } from "~/composables/formatters";
import { numberColorClass } from "~/composables/numberColorClass";
import { capitalizeFirst } from "~/composables/utils";
import { useFundStore } from "~/store/fund/fund.store";
import type IFund from "~/types/fund";
const fundStore = useFundStore();

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

const fundChainIcon = computed(() => getChainIcon(props.fund?.chainShort));
</script>
