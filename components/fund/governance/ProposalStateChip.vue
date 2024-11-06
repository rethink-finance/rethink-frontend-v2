<template>
  <UiTextBadge
    :value="value"
    :class="proposalStateClass"
    uppercase
    bold
  />
</template>

<script setup lang="ts">
const props = defineProps({
  value: {
    type: String,
    default: "",
  },
});

const proposalStateClass = computed(() => {
  return `proposal_state_${props.value?.toLowerCase() ?? "undefined"}`
});
</script>

<style scoped lang="scss">
</style>
