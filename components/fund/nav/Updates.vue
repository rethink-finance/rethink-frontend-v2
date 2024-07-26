<template>
  <div class="details main_grid main_grid--full-width">
    <template v-if="fund.navUpdates?.length > 0">

      <UiDataRowCard
        v-for="(navUpdate, index) in parsedNavUpdates"
        :key="index"
        :title="navUpdate.date"
        :grow-column1="true"
        :title2="formatNAV(navUpdate.totalNAV)"
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

export default defineComponent({
  name: "NAVUpdates",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  methods: {
    formatNAV(value: bigint) {
      return formatTokenValue(value, this.fund.baseToken.decimals) + " " + this.fund.baseToken.symbol;
    },
  },
  computed: {
    parsedNavUpdates() {
      if (this.fund.navUpdates.length === 0) return [];

      // reverse the array to show the latest updates first
      return this.fund.navUpdates.reverse();
    },
  },
})
</script>

<style lang="scss" scoped>

</style>
