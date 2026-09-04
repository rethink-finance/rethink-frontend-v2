<template>
  <UiConfirmDialog
    v-model="isOpen"
    max-width="600px"
  >
    <template #title>
      <div class="plib__head">
        <button
          v-if="selectedProtocol"
          type="button"
          class="plib__back"
          aria-label="Back to protocols"
          @click="selectedProtocol = null"
        >
          <Icon icon="material-symbols:arrow-back" width="1.125rem" />
        </button>
        <h2 class="brand_modal__title plib__title">
          {{ selectedProtocol?.label ?? "Add from protocols" }}
        </h2>
      </div>
    </template>

    <FundNavValuationLibrary
      v-if="selectedProtocol && context"
      :chain-id="chainId"
      :context="context"
      :protocol="selectedProtocol"
      :existing-methods="existingMethods"
      @added-methods="onAdded"
    />

    <div v-else class="plib">
      <p v-if="!context" class="plib__lead">
        The vault's addresses are still loading.
      </p>
      <p v-else-if="!protocols.length" class="plib__lead">
        No valuation methods are registered for this chain yet.
      </p>
      <template v-else>
        <div class="plib__head">
          <span class="plib__eyebrow">Library</span>
          <span class="plib__count">
            {{ filteredProtocols.length }} of {{ protocols.length }}
          </span>
        </div>
        <div class="plib__search">
          <Icon
            icon="material-symbols:search"
            width="1.125rem"
            class="plib__search_icon"
          />
          <input
            v-model="query"
            class="plib__search_input"
            type="search"
            placeholder="Search protocols"
            aria-label="Search the valuation library"
          >
          <button
            v-if="query"
            type="button"
            class="plib__search_clear"
            @click="query = ''"
          >
            Clear
          </button>
        </div>
        <ul v-if="filteredProtocols.length" class="plib__list">
          <li
            v-for="protocol in filteredProtocols"
            :key="protocol.protocol"
            class="plib__row"
          >
            <button
              type="button"
              class="plib__item"
              @click="selectedProtocol = protocol"
            >
              <OnboardingProtocolLogo
                :protocol="protocol.protocol"
                :label="protocol.label"
              />
              <span class="plib__item_text">
                <span class="plib__item_name">{{ protocol.label }}</span>
                <span class="plib__item_meta">
                  {{ protocol.methods.map((m) => m.label.toLowerCase()).join(" · ") }}
                </span>
              </span>
              <Icon
                class="plib__item_plus"
                icon="material-symbols:add-rounded"
                aria-hidden="true"
              />
            </button>
          </li>
        </ul>
        <p v-else class="plib__lead">
          No protocol matches “{{ query }}”.
        </p>
      </template>
    </div>
  </UiConfirmDialog>
</template>

<script setup lang="ts">
import { listValuationLibrary } from "~/composables/nav/valuationRegistry";
import type {
  IValuationProtocolView,
  IValuationVaultContext,
} from "~/composables/nav/valuationRegistry";
import type { ChainId } from "~/types/enums/chain_id";
import type INAVMethod from "~/types/nav_method";

/**
 * The registry's valuation library as a standalone dialog: the chain's
 * protocols as rows, then one protocol's forms (FundNavValuationLibrary).
 * The create step draws the same rows inline in its own picker; pages that
 * add methods to an existing vault open this instead.
 */
const props = defineProps<{
  modelValue: boolean;
  chainId: ChainId;
  /** Null while the vault's addresses are unknown; rows wait for it. */
  context: IValuationVaultContext | null;
  existingMethods: INAVMethod[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "added-methods", methods: INAVMethod[]): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});

const selectedProtocol = ref<IValuationProtocolView | null>(null);
const query = ref("");

watch(isOpen, (open) => {
  if (open) selectedProtocol.value = null;
  else query.value = "";
});

const protocols = computed((): IValuationProtocolView[] => {
  try {
    return listValuationLibrary(props.chainId, props.context);
  } catch (error) {
    console.error("valuation library unavailable", error);
    return [];
  }
});

const filteredProtocols = computed((): IValuationProtocolView[] => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return protocols.value;
  return protocols.value.filter((protocol) =>
    [protocol.label, protocol.protocol, ...protocol.methods.map((m) => m.label)]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
});

const onAdded = (methods: INAVMethod[]) => {
  emit("added-methods", methods);
  isOpen.value = false;
};
</script>

<style scoped lang="scss">
/* Row chrome matches the create step's picker (NavMethods.vue .nav_pick). */
.plib {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__head {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  &__title {
    margin-top: 0;
  }

  &__back {
    display: grid;
    place-items: center;
    flex: none;
    width: 2rem;
    height: 2rem;
    margin-left: -0.5rem;
    border: none;
    border-radius: $default-border-radius;
    background: none;
    color: $color-steel-blue;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      outline: none;
      background: $color-gray-light-transparent;
      color: $color-white;
    }
  }

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__eyebrow {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__count {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;
  }

  &__lead {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;

    &:focus-within {
      border-color: $color-accent-line;
    }
  }

  &__search_icon {
    flex: none;
    color: $color-steel-blue;
  }

  /* The app's global input rule sets a height and padding on every bare
     input, so all three are set here rather than only the one. */
  &__search_input {
    flex: 1;
    min-width: 0;
    min-height: 0;
    height: 2.25rem;
    padding: 0;
    border: none;
    background: transparent;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.3;
    color: $color-white;

    &::placeholder {
      color: $color-steel-blue;
    }

    &:focus {
      outline: none;
    }

    &::-webkit-search-cancel-button {
      display: none;
    }
  }

  &__search_clear {
    flex: none;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;

    &:hover {
      color: $color-white;
    }
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
  }

  &__row + &__row {
    border-top: 1px solid $color-line;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 0.875rem;
    border: none;
    background: none;
    text-align: left;
    color: $color-white;
    cursor: pointer;
    transition: background-color $default-transition-time ease;

    &:hover:not(:disabled),
    &:focus-visible {
      outline: none;
      background: $color-gray-light-transparent;
    }

    &:disabled {
      cursor: default;
      opacity: 0.55;
    }
  }

  &__item_text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }

  &__item_name {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }

  &__item_meta {
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1.4;
    color: $color-steel-blue;
  }

  &__item_plus {
    flex: none;
    font-size: 18px;
    color: $color-steel-blue;
  }
}
</style>
