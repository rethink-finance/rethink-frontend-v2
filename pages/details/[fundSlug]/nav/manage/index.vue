<template>
  <div class="nav_manage">
    <div class="nav_manage__header">
      <div class="nav_manage__titles">
        <h2 class="nav_manage__title">
          Manage NAV methods
        </h2>
        <p class="nav_manage__sub">
          Changes are kept as a draft in this browser until you create a NAV
          proposal from them.
        </p>
      </div>

      <div class="nav_manage__actions">
        <nuxt-link
          class="nav_manage__ghost"
          :to="`/details/${selectedFundSlug}/nav/manage/newMethod`"
        >
          Define new method
        </nuxt-link>
        <nuxt-link
          class="nav_manage__ghost"
          :to="`/details/${selectedFundSlug}/nav/manage/addFromLibrary`"
        >
          Add from library
        </nuxt-link>
        <button
          type="button"
          class="nav_manage__ghost"
          @click="addRawDialog = true"
        >
          Import raw
        </button>
        <nuxt-link :to="`/details/${selectedFundSlug}/nav/manage/proposal`">
          <v-btn color="primary">
            Create NAV proposal
          </v-btn>
        </nuxt-link>
      </div>
    </div>

    <div class="nav_manage__card brand_card">
      <div class="nav_manage__card_head">
        <div class="nav_manage__card_titles">
          <div class="brand_card__eyebrow">
            Draft methods
          </div>
          <span class="brand_card__meta">
            {{ changesNumber }} {{ changesNumber === 1 ? "change" : "changes" }}
          </span>
        </div>
        <button
          v-if="isClearDraftVisible"
          type="button"
          class="nav_manage__ghost nav_manage__ghost--danger"
          @click="clearDraft"
        >
          Clear draft
        </button>
      </div>
      <FundNavMethodsTable
        v-model:methods="fundManagedNAVMethods"
        :fund-chain-id="selectedFundChain"
        :fund-address="fundAddress"
        :fund-contract-base-token-balance="Number(fundStore.fund?.fundContractBaseTokenBalance)"
        :safe-contract-base-token-balance="Number(fundStore.fund?.safeContractBaseTokenBalance)"
        :fee-balance="Number(fundStore.fund?.feeBalance)"
        :safe-address="fundStore.fund?.safeAddress"
        :base-symbol="fundStore.fund?.baseToken.symbol"
        :base-decimals="fundStore.fund?.baseToken.decimals"
        deletable
        show-summary-row
        show-base-token-balances
        show-simulated-nav
        frameless
        idx="nav/manage/index"
        :loading="isLoadingFetchFundNAVUpdatesAction"
      />
    </div>

    <FundNavAddRaw
      v-model="addRawDialog"
      :methods="fundManagedNAVMethods"
      @added-methods="addRawMethods"
    />
  </div>
</template>

<script setup lang="ts">
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { ActionState } from "~/types/enums/action_state";
import type INAVMethod from "~/types/nav_method";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);

const {
  selectedFundSlug,
  selectedFundChain,
  selectedFundAddress,
  fundManagedNAVMethods,
  fundLastNAVUpdateMethods,
  fundAddress,
} = storeToRefs(useFundStore());

const toastStore = useToastStore();
const fundStore = useFundStore();
const actionStateStore = useActionStateStore();
const addRawDialog = ref(false);


const addRawMethods = (newMethods: INAVMethod[]) => {
  fundManagedNAVMethods.value = [
    ...fundManagedNAVMethods.value,
    ...newMethods,
  ];
};

const isLoadingFetchFundNAVUpdatesAction = computed(() => {
  return actionStateStore.isActionState("fetchFundNAVDataAction", ActionState.Loading);
});

const changesNumber = computed(() => {
  // check how many methods are deleted and added
  const changedMethods = fundManagedNAVMethods.value.filter(
    (method: INAVMethod) => {
      return method.deleted || method.isNew;
    },
  )

  return changedMethods.length;
});

const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "NAV Methods",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/nav`,
  },
  {
    title: "Manage NAV Methods",
    disabled: true,
    to: `/details/${selectedFundSlug.value}/nav/manage`,
  },
];


const clearDraft = async () => {
  try {
    fundManagedNAVMethods.value =  JSON.parse(JSON.stringify(fundLastNAVUpdateMethods.value, stringifyBigInt), parseBigInt);
    // reset the local storage as well
    const navUpdateEntries = await getLocalForageItem("navUpdateEntries", {});
    // navUpdateEntries[selectedFundAddress.value] = fundManagedNAVMethods.value;
    // we need to delete navUpdateEntries[selectedFundAddress.value];
    delete navUpdateEntries[selectedFundAddress.value];

    setLocalForageItem("navUpdateEntries", navUpdateEntries);

    toastStore.successToast("Draft cleared successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to clear NAV draft");
  }
};

const saveDraft = async () => {
  try {
    const navUpdateEntries = await getLocalForageItem("navUpdateEntries", {});

    navUpdateEntries[selectedFundAddress.value] = JSON.parse(
      JSON.stringify(fundManagedNAVMethods.value, stringifyBigInt),
    );

    setLocalForageItem("navUpdateEntries", navUpdateEntries);
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to save NAV draft");
  }
};

const isClearDraftVisible = computed(() => {
  // check if the draft is the same as the last update
  const isSameAsLastUpdate =
    JSON.stringify(fundManagedNAVMethods.value, stringifyBigInt) ===
    JSON.stringify(fundLastNAVUpdateMethods.value, stringifyBigInt);
  const isDraftEmpty = Object.keys(fundManagedNAVMethods.value).length === 0;

  return !isSameAsLastUpdate && !isDraftEmpty;
});

// watch for changes in fundManagedNAVMethods
// and update the local storage
watch(
  fundManagedNAVMethods,
  () => {
    saveDraft();
  },
  { deep: true },
);

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});
</script>

<style scoped lang="scss">
.nav_manage {
  display: flex;
  flex-direction: column;
  gap: 1.375rem;

  &__header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1.25rem;
    flex-wrap: wrap;
  }

  &__titles {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__title {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.25;
    color: $color-white;
  }

  &__sub {
    max-width: 62ch;
    font-size: 13px;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__ghost {
    display: inline-flex;
    align-items: center;
    padding: 9px 14px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-sans;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    color: $color-text-irrelevant;
    cursor: pointer;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover {
      color: $color-white;
      border-color: $color-line-3;
    }
    &--danger:hover {
      color: $color-neg;
      border-color: $color-neg-line;
    }
  }

  /* The rows draw their own inset, so the card keeps none — and clips, so
     the tinted total row ends on the card's rounded corners. */
  &__card {
    padding: 0;
    overflow: hidden;
  }

  &__card_head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 20px 24px 16px;
  }

  &__card_titles {
    display: flex;
    align-items: baseline;
    gap: 0.875rem;
    flex-wrap: wrap;
  }

  @media (prefers-reduced-motion: reduce) {
    &__ghost {
      transition: none;
    }
  }
}
</style>
