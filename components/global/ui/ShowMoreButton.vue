<template>
  <span
    class="show_more"
    @click="toggleShowMore"
  >
    Show
    <template v-if="showMore">
      Less
      <Icon icon="ion:chevron-up" width="1rem" />
    </template>
    <template v-else>
      More
      <Icon icon="ion:chevron-down" width="1rem" />
    </template>
  </span>
</template>

<script setup lang="ts">
const props = defineProps({ modelValue: Boolean });
const emit = defineEmits(["update:modelValue"]);

const showMore = computed({
  get: () => props?.modelValue ?? "0",
  set: (value: boolean) => {
    emit("update:modelValue", value);
  },
});

const toggleShowMore = () => {
  showMore.value = !showMore.value;
}
</script>

<style scoped lang="scss">
.show_more {
  font-weight: bold;
  &:hover {
    text-decoration: underline;
    cursor: pointer;
  }
}
</style>
