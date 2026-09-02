<template>
  <div class="add_library">
    <div class="add_library__toolbar">
      <div class="add_library__search">
        <Icon
          icon="material-symbols:search"
          width="1.125rem"
          class="add_library__search_icon"
        />
        <input
          v-model="search"
          class="add_library__search_input"
          type="search"
          placeholder="Search methods"
          aria-label="Search NAV methods"
        >
        <button
          v-if="search"
          type="button"
          class="add_library__search_clear"
          @click="search = ''"
        >
          Clear
        </button>
      </div>
      <span class="add_library__count">
        {{ selectedMethodHashes.length }} selected
      </span>
      <v-btn
        color="primary"
        :disabled="!selectedMethodHashes.length"
        @click="addMethods"
      >
        Add methods
      </v-btn>
    </div>

    <div v-if="loadingAllNavMethods" class="add_library__placeholder">
      <v-progress-circular size="16" width="2" indeterminate />
      Loading the method library…
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
      :compact="compact"
      :search="search"
      show-simulated-nav
      empty-text="No methods in the library yet."
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
  /** Narrow-container layout for the table, for the picker in a modal. */
  compact: {
    type: Boolean,
    default: false,
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
.add_library {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1 1 16rem;
    min-width: 0;
    padding: 0 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;

    &:focus-within {
      border-color: $color-accent-line;
    }
  }

  &__search_icon {
    flex: none;
    color: $color-steel-blue;
  }

  /* The app's global input rule sets a height and padding on every bare
     input, so all three are set here rather than only the one. */
  &__search_input {
    flex: 1;
    min-width: 0;
    min-height: 0;
    height: 2.375rem;
    padding: 0;
    border: none;
    background: transparent;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.3;
    color: $color-white;

    &::placeholder {
      color: $color-steel-blue;
    }
    &:focus {
      outline: none;
    }
    // The native clear affordance is a light glyph on a dark field.
    &::-webkit-search-cancel-button {
      display: none;
    }
  }

  &__search_clear {
    flex: none;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;

    &:hover {
      color: $color-white;
    }
  }

  &__count {
    margin-left: auto;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__placeholder {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem 0;
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
  }
}
</style>
