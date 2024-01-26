<template>
  <div class="pending_request_row">
    <div class="pending_request_row__header">
      <div>
        Pending request
      </div>
      <div>
        {{ availableTokens }} {{ token }}
      </div>
    </div>
    <div />
  </div>
</template>

<script lang="ts">
export default {
  name: "PendingRequestRow",
  props: {
    pendingTokens: {
      type: Number,
      default: 0,
    },
    availableTokens: {
      type: Number,
      default: 0,
    },
    token: {
      type: String,
      default: "",
    },
  },
};
</script>

<style lang="scss" scoped>
.pending_request_row {
  display: flex;
  padding: 1rem;
  gap: 1.5rem;

  &__header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }
}
</style>
