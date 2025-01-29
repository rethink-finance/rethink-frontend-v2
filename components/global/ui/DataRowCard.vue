<template>
  <v-expansion-panels
    v-model="expandedList"
    class="data_row"
    variant="accordion"
    :readonly="isReadOnly"
    :class="{'data_row--readonly': isReadOnly}"
  >
    <v-expansion-panel
      class="data_row__panel"
      eager
      :class="{'data_row__panel--transparent': bgTransparent }"
      :readonly="isReadOnly"
    >
      <v-expansion-panel-title :hide-actions="isReadOnly" static>
        <div class="data_row__header">
          <div class="data_row__column" :class="{'data_row__column--grow': growColumn1}">
            <div class="data_row__title">
              <slot name="title">
                {{ title }}
              </slot>
            </div>
            <div v-if="subtitle" class="data_row__subtitle">
              {{ subtitle }}
            </div>
          </div>
          <div v-if="title2" class="data_row__column" :class="{'data_row__column--grow': growColumn2}">
            <div class="data_row__title">
              {{ title2 }}
            </div>
            <div v-if="subtitle2" class="data_row__subtitle">
              {{ subtitle2 }}
            </div>
          </div>
          <div v-if="title3" class="data_row__column" :class="{'data_row__column--grow': growColumn3}">
            <div class="data_row__title">
              {{ title3 }}
            </div>
            <div v-if="subtitle3" class="data_row__subtitle">
              {{ subtitle3 }}
            </div>
          </div>
          <div v-if="title4" class="data_row__column is-last" :class="{'data_row__column--grow': growColumn4}">
            <div class="data_row__title">
              {{ title4 }}
            </div>
            <div v-if="subtitle4" class="data_row__subtitle">
              {{ subtitle4 }}
            </div>
          </div>
        </div>

        <template #actions="{ expanded }">
          <slot name="actions" :details-expanded="expanded">
            <span class="data_row__action_text" :class="expanded ? 'text-primary' : ''">
              <slot name="actionText" :expanded="expanded" />
            </span>
            <v-icon class="data_row__action_icon" :color="expanded ? 'primary' : ''" :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
          </slot>
        </template>
      </v-expansion-panel-title>

      <v-expansion-panel-text v-if="hasBody" class="data_row__body" :class="{'data_row__body--no-padding': noBodyPadding}">
        <slot name="body">
          {{ body }}
        </slot>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
/**
 * Component: DataRowCard
 *
 * Description:
 *   This Vue component represents an expandable card with a dynamic title header
 *   that can include multiple columns. It is designed to display information in a
 *   structured manner, with support for additional columns in the title header.
 *
 * Props:
 *   - title: The main title for the card.
 *   - subtitle: The subtitle or additional information for the card.
 *   - growColumn1: If true the column 1 width will take available space (flex-grow: 1).
 *   - body: The content body of the card.
 *   - noBodyPadding: If True remove body padding.
 *   - bgTransparent: If true, the panel background will be transparent.
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
      default: "",
    },
    subtitle: {
      type: String,
      default: "",
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
    title4: {
      type: String,
      default: "",
    },
    subtitle4: {
      type: String,
      default: "",
    },
    growColumn4: {
      type: Boolean,
      default: false,
    },
    noBodyPadding: {
      type: Boolean,
      default: false,
    },
    bgTransparent: {
      type: Boolean,
      default: false,
    },
    body: {
      type: String,
      default: "",
    },
    isExpanded: {
      type: Boolean,
      default: false,
    },
    isExpandable: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    const expandedList = [];
    if (this.isExpanded) {
      expandedList.push(0)
    }
    return {
      expandedList,
    }
  },
  computed: {
    hasBody(): boolean {
      // Check if either body prop or body slot content is present
      return !(!this.body && !this.$slots.body);
    },
    isReadOnly(): boolean {
      if (!this.isExpandable) return true;
      return !this.hasBody;
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
      cursor: text;
    }
  }
  &__panel {
    background: $color-card-background;

    &--transparent {
      background: transparent;
    }
  }
  &__header {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    gap: 2.5rem;
    overflow: hidden;
    flex-grow: 1;
    line-height: normal;
  }
  &__action_text{
    margin: auto;
    text-align: right;
  }
  .v-expansion-panel-title {
    overflow: hidden;
    padding: 10px 8px;
    height: 56px;
    font-size: 14px;
  }

  &__body {
    word-wrap: break-word;
    max-width: 100%;
    width: 100%;

    &--no-padding :deep(.v-expansion-panel-text__wrapper) {
      padding: 0 !important;
    }
  }
  ::v-deep(.v-expansion-panel-text__wrapper) {
    padding: 0.625rem 1rem;
  }
  ::v-deep(.v-expansion-panel-title__icon),
  &__title {
    font-weight: 700;
    color: $color-title;
  }
  &__subtitle {
    font-weight: 500;
    color: $color-steel-blue;
    font-size: $text-sm;
  }
  &__column {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 7rem;
    max-width: 100%;
    margin-top: auto;
    margin-bottom: auto;
    overflow: hidden;

    &--grow {
      flex-grow: 1;
    }

    &.is-last {
      margin-left: auto;
      padding-left: 25px;
      border-left: 1px solid $color-gray-transparent;
    }
  }
  &__title, &__subtitle {
    @include ellipsis;
    max-width: 100%;
  }

  &__action_icon{
    height: 24px;
    width: 24px;
  }
}
</style>
