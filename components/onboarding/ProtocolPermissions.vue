<template>
  <div class="protocols">
    <div class="protocols__head">
      <span class="protocols__title">Protocol permissions</span>
    </div>

    <p v-if="!protocols.length" class="protocols__empty">
      No protocol templates are available on {{ chainName }} yet.
    </p>

    <div
      v-for="protocol in protocols"
      :key="protocol.protocol"
      class="protocols__protocol"
    >
      <div class="protocols__row">
        <img
          v-if="!failedProtocolLogos.has(protocol.protocol)"
          class="protocols__logo"
          :src="getProtocolLogoUrl(protocol.protocol)"
          :alt="`${protocol.label} logo`"
          @error="markProtocolLogoFailed(protocol.protocol)"
        >
        <span v-else class="protocols__logo protocols__logo--fallback">
          {{ protocol.label.charAt(0) }}
        </span>
        <div class="protocols__row_text">
          <p class="protocols__name">
            {{ protocol.label }}
          </p>
          <p class="protocols__meta">
            {{ protocolMeta(protocol) }}
          </p>
        </div>
        <OnboardingToggle
          :model-value="isProtocolEnabled(protocol.protocol)"
          :label="`Enable ${protocol.label} permissions`"
          @update:model-value="(v: boolean) => setProtocolEnabled(protocol.protocol, v)"
        />
      </div>

      <template v-if="isProtocolEnabled(protocol.protocol)">
        <div class="protocols__action">
          <div
            v-for="group in primaryGroups(protocol)"
            :key="group.id"
            class="protocols__field"
          >
            <OnboardingProtocolField
              :descriptor="protocol"
              :entry="findProtocol(protocol.protocol)!"
              :group="group"
              :chain-id="chainId"
              @update:entry="(next) => replaceEntry(protocol.protocol, next)"
            />
          </div>

          <!--
            An action no asset picker decides — Spark's stake takes no
            parameters at all — keeps a switch of its own: with nothing to
            pick for it, there is nothing else that could grant or withhold
            it.
          -->
          <div
            v-for="action in primaryActions(protocol)"
            :key="action.action"
            class="protocols__field"
          >
            <OnboardingProtocolSwitchRow
              :label="action.label"
              :hint="action.hint"
              :open="isActionEnabled(protocol.protocol, action.action)"
              :switch-label="`Allow the ${action.label.toLowerCase()} action on ${protocol.label}`"
              @update:open="(v: boolean) => setActionEnabled(protocol.protocol, action.action, v)"
            />
          </div>

          <!--
            Staking and governance delegation are a different errand from
            lending, over a handful of tokens: they wait inside one box the
            switch opens, so the card leads with what a vault is usually
            here for. The header carries the name and the count for
            everything inside, so nothing granted hides behind it and
            nothing inside has to say either again.
          -->
          <div v-if="hasSecondary(protocol)" class="protocols__secondary">
            <!--
              Nothing to disclose when the box holds one parameterless
              action: its own switch IS the grant, and a disclosure over it
              would be the same label and the same switch, twice.
            -->
            <OnboardingProtocolSwitchRow
              v-if="soleSecondaryAction(protocol)"
              :label="secondaryLabel(protocol)"
              :hint="secondaryHint(protocol)"
              :open="isActionEnabled(protocol.protocol, soleSecondaryAction(protocol)!.action)"
              :bordered="false"
              :switch-label="`Allow the ${secondaryLabel(protocol).toLowerCase()} action on ${protocol.label}`"
              @update:open="(v: boolean) => setActionEnabled(protocol.protocol, soleSecondaryAction(protocol)!.action, v)"
            />

            <template v-else>
              <OnboardingProtocolSwitchRow
                :label="secondaryLabel(protocol)"
                :hint="secondaryHint(protocol)"
                :summary="secondarySummary(protocol)"
                :muted="secondaryCount(protocol) === 0"
                :open="isSecondaryOpen(protocol.protocol)"
                :bordered="false"
                :switch-label="`Show ${secondaryLabel(protocol).toLowerCase()} on ${protocol.label}`"
                @update:open="(v: boolean) => setSecondaryOpen(protocol.protocol, v)"
              />

              <div
                v-if="isSecondaryOpen(protocol.protocol)"
                class="protocols__secondary_body"
              >
                <div
                  v-for="group in secondaryParts(protocol).groups"
                  :key="group.id"
                  class="protocols__field"
                >
                  <OnboardingProtocolField
                    :descriptor="protocol"
                    :entry="findProtocol(protocol.protocol)!"
                    :group="group"
                    :chain-id="chainId"
                    :hide-label="group.label === secondaryLabel(protocol)"
                    @update:entry="(next) => replaceEntry(protocol.protocol, next)"
                  />
                </div>

                <div
                  v-for="action in secondaryParts(protocol).actions"
                  :key="action.action"
                  class="protocols__field"
                >
                  <OnboardingProtocolSwitchRow
                    :label="action.label"
                    :hint="action.hint"
                    :open="isActionEnabled(protocol.protocol, action.action)"
                    :switch-label="`Allow the ${action.label.toLowerCase()} action on ${protocol.label}`"
                    @update:open="(v: boolean) => setActionEnabled(protocol.protocol, action.action, v)"
                  />
                </div>
              </div>
            </template>
          </div>
        </div>

        <p
          v-for="issue in issuesFor(protocol.protocol)"
          :key="issue.message"
          class="protocols__error"
        >
          {{ issue.message }}
        </p>

        <!--
          What the choices above actually submit, in the same disclosure
          shape as the prepopulated permissions above them: the card says
          what is granted in words, this says it in calls. Read before
          signing, or never — but it is the only place either is visible
          before the transaction.
        -->
        <div class="protocols__advanced">
          <button
            type="button"
            class="protocols__disclosure"
            :aria-expanded="isAdvancedOpen(protocol.protocol)"
            @click="toggleAdvanced(protocol.protocol)"
          >
            <Icon
              class="protocols__chevron"
              :class="{ 'protocols__chevron--open': isAdvancedOpen(protocol.protocol) }"
              icon="material-symbols:keyboard-arrow-down-rounded"
              width="1.125rem"
              height="1.125rem"
            />
            <span class="protocols__disclosure_title">Generated calls</span>
            <span class="protocols__disclosure_summary">
              {{ previewSummary(protocol.protocol) }}
            </span>
          </button>

          <template v-if="isAdvancedOpen(protocol.protocol)">
            <ul
              v-if="previewFor(protocol.protocol).descriptions.length"
              class="protocols__preview"
            >
              <li
                v-for="(description, index) in previewFor(protocol.protocol).descriptions"
                :key="index"
                class="protocols__preview_row"
              >
                {{ description }}
              </li>
            </ul>
            <p
              v-else-if="previewFor(protocol.protocol).error"
              class="protocols__error protocols__error--inset"
            >
              {{ previewFor(protocol.protocol).error }}
            </p>
            <p v-else class="protocols__preview_note">
              {{ previewNote(protocol.protocol) }}
            </p>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PACKAGE_VERSION } from "@rethink-finance/positions-registry";
import {
  type IProtocolActionDescriptor,
  type IProtocolDescriptor,
  type IProtocolFieldGroup,
  type IProtocolSelectionIssue,
  type IProtocolSelectionState,
  buildProtocolPermissionEntries,
  getActionHint,
  getActionLabel,
  getProtocolLogoUrl,
  getRegistryProtocols,
  governingMembers,
  initProtocolSelections,
  isSecondaryAction,
  isSecondaryGroup,
  normalizeProtocolSelections,
  validateProtocolSelections,
  viewGroup,
} from "~/composables/permissions/protocolPermissions";
import { networksMap } from "~/store/web3/networksMap";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * "Protocol permissions" card for the Roles V2 creation flow: pick protocols
 * from the permissions registry, pick assets (and any other schema-backed
 * setting) per protocol, and the registry compiles the scoped Roles v2
 * grants that join this step's submitPermissions batch.
 *
 * The controls are derived from the registry's schemas at render time
 * (SCHEMA.md: no control without a schema field), so a registry update that
 * adds a protocol or a field shows up here without a frontend change.
 *
 * Controls are per CHOICE, not per action: actions offering the same assets
 * share one picker (see buildFieldGroups), and what a picked asset is used
 * FOR is chosen on the asset itself — each one offering only the scopes its
 * own schema accepts, so a wrapped reserve never shows a staking switch it
 * would reject. The state underneath stays per-action, exactly as the
 * registry's schemas declare it.
 */
const props = defineProps<{
  modelValue: IProtocolSelectionState[];
  chainId: ChainId;
  /** For the generated-calls preview; grants still build without it. */
  rolesModAddress?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: IProtocolSelectionState[]): void;
}>();

const advancedOpen = ref<Set<string>>(new Set());

/** Protocols whose staking/delegation block is expanded. */
const secondaryOpen = ref<Set<string>>(new Set());

/** Protocols whose DefiLlama mark failed to load — shown as a letter disc. */
const failedProtocolLogos = ref<Set<string>>(new Set());

const markProtocolLogoFailed = (protocol: string) => {
  failedProtocolLogos.value = new Set([...failedProtocolLogos.value, protocol]);
};

const protocols = computed<IProtocolDescriptor[]>(() =>
  getRegistryProtocols(props.chainId),
);

const chainName = computed(
  () => networksMap[props.chainId]?.chainName ?? "this chain",
);

const packageVersion = PACKAGE_VERSION;

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

const findAction = (protocol: string, action: string) =>
  findProtocol(protocol)?.actions.find((entry) => entry.action === action);

const isProtocolEnabled = (protocol: string) =>
  findProtocol(protocol)?.enabled ?? false;

const isActionEnabled = (protocol: string, action: string) =>
  findAction(protocol, action)?.enabled ?? false;


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

const patchAction = (
  protocol: string,
  action: string,
  patch: (
    entry: IProtocolSelectionState["actions"][number],
  ) => IProtocolSelectionState["actions"][number],
) => {
  patchState(protocol, (entry) => ({
    ...entry,
    actions: entry.actions.map((candidate) =>
      candidate.action === action ? patch(candidate) : candidate,
    ),
  }));
};

const setProtocolEnabled = (protocol: string, enabled: boolean) => {
  patchState(protocol, (entry) => ({ ...entry, enabled }));
};

const setActionEnabled = (protocol: string, action: string, enabled: boolean) => {
  patchAction(protocol, action, (entry) => ({ ...entry, enabled }));
};

/**
 * What a control holds right now. The controls themselves are rendered by
 * OnboardingProtocolField; the card only asks for counts and for whether a
 * control has anything live behind it.
 *
 * Memoized on the identity of the selection array: every write replaces the
 * array rather than mutating it, so identity is exactly the "has anything
 * changed" signal — and reading it still registers the reactive dependency.
 */
const viewCache = new Map<
  string,
  { state: IProtocolSelectionState[]; view: ReturnType<typeof viewGroup> }
>();

const view = (protocol: string, group: IProtocolFieldGroup) => {
  const state = props.modelValue;
  const key = `${protocol}.${group.id}`;
  const cached = viewCache.get(key);
  if (cached?.state === state) return cached.view;
  const fresh = viewGroup(findProtocol(protocol), group);
  viewCache.set(key, { state, view: fresh });
  return fresh;
};

/** A control handing back a whole new entry for its protocol. */
const replaceEntry = (protocol: string, next: IProtocolSelectionState) => {
  patchState(protocol, () => next);
};

/**
 * Controls with something live behind them. A control whose values ARE the
 * grant always shows: the actions behind it are switched on by picking, so
 * hiding it while it is empty would leave nothing to pick with. The rest —
 * Aave's market, the delegatee address — appear once something is granted
 * through them.
 */
const visibleGroups = (descriptor: IProtocolDescriptor) =>
  descriptor.groups.filter(
    (group) =>
      governingMembers(group).length > 0 ||
      view(descriptor.protocol, group).actions.length > 0,
  );

/**
 * Controls in render order: the protocol's main business first, its side
 * errands after. Descriptor order already puts staking and delegation last,
 * but ordering it here means the disclosure cannot end up mid-card if a
 * registry ever declares the actions the other way round.
 */
const orderedGroups = (descriptor: IProtocolDescriptor) => {
  const groups = visibleGroups(descriptor);
  return [
    ...groups.filter((group) => !isSecondaryGroup(group)),
    ...groups.filter(isSecondaryGroup),
  ];
};

/** The controls the card leads with. */
const primaryGroups = (descriptor: IProtocolDescriptor) =>
  orderedGroups(descriptor).filter((group) => !isSecondaryGroup(group));

/** Parameterless actions that are part of the protocol's main business. */
const primaryActions = (descriptor: IProtocolDescriptor) =>
  standaloneActionsFor(descriptor).filter(
    (action) => !isSecondaryAction(action.action),
  );

/** The side-errand controls and actions, as one block behind one switch. */
const secondaryParts = (descriptor: IProtocolDescriptor) => ({
  groups: orderedGroups(descriptor).filter(isSecondaryGroup),
  actions: standaloneActionsFor(descriptor).filter((action) =>
    isSecondaryAction(action.action),
  ),
});

const hasSecondary = (descriptor: IProtocolDescriptor): boolean => {
  const { groups, actions } = secondaryParts(descriptor);
  return groups.length > 0 || actions.length > 0;
};

const secondaryLabel = (descriptor: IProtocolDescriptor): string => {
  const { groups, actions } = secondaryParts(descriptor);
  // The merged control already carries the family's name ("Stake &
  // delegate"); a protocol with only the parameterless action names itself.
  const named = groups.find((group) => group.members.length > 1);
  if (named) return named.label;
  const labels = [
    ...new Set([
      ...groups.flatMap((group) => group.members.map((m) => m.action)),
      ...actions.map((action) => action.action),
    ]),
  ].map((action) => getActionLabel(action));
  return actionList(labels).replace(/^./, (c) => c.toUpperCase());
};

const secondaryHint = (descriptor: IProtocolDescriptor): string => {
  const { groups, actions } = secondaryParts(descriptor);
  const inside = [
    ...new Set([
      ...groups.flatMap((group) => group.members.map((m) => m.action)),
      ...actions.map((action) => action.action),
    ]),
  ];
  // One action can speak for itself; two would be described by whichever
  // happened to come first, which is how a block named "Stake & delegate"
  // ends up explaining only staking.
  if (inside.length === 1) return getActionHint(inside[0], descriptor.protocol);
  return `Beyond lending: what the vault may ${actionList(inside)}.`;
};

/**
 * How much is granted inside, so a closed block still says so. Counts the
 * parameterless actions too: Spark's stake farm is granted by enabling the
 * protocol, and a box that reported nothing while holding it would hide the
 * very grant it contains.
 */
const secondaryCount = (descriptor: IProtocolDescriptor): number => {
  const { groups, actions } = secondaryParts(descriptor);
  const picked = groups.reduce(
    (count, group) =>
      count +
      (group.control === "multi-select"
        ? view(descriptor.protocol, group).selected.length
        : 0),
    0,
  );
  return (
    picked +
    actions.filter((action) =>
      isActionEnabled(descriptor.protocol, action.action),
    ).length
  );
};

/**
 * The same count as a phrase, in the words the control inside used to say
 * it — the header is now the only place either is said.
 */
const secondarySummary = (descriptor: IProtocolDescriptor): string => {
  const { groups, actions } = secondaryParts(descriptor);
  const parts: string[] = [];
  const lists = groups.filter((group) => group.control === "multi-select");
  if (lists.length) {
    const picked = lists.reduce(
      (count, group) => count + view(descriptor.protocol, group).selected.length,
      0,
    );
    const total = lists.reduce(
      (count, group) => count + view(descriptor.protocol, group).options.length,
      0,
    );
    parts.push(`${picked} of ${total} selected`);
  }
  if (actions.length) {
    const on = actions.filter((action) =>
      isActionEnabled(descriptor.protocol, action.action),
    ).length;
    parts.push(`${on} of ${actions.length} on`);
  }
  return parts.join(" · ");
};

/**
 * A box holding nothing but one parameterless action has nothing to
 * disclose: the header switch grants it directly rather than opening a
 * body that repeats the same label over the same switch.
 */
const soleSecondaryAction = (
  descriptor: IProtocolDescriptor,
): IProtocolActionDescriptor | undefined => {
  const { groups, actions } = secondaryParts(descriptor);
  return groups.length === 0 && actions.length === 1 ? actions[0] : undefined;
};

const isSecondaryOpen = (protocol: string) =>
  secondaryOpen.value.has(protocol);

const setSecondaryOpen = (protocol: string, open: boolean) => {
  const next = new Set(secondaryOpen.value);
  if (open) next.add(protocol);
  else next.delete(protocol);
  secondaryOpen.value = next;
};

/**
 * Actions no picker decides for (Spark's parameterless stake): nothing
 * would grant or withhold them, so they carry their own switch.
 */
const standaloneActionsFor = (
  descriptor: IProtocolDescriptor,
): IProtocolActionDescriptor[] => {
  const governed = new Set(
    descriptor.groups.flatMap((group) =>
      governingMembers(group).map((member) => member.action),
    ),
  );
  return descriptor.actions.filter((action) => !governed.has(action.action));
};

const actionList = (actions: string[]): string => {
  const labels = actions.map((action) => getActionLabel(action).toLowerCase());
  if (labels.length < 2) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
};

const isAdvancedOpen = (protocol: string) => advancedOpen.value.has(protocol);

const toggleAdvanced = (protocol: string) => {
  const next = new Set(advancedOpen.value);
  if (next.has(protocol)) next.delete(protocol);
  else next.add(protocol);
  advancedOpen.value = next;
};

const issues = computed<IProtocolSelectionIssue[]>(() =>
  validateProtocolSelections(props.chainId, props.modelValue, protocols.value),
);

const issuesFor = (protocol: string) =>
  issues.value.filter((issue) => issue.protocol === protocol);

/**
 * Memoized like the control views, and for the same reason: the template
 * asks each protocol's preview several times per render, and answering
 * means compiling that protocol's grants from scratch every time.
 */
const previewCache = new Map<
  string,
  {
    state: IProtocolSelectionState[];
    preview: { descriptions: string[]; error: string };
  }
>();

/**
 * Per-protocol review of what the registry will actually configure, with
 * addresses swapped for the names its data tables know. Built per protocol
 * so the list under "Aave v3" never mixes in another protocol's calls.
 */
const previewFor = (
  protocol: string,
): { descriptions: string[]; error: string } => {
  const key = `${props.chainId}.${props.rolesModAddress ?? ""}.${protocol}`;
  const cached = previewCache.get(key);
  if (cached?.state === props.modelValue) return cached.preview;
  const preview = buildPreview(protocol);
  previewCache.set(key, { state: props.modelValue, preview });
  return preview;
};

const buildPreview = (
  protocol: string,
): { descriptions: string[]; error: string } => {
  const entry = findProtocol(protocol);
  const descriptor = protocols.value.find(
    (candidate) => candidate.protocol === protocol,
  );
  if (!entry?.enabled || !descriptor || issuesFor(protocol).length) {
    return { descriptions: [], error: "" };
  }
  try {
    const build = buildProtocolPermissionEntries({
      chainId: props.chainId,
      // Preview never leaves the page; a placeholder keeps it rendering
      // while the roles modifier is still unknown.
      rolesModAddress:
        props.rolesModAddress || "0x0000000000000000000000000000000000000001",
      selections: [entry],
    });
    return {
      descriptions: build.descriptions.map((description) =>
        friendlyDescription(description, descriptor.addressLabels),
      ),
      error: "",
    };
  } catch (error: any) {
    return { descriptions: [], error: error?.message ?? String(error) };
  }
};

/** What the disclosure says with itself closed. */
const previewSummary = (protocol: string): string => {
  const { descriptions, error } = previewFor(protocol);
  const registry = `registry v${packageVersion}`;
  if (error) return `unavailable · ${registry}`;
  if (!descriptions.length) return `nothing yet · ${registry}`;
  return `${descriptions.length} call${
    descriptions.length === 1 ? "" : "s"
  } · ${registry}`;
};

/**
 * Why the list is empty, when it is. A disclosure that opens onto nothing
 * at all reads as a broken control rather than as an honest "there is
 * nothing to show yet".
 */
const previewNote = (protocol: string): string => {
  if (issuesFor(protocol).length) {
    return "No calls yet — settle the problem above and they appear here.";
  }
  return "No calls yet — nothing on this card is granted.";
};

const friendlyDescription = (
  description: string,
  labels: Record<string, string>,
): string =>
  description.replace(/0x[0-9a-fA-F]{40}/g, (address) => {
    const label = labels[address.toLowerCase()];
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    return label ? `${label} (${short})` : short;
  });

const protocolMeta = (descriptor: IProtocolDescriptor): string => {
  const entry = findProtocol(descriptor.protocol);
  if (!entry?.enabled) {
    const actions = descriptor.actions.map((action) => action.label.toLowerCase());
    return actions.join(" · ");
  }
  // Counted per control, not per action: an asset shared by deposit and
  // borrow is written to both, but reads as the one choice it was. The side
  // errand is left out — its own box says how many of its tokens are
  // picked, and adding them here made this row disagree with the asset
  // control directly beneath it.
  const selected = primaryGroups(descriptor)
    .filter((group) => group.control === "multi-select")
    .reduce(
      (count, group) => count + view(descriptor.protocol, group).selected.length,
      0,
    );
  return `${selected} asset${selected === 1 ? "" : "s"} selected`;
};

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

  &__chevron {
    flex: none;
    color: $color-steel-blue;
    transition: transform $default-transition-time ease;

    &--open {
      transform: rotate(180deg);
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  &__title {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__empty {
    padding: 0.75rem 1rem;
    border-top: 1px solid $color-line;
    font-size: 13px;
    color: $color-steel-blue;
  }

  &__protocol {
    border-top: 1px solid $color-line;
    padding-bottom: 0.25rem;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
  }

  &__logo {
    flex: none;
    width: 28px;
    height: 28px;
    object-fit: contain;
    border-radius: 999px;

    &--fallback {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid $color-line-2;
      font-family: $font-mono;
      font-size: 12px;
      color: $color-steel-blue;
    }
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

  &__action {
    padding: 0 1rem 0.75rem;
  }

  &__field {
    & + & {
      margin-top: 0.75rem;
    }
  }

  /** The box a side errand waits inside: header, then its own controls. */
  &__secondary {
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
  }

  /* A change of subject, not the next field: staking sits well clear of
     the asset list it follows. */
  &__field + &__secondary {
    margin-top: 1.5rem;
  }

  /* No rule under the header — the box's own border already groups these,
     so the gap carries the separation. */
  &__secondary_body {
    padding: 0.25rem 0.75rem 0.75rem;
  }

  &__secondary_body &__field:first-child {
    margin-top: 0;
  }

  &__error {
    padding: 0 1rem 0.5rem;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-neg;

    &--inset {
      padding: 0 0.75rem 0.5rem;
    }
  }

  /* The prepopulated-permissions header, one level in: same chevron, same
     mono title, same summary beside it. */
  &__advanced {
    border-top: 1px solid $color-line;
  }

  &__disclosure {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    min-width: 0;
    padding: 0.5rem 1rem;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;

    &:focus-visible {
      outline: none;

      .protocols__disclosure_title {
        color: $color-white;
      }
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

  &__disclosure_summary {
    font-size: 12px;
    line-height: 1.4;
    color: $color-steel-blue;
    opacity: 0.75;
  }

  &__preview {
    margin: 0;
    padding: 0 1rem 0.75rem;
    list-style: none;
  }

  &__preview_note {
    padding: 0 1rem 0.75rem;
    font-size: 11.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__preview_row {
    padding: 0.25rem 0;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1.5;
    color: $color-steel-blue;
    word-break: break-word;

    & + & {
      border-top: 1px solid $color-line;
    }
  }


}
</style>
