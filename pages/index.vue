<template>
  <div class="discover page_shell">
    <AppAccessGate />
    <div
      v-if="isErrorFetchFundsData"
      class="w-100 d-flex justify-center flex-column"
    >
      <h3>Oops, something went wrong while getting OIVs data</h3>
      <span>
        Maybe the current RPC is down?
      </span>
    </div>
    <template v-else>
      <div class="discover__head">
        <h1 class="discover__title">
          On-chain <span class="gradient_text">vaults</span>
        </h1>
        <TableTotalTVLBanner />
      </div>
      <TableFunds :loading="isLoadingFetchFundsData" :items="funds" />
    </template>
  </div>
</template>

<script setup lang="jsx">
import { useActionStateStore } from "~/store/actionState.store";
import { useFundsStore } from "~/store/funds/funds.store";
import { ActionState } from "~/types/enums/action_state";

const funds = computed(() => fundsStore.funds);
const fundsStore = useFundsStore();
const actionStateStore = useActionStateStore();

const isLoadingFetchFundsData = computed(() =>
  actionStateStore.isActionState("fetchFundsAction", ActionState.Loading),
);
const isErrorFetchFundsData = computed(() =>
  actionStateStore.isActionState("fetchFundsAction", ActionState.Error),
);
console.log("on created")
fundsStore.fetchFunds()
</script>

<style lang="scss">
.discover {
  // Width comes from the shared .page_shell class in app.scss.

  &__head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2.5rem;
    flex-wrap: wrap;
    margin: 1rem 0 2.25rem;
  }

  &__title {
    font-size: clamp(30px, 3.4vw, 44px);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
    margin: 0;
    color: $color-white;
    min-width: 280px;
  }

}
</style>
