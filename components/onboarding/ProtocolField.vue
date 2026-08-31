<template>
  <div>
    <template v-if="group.control === 'multi-select'">
      <div
        class="field__head"
        :class="{ 'field__head--warned': inlineWarning }"
      >
        <template v-if="!hideLabel">
          <span class="field__label">{{ group.label }}</span>
          <span class="field__count">
            {{ view.selected.length }} of {{ view.options.length }} selected
          </span>
        </template>
        <!-- With the name and count up in the box header, this row is two
             buttons and empty space; the caution takes the space rather
             than a row of its own. -->
        <p v-if="inlineWarning" class="field__warning field__warning--inline">
          {{ group.warning }}
        </p>
        <button type="button" class="field__bulk" @click="selectAll">
          Select all
        </button>
        <button type="button" class="field__bulk" @click="setGroup([])">
          Clear
        </button>
      </div>
      <!-- Under this control's own label: read above it, a caution looks
           like a footnote to the control before it. -->
      <p v-if="group.warning && !inlineWarning" class="field__warning">
        {{ group.warning }}
      </p>

      <!--
        A list that shrank says why. Without it, moving Aave's market from
        Core to Prime silently takes 57 of 67 assets away and reads as the
        form losing them.
      -->
      <p v-if="narrowedNote" class="field__note field__note--lead">
        {{ narrowedNote }}
      </p>

      <template v-for="section in optionSections">
        <!--
          A long-tail family folds to the end of the SAME list, not into a
          section of its own: Aave's 15 dated Pendle tokens are ordinary
          reserves and belong under Assets — they just should not sit
          between USDC and DAI. The expander keeps its selected count, so a
          grant never hides behind it.
        -->
        <div
          v-if="!section.deferred || isSectionOpen(section.id)"
          :key="`${section.id}-chips`"
          class="field__chips"
          :class="{ 'field__chips--continued': section.deferred }"
        >
          <div
            v-for="option in section.options"
            :key="option.value"
            class="field__chip"
            :class="{ 'field__chip--selected': isPicked(option.value) }"
          >
            <button
              type="button"
              class="field__chip_main"
              :aria-pressed="isPicked(option.value)"
              @click="toggleValue(option.value)"
            >
              <OnboardingTokenLogo
                :chain-id="chainId"
                :symbol="option.value"
                :token-address="option.tokenAddress"
                :size="16"
              />
              <span class="field__chip_label">{{ option.label }}</span>
            </button>
            <!--
              What this one asset is used FOR — and only what it can be used
              for: a wrapped reserve offers deposit and borrow, an Aave
              safety-module token offers staking, and neither is shown a
              scope its own schema would reject.
            -->
            <span
              v-if="isPicked(option.value) && view.actions.length > 1"
              class="field__scopes"
            >
              <button
                v-for="scope in valueScopes(option.value)"
                :key="scope.action"
                type="button"
                class="field__scope"
                :class="{ 'field__scope--on': scope.granted }"
                :aria-pressed="scope.granted"
                :aria-label="`${getActionLabel(scope.action)} ${option.label}`"
                :title="getActionHint(scope.action, descriptor.protocol)"
                @click="toggleValueScope(option.value, scope.action)"
              >
                {{ getActionLabel(scope.action) }}
              </button>
            </span>
          </div>

          <!-- Last chip of the main list: the fold itself. -->
          <button
            v-for="deferred in section.deferred ? [] : deferredSections"
            :key="deferred.id"
            type="button"
            class="field__chip field__more"
            :aria-expanded="isSectionOpen(deferred.id)"
            :title="deferred.hint"
            @click="setSectionOpen(deferred.id, !isSectionOpen(deferred.id))"
          >
            <Icon
              class="field__chevron"
              :class="{ 'field__chevron--open': isSectionOpen(deferred.id) }"
              icon="material-symbols:keyboard-arrow-down-rounded"
              width="0.875rem"
              height="0.875rem"
            />
            {{ deferred.options.length }} {{ deferred.label }}
            <span
              v-if="deferred.selected"
              class="field__chip_only"
            >{{ deferred.selected }} selected</span>
          </button>
        </div>
      </template>

      <!--
        What each scope currently covers, read back in the assets' own
        names. Deliberately not switchable: a control-wide switch takes a
        scope off EVERY asset at once, which is a long way to undo by hand —
        narrowing belongs on the asset, where one click does one thing.
      -->
      <div
        v-if="view.actions.length > 1 && view.selected.length"
        class="field__scope_list"
      >
        <p class="field__label field__scope_list_title">
          Scope
        </p>
        <div
          v-for="scope in groupScopes"
          :key="scope.action"
          class="field__scope_row"
        >
          <p class="field__scope_row_head">
            <span class="field__scope_name">
              {{ getActionLabel(scope.action) }}
            </span>
            <span
              class="field__scope_assets"
              :class="{ 'field__scope_assets--none': !scope.assets.length }"
            >{{ scopeAssetList(scope.assets) }}</span>
          </p>
          <p class="field__hint">
            {{ getActionHint(scope.action, descriptor.protocol) }}
          </p>
          <p v-if="scope.optional" class="field__hint">
            {{ optionalScopeNote }}
          </p>
        </div>
      </div>
    </template>

    <template v-else-if="group.control === 'single-select'">
      <div v-if="!hideLabel" class="field__head">
        <span class="field__label">{{ group.label }}</span>
      </div>
      <p v-if="group.warning" class="field__warning">
        {{ group.warning }}
      </p>
      <OnboardingSelectMenu
        :model-value="view.selected[0]"
        :options="view.options.map((o) => ({ value: o.value, label: o.label }))"
        :placeholder="`Select ${group.label.toLowerCase()}`"
        @update:model-value="(v: string | number | undefined) => setGroup(v === undefined || v === '' ? [] : [String(v)])"
      />
    </template>

    <template v-else-if="group.control === 'text'">
      <div v-if="!hideLabel" class="field__head">
        <span class="field__label">{{ group.label }}</span>
      </div>
      <p v-if="group.warning" class="field__warning">
        {{ group.warning }}
      </p>
      <input
        class="field__input"
        type="text"
        :value="view.selected[0] ?? ''"
        spellcheck="false"
        @input="(e) => setGroup([(e.target as HTMLInputElement).value])"
      >
    </template>

    <p v-else class="field__unsupported">
      The registry offers a “{{ group.label }}” setting this interface
      cannot render yet — it stays unset.
    </p>

    <p v-if="group.note && view.optional" class="field__note">
      {{ group.note }}
    </p>
  </div>
</template>

<script setup lang="ts">
import {
  type IProtocolDescriptor,
  type IProtocolFieldGroup,
  type IProtocolSelectionState,
  OPTIONAL_FIELD_NOTE,
  applyGroupSelection,
  applyValueScopes,
  getActionHint,
  getActionLabel,
  viewGroup,
  viewValueScopes,
} from "~/composables/permissions/protocolPermissions";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * One control of the "Protocol permissions" card: a registry field group
 * and everything that hangs off it — the value chips, what each picked
 * value is used FOR, and the read-back of what the control's scopes now
 * cover.
 *
 * It owns no selection state. The card passes the protocol's entry in and
 * takes a new one back, so the registry is still handed exactly the params
 * each action's own schema declares (see the composable).
 */
const props = withDefaults(
  defineProps<{
    descriptor: IProtocolDescriptor;
    entry: IProtocolSelectionState;
    group: IProtocolFieldGroup;
    chainId: ChainId;
    /**
     * On when the container already carries this control's name and count —
     * the merged control inside a box named after it. Repeating them here
     * would say the same thing twice, a line apart.
     */
    hideLabel?: boolean;
  }>(),
  { hideLabel: false },
);

const emit = defineEmits<{
  (e: "update:entry", value: IProtocolSelectionState): void;
}>();

/**
 * Asset families a list defers to the end, behind their own switch. Matched
 * on the registry's own value spelling, which is all the schema gives us —
 * so this is a display rule about a naming convention, not a claim about
 * what the token is. Aave's Core market lists 15 dated Pendle principal
 * tokens among its 67 reserves: they are the widest chips in the list, they
 * all expire, and a creator looking for USDC should not have to read past
 * them.
 */
const DEFERRED_SECTIONS = [
  {
    id: "pendle-pt",
    label: "Pendle PT tokens",
    hint:
      "Fixed-yield principal tokens, each maturing on the date in its " +
      "name. Granted like any other asset — they just expire.",
    match: (value: string) => /^PT-/i.test(value),
  },
];

/** Below this a family is not worth its own fold — just show the chips. */
const MIN_DEFERRED_SECTION = 3;

/** Past this many names the scope list stops reading and starts counting. */
const SCOPE_ASSET_PREVIEW = 10;

const optionalScopeNote = OPTIONAL_FIELD_NOTE;

/** Which folds are open, by section id. */
const openSections = ref<Set<string>>(new Set());

const view = computed(() => viewGroup(props.entry, props.group));

/**
 * A caution shares the bulk-action row only when that row has nothing else
 * in it. Beside a label and a count it would be a third thing competing for
 * one line, which is how a warning stops being read.
 */
const inlineWarning = computed(() => props.hideLabel && !!props.group.warning);

/**
 * Why this list is shorter than the value space behind it. The narrowing
 * comes from the action's other settings — Aave's market — so the note is
 * written in their values, which is what the creator just changed.
 */
const narrowedNote = computed(() => {
  if (props.group.control !== "multi-select" || !view.value.narrowed) return "";
  const mine = new Set(props.group.members.map((member) => member.action));
  const settings = new Set<string>();
  for (const action of props.descriptor.actions) {
    if (!mine.has(action.action)) continue;
    const params =
      props.entry.actions.find((entry) => entry.action === action.action)
        ?.params ?? {};
    for (const field of action.fields) {
      if (field.control === "multi-select") continue;
      const held = params[field.key];
      if (typeof held === "string" && held) settings.add(held);
    }
  }
  if (!settings.size) return "";
  const shown = view.value.options.length;
  const total = shown + view.value.narrowed;
  const noun = `${props.group.noun}${total === 1 ? "" : "s"}`;
  return `${[...settings].join(" · ")} lists ${shown} of ${total} ${noun}.`;
});

const isPicked = (value: string) => view.value.selected.includes(value);

const setGroup = (values: string[]) => {
  emit(
    "update:entry",
    applyGroupSelection(props.descriptor, props.entry, props.group, values),
  );
};

/** The scopes one value can carry, and which of them it carries now. */
const valueScopes = (value: string) =>
  viewValueScopes(props.entry, props.group, value);

const setValueScopes = (value: string, actions: string[]) => {
  emit(
    "update:entry",
    applyValueScopes(
      props.descriptor,
      props.entry,
      props.group,
      value,
      actions,
    ),
  );
};

/**
 * Picking a value grants every scope it accepts; unpicking takes them all
 * back. Narrowing to some of them is the per-value switches' job.
 */
const toggleValue = (value: string) => {
  if (props.group.control !== "multi-select") {
    const selected = view.value.selected;
    setGroup(
      selected.includes(value)
        ? selected.filter((entry) => entry !== value)
        : [...selected, value],
    );
    return;
  }
  setValueScopes(
    value,
    isPicked(value) ? [] : valueScopes(value).map((scope) => scope.action),
  );
};

const toggleValueScope = (value: string, action: string) => {
  setValueScopes(
    value,
    valueScopes(value)
      .filter((scope) =>
        scope.action === action ? !scope.granted : scope.granted,
      )
      .map((scope) => scope.action),
  );
};

/**
 * The control's options in render order: everything ordinary first, then
 * one section per deferred family. The families keep the registry's own
 * order within themselves, so a section is a fold in the list, never a
 * re-sort.
 */
const optionSections = computed(() => {
  const { options, selected } = view.value;
  const rules = DEFERRED_SECTIONS.filter(
    (rule) =>
      options.filter((option) => rule.match(option.value)).length >=
      MIN_DEFERRED_SECTION,
  );
  const sections = [
    {
      id: "main",
      label: "",
      hint: "",
      deferred: false,
      selected: 0,
      options: options.filter(
        (option) => !rules.some((rule) => rule.match(option.value)),
      ),
    },
  ];
  for (const rule of rules) {
    const matched = options.filter((option) => rule.match(option.value));
    sections.push({
      id: rule.id,
      label: rule.label,
      hint: rule.hint,
      deferred: true,
      selected: matched.filter((option) => selected.includes(option.value))
        .length,
      options: matched,
    });
  }
  return sections;
});

/** Just the folded families, for the expander chip. */
const deferredSections = computed(() =>
  optionSections.value.filter((section) => section.deferred),
);

const isSectionOpen = (section: string) => openSections.value.has(section);

const setSectionOpen = (section: string, open: boolean) => {
  const next = new Set(openSections.value);
  if (open) next.add(section);
  else next.delete(section);
  openSections.value = next;
};

/**
 * Select all means ALL — including a deferred family — and opens the folds
 * it just granted, because a grant the creator cannot see is the one thing
 * this card must never produce.
 */
const selectAll = () => {
  setGroup(view.value.options.map((option) => option.value));
  for (const section of deferredSections.value) {
    if (section.options.length) setSectionOpen(section.id, true);
  }
};

/**
 * What each of the control's scopes currently covers, in the values' own
 * names — the per-value switches read back as a sentence.
 */
const groupScopes = computed(() => {
  if (props.group.control !== "multi-select") return [];
  const { options, selected, actions } = view.value;
  const picked = options.filter((option) => selected.includes(option.value));
  return actions.map((action) => ({
    action,
    optional: props.group.members.some(
      (member) => member.action === action && member.optional,
    ),
    assets: picked
      .filter((option) =>
        valueScopes(option.value).some(
          (scope) => scope.action === action && scope.granted,
        ),
      )
      .map((option) => option.label),
  }));
});

const scopeAssetList = (assets: string[]): string => {
  if (!assets.length) return "not granted";
  if (assets.length <= SCOPE_ASSET_PREVIEW) return assets.join(" · ");
  return `${assets.slice(0, SCOPE_ASSET_PREVIEW).join(" · ")} + ${
    assets.length - SCOPE_ASSET_PREVIEW
  } more`;
};
</script>

<style scoped lang="scss">
.field {
  &__head {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    margin-bottom: 0.5rem;

    /* Nothing left to sit on a baseline with — the caution is a box. */
    &--warned {
      align-items: center;
      margin-bottom: 0.75rem;
    }
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__count {
    font-size: 11px;
    color: $color-steel-blue;
    opacity: 0.75;
  }

  &__bulk {
    margin-left: auto;
    border: none;
    background: none;
    padding: 0;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-cyan;
    }

    & + & {
      margin-left: 0;
    }
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;

    &--continued {
      margin-top: 0.375rem;
    }
  }

  &__chip {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-mono;
    font-size: 12px;
    line-height: 1.2;
    color: $color-white;
    transition:
      border-color $default-transition-time ease,
      background-color $default-transition-time ease,
      color $default-transition-time ease;

    &:hover {
      border-color: $color-line-3;
    }

    &--selected {
      border-color: $color-cyan-line;
      background: $color-cyan-tint;
      color: $color-cyan;
    }
  }

  &__chip_main {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3125rem 0.5rem 0.3125rem 0.625rem;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }

  &__chip_label {
    white-space: nowrap;
  }

  &__chip_only {
    margin-left: 0.375rem;
    padding-left: 0.375rem;
    border-left: 1px solid $color-line;
    font-family: $font-mono;
    font-size: 9.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-steel-blue;
    opacity: 0.8;
  }

  /**
   * The fold at the end of an asset list. A chip, because what it opens is
   * more of the same chips — not a section of its own.
   */
  &__more {
    align-items: center;
    gap: 0.25rem;
    padding: 0.3125rem 0.625rem;
    border-style: dashed;
    color: $color-steel-blue;
    cursor: pointer;

    &:hover {
      border-color: $color-line-3;
      color: $color-white;
    }
  }

  &__chevron {
    flex: none;
    transition: transform $default-transition-time ease;

    &--open {
      transform: rotate(180deg);
    }
  }

  /**
   * The scopes of one picked value, hanging off the chip behind the same
   * hairline the narrower-than-its-neighbours marker uses. Kept light: a
   * 67-asset list all switched on would otherwise read as a wall of buttons
   * rather than as a list of assets.
   */
  &__scopes {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    margin: 0.1875rem 0;
    padding: 0 0.5rem 0 0.375rem;
    border-left: 1px solid $color-cyan-line;
  }

  &__scope {
    padding: 0.125rem 0.25rem;
    border: none;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-mono;
    font-size: 9.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;
    transition:
      background-color $default-transition-time ease,
      color $default-transition-time ease;

    &:hover {
      color: $color-white;
    }

    &--on {
      color: $color-cyan;

      &:hover {
        color: $color-cyan-soft;
      }
    }
  }

  &__scope_list {
    margin-top: 0.625rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    padding: 0.5rem 0.75rem;
  }

  &__scope_list_title {
    margin-bottom: 0.25rem;
  }

  &__scope_row {
    padding: 0.5rem 0;

    & + & {
      border-top: 1px solid $color-line;
    }
  }

  &__scope_row_head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  &__scope_name {
    font-size: 13px;
    line-height: 1.4;
    color: $color-white;
  }

  &__scope_assets {
    min-width: 0;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1.5;
    color: $color-cyan;
    word-break: break-word;

    &--none {
      color: $color-steel-blue;
      opacity: 0.75;
    }
  }

  &__hint {
    margin-top: 0.125rem;
    font-size: 11.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__warning {
    margin-bottom: 0.75rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid rgba($color-warning, 0.35);
    border-radius: $default-border-radius;
    font-size: 11.5px;
    line-height: 1.5;
    color: $color-warning;

    &--inline {
      min-width: 0;
      flex: 1;
      margin-bottom: 0;
    }
  }

  &__input {
    display: block;
    width: 100%;
    padding: 11px 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;

    &:focus {
      outline: none;
      border-color: $color-accent-line;
    }
  }

  &__unsupported {
    font-size: 12px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__note {
    margin-top: 0.5rem;

    &--lead {
      margin-top: 0;
      margin-bottom: 0.5rem;
    }
    font-size: 11.5px;
    line-height: 1.5;
    color: $color-steel-blue;
    opacity: 0.85;
  }

  @media (prefers-reduced-motion: reduce) {
    &__bulk,
    &__chip,
    &__scope,
    &__chevron {
      transition: none;
    }
  }
}
</style>
