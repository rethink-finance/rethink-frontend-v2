<template>
  <div class="fund_details">
    <!--    <FundOverview :fund="fund" />-->

    <!--    <div class="main_card">-->
    <!--      <FundInfo :fund="fund" />-->
    <!--    </div>-->

    <!-- show just NAV value -->
    <UiDataBar class="data_bar">
      <div class="data_bar__item">
        <div class="data_bar__title" :class="{'justify-center': isLoadingFetchFundNAVUpdatesActionState}">
          <v-progress-circular
            v-if="isLoadingFetchFundNAVUpdatesActionState"
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
          NAV
        </div>
      </div>
    </UiDataBar>

    <div class="d-flex flex-column">
      <div class="main_card main_grid order-1 order-sm-0">
        <FundSettlement :fund="fund" :should-user-delegate="shouldUserDelegate" />
        <FundCurrentCycle :fund="fund" />
      </div>

    <!--      <div class="main_card">-->
    <!--        <FundChart :fund="fund" />-->
    <!--      </div>-->
    </div>
  </div>
</template>

<script setup lang="ts">
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { ActionState } from "~/types/enums/action_state";
import type IFund from "~/types/fund";

const fundStore = useFundStore();
const { shouldUserDelegate } = storeToRefs(fundStore);

const actionStateStore = useActionStateStore();

const isLoadingFetchFundNAVUpdatesActionState =
  computed(() => actionStateStore.isActionState("fetchFundNAVDataAction", ActionState.Loading));


const fund = useAttrs().fund as IFund;
</script>

<style scoped lang="scss"></style>
