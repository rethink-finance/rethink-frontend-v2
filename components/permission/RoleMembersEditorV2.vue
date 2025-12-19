<template>
  <div class="role-members-editor">
    <div class="d-flex align-center gap-3 flex-wrap">
      <div>
        <v-label class="label mb-2">
          Member Address
        </v-label>
        <v-text-field
          v-model="addressInput"
          :error-messages="addressError"
          hide-details="auto"
          density="comfortable"
          class="role-members-editor__address"
          placeholder="0x..."
          @keyup.enter="queueChange"
        />
      </div>
      <div>
        <v-label class="label mb-2">
          Action
        </v-label>
        <v-select
          v-model="actionInput"
          :items="actionItems"
          hide-details
          density="compact"
          class="role-members-editor__action"
        />
      </div>
      <v-btn
        color="primary"
        variant="flat"
        :disabled="!canQueue"
        @click="queueChange"
      >
        Queue
      </v-btn>
    </div>

    <div v-if="modelValue?.length" class="mt-4">
      <div class="mb-2 subtitle">
        Queued member changes
      </div>
      <div class="d-flex flex-column gap-2">
        <div
          v-for="(item, idx) in modelValue"
          :key="item.address + '-' + idx"
          class="queued-item d-flex align-center justify-space-between"
        >
          <div class="d-flex align-center gap-2">
            <v-chip
              :color="item.action === 'ADD' ? 'success' : 'error'"
              size="small"
              label
            >
              {{ item.action }}
            </v-chip>
            <span class="address">{{ item.address }}</span>
          </div>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            @click="removeAt(idx)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ethers } from "ethers";

type ChangeAction = "ADD" | "REMOVE";
type ChangeItem = { address: string; action: ChangeAction };

const props = defineProps<{
  modelValue: ChangeItem[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: ChangeItem[]): void;
}>();

const addressInput = ref<string>("");
const actionInput = ref<ChangeAction>("ADD");
const actionItems = [
  { title: "ADD", value: "ADD" },
  { title: "REMOVE", value: "REMOVE" },
] as const;

const addressError = computed(() => {
  if (!addressInput.value) return [] as string[];
  return ethers.isAddress(addressInput.value) ? [] : ["Invalid address"];
});

const isDuplicate = computed(() => {
  const addr = addressInput.value?.toLowerCase();
  return props.modelValue?.some(
    (i) => i.address.toLowerCase() === addr && i.action === actionInput.value,
  );
});

const canQueue = computed(() => {
  return (
    !!addressInput.value &&
    ethers.isAddress(addressInput.value) &&
    !isDuplicate.value
  );
});

const queueChange = () => {
  if (!canQueue.value) return;
  const value = [
    ...(props.modelValue || []),
    { address: addressInput.value, action: actionInput.value },
  ];
  emit("update:modelValue", value);
  // keep address to allow quickly toggling action; optionally clear
  addressInput.value = "";
};

const removeAt = (idx: number) => {
  const value = [...(props.modelValue || [])];
  value.splice(idx, 1);
  emit("update:modelValue", value);
};
</script>

<style scoped lang="scss">
.role-members-editor {
  // Keep controls from breaking the layout on long input values
  &__address {
    min-width: 280px;
    max-width: 520px;
    flex: 1 1 320px;
  }
  &__action {
    min-width: 160px;
    flex: 0 0 160px;
  }
  .subtitle {
    color: $color-light-subtitle;
    font-size: $text-sm;
  }
  .queued-item {
    padding: 8px 12px;
    border: 1px solid $color-border-dark;
    border-radius: 8px;
    flex-wrap: wrap; // allow content to wrap on small screens
    gap: 6px;
  }
  .address {
    font-family: monospace;
    display: inline-block;
    max-width: 60ch; // keep long addresses from pushing layout
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
