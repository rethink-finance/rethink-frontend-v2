<template>
  <UiConfirmDialog
    :model-value="modelValue"
    title="Add Raw Methods"
    max-width="80%"
    confirm-text="Load"
    cancel-text="Cancel"
    message="Please enter the raw methods JSON below"
    @confirm="addRawMethods"
    @update:model-value="updateModelValue"
  >
    <v-textarea
      v-model="rawMethods"
      label="Raw Methods"
      outlined
      placeholder="Enter the raw methods here"
      rows="20"
      class="raw-method-textarea"
    />
  </UiConfirmDialog>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { useToastStore } from "~/store/toasts/toast.store";
import { NAVEntryTypeStringToNAVEntryTypeMap, NAVEntryTypeStringToPositionTypeMap } from "~/types/enums/position_type";
import type INAVMethod from "~/types/nav_method";
import type { INAVMethodDetails } from "~/types/nav_method";

const toastStore = useToastStore();
const emits = defineEmits(["update:modelValue", "added-methods"]);


// Props
const props = defineProps({
  modelValue: Boolean,
  methods: {
    type: Array as PropType<INAVMethod[]>,
    required: true,
  },
})

// Data
const rawMethods = ref("");

// Computeds

// Methods
const updateModelValue = (value: boolean) => {
  emits("update:modelValue", value);
};
const addRawMethods = () => {
  try {
    const newEntires = formatRawMethod();
    emits("added-methods", newEntires);

    // clear input and close dialog
    rawMethods.value = "";
    emits("update:modelValue", false);
    toastStore.successToast("Raw methods added successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to add raw method. Invalid JSON format.");
  }
};

const formatRawMethod = ()=>{
  const parsedMethod =  JSON.parse(rawMethods.value, (key, value) => {
    // check if value is a string and exactly "true" or "false" and convert it to boolean
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  });
  const lastIndex = props.methods.length - 1;

  const newEntires = [] as INAVMethod[];


  //   TODO: foreach
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
      details,
      detailsHash: ethers.keccak256(ethers.toUtf8Bytes(detailsJson)),
      detailsJson,
      foundMatchingPastNAVUpdateEntryFundAddress: method?.foundMatchingPastNAVUpdateEntryFundAddress || false,
      isSimulatedNavError: method?.isSimulatedNavError || false,
      pastNAVUpdateEntryFundAddress: method?.pastNAVUpdateEntryFundAddress || ethers.ZeroAddress,
      positionName: method?.description?.positionName || "",
      positionType: NAVEntryTypeStringToPositionTypeMap[method?.entryType] || "",
      simulatedNav: method?.simulatedNav || 0n,
      simulatedNavFormatted: method?.simulatedNavFormatted || "0 USDC",
      valuationSource: method?.description?.valuationSource || "",
    } as INAVMethod;

    // add the new entry
    newEntires.push(newEntry);
  });

  return newEntires;
}


// Watchers

// Lifecycle Hooks
</script>

<style scoped lang="scss">
</style>
