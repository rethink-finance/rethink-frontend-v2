<template>
  <div class="vlib">
    <section
      v-for="method in protocol.methods"
      :key="method.method"
      class="vlib__method"
    >
      <header class="vlib__method_head">
        <div class="vlib__method_text">
          <span class="vlib__method_name">{{ method.label }}</span>
          <span class="vlib__method_meta">{{ method.description }}</span>
        </div>
        <!-- Priced methods read Chainlink feeds; say so where the method is
             named, not only in the fine print of each generated row. -->
        <span
          v-if="isPricedKind(method)"
          class="vlib__source"
          title="Prices come from Chainlink data feeds"
        >
          <FundNavChainlinkMark :size="14" />
          Chainlink prices
        </span>
      </header>

      <div
        v-for="field in method.fields"
        :key="field.key"
        class="vlib__field"
      >
        <!-- The search sits above the field's heading, so a long list
             (the spot table runs to a hundred) is narrowed before it is
             counted. -->
        <input
          v-if="field.control === 'multi-select' && field.options.length > SEARCH_FROM"
          v-model="search[fieldKey(method, field)]"
          type="search"
          class="vlib__search"
          placeholder="Search…"
        >
        <div class="vlib__field_head">
          <span class="vlib__label">{{ field.label }}</span>
          <span
            v-if="field.control === 'multi-select'"
            class="vlib__count"
          >
            {{ pickedCount(method, field) }} of {{ visibleOptions(field).length }}
          </span>
        </div>

        <!-- A chip per option, marks from the token address, set like the
             permissions card's asset chips. -->
        <template v-if="field.control === 'multi-select'">
          <div class="vlib__chips">
            <button
              v-for="option in shownOptions(method, field)"
              :key="option.value"
              type="button"
              class="vlib__chip"
              :class="{
                'vlib__chip--selected': isPicked(method, field, option.value),
                'vlib__chip--unsupported': !option.supported,
              }"
              :aria-pressed="isPicked(method, field, option.value)"
              :title="option.supported ? option.label : `${option.label} — cannot be valued in this vault`"
              :disabled="!option.supported"
              @click="togglePick(method, field, option.value)"
            >
              <OnboardingTokenLogo
                v-if="option.tokenAddress"
                :chain-id="chainId"
                :symbol="option.label"
                :token-address="option.tokenAddress"
                :size="16"
              />
              <span class="vlib__chip_label">{{ option.label }}</span>
            </button>
            <button
              v-if="hiddenCount(method, field) > 0"
              type="button"
              class="vlib__chip vlib__chip--more"
              @click="expanded[fieldKey(method, field)] = true"
            >
              +{{ hiddenCount(method, field) }} more
            </button>
          </div>
        </template>

        <div v-else-if="field.control === 'single-select'" class="vlib__chips">
          <button
            v-for="option in field.options"
            :key="option.value"
            type="button"
            class="vlib__chip"
            :class="{ 'vlib__chip--selected': params[method.method]?.[field.key] === option.value }"
            :aria-pressed="params[method.method]?.[field.key] === option.value"
            @click="setParam(method, field.key, option.value)"
          >
            <span class="vlib__chip_label">{{ option.label }}</span>
          </button>
        </div>

        <button
          v-else-if="field.control === 'switch'"
          type="button"
          class="vlib__switch"
          :class="{ 'vlib__switch--on': params[method.method]?.[field.key] === true }"
          :aria-pressed="params[method.method]?.[field.key] === true"
          @click="setParam(method, field.key, !params[method.method]?.[field.key])"
        >
          <span class="vlib__switch_track" aria-hidden="true">
            <span class="vlib__switch_knob" />
          </span>
          <span>{{ params[method.method]?.[field.key] ? "On" : "Off" }}</span>
        </button>

        <input
          v-else
          :value="params[method.method]?.[field.key] ?? ''"
          type="text"
          class="vlib__input"
          :placeholder="field.placeholder"
          @input="setParam(method, field.key, ($event.target as HTMLInputElement).value)"
        >

        <p v-if="field.hint" class="vlib__hint">
          {{ field.hint }}
        </p>
      </div>

      <ul
        v-if="compiled.issues[`${protocol.protocol}.${method.method}`]?.length"
        class="vlib__issues"
      >
        <li
          v-for="issue in compiled.issues[`${protocol.protocol}.${method.method}`]"
          :key="issue"
        >
          {{ issue }}
        </li>
      </ul>
    </section>

    <!-- What the registry would add, before it is added. -->
    <section class="vlib__preview">
      <div class="vlib__field_head">
        <span class="vlib__label">Methods to add</span>
        <span class="vlib__count">{{ compiled.methods.length }}</span>
      </div>
      <p v-if="!hasSelection" class="vlib__empty">
        Pick what the vault holds; the methods appear here.
      </p>
      <ul v-else-if="compiled.preview.length" class="vlib__rows">
        <li
          v-for="(row, i) in compiled.preview"
          :key="i"
          class="vlib__row"
        >
          <span class="vlib__row_name">{{ row.positionName }}</span>
          <span class="vlib__row_meta">
            <FundNavChainlinkMark
              v-if="isChainlinkSource(row)"
              :size="12"
            />
            {{ row.valuationSource }}
          </span>
        </li>
      </ul>
      <ul v-if="compiled.notes.length" class="vlib__notes">
        <li v-for="note in compiled.notes" :key="note">
          {{ note }}
        </li>
      </ul>
    </section>

    <div class="vlib__footer">
      <v-btn
        color="primary"
        :disabled="compiled.methods.length === 0"
        @click="add"
      >
        Add {{ compiled.methods.length || "" }}
        {{ compiled.methods.length === 1 ? "method" : "methods" }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  compileValuationMethods,
  initValuationParams,
  isValuationSelectionActive,
  toValuationParams,
} from "~/composables/nav/valuationRegistry";
import type {
  IValuationField,
  IValuationMethodView,
  IValuationPreviewRow,
  IValuationProtocolView,
  IValuationSelection,
  IValuationVaultContext,
} from "~/composables/nav/valuationRegistry";
import type { ChainId } from "~/types/enums/chain_id";
import type INAVMethod from "~/types/nav_method";

/**
 * One protocol of the registry's valuation library: its methods as forms
 * derived from the registry schemas, a live preview of the NAV methods
 * they would generate, and one Add. The registry decides what can be
 * valued in this vault (`supportedTargets`) and says what it skipped
 * (`notes`); this component only renders and relays.
 */
const props = defineProps<{
  chainId: ChainId;
  context: IValuationVaultContext;
  protocol: IValuationProtocolView;
  /** The methods already listed, so the new ones index after them. */
  existingMethods: INAVMethod[];
}>();

const emit = defineEmits<{
  (e: "added-methods", methods: INAVMethod[]): void;
}>();

const SEARCH_FROM = 24;
const SHOW_AT_MOST = 24;

/** Methods whose entries multiply a balance by a Chainlink price. */
const isPricedKind = (method: IValuationMethodView) =>
  method.kind === "spot" || method.kind === "receipt";
const isChainlinkSource = (row: IValuationPreviewRow) =>
  row.valuationSource.includes("Chainlink");

const params = ref<Record<string, Record<string, unknown>>>(
  Object.fromEntries(
    props.protocol.methods.map((m) => [m.method, initValuationParams(m)]),
  ),
);
const search = ref<Record<string, string>>({});
const expanded = ref<Record<string, boolean>>({});

watch(
  () => props.protocol,
  (protocol) => {
    params.value = Object.fromEntries(
      protocol.methods.map((m) => [m.method, initValuationParams(m)]),
    );
    search.value = {};
    expanded.value = {};
  },
);

const fieldKey = (method: IValuationMethodView, field: IValuationField) =>
  `${method.method}.${field.key}`;

const setParam = (method: IValuationMethodView, key: string, value: unknown) => {
  params.value = {
    ...params.value,
    [method.method]: { ...params.value[method.method], [key]: value },
  };
};

const picks = (method: IValuationMethodView, field: IValuationField): string[] => {
  const value = params.value[method.method]?.[field.key];
  return Array.isArray(value) ? (value as string[]) : [];
};
const isPicked = (method: IValuationMethodView, field: IValuationField, value: string) =>
  picks(method, field).includes(value);
const togglePick = (method: IValuationMethodView, field: IValuationField, value: string) => {
  const current = picks(method, field);
  setParam(
    method,
    field.key,
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
  );
};
const pickedCount = (method: IValuationMethodView, field: IValuationField) =>
  picks(method, field).length;

/** Options this vault can value, narrowed by the search box. */
const visibleOptions = (field: IValuationField) =>
  field.options.filter((o) => o.supported);
const filteredOptions = (method: IValuationMethodView, field: IValuationField) => {
  const needle = (search.value[fieldKey(method, field)] ?? "").trim().toLowerCase();
  const options = visibleOptions(field);
  if (!needle) return options;
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(needle) ||
      o.value.toLowerCase().includes(needle),
  );
};
/** Picked options always show; the rest fold past SHOW_AT_MOST until expanded. */
const shownOptions = (method: IValuationMethodView, field: IValuationField) => {
  const options = filteredOptions(method, field);
  if (expanded.value[fieldKey(method, field)] || options.length <= SHOW_AT_MOST) {
    return options;
  }
  const chosen = new Set(picks(method, field));
  const head = options.slice(0, SHOW_AT_MOST);
  const extra = options.slice(SHOW_AT_MOST).filter((o) => chosen.has(o.value));
  return [...head, ...extra];
};
const hiddenCount = (method: IValuationMethodView, field: IValuationField) =>
  filteredOptions(method, field).length - shownOptions(method, field).length;

const selections = computed((): IValuationSelection[] =>
  props.protocol.methods
    .filter((m) => isValuationSelectionActive(m, params.value[m.method] ?? {}))
    .map((m) => ({
      protocol: props.protocol.protocol,
      method: m.method,
      params: toValuationParams(m, params.value[m.method] ?? {}),
    })),
);
const hasSelection = computed(() => selections.value.length > 0);

const compiled = computed(() => {
  if (!hasSelection.value) {
    return { methods: [], preview: [], notes: [], issues: {} };
  }
  try {
    return compileValuationMethods(
      props.chainId,
      props.context,
      selections.value,
      props.existingMethods.length,
    );
  } catch (error) {
    console.error("valuation compile failed", error);
    return {
      methods: [],
      preview: [],
      notes: [],
      issues: { [`${props.protocol.protocol}.*`]: [String(error)] },
    };
  }
});

const add = () => {
  if (compiled.value.methods.length === 0) return;
  emit("added-methods", compiled.value.methods);
};
</script>

<style scoped lang="scss">
.vlib {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__method {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 0.875rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__method_head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.5rem 0.75rem;
  }

  /* Claims the row; a narrow pane drops the source pill onto its own line
     instead of squeezing the description into a sliver. */
  &__method_text {
    display: flex;
    flex: 1 1 14rem;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  /* The price-source pill: Chainlink's mark and two words, set like a
     chip so it reads as a label rather than a button. */
  &__source {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    font-family: $font-mono;
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
    color: $color-steel-blue;
    white-space: nowrap;
  }

  &__method_name {
    font-weight: 600;
    color: $color-white;
  }

  &__method_meta,
  &__hint,
  &__empty {
    font-size: $text-sm;
    color: $color-steel-blue;
  }

  &__count,
  &__label {
    font-family: $font-mono;
    font-size: 0.6875rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__field_head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  &__search,
  &__input {
    width: 100%;
    min-height: 2.25rem;
    height: 2.25rem;
    padding: 0 0.625rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    color: $color-white;
    font-size: $text-sm;

    &:focus {
      outline: none;
      border-color: $color-cyan;
    }
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  /* The same box the permissions card gives an asset (ProtocolField's
     .field__chip): a hairline rounded rectangle, mono label, cyan tint
     once picked. */
  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3125rem 0.5rem 0.3125rem 0.625rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-mono;
    font-size: 12px;
    line-height: 1.2;
    color: $color-white;
    cursor: pointer;
    transition:
      border-color $default-transition-time ease,
      background-color $default-transition-time ease,
      color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      border-color: $color-line-3;
    }

    &--selected {
      border-color: $color-cyan-line;
      background: $color-cyan-tint;
      color: $color-cyan;
    }

    &--unsupported {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &--more {
      color: $color-steel-blue;
      border-style: dashed;
    }
  }

  &__chip_label {
    white-space: nowrap;
  }

  &__switch {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0;
    border: none;
    background: none;
    color: $color-steel-blue;
    font-size: $text-sm;
    cursor: pointer;

    &--on {
      color: $color-white;
    }
  }

  &__switch_track {
    position: relative;
    width: 2rem;
    height: 1.125rem;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    background: $color-card-background;
    transition: background-color $default-transition-time ease;

    .vlib__switch--on & {
      background: $color-cyan;
      border-color: $color-cyan;
    }
  }

  &__switch_knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 999px;
    background: $color-white;
    transition: transform $default-transition-time ease;

    .vlib__switch--on & {
      transform: translateX(0.875rem);
    }
  }

  &__issues,
  &__notes {
    margin: 0;
    padding: 0 0 0 1rem;
    font-size: $text-sm;
    color: $color-steel-blue;
  }

  &__issues {
    color: $color-error;
  }

  &__preview {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__rows {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    overflow: hidden;
  }

  &__row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    font-size: $text-sm;

    & + & {
      border-top: 1px solid $color-line;
    }
  }

  &__row_name {
    color: $color-white;
  }

  &__row_meta {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-family: $font-mono;
    font-size: 0.6875rem;
    color: $color-steel-blue;
    text-align: right;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
