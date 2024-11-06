<template>
  <div>
    <UiHeader>
      <div class="main_header__title">
        Manage NAV Methods
      </div>
      <div>
        <nuxt-link :to="`/details/${selectedFundSlug}/nav/manage/newMethod`">
          <v-btn class="text-secondary me-4" variant="outlined">
            Define New Method
          </v-btn>
        </nuxt-link>
        <nuxt-link
          :to="`/details/${selectedFundSlug}/nav/manage/addFromLibrary`"
        >
          <v-btn class="text-secondary me-4" variant="outlined">
            Add From Library
          </v-btn>
        </nuxt-link>
       <v-btn
          class="text-secondary me-4"
          variant="outlined"
          @click="addRawDialog = true"
        >
          Add Raw
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
        deletable
        show-summary-row
        show-base-token-balances
        show-simulated-nav
        idx="nav/manage/index"
        :loading="isLoadingFetchFundNAVUpdatesAction"
      />
    </div>

    <UiConfirmDialog
      v-model="addRawDialog"
      title="Add Raw Methods"
      max-width="80%"
      confirm-text="Load"
      @confirm="addRawMethods"
      message="Please enter the raw methods JSON below"
    >
      <v-textarea
        v-model="rawMethods"
        label="Raw Methods"
        outlined
        placeholder="Enter the raw methods here"
        rows="20"
        class="raw-method-textarea"
      ></v-textarea>
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { ActionState } from "~/types/enums/action_state";
import { NAVEntryTypeStringToNAVEntryTypeMap, NAVEntryTypeStringToPositionTypeMap } from "~/types/enums/position_type";
import type INAVMethod from "~/types/nav_method";
import type { INAVMethodDetails } from "~/types/nav_method";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
const emit = defineEmits(["updateBreadcrumbs"]);

const {
  selectedFundSlug,
  selectedFundAddress,
  fundManagedNAVMethods,
  fundLastNAVUpdateMethods,
} = toRefs(useFundStore());

const toastStore = useToastStore();
const actionStateStore = useActionStateStore();
const addRawDialog = ref(false);
const rawMethods = ref("");

const addRawMethods = () => {
  try {
    const parsedMethod =  JSON.parse(rawMethods.value, (key, value) => {
      // check if value is a string and exactly "true" or "false" and convert it to boolean
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    });
    const lastIndex = fundManagedNAVMethods.value.length - 1;
    const nullAddress = "0x0000000000000000000000000000000000000000";

    parsedMethod?.map((method: any, index: number) => {
      const newIndex = lastIndex + index + 1;

      const details = {
        composable: method?.composableUpdates || [],
        description: JSON.stringify(method?.description || "{}"),
        entryType: NAVEntryTypeStringToNAVEntryTypeMap[method?.entryType].toString() || "",
        illiquid: method?.illiquidUpdates || [],
        isPastNAVUpdate: method?.isPastNAVUpdate || false,
        liquid: method?.liquidUpdates || [],
        nft: method?.nftUpdates || [],
        pastNAVUpdateEntryIndex: method?.pastNAVUpdateEntryIndex || 0,
        pastNAVUpdateIndex: method?.pastNAVUpdateIndex || 0,
      } as INAVMethodDetails;

      const detailsJson = formatJson(details) || "{}";

      const newEntry = {
        index: newIndex,
        isNew: true,
        details: details,
        detailsHash: ethers.keccak256(ethers.toUtf8Bytes(detailsJson)),
        detailsJson: detailsJson,
        foundMatchingPastNAVUpdateEntryFundAddress: method?.foundMatchingPastNAVUpdateEntryFundAddress || false,
        isSimulatedNavError: method?.isSimulatedNavError || false,
        pastNAVUpdateEntryFundAddress: method?.pastNAVUpdateEntryFundAddress || nullAddress,
        positionName: method?.description?.positionName || "",
        positionType: NAVEntryTypeStringToPositionTypeMap[method?.entryType] || "",
        simulatedNav: method?.simulatedNav || 0n,
        simulatedNavFormatted: method?.simulatedNavFormatted || "0 USDC",
        valuationSource: method?.description?.valuationSource || "",  
      } as INAVMethod;

      // add the new entry to the fundManagedNAVMethods
      fundManagedNAVMethods.value.push(newEntry);
    });

    // clear input and close dialog
    rawMethods.value = "";
    addRawDialog.value = false;
    toastStore.successToast("Raw methods added successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to add raw method. Invalid JSON format.");
  }
};
  
const isLoadingFetchFundNAVUpdatesAction = computed(() => {
  return actionStateStore.isActionState("fetchFundNAVDataAction", ActionState.Loading);
});

const changesNumber = computed(() => {
  // check how many methods are deleted and added
  const changedMethods = Object.values(fundManagedNAVMethods.value).filter(
    (method) => {
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


const clearDraft = () => {
  try {
    fundManagedNAVMethods.value =  JSON.parse(JSON.stringify(fundLastNAVUpdateMethods.value, stringifyBigInt), parseBigInt);
    // reset the local storage as well
    const navUpdateEntries = getLocalStorageItem("navUpdateEntries", {});
    // navUpdateEntries[selectedFundAddress.value] = fundManagedNAVMethods.value;
    // we need to delete navUpdateEntries[selectedFundAddress.value];
    delete navUpdateEntries[selectedFundAddress.value];

    setLocalStorageItem("navUpdateEntries", navUpdateEntries);

    toastStore.successToast("Draft cleared successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to clear NAV draft");
  }
};

const saveDraft = () => {
  try {
    const navUpdateEntries = getLocalStorageItem("navUpdateEntries", {});

    navUpdateEntries[selectedFundAddress.value] = JSON.parse(
      JSON.stringify(fundManagedNAVMethods.value, stringifyBigInt),
    );

    setLocalStorageItem("navUpdateEntries", navUpdateEntries);
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
.btn-draft {
  min-height: 40px;
}
</style>
