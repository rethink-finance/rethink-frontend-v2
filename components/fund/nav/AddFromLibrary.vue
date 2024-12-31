<template>
  <div class="add_from_library">
    <UiHeader>
      <div class="main_header__title">
        Add From Library
      </div>
      <div>
        <v-btn
          class="bg-primary text-secondary"
          :disabled="!selectedMethodHashes.length"
          @click="addMethods"
        >
          Add Methods
        </v-btn>
      </div>
    </UiHeader>

    <UiHeader>
      <div class="main_header__title">
        <v-text-field
          v-model="search"
          label="Search"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          hide-details
          single-line
          class="search"
        />
      </div>
      <div class="subtitle_steel_blue mb-0">
        {{ selectedMethodHashes.length }} selected
      </div>
    </UiHeader>

    <div v-if="loadingAllNavMethods" class="mt-4">
      <v-skeleton-loader type="table-row" />
      <v-skeleton-loader type="table-row" />
      <v-skeleton-loader type="table-row" />
      <v-skeleton-loader type="table-row" />
    </div>
    <FundNavMethodsTable
      v-else
      :methods="uniqueNavMethods[chainId]"
      :used-methods="alreadyUsedMethods"
      :fund-chain-id="chainId"
      :fund-address="fundAddress"
      selectable
      :search="search"
      show-simulated-nav
      idx="addFromLibrary"
      @selected-changed="onSelectionChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { useFundsStore } from "~/store/funds/funds.store";
import type INAVMethod from "~/types/nav_method";

const emit = defineEmits(["add-methods"]);

const props = defineProps({
  chainId: {
    type: String,
    required: true,
  },
  fundAddress: {
    type: String,
    required: true,
  },
  alreadyUsedMethods: {
    type: Array as PropType<INAVMethod[]>,
    required: true,
  },
});
const fundsStore = useFundsStore();
const { allNavMethods } = toRefs(fundsStore);
const { uniqueNavMethods } = toRefs(fundsStore);

// Data
const loadingAllNavMethods = ref(false);
const selectedMethodHashes = ref<string[]>([]);
const search = ref("");

// Methods
const onSelectionChanged = (hashes: string[]) => {
  selectedMethodHashes.value = hashes;
};

const addMethods = () => {
  // Add newly defined method to fund managed methods.
  const addedMethods = uniqueNavMethods.value[props.chainId].filter((method) =>
    selectedMethodHashes.value.includes(method.detailsHash || ""),
  );

  emit("add-methods", addedMethods);
};

onMounted(async () => {
  console.warn("fetch all nav methods", allNavMethods.value[props.chainId]);
  if (!allNavMethods.value[props.chainId].length) {
    loadingAllNavMethods.value = true;
    const fundsInfoArrays = await fundsStore.fetchFundsInfoArrays(
      props.chainId,
    );
    // Fetch all possible NAV methods for all funds
    try {
      await fundsStore.fetchFundsNavMethods(props.chainId, fundsInfoArrays);
    } catch (e: any) {
      console.error("Failed fetchFundsNavMethods", e)
    }
    loadingAllNavMethods.value = false;
  }
});
</script>

<style scoped lang="scss">
.search {
width: 300px;
}
</style>
