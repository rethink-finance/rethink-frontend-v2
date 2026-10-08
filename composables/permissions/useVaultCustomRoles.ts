import type { IRoleScopeLog } from "~/composables/permissions/roleScopeLogs";
import { listLiveRoleKeys } from "~/composables/permissions/roleScopeLogs";
import {
  type ICustomRole,
  customRoleNameError,
  resolveCustomRoles,
} from "~/composables/permissions/vaultRoles";

/**
 * The custom roles of the vault being created, on the create flow's
 * Permissions step.
 *
 * A Roles modifier keeps no list of roles: one exists once somebody holds it
 * or it is granted something. So a role added on the step is only a name
 * until its first save, and that name has to survive a reload or a walk to
 * another step and back. Names not yet on chain are kept per modifier in the
 * browser; everything else is read off the modifier's own log.
 */
const STORAGE_PREFIX = "rethink:custom-roles:";

// Per modifier, so a remounted step picks the list up where it was.
const drafts = ref<Record<string, string[]>>({});

const readStored = (key: string): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_PREFIX + key) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((name) => typeof name === "string")
      : [];
  } catch {
    return [];
  }
};

const writeStored = (key: string, names: string[]) => {
  try {
    if (names.length) {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(names));
    } else {
      localStorage.removeItem(STORAGE_PREFIX + key);
    }
  } catch {
    // Private mode or a full quota: the names still live for this visit.
  }
};

export const useVaultCustomRoles = (
  chainId: Ref<string | number | undefined>,
  rolesModifier: Ref<string | undefined>,
  /** The modifier's permission log; null until it has been read. */
  logs: Ref<IRoleScopeLog[] | null>,
) => {
  const storageKey = computed(() =>
    rolesModifier.value
      ? `${chainId.value}:${rolesModifier.value.toLowerCase()}`
      : "",
  );

  watch(
    storageKey,
    (key) => {
      if (key && !(key in drafts.value)) {
        drafts.value = { ...drafts.value, [key]: readStored(key) };
      }
    },
    { immediate: true },
  );

  const draftNames = computed(() => drafts.value[storageKey.value] ?? []);
  const setDrafts = (names: string[]) => {
    if (!storageKey.value) return;
    drafts.value = { ...drafts.value, [storageKey.value]: names };
    writeStored(storageKey.value, names);
  };

  const customRoles = computed<ICustomRole[]>(() =>
    resolveCustomRoles(
      logs.value ? listLiveRoleKeys(logs.value) : [],
      draftNames.value,
    ),
  );

  /** Adds a role by name; returns why it could not be added, or "". */
  const addCustomRole = (name: string): string => {
    const trimmed = name.trim();
    const error = customRoleNameError(
      trimmed,
      customRoles.value.map((role) => role.name),
    );
    if (error) return error;
    setDrafts([...draftNames.value, trimmed]);
    return "";
  };

  /** Drops a role nothing has been stored for yet. */
  const removeCustomRole = (role: ICustomRole) => {
    if (role.stored) return;
    setDrafts(draftNames.value.filter((name) => name !== role.name));
  };

  return { customRoles, addCustomRole, removeCustomRole };
};
