<template>
  <div>
    <v-label
      v-if="label"
      class="label"
      :class="{'label--center': labelCenter}"
    >
      {{ label }}
    </v-label>
    <v-select
      v-model="selectedChainId"
      v-model:menu="isSelectInputActive"
      class="select_network"
      density="compact"
      :bg-color="selectedChainId ? '' : 'error'"
      :items="networks"
      :loading="loading"
      item-title="chainName"
      item-value="chainId"
    >
      <template #selection="{ item }">
        <Icon
          :icon="item.raw.icon?.name ?? 'octicon:question-16'"
          :color="item.raw.icon?.color"
          class="select_item__icon mr-2"
        />
        <v-list-item-title>
          {{ item.raw.chainName ?? item.raw }}
        </v-list-item-title>
      </template>
      <template #item="{ item }">
        <div
          class="select_item"
          :class="{'select_item--active': item.raw.chainId === selectedChainId}"
          @click="changeSelectedChainId(item.raw.chainId)"
        >
          <Icon
            :icon="item.raw.icon?.name"
            :color="item.raw.icon?.color"
            class="select_item__icon"
          />
          <div>
            {{ item.raw.chainName }}
          </div>
        </div>
      </template>
    </v-select>
  </div>
</template>

<script setup lang="ts">
import { type ChainId, networks } from "~/store/web3/networksMap";

const props = defineProps({
  modelValue: {
    type: String,
    default: () => "",
  },
  label: {
    type: String,
    default: () => "",
  },
  labelCenter: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(
  ["update:modelValue", "selected-chain-changed"],
);

const isSelectInputActive = ref(false);

const selectedChainId = computed({
  get: () => props?.modelValue,
  set: (value: any) => {
    emit("update:modelValue", value);
  },
});

const changeSelectedChainId = (chainId: ChainId) => {
  selectedChainId.value = chainId;
  emit("selected-chain-changed", chainId);
  isSelectInputActive.value = false;
}
</script>

<style scoped lang="scss">
.label {
  font-size: $text-md;
  font-weight: 500;
  color: $color-text-irrelevant;
  margin-bottom: 0.25rem;

  &--center {
    display: flex;
    justify-content: center;
    width: 100%;
  }
}
.select_network {
  min-width: 12rem;

  :deep(.v-input__details) {
    display: none;
  }
}
.select_item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .5rem;
  padding: .5rem;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: $color-hover;
  }
  &--active {
    background-color: $color-border-dark;
  }
  &__icon{
    width: 1.5rem;
    height: 1.5rem;
  }
}
</style>
