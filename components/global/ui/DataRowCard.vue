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
          <div class="data_row__column" :class="{'data_row__column--grow': growColumn1}">
            <div class="data_row__title">
              {{ title }}
            </div>
            <div class="data_row__subtitle">
              {{ subtitle }}
            </div>
          </div>
          <div v-if="title2" class="data_row__column" :class="{'data_row__column--grow': growColumn2}">
            <div class="data_row__title">
              {{ title2 }}
            </div>
            <div class="data_row__subtitle">
              {{ subtitle2 }}
            </div>
          </div>
          <div v-if="subtitle3" class="data_row__column" :class="{'data_row__column--grow': growColumn3}">
            <div class="data_row__title">
              {{ title3 }}
            </div>
            <div class="data_row__subtitle">
              {{ subtitle3 }}
            </div>
          </div>
        </div>
        <template #actions="{ expanded }">
          <v-icon :color="expanded ? 'primary' : ''" :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
        </template>
      </v-expansion-panel-title>
      <v-expansion-panel-text v-if="body" class="data_row__body">
        {{ body }}
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
import { defineComponent } from "vue"

/**
 * Component: DataRowCard
 *
 * Description:
 *   This Vue component represents an expandable card with a dynamic title header
 *   that can include multiple columns. It is designed to display information in a
 *   structured manner, with support for additional columns in the title header.
 *
 * Props:
 *   - title (required): The main title for the card.
 *   - subtitle (required): The subtitle or additional information for the card.
 *   - growColumn1: If true the column 1 width will take available space (flex-grow: 1).
 *   - body: The content body of the card.
 *   - title2: An additional column for the title header.
 *   - subtitle2: An additional column for the subtitle header.
 *   - growColumn2: If true the column 2 width will take available space (flex-grow: 1).
 *   - title3: Another additional column for the title header.
 *   - subtitle3: Another additional column for the subtitle header.
 *   - growColumn3: If true the column 3 width will take available space (flex-grow: 1).
 *
 * Usage:
 *   The DataRowCard component can be used to create expandable cards with flexible
 *   title headers. You can customize the content of the title header by passing data
 *   to the title, subtitle, title2, title3, subtitle2, and subtitle3 props.
 *   It is typically used within a Vuetify Expansion Panel to provide an interactive
 *   accordion-like user interface.
 *
 * Example:
 *   <data-row-card
 *     :title="Main Title"
 *     :subtitle="Subtitle"
 *     :body="Card Body Optional Content"
 *     :title2="Additional Title Column 1"
 *     :title3="Additional Title Column 2"
 *     :subtitle2="Additional Subtitle Column 1"
 *     :subtitle3="Additional Subtitle Column 2"
 *   ></data-row-card>
 *
 */
export default defineComponent({
  name: "DataRowCard",
  props: {
    title: {
      type: String,
    },
    subtitle: {
      type: String,
    },
    growColumn1: {
      type: Boolean,
      default: false,
    },
    title2: {
      type: String,
      default: "",
    },
    subtitle2: {
      type: String,
      default: "",
    },
    growColumn2: {
      type: Boolean,
      default: false,
    },
    title3: {
      type: String,
      default: "",
    },
    subtitle3: {
      type: String,
      default: "",
    },
    growColumn3: {
      type: Boolean,
      default: false,
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

  &--readonly {
    ::v-deep(.v-expansion-panel-title__overlay) {
      display: none !important;
    }
    button.v-expansion-panel-title:hover {
      cursor: default;
    }
  }
  &__panel {
    background: $color-navy-gray-light;
  }
  &__header {
    display: inline-flex;
    flex-direction: row;
    justify-content: flex-start;
    gap: 2.5rem;
    overflow: hidden;
    width: 100%;
  }
  .v-expansion-panel-title {
    overflow: hidden;
    padding: 0.625rem 1rem;
    line-height: 1;
  }
  &__body {
    word-wrap: break-word;
    max-width: 100%;
  }
  ::v-deep(.v-expansion-panel-text__wrapper) {
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
  &__column {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 100%;

    &--grow {
      flex-grow: 1;
    }
  }
  &__title, &__subtitle {
    @include ellipsis;
    max-width: 100%;
  }
}
</style>
