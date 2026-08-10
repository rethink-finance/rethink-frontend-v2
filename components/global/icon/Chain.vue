<template>
  <span
    class="chain_icon"
    :style="{ '--chain-icon-size': `${size}px` }"
    :title="chainName"
  >
    <img
      v-if="designIcon"
      class="chain_icon__glyph"
      :src="designIcon"
      :alt="chainName"
    >
    <Icon
      v-else
      class="chain_icon__glyph"
      :icon="chainIcon?.name || 'octicon:question-16'"
      :color="chainIcon?.color"
    />
  </span>
</template>

<script setup lang="ts">
import { ChainId } from "~/types/enums/chain_id";
import { networksMap } from "~/store/web3/networksMap";

/**
 * Chain logo, matching the design file's chain cell (an 18px disc filled with
 * the chain mark). Marks come from the design system (see designSystemIcons)
 * and are already discs, bar Base's full-bleed square; rounding the frame is
 * all it takes to give every chain the same silhouette and the same size.
 *
 * Sized to match the token marks — see ICON_SIZE_PX in designSystemIcons.
 */
const props = defineProps({
  chainId: {
    type: String as PropType<ChainId>,
    default: "",
  },
  chainShort: {
    type: String,
    default: "",
  },
  /** Diameter in px. The shared default matches the discover table's 18px. */
  size: {
    type: Number,
    default: ICON_SIZE_PX,
  },
});

const network = computed(() => {
  if (props.chainId) return networksMap[props.chainId];
  // Callers pass either id or short code; resolve both so the hover title
  // reads "Polygon" rather than the raw "matic".
  return Object.values(networksMap).find(
    (n) => n.chainShort === props.chainShort,
  );
});

/** The design system's mark, and the only source when it has one. */
const designIcon = computed(() =>
  getDesignChainIcon(props.chainShort, props.chainId),
);

/** Iconify stands in only for chains the design system does not ship. */
const chainIcon = computed(() => {
  if (!props.chainShort && props.chainId) {
    return network.value?.icon;
  }

  return getChainIcon(props.chainShort);
});

const chainName = computed(
  () => network.value?.chainName || props.chainShort || "",
);
</script>

<style lang="scss" scoped>
.chain_icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--chain-icon-size);
  height: var(--chain-icon-size);
  /* No field and no hairline behind the mark. Every design-system mark but
     Base is a disc drawn to the edge of a transparent square, so anything
     painted underneath only ever showed through the corners as a rim around
     the logo. The rounding stays: it is what turns Base's full-bleed square
     into a disc, so all five chains read as one silhouette. */
  border-radius: 999px;
  overflow: hidden;

  &__glyph {
    width: 100%;
    height: 100%;
    /* The marks are square canvases in a square box, so this only guards
       against a future one shipping off-square. */
    object-fit: contain;
  }
}
</style>
