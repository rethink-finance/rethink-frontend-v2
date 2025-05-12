<template>
  <div v-if="charLimit" class="char-limit">
    MAX {{ charLimit }}
    <v-progress-circular
      v-model="parsedCharLimit"
      size="14"
      width="2"
      :color="parsedCharLimit > 100 ? 'red' : 'primary'"
      bg-color="rgba(255, 255, 255, 0.2)"
    />
  </div>
</template>

<script lang="ts" setup>
const props = defineProps({
  charLimit: {
    type: Number,
    default: 0,
  },
  charNumber: {
    type: String,
    default: "",
  },
});

const parsedCharLimit = computed(() => {
  return (props.charNumber.length / props.charLimit) * 100;
});
</script>

<style lang="scss" scoped>
.char-limit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: $text-sm;
}
</style>
