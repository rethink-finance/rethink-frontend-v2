<template>
  <div class="position_types_bar">
    <div
      v-for="positionType in calculatedPositionTypes"
      :key="positionType.type"
      class="position_types_bar__item"
      :class="positionType.class"
      :style="positionType.style"
    >
      <v-tooltip activator="parent" location="bottom">
        {{ positionType.type }} of {{ positionType.width }}
      </v-tooltip>
    </div>
  </div>
</template>

<script lang="ts">
import type IPositionType from "~/types/position_type";
import { PositionType } from "~/types/enums/position_type";

export default {
  name: "PositionTypesBar",
  props: {
    positionTypes: {
      type: Array as () => IPositionType[],
      default: () => [],
    },
  },
  data() {
    return {
      positionTypeToClass: {
        [PositionType.NAVLiquid]: "nav_liquid",
        [PositionType.NAVComposable]: "nav_composable",
        [PositionType.NAVNft]: "nav_nft",
        [PositionType.NAVIlliquid]: "nav_illiquid",
      },
    };
  },
  computed: {
    totalValueSum() {
      return this.positionTypes.reduce((sum, current) => {
        return sum + current.value;
      }, 0);
    },
    calculatedPositionTypes() {
      return this.positionTypes.map((positionType) => {
        const width = positionType.value / this.totalValueSum;

        return {
          width: formatPercent(width, false),
          style: { width: width * 100 + "px" },
          class: `bg_${this.positionTypeToClass[positionType.type]}`,
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
  margin: auto;

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
