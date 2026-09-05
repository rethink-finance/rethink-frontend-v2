<template>
  <div class="settings">
    <div class="settings__bar">
      <span class="settings__summary">{{ summary }}</span>
      <div class="settings__controls">
        <UiSegmented
          v-if="changedCount"
          v-model="filter"
          :options="FILTER_OPTIONS"
        />
        <button
          v-if="collapsed"
          type="button"
          class="settings__toggle"
          @click="open = !open"
        >
          {{ open ? "Hide settings" : "Show settings" }}
        </button>
      </div>
    </div>

    <div v-if="open" class="settings__sections">
      <section
        v-for="section in visibleSections"
        :key="section.name"
        class="settings__section"
      >
        <div class="settings__section_name">
          {{ section.name }}
        </div>
        <div
          v-for="row in section.rows"
          :key="row.key"
          class="settings__row"
          :class="{ 'settings__row--changed': row.changed }"
        >
          <div class="settings__label">
            {{ row.label }}
          </div>
          <div class="settings__values">
            <div class="settings__proposed">
              <template v-if="row.kind === 'address'">
                <FundGovernanceProposalAddressChip
                  v-if="row.proposed"
                  :address="String(row.proposed)"
                />
                <span v-else class="settings__muted">none</span>
              </template>
              <template v-else-if="row.kind === 'list'">
                <ul v-if="(row.proposed as string[]).length" class="settings__list">
                  <li v-for="item in (row.proposed as string[])" :key="item">
                    <FundGovernanceProposalAddressChip :address="item" />
                  </li>
                </ul>
                <span v-else class="settings__muted">none</span>
              </template>
              <a
                v-else-if="row.kind === 'url' && row.proposed && !isDataUri(row.proposed)"
                class="settings__link"
                :href="String(row.proposed)"
                target="_blank"
                rel="noopener noreferrer"
              >{{ display(row, row.proposed) }}</a>
              <span
                v-else
                :class="{ settings__muted: !display(row, row.proposed) }"
                :title="typeof row.proposed === 'string' && !isDataUri(row.proposed) ? row.proposed : undefined"
              >
                {{ display(row, row.proposed) || "empty" }}
              </span>
            </div>
            <div v-if="row.changed" class="settings__current">
              <span class="settings__current_label">currently</span>
              <template v-if="row.kind === 'address'">
                <FundGovernanceProposalAddressChip
                  v-if="row.current"
                  :address="String(row.current)"
                />
                <span v-else>none</span>
              </template>
              <template v-else-if="row.kind === 'list'">
                {{ (row.current as string[])?.length ?? 0 }}
                {{ (row.current as string[])?.length === 1 ? "address" : "addresses" }}
              </template>
              <span v-else>{{ display(row, row.current) || "empty" }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
import {
  buildSettingsSections,
  countChangedSettings,
  formatFeePeriodDays,
  type ISettingsRow,
} from "~/composables/proposal/describeProposalActions";

/**
 * An `updateSettings` call, as a settings sheet: every value the call would
 * write, against what the vault has now. Changed rows are marked and shown
 * first by default, because "what changes?" is the question a voter has;
 * the unchanged rest is one click away for anyone checking the whole sheet.
 *
 * "Currently" is the vault as loaded, not as it was when the proposal was
 * made — for an executed proposal the two coincide and nothing is marked.
 */
const props = defineProps<{
  decoded?: Record<string, any>;
  /** Start folded; for a call that is only a technical repeat. */
  collapsed?: boolean;
}>();

const fundStore = useFundStore();

const FILTER_OPTIONS = [
  { key: "changed", label: "Changes" },
  { key: "all", label: "All settings" },
];

const sections = computed(() =>
  buildSettingsSections(props.decoded, fundStore.fund),
);
const changedCount = computed(() => countChangedSettings(sections.value));
const comparable = computed(() =>
  sections.value.some((section) => section.rows.some((row) => row.comparable)),
);

const filter = ref<"changed" | "all">("all");
watch(
  changedCount,
  (count) => {
    filter.value = count ? "changed" : "all";
  },
  { immediate: true },
);

const open = ref(!props.collapsed);

const visibleSections = computed(() => {
  if (filter.value === "all") return sections.value;
  return sections.value
    .map((section) => ({
      ...section,
      rows: section.rows.filter((row) => row.changed),
    }))
    .filter((section) => section.rows.length);
});

const summary = computed(() => {
  if (!comparable.value) return "Proposed settings";
  if (!changedCount.value) return "No change from the vault's current settings";
  return `${changedCount.value} ${changedCount.value === 1 ? "setting changes" : "settings change"}`;
});

/**
 * Long values — a description, or the default avatar that arrives as a
 * base64 data URI — must not swamp the sheet. An embedded image says what it
 * is, and anything else is cut with the full value left in the tooltip.
 */
const MAX_CHARS = 200;

const clamp = (text: string): string => {
  if (text.startsWith("data:")) {
    const kb = Math.max(1, Math.round((text.length * 3) / 4 / 1024));
    const type = text.slice(5, text.indexOf(";")) || "file";
    return `embedded ${type}, ~${kb} KB`;
  }
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text;
};

const display = (row: ISettingsRow, value: string | string[] | undefined): string => {
  if (value === undefined || value === null) return "";
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  switch (row.kind) {
    case "percent":
      return text === "" ? "" : `${text}%`;
    case "days":
      return formatFeePeriodDays(text);
    case "bool":
      return text === "true" ? "yes" : "no";
    default:
      return clamp(text);
  }
};

const isDataUri = (value: string | string[] | undefined): boolean =>
  typeof value === "string" && value.startsWith("data:");
</script>

<style scoped lang="scss">
.settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__summary {
    font-size: 13px;
    font-weight: 600;
    color: $color-white;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__toggle {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-cyan;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  &__sections {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
  }

  &__section {
    display: flex;
    flex-direction: column;
  }

  &__section_name {
    padding-bottom: 0.375rem;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
    gap: 0.25rem 1rem;
    padding: 0.5rem 0.625rem;
    border-top: 1px solid $color-line;
    font-size: 13px;

    &--changed {
      background: $color-accent-soft;
      box-shadow: inset 2px 0 0 $color-cyan;
    }

    @media (max-width: 600px) {
      grid-template-columns: 1fr;
    }
  }

  &__label {
    color: $color-text-irrelevant;
  }

  &__values {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    color: $color-white;
    overflow-wrap: anywhere;
  }

  &__current {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    flex-wrap: wrap;
    font-size: 12px;
    color: $color-steel-blue;
  }

  &__current_label {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  &__muted {
    color: $color-steel-blue;
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  &__link {
    color: $color-white;
    overflow-wrap: anywhere;

    &:hover {
      color: $color-cyan;
    }
  }
}
</style>
