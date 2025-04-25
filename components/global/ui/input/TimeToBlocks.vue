<template>
  <v-row class="time-to-blocks">
    <v-col class="column" cols="5">
      <v-skeleton-loader
        v-if="isLoading"
        type="text"
        class="skeleton-text-field"
      />
      <v-text-field
        v-else
        v-model="inputValue"
        type="number"
        :placeholder="placeholder"
        :disabled="isDisabled"
        :rules="rules"
        :error-messages="customErrorMessage"
      />
    </v-col>
    <v-col class="column" cols="4">
      <v-skeleton-loader
        v-if="isLoading"
        type="text"
        class="skeleton-text-field"
      />
      <UiField
        v-else
        v-model="selectedUnit"
        class="padding-bottom"
        :field="{
          label: 'Unit',
          type: InputType.Select,
          choices: periodChoices,
          isEditable: true
        }"
        :is-disabled="isDisabled"
      />
    </v-col>
    <v-col class="column" cols="3">
      <v-skeleton-loader
        v-if="isLoading"
        type="text"
        class="skeleton-text-field"
      />
      <UiField
        v-else
        :model-value="blocks"
        :rules="rules"
        class="move-up"
        :field="{
          label: 'Blocks',
          type: InputType.Number,
          isEditable: false
        }"
      />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { ChainId } from "~/types/enums/chain_id";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";
import {
  InputType,
  periodChoices,
  PeriodUnits,
  TimeInSeconds,
} from "~/types/enums/input_type";

const emit = defineEmits(["update:modelValue"]);
const blockTimeStore = useBlockTimeStore();

const props = defineProps({
  modelValue: {
    type: [Number, String],
    default: undefined,
  },
  chainId: {
    type: String as PropType<ChainId>,
    default: "",
  },
  placeholder: {
    type: String,
    default: "",
  },
  isDisabled: {
    type: Boolean,
    default: false,
  },
  customErrorMessage: {
    type: String,
    default: "",
  },
  rules: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
});

// we only save the number in blocks and have a local state for the unit which is changing and emitting the blocks
const inputValue = ref("");
const blocks = ref<number | undefined>(undefined);
const selectedUnit = ref<PeriodUnits>(PeriodUnits.Days);
const blockTime = ref(0);
const isLoading = ref(false);
const isUpdatingFromBlocks = ref(false);


const findBestTimeUnit = (totalSeconds: number) => {
  // If the currently selected unit makes sense, keep using it
  const currentUnitSeconds = TimeInSeconds[selectedUnit.value];
  const currentValue = totalSeconds / currentUnitSeconds;

  if (currentValue >= 1 && currentValue < 1000) {
    return {
      bestValue: parseFloat(currentValue.toFixed(2)),
      bestUnit: selectedUnit.value,
    };
  }

  // Otherwise find the most appropriate unit
  let bestUnit = PeriodUnits.Seconds;
  let bestValue = totalSeconds;

  // Start from larger units and work down to find the most appropriate one
  const units = Object.keys(TimeInSeconds) as PeriodUnits[];
  for (let i = units.length - 1; i >= 0; i--) {
    const unit = units[i];
    const secondsPerUnit = TimeInSeconds[unit];
    const value = totalSeconds / secondsPerUnit;

    if (value >= 1) {
      bestValue = value;
      bestUnit = unit;
      break;
    }
  }

  return {
    bestValue: parseFloat(bestValue.toFixed(3)),
    bestUnit,
  };
};
const getBlockTime = async () => {
  if (!props.chainId) {
    blockTime.value = 0;
    return;
  }

  isLoading.value = true;
  const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(props.chainId);
  blockTime.value = blockTimeContext?.averageBlockTime || 0;
  isLoading.value = false;
}

// Update input value and emit events when changing input or unit
const updateFromInput = async () => {
  console.warn("updateFromInput", inputValue.value)
  await getBlockTime();
  if (blockTime.value <= 0) return;

  const timeInSeconds = TimeInSeconds[selectedUnit.value];
  const inputNumber = Number(inputValue.value);

  if (!isNaN(inputNumber)) {
    blocks.value = Math.floor((inputNumber * timeInSeconds) / blockTime.value);
  } else {
    blocks.value = undefined;
  }
  emit("update:modelValue", blocks.value);
};

const updateFromBlocks = async () => {
  console.warn("updateFromBlocks")
  await getBlockTime();

  if (blockTime.value <= 0 || props.modelValue == null) return;

  isUpdatingFromBlocks.value = true; // Set flag before updating

  const totalSeconds = Number(props.modelValue) * blockTime.value;
  const { bestValue, bestUnit } = findBestTimeUnit(totalSeconds);
  console.warn("updateFromBlocks", totalSeconds, bestValue.toString());

  inputValue.value = bestValue.toString();
  selectedUnit.value = bestUnit;
};

// Watch for changes in the modelValue to update the local state
watch(
  () => props.modelValue,
  () => {
    if (props.modelValue !== blocks.value) {
      console.log("props.modelValue changed: ", props.modelValue, "blocks: ", blocks.value)
      updateFromBlocks();
    }
  },
  { immediate: true },
);

watch([inputValue, selectedUnit], () => {
  updateFromInput();
});

watch(
  () => props.chainId,
  () => {
    updateFromBlocks();
  },
);
</script>

<style scoped lang="scss">
.time-to-blocks {
  display: flex;
  align-items: center;
  margin-top: -29px;
}

.skeleton-text-field,
.skeleton-select {
  height: 64px;
  border-radius: 4px;
}

.column {
  padding-block: 0;
}
.move-up {
  margin-top: -29px;
}
.padding-bottom {
  padding-bottom: 29px;
}
</style>
