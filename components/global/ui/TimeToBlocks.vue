<template>
  <v-row class="time-to-blocks">
    <v-col cols="10">
      <v-text-field
        v-model="inputValue"
        type="number"
        :placeholder="placeholder"
        :disabled="isDisabled"
        :rules="rules"
        :error-messages="customErrorMessage"
      />
    </v-col>
    <v-col cols="2">
      <v-select
        v-model="selectedUnit"
        :items="periodChoices"
        class="field-select"
        :disabled="isDisabled"
      />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { useWeb3Store } from "~/store/web3/web3.store";
import { periodChoices, PeriodUnits, TimeInSeconds } from "~/types/enums/input_type";

const CHAIN_ID_MAP = {
  "0xa4b1": "0x1",
} as const;


const emit = defineEmits(["update:modelValue", "update:blocks"]);

const { initializeBlockTimeContext } = useBlockTime();
const web3Store = useWeb3Store();

const props = defineProps({
  modelValue: {
    type: Number,
    default: 0,
  },
  chainId: {
    type: String,
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

// we only save the number in blocks and have a local state for the unit which is changing and emiting the blocks
const inputValue = ref(props.modelValue);
const selectedUnit = ref<PeriodUnits>(PeriodUnits.Days);
const blockTime = ref(0);

const blocks = computed(() => {
  const timeInSeconds = TimeInSeconds[selectedUnit.value];
  const output =  Math.floor((inputValue.value * timeInSeconds) / blockTime.value);

  return output;
});

const getWeb3Instance = () => {
  const mappedChainId = CHAIN_ID_MAP[props.chainId as keyof typeof CHAIN_ID_MAP];

  // ARB1 is mapped to ETH
  if(mappedChainId) {
    return web3Store.chainProviders[mappedChainId];
  }

  return web3Store.chainProviders[props.chainId];
};

const determineInputValueAndUnit = (totalSeconds: number) => {
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

  return { bestValue, bestUnit };
};

const initializeBlockTime = async () => {
  const web3Instance = getWeb3Instance();
  if (!web3Instance) return;
  const context = await initializeBlockTimeContext(web3Instance);
  blockTime.value = context?.averageBlockTime || 0;


  if (blockTime.value > 0 && props.modelValue > 0) {
    const totalSeconds = props.modelValue * blockTime.value;
    const { bestValue, bestUnit } = determineInputValueAndUnit(totalSeconds);
    inputValue.value = bestValue;
    selectedUnit.value = bestUnit;
  } else {
    inputValue.value = 0;
    selectedUnit.value = PeriodUnits.Days;
  }
};

onMounted(initializeBlockTime);

watch([inputValue, selectedUnit], () => {
  console.log("blocks: ", blocks.value);
  emit("update:modelValue", blocks.value);
});
</script>

<style scoped lang="scss">
.time-to-blocks {
  display: flex;
  align-items: center;
}

.field-select {
  line-height: normal;

  :deep(.v-field__input) {
    padding: 10px;
    min-height: 40px;
  }
}
</style>
