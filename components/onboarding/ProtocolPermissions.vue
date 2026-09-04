<template>
  <div class="protocols">
    <div class="protocols__head">
      <span class="protocols__title">Protocol integrations</span>
      <span v-if="added.length" class="protocols__summary">
        {{ added.length }} added
      </span>
    </div>

    <!-- What has been added, in the order it was added, each one open. -->
    <div
      v-for="item in added"
      :key="item.key"
      class="protocols__item"
    >
      <OnboardingProtocolIntegration
        v-if="item.kind === 'protocol'"
        :descriptor="item.descriptor"
        :entry="findProtocol(item.descriptor.protocol)!"
        :chain-id="chainId"
        :roles-mod-address="rolesModAddress"
        @update:entry="(next) => replaceEntry(item.descriptor.protocol, next)"
        @remove="removeProtocol(item.descriptor.protocol)"
      />

      <template v-else>
        <div class="protocols__row">
          <span class="protocols__glyph" aria-hidden="true">
            <Icon icon="material-symbols:code-rounded" />
          </span>
          <div class="protocols__row_text">
            <p class="protocols__name">
              Raw permissions
            </p>
            <p class="protocols__meta">
              {{ rawMeta }}
            </p>
          </div>
          <button
            type="button"
            class="protocols__remove"
            aria-label="Remove raw permissions"
            @click="removeRaw"
          >
            Remove
          </button>
        </div>
        <div class="protocols__raw_body">
          <OnboardingRawPermissionsCode
            :model-value="rawEntries"
            @update:model-value="(v) => emit('update:rawEntries', v)"
          />
        </div>
      </template>
    </div>

    <!--
      The way in. With nothing added it is the whole card — a tile that
      says what this section is for — and once something is, it steps back
      to a row under the last integration, where the next one will appear.
    -->
    <div
      class="protocols__add_wrap"
      :class="{ 'protocols__add_wrap--hero': !added.length }"
    >
      <button
        type="button"
        class="protocols__add"
        :class="{ 'protocols__add--hero': !added.length }"
        @click="libraryOpen = true"
      >
        <span class="protocols__plus" aria-hidden="true">
          <Icon icon="material-symbols:add-rounded" />
        </span>
        <span class="protocols__add_text">
          <span class="protocols__add_title">Add protocol</span>
          <span v-if="!added.length && addHint" class="protocols__add_hint">
            {{ addHint }}
          </span>
        </span>
      </button>
    </div>

    <UiConfirmDialog v-model="libraryOpen" max-width="600px">
      <!-- Just the heading: the dialog's default puts an eyebrow over it,
           and the list below needs no introduction. -->
      <template #title>
        <h2 class="brand_modal__title library__title">
          Add protocol
        </h2>
      </template>

      <div class="library">
        <!--
          First, the way that covers everything: Zodiac's own app, where any
          protocol and any action can be granted by hand. The row is the
          link; the disclosure under it says what to do once there.
        -->
        <div class="zodiac">
          <a
            class="zodiac__row"
            :href="ZODIAC_APP_URL"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              class="zodiac__logo"
              src="@/assets/images/logo-zodiac.png"
              alt="Zodiac"
            >
            <span class="zodiac__text">
              <span class="zodiac__name">Configure permissions in Zodiac</span>
              <span class="zodiac__meta">
                Permissions and manual execution app
              </span>
            </span>
            <span class="zodiac__open">
              Open Zodiac
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17L17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </span>
          </a>

          <button
            type="button"
            class="zodiac__disclosure"
            :aria-expanded="zodiacInfoOpen"
            @click="zodiacInfoOpen = !zodiacInfoOpen"
          >
            <Icon
              class="zodiac__chevron"
              :class="{ 'zodiac__chevron--open': zodiacInfoOpen }"
              icon="material-symbols:keyboard-arrow-down-rounded"
              width="1.125rem"
              height="1.125rem"
            />
            <span class="zodiac__disclosure_title">How to integrate a protocol</span>
          </button>

          <div v-if="zodiacInfoOpen" class="zodiac__info">
            <!-- Steps 2 and 3 name the Zodiac sidebar entries they happen
                 in, drawn the way Zodiac draws them, so the words on this
                 side match what is being looked for on that one. -->
            <ol class="zodiac__steps">
              <li class="zodiac__step">
                <span class="zodiac__step_number">1</span>
                <span class="zodiac__step_text">Create an account.</span>
              </li>
              <li class="zodiac__step">
                <span class="zodiac__step_number">2</span>
                <span class="zodiac__step_text">
                  Open
                  <span class="zodiac__nav">
                    <svg
                      class="zodiac__nav_icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="3"
                      />
                      <path d="M8.5 8.5l7 7" />
                      <path d="M15.5 8.5l-7 7" />
                    </svg>
                    Vaults
                  </span>
                  and import the Safe contract:
                  <span class="zodiac__safe">
                    <span
                      class="zodiac__safe_address"
                      :class="{ 'zodiac__safe_address--pending': !safeAddress }"
                    >
                      {{ safeAddress || "available once the vault is initialized" }}
                    </span>
                    <button
                      v-if="safeAddress"
                      type="button"
                      class="zodiac__copy"
                      :aria-label="safeCopied ? 'Copied' : 'Copy the Safe contract address'"
                      @click="copySafeAddress"
                    >
                      {{ safeCopied ? "Copied" : "Copy" }}
                    </button>
                  </span>
                </span>
              </li>
              <li class="zodiac__step">
                <span class="zodiac__step_number">3</span>
                <span class="zodiac__step_text">
                  Go to
                  <span class="zodiac__nav">
                    <svg
                      class="zodiac__nav_icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 3l7.5 3v5.2c0 4.9-3.2 8.4-7.5 9.8-4.3-1.4-7.5-4.9-7.5-9.8V6l7.5-3z" />
                    </svg>
                    Policies
                  </span>
                  and add the actions you need.
                </span>
              </li>
            </ol>
          </div>
        </div>

        <!--
          Then the escape hatch: anything Zodiac or the library does not
          cover can still be granted as the calldata itself.
        -->
        <ul class="library__list">
          <li class="library__row">
            <button
              type="button"
              class="library__item"
              :disabled="isRawAdded"
              @click="addRaw"
            >
              <span class="protocols__glyph" aria-hidden="true">
                <Icon icon="material-symbols:code-rounded" />
              </span>
              <span class="library__item_text">
                <span class="library__item_name">Raw permissions</span>
                <span class="library__item_meta">
                  Paste pre-encoded Roles modifier calldata
                </span>
              </span>
              <span v-if="isRawAdded" class="library__badge">Added</span>
              <Icon
                v-else
                class="library__item_plus"
                icon="material-symbols:add-rounded"
                aria-hidden="true"
              />
            </button>
          </li>
        </ul>

        <!-- And the templates the registry offers on this chain. -->
        <div class="library__section">
          <div class="library__section_head">
            <span class="library__eyebrow">Library</span>
            <span v-if="protocols.length" class="library__count">
              {{ filteredProtocols.length }} of {{ protocols.length }}
            </span>
          </div>

          <p v-if="!protocols.length" class="library__lead">
            No protocol templates are available on {{ chainName }} yet.
          </p>

          <template v-else>
            <div class="library__search">
              <Icon
                icon="material-symbols:search"
                width="1.125rem"
                class="library__search_icon"
              />
              <input
                v-model="query"
                class="library__search_input"
                type="search"
                placeholder="Search protocols"
                aria-label="Search the protocol library"
              >
              <button
                v-if="query"
                type="button"
                class="library__search_clear"
                @click="query = ''"
              >
                Clear
              </button>
            </div>

            <ul v-if="filteredProtocols.length" class="library__list">
              <li
                v-for="protocol in filteredProtocols"
                :key="protocol.protocol"
                class="library__row"
              >
                <button
                  type="button"
                  class="library__item"
                  :disabled="isProtocolEnabled(protocol.protocol)"
                  @click="addProtocol(protocol.protocol)"
                >
                  <OnboardingProtocolLogo
                    :protocol="protocol.protocol"
                    :label="protocol.label"
                  />
                  <span class="library__item_text">
                    <span class="library__item_name">{{ protocol.label }}</span>
                    <span class="library__item_meta">
                      {{ protocolActions(protocol) }}
                    </span>
                  </span>
                  <span
                    v-if="isProtocolEnabled(protocol.protocol)"
                    class="library__badge"
                  >Added</span>
                  <Icon
                    v-else
                    class="library__item_plus"
                    icon="material-symbols:add-rounded"
                    aria-hidden="true"
                  />
                </button>
              </li>
            </ul>
            <p v-else class="library__lead">
              No protocol matches “{{ query }}”.
            </p>
          </template>
        </div>
      </div>
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import {
  type IProtocolDescriptor,
  type IProtocolSelectionState,
  getRegistryProtocols,
  initProtocolSelections,
  normalizeProtocolSelections,
} from "~/composables/permissions/protocolPermissions";
import type { IRawPermissionCodeEntry } from "~/composables/permissions/parseRawPermissionCode";
import { networksMap } from "~/store/web3/networksMap";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * "Protocol integrations" card for the Roles V2 creation flow. It starts
 * empty, with one way in: a tile that opens the library of everything the
 * permissions registry offers on this chain, plus raw Roles calldata for
 * whatever it does not. Picking one adds it to the card, open, where its
 * grants are chosen (OnboardingProtocolIntegration) and compiled by the
 * registry into the scoped Roles v2 calls that join this step's
 * submitPermissions batch.
 *
 * Selection state stays with the parent, one entry per protocol the chain
 * offers: "added" is the entry's `enabled` flag, so the save's authoritative
 * diff sees a removed integration as grants to take back. Only the order
 * things were added in lives here — it is presentation, and a new
 * integration belongs where the eye already is, above the tile that added
 * it.
 */
const props = defineProps<{
  modelValue: IProtocolSelectionState[];
  /** Raw calldata entries queued for the batch, owned by the parent. */
  rawEntries: IRawPermissionCodeEntry[];
  chainId: ChainId;
  /** For the generated-calls preview; grants still build without it. */
  rolesModAddress?: string;
  /**
   * The vault's Safe, for the Zodiac instructions — it is what gets
   * imported there. Absent until the vault is initialized.
   */
  safeAddress?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: IProtocolSelectionState[]): void;
  (e: "update:rawEntries", value: IRawPermissionCodeEntry[]): void;
}>();

/** The raw block's slot in the added order, beside the protocol keys. */
const RAW_KEY = "raw-permissions";

/** Zodiac's own app: permissions and manual execution for any protocol. */
const ZODIAC_APP_URL = "https://app.zodiac.eco/";

const libraryOpen = ref(false);

/** Whether the Zodiac walkthrough in the dialog is expanded. */
const zodiacInfoOpen = ref(false);

/** The library search, cleared with the dialog. */
const query = ref("");

const safeCopied = ref(false);
let safeCopiedTimer: ReturnType<typeof setTimeout> | undefined;

const copySafeAddress = () => {
  if (!props.safeAddress) return;
  navigator.clipboard.writeText(props.safeAddress);
  safeCopied.value = true;
  if (safeCopiedTimer) clearTimeout(safeCopiedTimer);
  safeCopiedTimer = setTimeout(() => {
    safeCopied.value = false;
  }, 1500);
};

onBeforeUnmount(() => {
  if (safeCopiedTimer) clearTimeout(safeCopiedTimer);
});

// The dialog reopens the way it was first seen: walkthrough folded, no
// search left over from last time.
watch(libraryOpen, (open) => {
  if (open) return;
  zodiacInfoOpen.value = false;
  query.value = "";
});

/**
 * Raw permissions added but still empty. Once entries exist they speak for
 * themselves; this only keeps the block on the card before the first paste.
 */
const rawAdded = ref(false);

/** Keys in the order they were added; pruned as things are removed. */
const addedOrder = ref<string[]>([]);

const protocols = computed<IProtocolDescriptor[]>(() =>
  getRegistryProtocols(props.chainId),
);

const chainName = computed(
  () => networksMap[props.chainId]?.chainName ?? "this chain",
);

/**
 * The library narrowed to the search: by name, by registry key, or by an
 * action it offers — "borrow" finds every lending template.
 */
const filteredProtocols = computed<IProtocolDescriptor[]>(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return protocols.value;
  return protocols.value.filter((protocol) =>
    [
      protocol.label,
      protocol.protocol,
      ...protocol.actions.map((action) => action.label),
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
});

/**
 * The selection state always mirrors the current chain's descriptors: one
 * entry per protocol, reconciled by key so a chain switch drops what the new
 * chain does not offer instead of submitting it.
 */
watch(
  protocols,
  (descriptors) => {
    const existingByProtocol = new Map(
      props.modelValue.map((entry) => [entry.protocol, entry]),
    );
    // Normalized on the way through: an action's switch is derived from
    // what its own asset list holds, and a chain switch must not leave one
    // standing on an emptied list.
    const reconciled = normalizeProtocolSelections(
      descriptors,
      initProtocolSelections(descriptors).map(
        (fresh) => existingByProtocol.get(fresh.protocol) ?? fresh,
      ),
    );
    const changed =
      reconciled.length !== props.modelValue.length ||
      reconciled.some((entry, index) => entry !== props.modelValue[index]);
    if (changed) emit("update:modelValue", reconciled);
  },
  { immediate: true },
);

const findProtocol = (protocol: string) =>
  props.modelValue.find((entry) => entry.protocol === protocol);

const isProtocolEnabled = (protocol: string) =>
  findProtocol(protocol)?.enabled ?? false;

/** Immutable update helpers — the parent owns the state. */
const patchState = (
  protocol: string,
  patch: (entry: IProtocolSelectionState) => IProtocolSelectionState,
) => {
  emit(
    "update:modelValue",
    props.modelValue.map((entry) =>
      entry.protocol === protocol ? patch(entry) : entry,
    ),
  );
};

/** An integration handing back a whole new entry for its protocol. */
const replaceEntry = (protocol: string, next: IProtocolSelectionState) => {
  patchState(protocol, () => next);
};

const setProtocolEnabled = (protocol: string, enabled: boolean) => {
  patchState(protocol, (entry) => ({ ...entry, enabled }));
};

const isRawAdded = computed(
  () => rawAdded.value || props.rawEntries.length > 0,
);

/** Everything currently on the card, in the chain's own order. */
const liveKeys = computed<string[]>(() => [
  ...protocols.value
    .filter((protocol) => isProtocolEnabled(protocol.protocol))
    .map((protocol) => protocol.protocol),
  ...(isRawAdded.value ? [RAW_KEY] : []),
]);

/**
 * Keeps the added order in step with the state: whatever left is dropped,
 * whatever arrived goes last. Driven off the state rather than off the add
 * handlers, so an entry enabled any other way — restored, reconciled after
 * a chain switch — still gets a place on the card.
 */
watch(
  liveKeys,
  (keys) => {
    const live = new Set(keys);
    const kept = addedOrder.value.filter((key) => live.has(key));
    const known = new Set(kept);
    const next = [...kept, ...keys.filter((key) => !known.has(key))];
    const changed =
      next.length !== addedOrder.value.length ||
      next.some((key, index) => key !== addedOrder.value[index]);
    if (changed) addedOrder.value = next;
  },
  { immediate: true },
);

type AddedItem =
  | { key: string; kind: "protocol"; descriptor: IProtocolDescriptor }
  | { key: string; kind: "raw" };

const added = computed<AddedItem[]>(() =>
  addedOrder.value.flatMap((key): AddedItem[] => {
    if (key === RAW_KEY) return [{ key, kind: "raw" }];
    const descriptor = protocols.value.find(
      (candidate) => candidate.protocol === key,
    );
    return descriptor ? [{ key, kind: "protocol", descriptor }] : [];
  }),
);

const addProtocol = (protocol: string) => {
  setProtocolEnabled(protocol, true);
  libraryOpen.value = false;
};

/**
 * Off the card, and off the save: a disabled entry compiles to nothing and
 * the authoritative diff revokes what an earlier save granted for it. Its
 * picks stay in the entry, so adding it back after a slip restores them —
 * visibly, since the block reopens with its counts.
 */
const removeProtocol = (protocol: string) => {
  setProtocolEnabled(protocol, false);
};

const addRaw = () => {
  rawAdded.value = true;
  libraryOpen.value = false;
};

const removeRaw = () => {
  rawAdded.value = false;
  if (props.rawEntries.length) emit("update:rawEntries", []);
};

/** What a template covers, for the library row. */
const protocolActions = (descriptor: IProtocolDescriptor): string =>
  descriptor.actions.map((action) => action.label.toLowerCase()).join(" · ");

const rawMeta = computed((): string => {
  const count = props.rawEntries.length;
  if (!count) return "nothing queued yet";
  return `${count} entr${count === 1 ? "y" : "ies"} queued`;
});

/**
 * The tile explains itself only when the library behind it has no
 * protocols to offer — otherwise "Add protocol" is the whole story.
 */
const addHint = computed((): string =>
  protocols.value.length
    ? ""
    : `No protocol templates cover ${chainName.value} yet — raw Roles permissions can still be added.`,
);
</script>

<style scoped lang="scss">
.protocols {
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.625rem 1rem;
  }

  &__title {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__summary {
    font-size: 12px;
    line-height: 1.4;
    color: $color-steel-blue;
    opacity: 0.75;
  }

  &__item {
    border-top: 1px solid $color-line;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
  }

  &__row_text {
    min-width: 0;
    flex: 1;
  }

  &__name {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    color: $color-white;
  }

  &__meta {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
  }

  /* The raw block's mark: the same disc a protocol's logo fills, with a
     glyph instead, since calldata has no logo. */
  &__glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 28px;
    height: 28px;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    font-size: 15px;
    color: $color-cyan;
  }

  &__remove {
    flex: none;
    padding: 0.25rem 0;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-neg;
    }
  }

  &__raw_body {
    padding: 0 1rem 1rem;
  }

  &__add_wrap {
    padding: 0.75rem 1rem 1rem;
    border-top: 1px solid $color-line;

    &--hero {
      padding: 1rem;
    }
  }

  /* Dashed, like every other "put something here" surface in the flow
     (the image drop zone, the fold at the end of an asset list). */
  &__add {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px dashed $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition:
      border-color $default-transition-time ease,
      background-color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      border-color: $color-cyan-line;
      background: $color-gray-light-transparent;

      .protocols__add_title {
        color: $color-white;
      }
    }

    &--hero {
      flex-direction: column;
      justify-content: center;
      gap: 1rem;
      padding: 2.5rem 1.5rem;
      text-align: center;
    }
  }

  &__plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: $color-cyan-tint;
    font-size: 16px;
    color: $color-cyan;
  }

  &__add--hero &__plus {
    width: 56px;
    height: 56px;
    font-size: 32px;
  }

  &__add_text {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__add--hero &__add_text {
    align-items: center;
  }

  &__add_title {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    transition: color $default-transition-time ease;
  }

  &__add--hero &__add_title {
    font-size: 12px;
  }

  &__add_hint {
    max-width: 34rem;
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  @media (prefers-reduced-motion: reduce) {
    &__remove,
    &__add,
    &__add_title {
      transition: none;
    }
  }
}

/**
 * The Zodiac option: a framed block whose top row is the link out and
 * whose second row folds open into the walkthrough.
 */
.zodiac {
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-card-background;
  overflow: hidden;

  &__row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem;
    color: $color-white;
    text-decoration: none;
    transition: background-color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      background: $color-gray-light-transparent;

      .zodiac__open {
        color: $color-white;
      }
    }
  }

  /* A wordmark, not a disc: the file is the name set wide. */
  &__logo {
    flex: none;
    width: auto;
    height: 18px;
  }

  /* The mark is a white monochrome PNG, so on the light theme it inverts to
     ink instead of vanishing into the card. :global because data-theme sits
     on <html>, outside this component's scope. */
  :global([data-theme="light"] .zodiac__logo) {
    filter: invert(1);
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }

  &__meta {
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1.4;
    color: $color-steel-blue;
  }

  &__open {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    flex: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
    transition: color $default-transition-time ease;
  }

  &__disclosure {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.875rem;
    border: none;
    border-top: 1px solid $color-line;
    background: none;
    text-align: left;
    cursor: pointer;

    &:focus-visible {
      outline: none;

      .zodiac__disclosure_title {
        color: $color-white;
      }
    }
  }

  &__chevron {
    flex: none;
    color: $color-steel-blue;
    transition: transform $default-transition-time ease;

    &--open {
      transform: rotate(180deg);
    }
  }

  &__disclosure_title {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.25rem 0.875rem 0.875rem;
  }

  &__steps {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__step {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    font-size: 13px;
    line-height: 1.5;
    color: $color-white;
  }

  &__step_number {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    border: 1px solid $color-cyan-line;
    border-radius: 999px;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-cyan;
  }

  &__step_text {
    min-width: 0;
  }

  /* A Zodiac sidebar entry, quoted: its icon and its word in a small chip,
     so the step points at something recognisable over there. */
  &__nav {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    vertical-align: baseline;
    margin: 0 0.125rem;
    padding: 0.0625rem 0.4375rem 0.0625rem 0.3125rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-gray-light-transparent;
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.4;
    color: $color-white;
    white-space: nowrap;
  }

  &__nav_icon {
    flex: none;
    width: 14px;
    height: 14px;
    color: $color-secondary;
  }

  /* The address to paste into Zodiac, on its own line under the short
     sentence so it can be read and copied whole. */
  &__safe {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
    margin-top: 0.25rem;
  }

  &__safe_address {
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-cyan;
    word-break: break-all;

    &--pending {
      color: $color-steel-blue;
    }
  }

  &__copy {
    flex: none;
    padding: 0;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      color: $color-white;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &__row,
    &__open,
    &__chevron,
    &__copy {
      transition: none;
    }
  }
}

.library {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  /* The modal's title expects an eyebrow above it; without one, the gap
     it leaves for that would just be a title sitting low in its head. */
  &__title {
    margin-top: 0;
  }

  &__lead {
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  &__section_head {
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

  &__badge {
    flex: none;
    padding: 0.125rem 0.375rem;
    border: 1px solid $color-cyan-line;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 9.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  @media (prefers-reduced-motion: reduce) {
    &__item {
      transition: none;
    }
  }
}
</style>
