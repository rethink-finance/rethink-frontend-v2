<template>
  <section class="whitelist">
    <div class="whitelist__head">
      <div class="whitelist__titles">
        <div class="whitelist__title_row">
          <h2 class="whitelist__title">
            Whitelisted deposits
          </h2>
          <OnboardingFieldChip :tag="FieldTag.UpgradableCurator" />
        </div>
        <p class="whitelist__sub">
          Only the addresses below can deposit into the vault. Leave off for a
          permissionless vault.
        </p>
      </div>

      <OnboardingToggle
        v-model="isWhitelistEnabled"
        :disabled="!isEditable"
        label="Restrict deposits to a whitelist"
      />
    </div>

    <!-- Curator mode keeps the list live while enforcement is off (addresses
         can be staged before flipping it on); dimming it there would read as
         "you cannot maintain the whitelist", which is exactly what curator
         mode is for. -->
    <div
      class="whitelist__body"
      :class="{
        'whitelist__body--off': !isWhitelistEnabled && dimWhenDisabled,
        'whitelist__body--over': isDragOver,
      }"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div v-if="isEditable" class="whitelist__add">
        <input
          v-model="newAddress"
          class="whitelist__input"
          type="text"
          placeholder="0x0000000000000000000000000000000000000000"
          @keydown.enter="addAddress"
        >
        <button
          type="button"
          class="whitelist__add_button"
          @click="addAddress"
        >
          Add address
        </button>
        <button
          type="button"
          class="whitelist__add_button"
          :disabled="isImporting"
          @click="browseCsv"
        >
          {{ isImporting ? "Reading…" : "Import CSV" }}
        </button>
        <OnboardingInfoTip
          label="About importing a CSV"
          text="One address per row, extra columns ignored. Imported addresses are added to the list below, never replace it."
        />
        <input
          ref="csvInputRef"
          class="whitelist__file"
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          @change="onCsvChosen"
        >
      </div>
      <p class="whitelist__error">
        {{ addError }}
      </p>
      <p v-if="importSummary" class="whitelist__import_note">
        {{ importSummary }}
      </p>

      <div v-if="whitelist.length" class="whitelist__search">
        <Icon
          icon="material-symbols:search"
          width="1.125rem"
          class="whitelist__search_icon"
        />
        <input
          v-model="searchQuery"
          class="whitelist__search_input"
          type="search"
          placeholder="Search addresses"
          aria-label="Search whitelisted addresses"
        >
        <button
          v-if="searchQuery"
          type="button"
          class="whitelist__search_clear"
          @click="searchQuery = ''"
        >
          Clear
        </button>
        <span class="whitelist__search_count">
          {{ visibleRows.length }} / {{ whitelist.length }}
        </span>
      </div>

      <div class="whitelist__table">
        <div class="whitelist__row whitelist__row--head">
          <span>#</span>
          <span>Address</span>
          <span>State</span>
          <button
            v-if="canRemoveAll"
            type="button"
            class="whitelist__remove"
            @click="isRemoveAllDialogOpen = true"
          >
            Remove all
          </button>
          <span v-else />
        </div>

        <!-- The row number is the position in the whole list, not in the
             filtered view, so a searched-for row keeps the number it has when
             the search is cleared. -->
        <div
          v-for="row in visibleRows"
          :key="row.item.address"
          class="whitelist__row"
        >
          <span class="whitelist__index">{{ row.index + 1 }}</span>
          <span class="whitelist__address">{{ row.item.address }}</span>
          <span class="whitelist__state">{{ stateOf(row.item) }}</span>
          <button
            v-if="isEditable"
            type="button"
            class="whitelist__remove"
            @click="removeAddress(row.item)"
          >
            {{ row.item.deleted ? "Undo" : "Remove" }}
          </button>
          <span v-else />
        </div>

        <div v-if="!whitelist.length" class="whitelist__empty">
          No addresses whitelisted yet.
        </div>
        <div v-else-if="!visibleRows.length" class="whitelist__empty">
          No address matches “{{ searchQuery }}”.
        </div>
      </div>
    </div>

    <UiConfirmDialog
      v-model="isRemoveAllDialogOpen"
      title="Remove every address?"
      :message="removeAllMessage"
      confirm-text="Remove all"
      cancel-text="Cancel"
      @confirm="removeAll"
    />
  </section>
</template>

<script setup lang="ts">
import type { IWhitelist } from "~/types/enums/fund_setting_proposal";
import { FieldTag } from "~/types/enums/stepper_onboarding";

/**
 * The deposit whitelist. Rows are never dropped once they exist on-chain —
 * removing one marks it `deleted`, which is what the settings transaction
 * reads; only an address added in this session disappears outright.
 */
const emit = defineEmits(["update:modelValue", "update:whitelistEnabled"]);

const props = defineProps({
  modelValue: {
    type: Array as () => IWhitelist[],
    default: () => [],
  },
  whitelistEnabled: {
    type: Boolean,
    default: false,
  },
  isEditable: {
    type: Boolean,
    default: true,
  },
  /**
   * Grey the address list out while enforcement is off. Curator mode turns
   * this off: the list stays editable so addresses can be staged before the
   * whitelist is switched on.
   */
  dimWhenDisabled: {
    type: Boolean,
    default: true,
  },
});

const newAddress = ref("");
const searchQuery = ref("");
const addError = ref("");
const csvInputRef = ref<HTMLInputElement | null>(null);
const isImporting = ref(false);
const isDragOver = ref(false);
const importSummary = ref("");
const isRemoveAllDialogOpen = ref(false);

const whitelist = computed({
  get: () => props?.modelValue || [],
  set: (value: IWhitelist[]) => {
    emit("update:modelValue", value);
  },
});

const isWhitelistEnabled = computed({
  get: () => props.whitelistEnabled || false,
  set: (value: boolean) => {
    emit("update:whitelistEnabled", value);
  },
});

/**
 * Rows carry their position in the full list so filtering never renumbers
 * them. A long whitelist is a wall of hex, and the search is how a manager
 * checks whether one address is on it — matching is a plain substring, which
 * covers pasting a full address as well as typing the last few characters.
 */
const visibleRows = computed(() => {
  const rows = whitelist.value.map((item, index) => ({ item, index }));
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return rows;

  return rows.filter((row) => row.item.address.toLowerCase().includes(query));
});

/** Addresses still standing — a row already marked removed is not one of them. */
const activeAddresses = computed(() =>
  whitelist.value.filter((item) => !item.deleted),
);

// Clearing a list of one is what the row's own Remove button is for.
const canRemoveAll = computed(
  () => props.isEditable && activeAddresses.value.length > 1,
);

const removeAllMessage = computed(() => {
  const count = activeAddresses.value.length;
  const stored = activeAddresses.value.filter((item) => !item.isNew).length;
  const storedNote = stored
    ? ` ${stored} already on-chain, so ${stored === 1 ? "it is" : "they are"} marked removed and can be restored until the settings are saved.`
    : "";
  return `This clears all ${count} addresses from the whitelist.${storedNote}`;
});

const stateOf = (item: IWhitelist) => {
  if (item.deleted) return "Removed";
  if (item.isNew) return "Added";
  return "Active";
};

const addAddress = () => {
  const address = newAddress.value.trim();
  addError.value = "";
  importSummary.value = "";

  if (formRules.isValidAddress(address) !== true) {
    addError.value = "Address is not valid.";
    return;
  }
  if (
    whitelist.value.some(
      (item) => item.address.toLowerCase() === address.toLowerCase(),
    )
  ) {
    addError.value = "This address is already in the whitelist.";
    return;
  }

  whitelist.value = [
    ...whitelist.value,
    { address, isNew: true, deleted: false },
  ];
  newAddress.value = "";
};

const removeAddress = (item: IWhitelist) => {
  // An address added in this session was never stored, so it just goes away.
  if (item.isNew) {
    whitelist.value = whitelist.value.filter((i) => i.address !== item.address);
    return;
  }
  item.deleted = !item.deleted;
};

/**
 * The same split the single-row Remove makes, applied to the whole list: an
 * address added in this session was never stored and just goes away, while one
 * that exists on-chain is marked `deleted` for the settings transaction.
 */
const removeAll = () => {
  addError.value = "";
  importSummary.value = "";
  whitelist.value = whitelist.value
    .filter((item) => !item.isNew)
    .map((item) => ({ ...item, deleted: true }));
  isRemoveAllDialogOpen.value = false;
};

const browseCsv = () => {
  if (!props.isEditable) return;
  csvInputRef.value?.click();
};

const onCsvChosen = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) importCsv(file);
  // Lets the same file be picked again after a fix.
  input.value = "";
};

const onDragOver = () => {
  if (!props.isEditable) return;
  isDragOver.value = true;
};

// dragleave bubbles up from every child the cursor crosses, so the highlight
// only drops when the cursor has actually left the zone.
const onDragLeave = (event: DragEvent) => {
  const enteredNode = event.relatedTarget as Node | null;
  const zone = event.currentTarget as HTMLElement;
  if (enteredNode && zone.contains(enteredNode)) return;
  isDragOver.value = false;
};

const onDrop = (event: DragEvent) => {
  isDragOver.value = false;
  if (!props.isEditable) return;
  const file = event.dataTransfer?.files?.[0];
  if (file) importCsv(file);
};

const importCsv = async (file: File) => {
  addError.value = "";
  importSummary.value = "";

  if (file.size > MAX_ADDRESS_CSV_BYTES) {
    addError.value = "The file must be 1 MB or smaller.";
    return;
  }

  isImporting.value = true;
  try {
    const parsed = parseAddressCsv(await file.text());
    const merge = mergeAddressesIntoWhitelist(
      whitelist.value,
      parsed.addresses,
    );

    if (merge.added || merge.restored) whitelist.value = merge.whitelist;

    if (!parsed.addresses.length && !parsed.invalid.length) {
      addError.value = "No addresses found in that file.";
      return;
    }

    const parts = [`${merge.added} added`];
    if (merge.restored) parts.push(`${merge.restored} restored`);
    if (merge.alreadyListed) parts.push(`${merge.alreadyListed} already listed`);
    if (parsed.duplicateCount) {
      parts.push(`${parsed.duplicateCount} repeated in the file`);
    }
    importSummary.value = `${file.name}: ${parts.join(" · ")}`;

    if (parsed.invalid.length) {
      const preview = parsed.invalid
        .slice(0, 3)
        .map((row) => `line ${row.line}`)
        .join(", ");
      addError.value =
        `${parsed.invalid.length} row${parsed.invalid.length === 1 ? "" : "s"}` +
        ` skipped, no valid address (${preview}` +
        `${parsed.invalid.length > 3 ? ", …" : ""}).`;
    }
  } catch (error) {
    console.error("Failed reading the whitelist CSV", error);
    addError.value = "The file could not be read.";
  } finally {
    isImporting.value = false;
  }
};
</script>

<style scoped lang="scss">
.whitelist {
  display: flex;
  flex-direction: column;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.375rem;
  }

  &__title_row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  &__title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  &__sub {
    max-width: 62ch;
    margin-top: 0.375rem;
    font-size: 13px;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__body {
    border-radius: $default-border-radius;
    outline: 1px dashed transparent;
    outline-offset: 6px;
    transition: outline-color $default-transition-time ease;

    &--off {
      opacity: 0.45;
      pointer-events: none;
    }

    &--over {
      outline-color: $color-cyan-line;
    }
  }

  &__add {
    display: flex;
    align-items: stretch;
    gap: 0.625rem;
  }

  &__file {
    display: none;
  }

  &__import_note {
    margin: 0 0 0.875rem;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 13px;
    color: $color-cyan;
  }

  &__input {
    flex: 1;
    min-width: 0;
    padding: 11px 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.3;
    color: $color-white;

    &::placeholder {
      color: $color-steel-blue;
    }
    &:focus {
      outline: none;
      border-color: $color-accent-line;
    }
  }

  &__add_button {
    flex: none;
    padding: 0 14px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-white;
    cursor: pointer;

    &:hover {
      border-color: $color-line-3;
    }
  }

  &__error {
    min-height: 13px;
    margin: 0.3125rem 0 0.875rem;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 13px;
    color: $color-neg;
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.625rem;
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

  &__search_input {
    flex: 1;
    min-width: 0;
    padding: 9px 0;
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
    // The native clear affordance is a light glyph on a dark field.
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

  &__search_count {
    flex: none;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;
  }

  &__table {
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    overflow: hidden;
  }

  &__row {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 110px 96px;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid $color-line;
    font-family: $font-mono;
    font-size: 12px;
    line-height: 1.4;
    color: $color-white;

    &:first-child {
      border-top: none;
    }

    &--head {
      font-size: 10.5px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: $color-steel-blue;
    }
  }

  &__index {
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;
  }

  &__address {
    word-break: break-all;
  }

  &__state {
    color: $color-cyan;
  }

  &__remove {
    justify-self: end;
    white-space: nowrap;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-neg;
    }
  }

  &__empty {
    padding: 28px;
    text-align: center;
    font-size: 13px;
    color: $color-steel-blue;
  }

  @media (prefers-reduced-motion: reduce) {
    &__remove,
    &__body {
      transition: none;
    }
  }
}
</style>
