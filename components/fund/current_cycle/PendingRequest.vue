<template>
  <div class="pending_request card_box">
    <div class="pending_request__header">
      <div class="pending_request__pending_tokens">
        Pending Request
        <div>
          {{ pendingRequest.pending_tokens }} {{ pendingRequest.token }}
        </div>
      </div>
      <div class="pending_request__icon_more">
        <Icon name="material-symbols:more-vert" size="1.5rem" />
      </div>
    </div>
    <div class="pending_request__header pending_request__header--bg-light">
      <div>
        Available
      </div>
      <div class="pending_request__available_token">
        {{ pendingRequest.available_tokens }} {{ pendingRequest.token }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type ICyclePendingRequest from "~/types/cycle_pending_request";

export default {
  name: "PendingRequest",
  props: {
    pendingRequest: {
      type: Object as PropType<ICyclePendingRequest>,
      default: () => {},
    },
  },
};
</script>

<style lang="scss" scoped>
.pending_request {
  display: flex;
  color: $color-light-subtitle;

  &__available_token {
    color: $color-white;
  }
  &__pending_tokens {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
  }
  &__icon_more {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    color: $color-light-moonlight;

    :hover {
      color: lighten($color-light-moonlight, 10%);
    }
  }
  &__header {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    border-bottom: 1px solid $color-gray-transparent;
    line-height: 1;
    padding: 0.5rem 1.5rem 0.5rem 1rem;

    &--bg-light {
      background: $color-light-gray-transparent;
    }
  }
}
</style>
