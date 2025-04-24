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

const emit = defineEmits(["update:modelValue", "update:blocks"]);
const blockTimeStore = useBlockTimeStore();

// TODO: this component needs further testing and improvements, it's way overcomplicated now!
const props = defineProps({
  modelValue: {
    type: [Number, String],
    default: undefined,
  },
  blocks: {
    type: [String, Number],
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
const inputValue = computed({
  get: () => {
    console.log("GET", props.modelValue, props.modelValue?.toString());
    return props.modelValue?.toString()
  },
  set: (val) => {
    console.log("val", val, Number(val));
    emit("update:modelValue", val);
  },
});
const blocksLocal = ref<number | undefined>(undefined);
const selectedUnit = ref<PeriodUnits>(PeriodUnits.Days);
const blockTime = ref(0);
const isLoading = ref(false);

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
    bestValue: parseFloat(bestValue.toFixed(3)),
    // bestValue,
    bestUnit,
  };
};

const isInitialized = ref(false);
const initializeBlockTime = async () => {
  if (!props.chainId) return;
  isLoading.value = true;
  console.log("start INIT block time", props.modelValue, "blocks", props.blocks, blockTime.value)
  const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(props.chainId);
  blockTime.value = blockTimeContext?.averageBlockTime || 0;

  if (props.modelValue == null && props.blocks == null) {
    isInitialized.value = true;
    isLoading.value = false;
    return;
  }

  console.log("end INIT block time", props.modelValue, "blocks", props.blocks, blockTime.value)
  blocksLocal.value = Number(props.blocks || 0)
  if (blockTime.value > 0 && !isInitialized.value) {
    const totalSeconds = blocksLocal.value * blockTime.value;
    const { bestValue, bestUnit } = determineInputValueAndUnit(
      totalSeconds,
      selectedUnit.value,
    );
    console.log("TimeToBlock props.blocks", props.blocks, "blocksLocal", blocksLocal.value, "bestUnit", bestUnit);
    inputValue.value = bestValue.toString();
    selectedUnit.value = bestUnit;
    blocksLocal.value = Number(props.blocks);
  } else {
    console.log("TimeToBlock ELSE blocks", props.blocks, "blocksLocal", blocksLocal.value, "inputValue", inputValue.value);
    // inputValue.value = "0";
    // selectedUnit.value = PeriodUnits.Days;
    // blocksLocal.value = 0;
  }
  isInitialized.value = true;
  isLoading.value = false;
};

// TODO: this should be run when the props.blocks changes first time, to be safe
onMounted(initializeBlockTime);

watch([inputValue, selectedUnit], async () => {
  console.log("change input", inputValue.value, selectedUnit.value, "isInitialized", isInitialized.value)
  if (!isInitialized.value) return;

  const timeInSeconds = TimeInSeconds[selectedUnit.value];
  if (blockTime.value == null) {
    const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(props.chainId);
    blockTime.value = blockTimeContext?.averageBlockTime || 0;
  }

  if (blockTime.value > 0 && inputValue.value != null) {
    blocksLocal.value = Math.floor((Number(inputValue.value) * timeInSeconds) / blockTime.value);
  } else {
    blocksLocal.value = 0;
  }

  emit("update:blocks", blocksLocal.value);
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
