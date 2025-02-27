<template>
  <div class="buttons-switch">
    <v-btn
      v-for="(item) in props.items"
      :key="item.label"
      :class="classesButton(item)"
      variant="text"
      @click="handleClick( item)"
    >
      {{ item.label }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits(["update:modelValue"])

// Types
interface Item {
  key: string
  label: string
  class?: string
  onClick?: () => void
}

// Props
const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  items: {
    type: Array as PropType<Item[]>,
    required: true,
  },
})

// Methods
const handleClick = (item: Item) => {
  emit("update:modelValue", item.key)

  //   item can have onClick function
  if (item.onClick) {
    item.onClick()
  }
}

const classesButton = (item: Item) => {
  const itemClass = item?.class || ""

  return [
    "v-btn",
    itemClass,
    { "active": item.key === props.modelValue },
  ]
}
</script>

<style scoped lang="scss">
.buttons-switch {
    display: flex;
    justify-content: center;
    gap: 4px;

    padding: 4px;
    background-color: $color-toast;
    border-radius: 5px;

    .v-btn {
        color: $color-white !important;
        flex: 1;

        &:deep(.v-btn__content) {
          opacity: 0.35;
        }

        &:hover {
          &:deep(.v-btn__content) {
            opacity: 1;
          }
        }

        &.active {
            background-color: $color-surface;

            // remove hover overlay for active button
            &:deep(.v-btn__overlay) {
                display: none;
            }
            &:deep(.v-btn__content) {
              opacity: 1;
            }
        }
    }
}
</style>
