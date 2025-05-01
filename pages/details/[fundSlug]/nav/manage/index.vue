<template>
  <div>
    <UiHeader>
      <div class="main_header__title">
        Manage NAV Methods
      </div>
      <div class="main_header__actions">
        <nuxt-link :to="`/details/${selectedFundSlug}/nav/manage/newMethod`">
          <v-btn class="text-secondary" variant="outlined">
            Define New Method
          </v-btn>
        </nuxt-link>
        <nuxt-link
          :to="`/details/${selectedFundSlug}/nav/manage/addFromLibrary`"
        >
          <v-btn class="text-secondary" variant="outlined">
            Add From Library
          </v-btn>
        </nuxt-link>
        <v-btn
          class="text-secondary"
          variant="outlined"
          @click="addRawDialog = true"
        >
          Import Raw
        </v-btn>
        <nuxt-link :to="`/details/${selectedFundSlug}/nav/manage/proposal`">
          <v-btn class="bg-primary text-secondary">
            Create NAV Proposal
          </v-btn>
        </nuxt-link>
      </div>
    </UiHeader>
    <div class="main_card">
      <UiHeader>
        <div class="subtitle_steel_blue mb-0">
          {{ changesNumber }} Changes
        </div>
        <div class="btn-draft">
          <v-btn
            v-if="isClearDraftVisible"
            class="text-secondary"
            variant="outlined"
            @click="clearDraft"
          >
            Clear Draft
          </v-btn>
        </div>
      </UiHeader>
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
.main_header {
  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
}
.btn-draft {
  min-height: 40px;
}
</style>
