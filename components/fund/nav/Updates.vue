<template>
  <div class="details main_grid main_grid--full-width">
    <template v-if="fundStore.loadingNavUpdates">
      <v-skeleton-loader v-for="i in 3" :key="i" type="list-item" />
    </template>

    <template v-else-if="fund.navUpdates?.length > 0">
      <UiDataRowCard
        v-for="(navUpdate, index) in fund.navUpdates"
        :key="index"
        :title="navUpdate.date"
        :grow-column1="true"
        :title2="navUpdateTotalNav(navUpdate)"
        :grow-column2="true"
        no-body-padding
        bg-transparent
      >
        <template #body>
          <FundNavMethodsTable :methods="navUpdate.entries" />
        </template>
        <!--        <template #actions="{detailsExpanded}">-->
        <!--          <UiDetailsButton text="Details" :active="detailsExpanded" />-->
        <!--        </template>-->
      </UiDataRowCard>
    </template>

    <template v-else>
      There are currently no NAV updates.
    </template>
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund.store";
import type INAVUpdate from "~/types/nav_update";

export default defineComponent({
  name: "NAVUpdates",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  setup() {
    const fundStore = useFundStore();
    return { fundStore };
  },
  methods: {
    formatNAV(value: bigint) {
      return formatTokenValue(value, this.fund.baseToken.decimals) + " " + this.fund.baseToken.symbol;
    },
    navUpdateTotalNav(navUpdate: INAVUpdate) {
      if (!navUpdate.navParts?.total) return "N/A"
      return this.formatNAV(navUpdate.navParts?.total)
    },
  },
})
</script>

<style lang="scss" scoped>

</style>
