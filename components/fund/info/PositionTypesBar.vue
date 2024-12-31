<template>
  <div class="position_types_bar">
    <template v-if="totalCountSum > 0 && calculatedPositionTypes?.length">
      <div
        v-for="(positionType, index) in calculatedPositionTypes"
        :key="index"
        class="position_types_bar__item"
        :class="positionType.class"
        :style="positionType.style"
      >
        <v-tooltip v-if="positionType?.type?.name" activator="parent" location="bottom">
          {{ positionType?.type?.name }} of {{ positionType.width }}
        </v-tooltip>
      </div>
    </template>
    <div v-else class="d-flex flex-grow-1 justify-end">
      N/A
    </div>
  </div>
</template>

<script lang="ts">
import type IPositionTypeCount from "~/types/position_type";

export default {
  name: "PositionTypesBar",
  props: {
    positionTypeCounts: {
      type: Array as () => IPositionTypeCount[],
      default: () => [],
    },
  },
  computed: {
    totalCountSum() {
      console.log("this.positionTypeCounts");
      console.log(this.positionTypeCounts);
      return this.positionTypeCounts.reduce((sum, current) => {
        return sum + current.count;
      }, 0n);
    },
    calculatedPositionTypes() {
      return this.positionTypeCounts.filter(
        positionType => positionType.count > 0n,
      ).map((positionType) => {
        const width = Number(positionType.count) / Number(this.totalCountSum);
        return {
          width: formatPercent(width, false),
          style: { width: width * 100 + "%" },
          class: `bg_nav_${positionType.type?.key || ""}`,
          ...positionType,
        }
      })
    },
  },
};
</script>

<style lang="scss" scoped>
.position_types_bar {
  display: flex;
  flex-grow: 1;
  width: 100%;

  &__item {
    height: $text-sm;

    &:first-of-type {
      border-top-left-radius: 0.25rem;
      border-bottom-left-radius: 0.25rem;
    }
    &:last-of-type {
      border-top-right-radius: 0.25rem;
      border-bottom-right-radius: 0.25rem;
    }
  }

  .bg_nav_liquid {
    background: $color-position-type-liquid;
  }
  .bg_nav_composable {
    background: $color-position-type-composable;
  }
  .bg_nav_nft {
    background: $color-position-type-nft;
  }
  .bg_nav_illiquid {
    background: $color-position-type-illiquid;
  }
}
</style>
