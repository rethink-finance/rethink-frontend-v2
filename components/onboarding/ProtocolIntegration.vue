<template>
  <div class="integration">
    <div class="integration__row">
      <OnboardingProtocolLogo
        :protocol="descriptor.protocol"
        :label="descriptor.label"
      />
      <div class="integration__row_text">
        <p class="integration__name">
          {{ descriptor.label }}
        </p>
        <p class="integration__meta">
          {{ meta }}
        </p>
      </div>
      <button
        type="button"
        class="integration__remove"
        :aria-label="`Remove ${descriptor.label}`"
        @click="emit('remove')"
      >
        Remove
      </button>
    </div>

    <div class="integration__body">
      <div
        v-for="group in primaryGroups"
        :key="group.id"
        class="integration__field"
      >
        <OnboardingProtocolField
          :descriptor="descriptor"
          :entry="entry"
          :group="group"
          :chain-id="chainId"
          @update:entry="(next) => emit('update:entry', next)"
        />
      </div>

      <!--
        An action no asset picker decides — Spark's stake takes no
        parameters at all — keeps a switch of its own: with nothing to
        pick for it, there is nothing else that could grant or withhold
        it.
      -->
      <div
        v-for="action in primaryActions"
        :key="action.action"
        class="integration__field"
      >
        <OnboardingProtocolSwitchRow
          :label="action.label"
          :hint="action.hint"
          :open="isActionEnabled(action.action)"
          :switch-label="`Allow the ${action.label.toLowerCase()} action on ${descriptor.label}`"
          @update:open="(v: boolean) => setActionEnabled(action.action, v)"
        />
      </div>

      <!--
        Staking and governance delegation are a different errand from
        lending, over a handful of tokens: they wait inside one box the
        switch opens, so the block leads with what a vault is usually
        here for. The header carries the name and the count for
        everything inside, so nothing granted hides behind it and
        nothing inside has to say either again.
      -->
      <div v-if="hasSecondary" class="integration__secondary">
        <!--
          Nothing to disclose when the box holds one parameterless
          action: its own switch IS the grant, and a disclosure over it
          would be the same label and the same switch, twice.
        -->
        <OnboardingProtocolSwitchRow
          v-if="soleSecondaryAction"
          :label="secondaryLabel"
          :hint="secondaryHint"
          :open="isActionEnabled(soleSecondaryAction.action)"
          :bordered="false"
          :switch-label="`Allow the ${secondaryLabel.toLowerCase()} action on ${descriptor.label}`"
          @update:open="(v: boolean) => setActionEnabled(soleSecondaryAction!.action, v)"
        />

        <template v-else>
          <OnboardingProtocolSwitchRow
            :label="secondaryLabel"
            :hint="secondaryHint"
            :summary="secondarySummary"
            :muted="secondaryCount === 0"
            :open="secondaryOpen"
            :bordered="false"
            :switch-label="`Show ${secondaryLabel.toLowerCase()} on ${descriptor.label}`"
            @update:open="(v: boolean) => (secondaryOpen = v)"
          />

          <div v-if="secondaryOpen" class="integration__secondary_body">
            <div
              v-for="group in secondaryParts.groups"
              :key="group.id"
              class="integration__field"
            >
              <OnboardingProtocolField
                :descriptor="descriptor"
                :entry="entry"
                :group="group"
                :chain-id="chainId"
                :hide-label="group.label === secondaryLabel"
                @update:entry="(next) => emit('update:entry', next)"
              />
            </div>

            <div
              v-for="action in secondaryParts.actions"
              :key="action.action"
              class="integration__field"
            >
              <OnboardingProtocolSwitchRow
                :label="action.label"
                :hint="action.hint"
                :open="isActionEnabled(action.action)"
                :switch-label="`Allow the ${action.label.toLowerCase()} action on ${descriptor.label}`"
                @update:open="(v: boolean) => setActionEnabled(action.action, v)"
              />
            </div>
          </div>
        </template>
      </div>
    </div>

    <p
      v-for="issue in issues"
      :key="issue.message"
      class="integration__error"
    >
      {{ issue.message }}
    </p>

    <!--
      What the choices above actually submit, in the same disclosure
      shape as the prepopulated permissions above them: the block says
      what is granted in words, this says it in calls. Read before
      signing, or never — but it is the only place either is visible
      before the transaction.
    -->
    <div class="integration__advanced">
      <button
        type="button"
        class="integration__disclosure"
        :aria-expanded="advancedOpen"
        @click="advancedOpen = !advancedOpen"
      >
        <Icon
          class="integration__chevron"
          :class="{ 'integration__chevron--open': advancedOpen }"
          icon="material-symbols:keyboard-arrow-down-rounded"
          width="1.125rem"
          height="1.125rem"
        />
        <span class="integration__disclosure_title">Generated calls</span>
        <span class="integration__disclosure_summary">
          {{ previewSummary }}
        </span>
      </button>

      <template v-if="advancedOpen">
        <ul v-if="preview.descriptions.length" class="integration__preview">
          <li
            v-for="(description, index) in preview.descriptions"
            :key="index"
            class="integration__preview_row"
          >
            {{ description }}
          </li>
        </ul>
        <p
          v-else-if="preview.error"
          class="integration__error integration__error--inset"
        >
          {{ preview.error }}
        </p>
        <p v-else class="integration__preview_note">
          {{ previewNote }}
        </p>
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
  governingMembers,
  isSecondaryAction,
  isSecondaryGroup,
  validateProtocolSelections,
  viewGroup,
} from "~/composables/permissions/protocolPermissions";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * One protocol added to the "Protocol integrations" card, open: its asset
 * pickers (and any other schema-backed setting), the side errand behind its
 * own switch, the problems that would stop a save, and the calls the
 * registry compiles from all of it.
 *
 * The controls are derived from the registry's schemas at render time
 * (SCHEMA.md: no control without a schema field), so a registry update that
 * adds a field shows up here without a frontend change.
 *
 * Controls are per CHOICE, not per action: actions offering the same assets
 * share one picker (see buildFieldGroups), and what a picked asset is used
 * FOR is chosen on the asset itself — each one offering only the scopes its
 * own schema accepts, so a wrapped reserve never shows a staking switch it
 * would reject. The state underneath stays per-action, exactly as the
 * registry's schemas declare it.
 *
 * Owns no selection state: the card passes the protocol's entry in and takes
 * a new one back.
 */
const props = defineProps<{
  descriptor: IProtocolDescriptor;
  entry: IProtocolSelectionState;
  chainId: ChainId;
  /** For the generated-calls preview; grants still build without it. */
  rolesModAddress?: string;
}>();

const emit = defineEmits<{
  (e: "update:entry", value: IProtocolSelectionState): void;
  (e: "remove"): void;
}>();

const advancedOpen = ref(false);

/** Whether the staking/delegation block is expanded. */
const secondaryOpen = ref(false);

const packageVersion = PACKAGE_VERSION;

const findAction = (action: string) =>
  props.entry.actions.find((candidate) => candidate.action === action);

const isActionEnabled = (action: string) =>
  findAction(action)?.enabled ?? false;

const setActionEnabled = (action: string, enabled: boolean) => {
  emit("update:entry", {
    ...props.entry,
    actions: props.entry.actions.map((candidate) =>
      candidate.action === action ? { ...candidate, enabled } : candidate,
    ),
  });
};

/**
 * What a control holds right now. The controls themselves are rendered by
 * OnboardingProtocolField; this block only asks for counts and for whether
 * a control has anything live behind it.
 *
 * Memoized on the identity of the entry AND the group: every write replaces
 * the entry rather than mutating it, so identity is exactly the "has
 * anything changed" signal, and a chain switch rebuilds the descriptor's
 * groups, which is what keeps a view from outliving the options it was
 * computed over. Reading props.entry still registers the reactive
 * dependency.
 */
const viewCache = new Map<
  string,
  {
    entry: IProtocolSelectionState;
    group: IProtocolFieldGroup;
    view: ReturnType<typeof viewGroup>;
  }
>();

const view = (group: IProtocolFieldGroup) => {
  const entry = props.entry;
  const cached = viewCache.get(group.id);
  if (cached?.entry === entry && cached.group === group) return cached.view;
  const fresh = viewGroup(entry, group);
  viewCache.set(group.id, { entry, group, view: fresh });
  return fresh;
};

/**
 * Controls with something live behind them. A control whose values ARE the
 * grant always shows: the actions behind it are switched on by picking, so
 * hiding it while it is empty would leave nothing to pick with. The rest —
 * Aave's market, the delegatee address — appear once something is granted
 * through them.
 */
const visibleGroups = computed(() =>
  props.descriptor.groups.filter(
    (group) =>
      governingMembers(group).length > 0 || view(group).actions.length > 0,
  ),
);

/**
 * Controls in render order: the protocol's main business first, its side
 * errands after. Descriptor order already puts staking and delegation last,
 * but ordering it here means the disclosure cannot end up mid-block if a
 * registry ever declares the actions the other way round.
 */
const orderedGroups = computed(() => [
  ...visibleGroups.value.filter((group) => !isSecondaryGroup(group)),
  ...visibleGroups.value.filter(isSecondaryGroup),
]);

/** The controls the block leads with. */
const primaryGroups = computed(() =>
  orderedGroups.value.filter((group) => !isSecondaryGroup(group)),
);

/**
 * Actions no picker decides for (Spark's parameterless stake): nothing
 * would grant or withhold them, so they carry their own switch.
 */
const standaloneActions = computed<IProtocolActionDescriptor[]>(() => {
  const governed = new Set(
    props.descriptor.groups.flatMap((group) =>
      governingMembers(group).map((member) => member.action),
    ),
  );
  return props.descriptor.actions.filter(
    (action) => !governed.has(action.action),
  );
});

/** Parameterless actions that are part of the protocol's main business. */
const primaryActions = computed(() =>
  standaloneActions.value.filter((action) => !isSecondaryAction(action.action)),
);

/** The side-errand controls and actions, as one block behind one switch. */
const secondaryParts = computed(() => ({
  groups: orderedGroups.value.filter(isSecondaryGroup),
  actions: standaloneActions.value.filter((action) =>
    isSecondaryAction(action.action),
  ),
}));

const hasSecondary = computed(
  () =>
    secondaryParts.value.groups.length > 0 ||
    secondaryParts.value.actions.length > 0,
);

const actionList = (actions: string[]): string => {
  const labels = actions.map((action) => getActionLabel(action).toLowerCase());
  if (labels.length < 2) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
};

const secondaryActionKeys = computed(() => [
  ...new Set([
    ...secondaryParts.value.groups.flatMap((group) =>
      group.members.map((member) => member.action),
    ),
    ...secondaryParts.value.actions.map((action) => action.action),
  ]),
]);

const secondaryLabel = computed((): string => {
  // The merged control already carries the family's name ("Stake &
  // delegate"); a protocol with only the parameterless action names itself.
  const named = secondaryParts.value.groups.find(
    (group) => group.members.length > 1,
  );
  if (named) return named.label;
  const labels = secondaryActionKeys.value.map((action) =>
    getActionLabel(action),
  );
  return actionList(labels).replace(/^./, (c) => c.toUpperCase());
});

const secondaryHint = computed((): string => {
  const inside = secondaryActionKeys.value;
  // One action can speak for itself; two would be described by whichever
  // happened to come first, which is how a block named "Stake & delegate"
  // ends up explaining only staking.
  if (inside.length === 1) {
    return getActionHint(inside[0], props.descriptor.protocol);
  }
  return `Beyond lending: what the vault may ${actionList(inside)}.`;
});

/**
 * How much is granted inside, so a closed block still says so. Counts the
 * parameterless actions too: Spark's stake farm is granted by adding the
 * protocol, and a box that reported nothing while holding it would hide the
 * very grant it contains.
 */
const secondaryCount = computed((): number => {
  const { groups, actions } = secondaryParts.value;
  const picked = groups.reduce(
    (count, group) =>
      count +
      (group.control === "multi-select" ? view(group).selected.length : 0),
    0,
  );
  return (
    picked +
    actions.filter((action) => isActionEnabled(action.action)).length
  );
});

/**
 * The same count as a phrase, in the words the control inside used to say
 * it — the header is now the only place either is said.
 */
const secondarySummary = computed((): string => {
  const { groups, actions } = secondaryParts.value;
  const parts: string[] = [];
  const lists = groups.filter((group) => group.control === "multi-select");
  if (lists.length) {
    const picked = lists.reduce(
      (count, group) => count + view(group).selected.length,
      0,
    );
    const total = lists.reduce(
      (count, group) => count + view(group).options.length,
      0,
    );
    parts.push(`${picked} of ${total} selected`);
  }
  if (actions.length) {
    const on = actions.filter((action) => isActionEnabled(action.action))
      .length;
    parts.push(`${on} of ${actions.length} on`);
  }
  return parts.join(" · ");
});

/**
 * A box holding nothing but one parameterless action has nothing to
 * disclose: the header switch grants it directly rather than opening a
 * body that repeats the same label over the same switch.
 */
const soleSecondaryAction = computed(
  (): IProtocolActionDescriptor | undefined => {
    const { groups, actions } = secondaryParts.value;
    return groups.length === 0 && actions.length === 1 ? actions[0] : undefined;
  },
);

const issues = computed<IProtocolSelectionIssue[]>(() =>
  validateProtocolSelections(props.chainId, [props.entry], [props.descriptor]),
);

/**
 * What the registry will actually configure for this protocol, with
 * addresses swapped for the names its data tables know. A computed, so the
 * compile runs once per change of the entry rather than once per read.
 */
const preview = computed((): { descriptions: string[]; error: string } => {
  if (!props.entry.enabled || issues.value.length) {
    return { descriptions: [], error: "" };
  }
  try {
    const build = buildProtocolPermissionEntries({
      chainId: props.chainId,
      // Preview never leaves the page; a placeholder keeps it rendering
      // while the roles modifier is still unknown.
      rolesModAddress:
        props.rolesModAddress || "0x0000000000000000000000000000000000000001",
      selections: [props.entry],
    });
    return {
      descriptions: build.descriptions.map((description) =>
        friendlyDescription(description, props.descriptor.addressLabels),
      ),
      error: "",
    };
  } catch (error: any) {
    return { descriptions: [], error: error?.message ?? String(error) };
  }
});

/** What the disclosure says with itself closed. */
const previewSummary = computed((): string => {
  const { descriptions, error } = preview.value;
  const registry = `registry v${packageVersion}`;
  if (error) return `unavailable · ${registry}`;
  if (!descriptions.length) return `nothing yet · ${registry}`;
  return `${descriptions.length} call${
    descriptions.length === 1 ? "" : "s"
  } · ${registry}`;
});

/**
 * Why the list is empty, when it is. A disclosure that opens onto nothing
 * at all reads as a broken control rather than as an honest "there is
 * nothing to show yet".
 */
const previewNote = computed((): string => {
  if (issues.value.length) {
    return "No calls yet — settle the problem above and they appear here.";
  }
  return "No calls yet — nothing on this integration is granted.";
});

const friendlyDescription = (
  description: string,
  labels: Record<string, string>,
): string =>
  description.replace(/0x[0-9a-fA-F]{40}/g, (address) => {
    const label = labels[address.toLowerCase()];
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    return label ? `${label} (${short})` : short;
  });

/**
 * Counted per control, not per action: an asset shared by deposit and
 * borrow is written to both, but reads as the one choice it was. The side
 * errand is left out — its own box says how many of its tokens are picked,
 * and adding them here made this row disagree with the asset control
 * directly beneath it.
 */
const meta = computed((): string => {
  const selected = primaryGroups.value
    .filter((group) => group.control === "multi-select")
    .reduce((count, group) => count + view(group).selected.length, 0);
  return `${selected} asset${selected === 1 ? "" : "s"} selected`;
});
</script>

<style scoped lang="scss">
.integration {
  padding-bottom: 0.25rem;

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

  /* Takes the integration off the card. Quiet until pointed at — it is the
     one control on the row a slip of the hand should not find easily. */
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

  &__body {
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

      .integration__disclosure_title {
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

  @media (prefers-reduced-motion: reduce) {
    &__remove,
    &__chevron {
      transition: none;
    }
  }
}
</style>
