<template>
  <div class="role_members">
    <div class="role_members__head">
      <div class="role_members__title">
        Role members &#183; {{ roleLabel }}
        <button
          v-if="canReadMembers"
          type="button"
          class="role_members__refresh"
          :disabled="isLoadingMembers"
          @click="loadMembers"
        >
          {{ isLoadingMembers ? "Loading…" : "Refresh" }}
        </button>
      </div>
      <div class="role_members__controls">
        <input
          v-model="addressInput"
          class="role_members__input"
          type="text"
          placeholder="0x0000000000000000000000000000000000000000"
          @keyup.enter="queueAdd"
        >
        <button
          type="button"
          class="role_members__button"
          :disabled="!canQueue"
          @click="queueAdd"
        >
          Add member
        </button>
      </div>
    </div>

    <p v-if="error" class="role_members__error">
      {{ error }}
    </p>
    <p v-if="loadError" class="role_members__error">
      {{ loadError }}
    </p>

    <div
      v-for="row in rows"
      :key="row.address"
      class="role_members__row"
    >
      <span class="role_members__address">
        {{ row.address }}
        <span v-if="isSelf(row.address)" class="role_members__self">(you)</span>
      </span>
      <span
        class="role_members__tag"
        :class="{ 'role_members__tag--muted': row.state === 'MEMBER' }"
      >{{ TAG_LABELS[row.state] }}</span>
      <button
        type="button"
        class="role_members__action"
        @click="act(row)"
      >
        {{ row.state === "TO_REMOVE" ? "Undo" : "Remove" }}
      </button>
    </div>

    <div v-if="!rows.length" class="role_members__empty">
      <template v-if="isLoadingMembers">
        Reading members from the modifier…
      </template>
      <template v-else>
        Nobody holds this role. The wallet that initialized the vault normally
        does — add one before saving, or the vault has no manager.
      </template>
    </div>

    <p v-else-if="leavesRoleEmpty" class="role_members__warning">
      These changes leave the role with no members. Nothing would be able to
      update NAV, settle flows or collect fees afterwards.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { fetchRoleMembers } from "~/composables/permissions/useRoleExecution";
import { useAccountStore } from "~/store/account/account.store";
import type { ChainId } from "~/types/enums/chain_id";

type ChangeAction = "ADD" | "REMOVE";
type ChangeItem = { address: string; action: ChangeAction };
type RowState = "MEMBER" | "TO_ADD" | "TO_REMOVE";
type Row = { address: string; state: RowState };

const TAG_LABELS: Record<RowState, string> = {
  MEMBER: "member",
  TO_ADD: "to add",
  TO_REMOVE: "to remove",
};

/**
 * Membership of the manager role: who holds it now, and what the pending
 * save will change. Nothing here touches the chain on its own — queued rows
 * are intent, applied by whatever owns the save (the create flow's
 * submitPermissions, or an execTransactionWithRole from the vault's
 * Permissions page).
 *
 * Pass chainId + rolesModAddress to list current members; without them the
 * component still works as a queue of additions.
 */
const props = defineProps<{
  modelValue: ChangeItem[];
  roleLabel?: string;
  chainId?: ChainId;
  rolesModAddress?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: ChangeItem[]): void;
}>();

const accountStore = useAccountStore();

const addressInput = ref("");
const error = ref("");
const loadError = ref("");
const currentMembers = ref<string[]>([]);
const isLoadingMembers = ref(false);

// "Curator" is the app's name for this role everywhere it is shown (the
// activity feed labels its executions the same way); the on-chain key stays
// "defaulManagerRole".
const roleLabel = computed(() => props.roleLabel || "curator");
const canQueue = computed(() => !!addressInput.value.trim());
const canReadMembers = computed(
  () => !!props.chainId && !!props.rolesModAddress,
);

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const isSelf = (address: string) =>
  eq(address, accountStore.activeAccountAddress || ethers.ZeroAddress);
const pendingFor = (address: string, action: ChangeAction) =>
  (props.modelValue || []).find(
    (item) => eq(item.address, address) && item.action === action,
  );

const loadMembers = async () => {
  if (!canReadMembers.value) {
    currentMembers.value = [];
    return;
  }
  isLoadingMembers.value = true;
  loadError.value = "";
  try {
    currentMembers.value = await fetchRoleMembers(
      props.chainId as ChainId,
      props.rolesModAddress as string,
    );
  } catch (e) {
    console.error("Failed loading role members", e);
    loadError.value =
      "Could not read current members from the modifier. Queued changes " +
      "still apply.";
  } finally {
    isLoadingMembers.value = false;
  }
};

/**
 * Current members first, then queued additions. A queued removal for an
 * address the fetch did not return is still shown, so a failed read never
 * hides a change that is about to be submitted.
 */
const rows = computed<Row[]>(() => {
  const pending = props.modelValue || [];
  const memberRows: Row[] = currentMembers.value.map((address) => ({
    address,
    state: pendingFor(address, "REMOVE") ? "TO_REMOVE" : "MEMBER",
  }));
  const unlistedRemovals: Row[] = pending
    .filter(
      (item) =>
        item.action === "REMOVE" &&
        !currentMembers.value.some((member) => eq(member, item.address)),
    )
    .map((item) => ({ address: item.address, state: "TO_REMOVE" }));
  const additions: Row[] = pending
    .filter((item) => item.action === "ADD")
    .map((item) => ({ address: item.address, state: "TO_ADD" }));

  return [...memberRows, ...unlistedRemovals, ...additions];
});

const leavesRoleEmpty = computed(
  () =>
    rows.value.length > 0 &&
    rows.value.every((row) => row.state === "TO_REMOVE"),
);

const setChanges = (value: ChangeItem[]) => emit("update:modelValue", value);

const queueAdd = () => {
  const address = addressInput.value.trim();
  error.value = "";

  if (!ethers.isAddress(address)) {
    error.value = "Address is not valid.";
    return;
  }

  // Re-adding someone who is queued for removal is an undo, not a second
  // change: assignRoles(false) then assignRoles(true) would just churn gas.
  const queuedRemoval = pendingFor(address, "REMOVE");
  if (queuedRemoval) {
    setChanges((props.modelValue || []).filter((item) => item !== queuedRemoval));
    addressInput.value = "";
    return;
  }
  if (currentMembers.value.some((member) => eq(member, address))) {
    error.value = "That address already holds the role.";
    return;
  }
  if (pendingFor(address, "ADD")) {
    error.value = "That change is already queued.";
    return;
  }

  setChanges([...(props.modelValue || []), { address, action: "ADD" }]);
  addressInput.value = "";
};

const act = (row: Row) => {
  error.value = "";
  const changes = props.modelValue || [];

  // A member on the chain is removed by queueing the revocation; a row that
  // only exists as a queued change is dropped outright.
  if (row.state === "MEMBER") {
    setChanges([...changes, { address: row.address, action: "REMOVE" }]);
    return;
  }
  const action: ChangeAction = row.state === "TO_ADD" ? "ADD" : "REMOVE";
  setChanges(
    changes.filter((item) => item !== pendingFor(row.address, action)),
  );
};

watch(
  () => [props.chainId, props.rolesModAddress],
  () => loadMembers(),
  { immediate: true },
);

defineExpose({ reload: loadMembers });
</script>

<style scoped lang="scss">
.role_members {
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.875rem 1.125rem;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__refresh {
    border: none;
    background: none;
    font: inherit;
    color: $color-cyan;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  &__controls {
    display: flex;
    gap: 0.625rem;
  }

  &__input {
    width: 340px;
    max-width: 100%;
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

  &__button {
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

    &:hover:not(:disabled) {
      border-color: $color-line-3;
    }
    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  &__error {
    padding: 0 1.125rem 0.75rem;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-neg;
  }

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 130px 90px;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.125rem;
    border-top: 1px solid $color-line;
    font-family: $font-mono;
    font-size: 12px;
    color: $color-white;
  }

  &__address {
    word-break: break-all;
  }

  &__self {
    margin-left: 0.375rem;
    color: $color-cyan;
  }

  &__tag {
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;

    &--muted {
      color: $color-steel-blue;
    }
  }

  &__action {
    justify-self: end;
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
    border-top: 1px solid $color-line;
    text-align: center;
    font-size: 13px;
    color: $color-steel-blue;
  }

  &__warning {
    padding: 0.75rem 1.125rem;
    border-top: 1px solid $color-line;
    font-size: 12px;
    line-height: 1.5;
    color: $color-warning;
  }

  @media (prefers-reduced-motion: reduce) {
    &__action {
      transition: none;
    }
  }
}
</style>
