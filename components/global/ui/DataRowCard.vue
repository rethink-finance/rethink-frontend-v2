<template>
  <v-expansion-panels
    class="data_row"
    variant="accordion"
    :readonly="isReadOnly"
    :class="{'data_row--readonly': isReadOnly}"
  >
    <v-expansion-panel
      class="data_row__panel card_box card_box--no-padding"
      eager
      :readonly="isReadOnly"
    >
      <v-expansion-panel-title :hide-actions="isReadOnly" static>
        <div class="data_row__header">
          <div class="data_row__title">
            {{ title }}
          </div>
          <div class="data_row__subtitle">
            {{ subtitle }}
          </div>
        </div>
        <template #actions="{ expanded }">
          <v-icon :color="expanded ? 'primary' : ''" :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
        </template>
      </v-expansion-panel-title>
      <v-expansion-panel-text v-if="body" class="data_row__body">
        test
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
import { defineComponent } from "vue"

export default defineComponent({
  name: "DataRowCard",
  props: {
    title: {
      type: String,
      default: "",
    },
    subtitle: {
      type: String,
      default: "",
    },
    body: {
      type: String,
      default: "",
    },
  },
  computed: {
    isReadOnly(): boolean {
      return !this.body;
    },
  },
})
</script>

<style lang="scss" scoped>
.data_row {
  overflow: hidden;
  user-select: text !important;


  ::v-deep(.v-expansion-panel-title__overlay) {
    display: none !important;
  }

  &--readonly {
    button.v-expansion-panel-title:hover {
      cursor: default;
    }
  }
  &__panel {
    background: $color-navy-gray-light;
  }
  &__header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow: hidden;
  }
  .v-expansion-panel-title {
    overflow: hidden;
    padding: 0.625rem 1rem;
    line-height: 1;
  }
  .v-expansion-panel-text {
    padding: 0.625rem 1rem;
  }

  &__title {
    font-weight: 700;
    color: $color-title;
  }
  &__subtitle {
    font-weight: 500;
    color: $color-subtitle;
    font-size: $text-sm;
  }
  &__title, &__subtitle {
    @include ellipsis;
    max-width: 100%;
  }
}
</style>
