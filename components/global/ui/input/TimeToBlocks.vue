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
        v-model="blocks"
        class="move-up"
        :field="{
          label: 'Blocks',
          type: InputType.Text,
          isEditable: false,
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

const emit = defineEmits(["update:modelValue", "update:blocks"]);
const blockTimeStore = useBlockTimeStore();

const props = defineProps({
  modelValue: {
    type: Number,
    default: 0,
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
const inputValue = ref(props.modelValue);
const selectedUnit = ref<PeriodUnits>(PeriodUnits.Days);
const blockTime = ref(0);
const isLoading = ref(false);

const blocks = computed(() => {
  const timeInSeconds = TimeInSeconds[selectedUnit.value];
  return Math.floor((inputValue.value * timeInSeconds) / blockTime.value);
});

const determineInputValueAndUnit = (
  totalSeconds: number,
  currentUnit: PeriodUnits,
) => {
  const currentUnitSeconds = TimeInSeconds[currentUnit];
  const currentValue = totalSeconds / currentUnitSeconds;

  if (currentValue >= 1) {
    return {
      bestValue: parseFloat(currentValue.toFixed(2)),
      // bestValue: currentValue,
      bestUnit: currentUnit,
    };
  }

  let bestUnit: PeriodUnits = PeriodUnits.Seconds;
  let bestValue = totalSeconds;

  for (const unit of Object.keys(TimeInSeconds) as PeriodUnits[]) {
    const secondsPerUnit = TimeInSeconds[unit];
    const value = totalSeconds / secondsPerUnit;

    if (value >= 1 && value < bestValue) {
      bestValue = value;
      bestUnit = unit;
    }
  }

  return {
    bestValue: parseFloat(bestValue.toFixed(2)),
    // bestValue,
    bestUnit,
  };
};

const initializeBlockTime = async () => {
  if (!props.chainId) return;
  isLoading.value = true;
  const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(props.chainId);
  blockTime.value = blockTimeContext?.averageBlockTime || 0;

  if (blockTime.value > 0 && props.modelValue > 0) {
    const totalSeconds = props.modelValue * blockTime.value;
    const { bestValue, bestUnit } = determineInputValueAndUnit(
      totalSeconds,
      selectedUnit.value,
    );
    inputValue.value = bestValue;
    selectedUnit.value = bestUnit;
  } else {
    inputValue.value = 0;
    selectedUnit.value = PeriodUnits.Days;
  }

  isLoading.value = false;
};

onMounted(initializeBlockTime);

watch([inputValue, selectedUnit], () => {
  console.log("blocks: ", blocks.value);
  emit("update:modelValue", blocks.value);
});

watch(
  () => props.chainId,
  () => {
    initializeBlockTime();
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
