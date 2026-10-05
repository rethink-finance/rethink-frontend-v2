<template>
  <section class="role_card" :class="{ 'role_card--off': !enabled }">
    <!-- Who this role is, before anything about it can be changed. -->
    <header class="role_card__head">
      <span v-if="!hideNumber" class="role_card__number">Role {{ role.number }}</span>
      <div class="role_card__identity">
        <h3 class="role_card__name">
          {{ role.name }}
        </h3>
        <p class="role_card__tagline">
          {{ role.tagline }}
        </p>
      </div>
      <!-- A role the vault can do without carries its own on/off switch. -->
      <div v-if="optional" class="role_card__enable">
        <span class="role_card__master_label">{{ enabled ? "Enabled" : "Disabled" }}</span>
        <OnboardingToggle
          :model-value="enabled"
          :label="`Enable the ${role.name} role`"
          @update:model-value="(value: boolean) => emit('update:enabled', value)"
        />
      </div>
      <!-- A role added on this step that nothing is stored for yet can be
           taken off again. -->
      <button
        v-else-if="removable"
        type="button"
        class="role_card__remove"
        :aria-label="`Remove the ${role.name} role`"
        @click="emit('remove')"
      >
        Remove
      </button>
    </header>

    <p v-if="!enabled" class="role_card__disabled">
      {{ disabledText }}
    </p>

    <!-- Who holds it. -->
    <OnboardingRoleMembers
      v-if="enabled"
      embedded
      :model-value="members"
      :role-label="role.name"
      :role-key="role.roleKey"
      :chain-id="chainId"
      :roles-mod-address="rolesModAddress"
      :recommend-multisig="recommendMultisig"
      :empty-text="emptyText"
      :leaves-empty-text="leavesEmptyText"
      @update:model-value="(value) => emit('update:members', value)"
    />

    <!-- What it may do, group by group. A group stays folded while it is in
         the state it starts in — on for what a vault needs to run, off for
         what has to be decided — so the card opens on the decisions, and the
         rows are there for whoever wants to change something. -->
    <template v-if="enabled">
      <div v-for="group in role.groups" :key="group.id" class="role_card__group">
        <div class="role_card__section">
          <button
            type="button"
            class="role_card__disclosure"
            :aria-expanded="isOpen(group)"
            @click="toggle(group)"
          >
            <Icon
              class="role_card__chevron"
              :class="{ 'role_card__chevron--open': isOpen(group) }"
              icon="material-symbols:keyboard-arrow-down-rounded"
              width="1.125rem"
              height="1.125rem"
            />
            <span class="role_card__eyebrow">{{ group.title }}</span>
            <span class="role_card__summary">{{ summaryOf(group) }}</span>
          </button>
          <div class="role_card__master">
            <span class="role_card__master_label">Enable all</span>
            <OnboardingToggle
              :model-value="enabledIn(group) === group.permissions.length"
              :label="`Enable all: ${group.title}`"
              @update:model-value="(value: boolean) => setGroup(group, value)"
            />
          </div>
        </div>

        <template v-if="isOpen(group)">
          <p v-if="group.note" class="role_card__note">
            {{ group.note }}
          </p>
          <div
            v-for="option in group.permissions"
            :key="option.key"
            class="role_card__row"
            :class="{ 'role_card__row--off': !permissions[option.key] }"
          >
            <div class="role_card__label">
              <span>{{ option.label }}</span>
              <OnboardingInfoTip
                :text="option.hint"
                :label="`About “${option.label}”`"
                align="left"
              />
            </div>
            <OnboardingToggle
              :model-value="!!permissions[option.key]"
              :label="option.label"
              @update:model-value="(value: boolean) => setOne(option.key, value)"
            />
          </div>
        </template>
      </div>

      <!-- Permissions beyond the vault's own contracts. The step shows its
           protocol card under this one while this is on. -->
      <div v-if="customToggle" class="role_card__section">
        <div class="role_card__disclosure role_card__disclosure--static">
          <span class="role_card__eyebrow">Custom permissions</span>
          <span class="role_card__summary">
            {{ customEnabled ? "Protocol and raw permissions below" : "Off" }}
          </span>
        </div>
        <div class="role_card__master">
          <OnboardingToggle
            :model-value="customEnabled"
            label="Custom permissions"
            @update:model-value="(value: boolean) => emit('update:customEnabled', value)"
          />
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { IAssignMemberChange } from "~/composables/nav/generateNAVPermission";
import type {
  IRolePermissionGroup,
  IVaultRoleDefinition,
} from "~/composables/permissions/vaultRoles";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * One of the vault's roles on the create flow's Permissions step: who holds
 * it, and which of its prepopulated permissions are switched on. Nothing
 * here touches the chain — both lists are intent, applied by the step's
 * save.
 */
const props = withDefaults(defineProps<{
  role: IVaultRoleDefinition;
  /** Queued membership changes for this role. */
  members: IAssignMemberChange[];
  /** The role's switches, keyed like `role.permissions`. A custom role has none. */
  permissions?: Record<string, boolean>;
  chainId?: ChainId;
  rolesModAddress?: string;
  emptyText?: string;
  leavesEmptyText?: string;
  /** Suggest a multisig for this role's members. */
  recommendMultisig?: boolean;
  /** The vault can run without this role: the header offers a switch. */
  optional?: boolean;
  /** Whether the role is in use. Only an optional role can be switched off. */
  enabled?: boolean;
  /** What to say in place of the card's body while the role is off. */
  disabledText?: string;
  /** Offer to take the role off the step again. */
  removable?: boolean;
  /** Leave out the role's number: the tab that opened the card carries it. */
  hideNumber?: boolean;
  /** Offer a switch for permissions beyond the prepopulated ones. */
  customToggle?: boolean;
  /** Whether that switch is on. */
  customEnabled?: boolean;
}>(), {
  permissions: () => ({}),
  chainId: undefined,
  rolesModAddress: undefined,
  emptyText: undefined,
  leavesEmptyText: undefined,
  enabled: true,
  disabledText: "This role is off.",
});

const emit = defineEmits<{
  (e: "update:members", value: IAssignMemberChange[]): void;
  (e: "update:permissions", value: Record<string, boolean>): void;
  (e: "update:enabled", value: boolean): void;
  (e: "update:customEnabled", value: boolean): void;
  (e: "remove"): void;
}>();

const enabledIn = (group: IRolePermissionGroup) =>
  group.permissions.filter((option) => props.permissions[option.key]).length;

/**
 * A switch has no third state, so the count is what says a group is only
 * partly on — otherwise "all on" and "two of three on" would look alike.
 */
const summaryOf = (group: IRolePermissionGroup) => {
  const on = enabledIn(group);
  if (on === group.permissions.length) return "All on";
  if (on === 0) return "All off";
  return `${on} of ${group.permissions.length} on`;
};

/** Is the group as it starts out: everything on, or everything off? */
const isAtDefault = (group: IRolePermissionGroup) =>
  enabledIn(group) === (group.defaultOn ? group.permissions.length : 0);

// A group opens itself when it is not in its starting state, so nobody is
// left looking at an innocent-looking folded row that hides a missing
// permission — or one that was granted and needs its note read.
const opened = ref<string[]>(
  props.role.groups.filter((group) => !isAtDefault(group)).map((group) => group.id),
);
const isOpen = (group: IRolePermissionGroup) => opened.value.includes(group.id);
const open = (group: IRolePermissionGroup) => {
  if (!isOpen(group)) opened.value = [...opened.value, group.id];
};
const toggle = (group: IRolePermissionGroup) => {
  opened.value = isOpen(group)
    ? opened.value.filter((id) => id !== group.id)
    : [...opened.value, group.id];
};

// The parent may set a switch after the card is up (a default that depends
// on the vault being read); a group pushed off its starting state opens.
watch(
  () => props.role.groups.map((group) => isAtDefault(group)),
  (atDefault) => {
    props.role.groups.forEach((group, i) => {
      if (!atDefault[i]) open(group);
    });
  },
);

const setOne = (key: string, value: boolean) =>
  emit("update:permissions", { ...props.permissions, [key]: value });

const setGroup = (group: IRolePermissionGroup, value: boolean) => {
  emit("update:permissions", {
    ...props.permissions,
    ...Object.fromEntries(group.permissions.map((option) => [option.key, value])),
  });
  // Moving a whole group off its starting state is how someone says they
  // want to look at it: the rows (and the group's note) should be there.
  if (value !== group.defaultOn) open(group);
};
</script>

<style scoped lang="scss">
.role_card {
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__head {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1.125rem;
  }

  /* The role's number, as the one accented mark on the card: it is how the
     two roles are told apart at a glance. */
  &__number {
    flex: none;
    padding: 0.3125rem 0.625rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    background: $color-accent-soft;
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
    white-space: nowrap;
  }

  &__identity {
    min-width: 0;
  }

  &__enable {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex: none;
    margin-left: auto;
  }

  &__remove {
    flex: none;
    margin-left: auto;
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
      color: $color-neg;
    }
  }

  /* Switched off, the card keeps its place and its name, and says in one
     line what the vault does without it. */
  &--off &__number {
    border-color: $color-line-2;
    background: none;
    color: $color-steel-blue;
  }

  &--off &__name {
    color: $color-steel-blue;
  }

  &__disabled {
    padding: 0.75rem 1.125rem;
    border-top: 1px solid $color-line;
    font-size: 13px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__name {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  &__tagline {
    margin-top: 1px;
    font-size: 12.5px;
    line-height: 1.4;
    color: $color-steel-blue;
  }

  &__section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1.125rem 0.625rem 0.875rem;
    border-top: 1px solid $color-line;
  }

  &__disclosure {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;

    &:hover .role_card__eyebrow,
    &:focus-visible .role_card__eyebrow {
      color: $color-white;
    }
    &:focus-visible {
      outline: none;
    }

    /* A row with nothing to fold: its title lines up with the groups'. */
    &--static {
      padding-left: calc(1.125rem + 0.5rem);
      cursor: default;

      &:hover .role_card__eyebrow {
        color: $color-steel-blue;
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

  &__eyebrow {
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

  &__master {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex: none;
    margin-left: auto;
  }

  &__master_label {
    font-size: 12px;
    line-height: 1.4;
    color: $color-steel-blue;
  }

  /* What to know before switching anything in the group on. */
  &__note {
    padding: 0.625rem 1.125rem;
    border-top: 1px solid $color-line;
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-warning;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5625rem 1.125rem;
    border-top: 1px solid $color-line;
  }

  &__label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
    font-size: 13px;
    line-height: 1.4;
    color: $color-white;
    transition: color $default-transition-time ease;
  }

  /* A permission that is off reads as off before the switch is found. */
  &__row--off &__label > span {
    color: $color-steel-blue;
  }

  @media (prefers-reduced-motion: reduce) {
    &__label,
    &__chevron {
      transition: none;
    }
  }
}
</style>
