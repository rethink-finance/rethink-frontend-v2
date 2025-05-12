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
      :methods="libraryNavMethods"
      :used-methods="alreadyUsedMethods"
      :fund-chain-id="chainId"
      :fund-address="fundAddress"
      :safe-address="safeAddress"
      :base-symbol="baseSymbol"
      :base-decimals="baseDecimals"
      :is-fund-non-init="isFundNonInit"
      selectable
      :search="search"
      show-simulated-nav
      idx="addFromLibrary"
      @selected-changed="onSelectionChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { encodeParameter } from "web3-eth-abi";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundsStore } from "~/store/funds/funds.store";
import { ActionState } from "~/types/enums/action_state";
import type { ChainId } from "~/types/enums/chain_id";
import { PositionType } from "~/types/enums/position_type";
import type INAVMethod from "~/types/nav_method";

const emit = defineEmits(["methods-added"]);

const props = defineProps({
  chainId: {
    type: String as PropType<ChainId>,
    required: true,
  },
  fundAddress: {
    type: String,
    required: true,
  },
  safeAddress: {
    type: String,
    required: true,
  },
  baseDecimals: {
    type: Number,
    required: true,
  },
  baseSymbol: {
    type: String,
    required: true,
  },
  // If fund was not created yet, it means it is non init. Used
  // only when simulating NAV.
  isFundNonInit: {
    type: Boolean,
    default: false,
  },
  alreadyUsedMethods: {
    type: Array as PropType<INAVMethod[]>,
    required: true,
  },
});
const actionStateStore = useActionStateStore();
const fundsStore = useFundsStore();
const { allNavMethods } = storeToRefs(fundsStore);
const { uniqueNavMethods } = storeToRefs(fundsStore);

// Data
const loadingAllNavMethods = ref(false);
const selectedMethodHashes = ref<string[]>([]);
const search = ref("");

const libraryNavMethods = ref<INAVMethod[]>([]);

// Computed
const isLoadingFetchFundsNavMethods = computed(() =>
  actionStateStore.isActionState("fetchFundsNavMethodsAction", ActionState.Loading),
);

// Methods
const onSelectionChanged = (hashes: string[]) => {
  selectedMethodHashes.value = hashes;
};

const addMethods = () => {
  // Add newly defined method to fund managed methods.
  const addedMethods = libraryNavMethods.value.filter((method) =>
    selectedMethodHashes.value.includes(method.detailsHash || ""),
  );

  emit("methods-added", addedMethods);
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

  setLibraryNavMethods();
});

const setLibraryNavMethods = () => {
  console.warn("setLibraryNavMethods", isLoadingFetchFundsNavMethods.value);
  // Composable methods are complicated.
  // Here we try to replace method parameters for each composable method, so that we find the original method's
  // safe contract address and try to replace it in the method input parameters encodedFunctionSignatureWithInputs.
  // So that we can simulate NAV on the passed safe address instead on the original.
  libraryNavMethods.value = uniqueNavMethods.value[props.chainId].map((originalNavEntry: INAVMethod) => {
    console.log("originalNavEntry", originalNavEntry);
    const navEntry = JSON.parse(JSON.stringify(originalNavEntry));

    if (navEntry.positionType === PositionType.Composable) {
      console.warn("navEntry Composable: ", navEntry)

      navEntry.details.composable = navEntry.details.composable.map(
        (method: Record<string, any>) => {
          console.warn("composable: ", method)
          const safeAddressToReplace: string = navEntry.pastNAVUpdateEntrySafeAddress;
          const safeAddressReplacement: string = props.safeAddress;
          console.log("[ADD_LIB1] safeAddressToReplace", safeAddressToReplace)
          console.log("[ADD_LIB2] safeAddressReplacement", safeAddressReplacement)

          let encodedSafeAddressToReplace = "";
          let encodedSafeAddressReplacement = "";
          if (safeAddressToReplace && safeAddressReplacement) {
            encodedSafeAddressToReplace = encodeParameter("address", safeAddressToReplace).replace("0x", "");
            console.log("encodedSafeAddressToReplace", encodedSafeAddressToReplace)
            encodedSafeAddressReplacement = encodeParameter("address", safeAddressReplacement).replace("0x", "");
            console.log("encodedSafeAddressReplacement", encodedSafeAddressReplacement)
          } else {
            if (!safeAddressToReplace && safeAddressReplacement) {
              console.warn("no safeAddressToReplace", safeAddressToReplace, method)
            // TODO throw error, this is dangerous
            }
            if (!safeAddressReplacement && safeAddressToReplace) {
              console.warn("no safeAddressReplacement", safeAddressReplacement, method)
            // TODO throw error, this is dangerous
            }
          }

          return {
            ...method,
            encodedFunctionSignatureWithInputs: method.encodedFunctionSignatureWithInputs.replace(encodedSafeAddressToReplace, encodedSafeAddressReplacement),
          }
        },
      );
    }
    return navEntry
  })
};
</script>

<style scoped lang="scss">
.search {
width: 300px;
}
</style>
