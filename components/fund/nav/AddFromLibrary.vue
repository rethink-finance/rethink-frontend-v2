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
      :methods="methods"
      :used-methods="usedMethods"
      selectable
      :search="search"
      show-simulated-nav
      idx="addFromLibrary"
      @selected-changed="onSelectionChanged"
    />
  </div>
</template>

<script setup lang="ts">
import type INAVMethod from "~/types/nav_method";

const emit = defineEmits(["add-methods"]);

const props = defineProps({
  methods: {
    type: Array as PropType<INAVMethod[]>,
    required: true,
  },
  usedMethods: {
    type: Array as PropType<INAVMethod[]>,
    required: true,
  },
  loadingAllNavMethods: {
    type: Boolean as PropType<boolean>,
    required: true,
  },
});

// Data
const selectedMethodHashes = ref<string[]>([]);
const search = ref("");

// Methods
const onSelectionChanged = (hashes: string[]) => {
  selectedMethodHashes.value = hashes;
};

const addMethods = () => {
  // // Add newly defined method to fund managed methods.
  const addedMethods = props.methods.filter((method) =>
    selectedMethodHashes.value.includes(method.detailsHash || ""),
  );

  emit("add-methods", addedMethods);
};
</script>

<style scoped lang="scss">
.search {
width: 300px;
}
</style>
