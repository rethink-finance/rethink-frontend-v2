import { ref } from "vue";
import { useRoleStore } from "~/store/role/role.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { parseRawPermissionsJson } from "~/composables/permissions/parseRawPermissionsJson";

/**
 * Composable for handling the import of raw permissions JSON
 *
 * @returns An object containing:
 *   - showAddRawDialog: Ref<boolean> - Controls the visibility of the import dialog
 *   - rawPermissionsJson: Ref<string> - The raw JSON input from the user
 *   - openImportRawDialog: () => void - Opens the import dialog
 *   - importRawPermissions: () => void - Processes and imports the raw permissions
 */
export function useImportRawPermissions() {
  const roleStore = useRoleStore();
  const toastStore = useToastStore();

  // Import raw permissions state
  const showAddRawDialog = ref(false);
  const rawPermissionsJson = ref("");

  // Methods
  const openImportRawDialog = () => (showAddRawDialog.value = true);

  const importRawPermissions = () => {
    try {
      const parsedRawPermissions = parseRawPermissionsJson(JSON.parse(rawPermissionsJson.value));
      if (!parsedRawPermissions) {
        throw new Error("Invalid raw permissions JSON");
      }
      console.log("parsedRawPermissions:", parsedRawPermissions)

      // TODO: add warning if any permission couldnt be imported or stayed in the customPermissions array
      //   eventually it could be displayed below as custom permissions list
      for (const [roleId, targets] of Object.entries(parsedRawPermissions.roleTargets)) {
        console.log("roleId", roleId, "targets", targets);
        if (roleId !== roleStore.roleId) continue;
        for (const target of Object.values(targets)) {
          console.debug("Import Role Target:", roleId, target)
          roleStore.handleAddTarget(target);
        }
      }

      showAddRawDialog.value = false;
      rawPermissionsJson.value = "";
      toastStore.successToast("Raw proposal added successfully");
    } catch (e) {
      console.error(e);
      toastStore.errorToast("Failed to import raw permissions. Make sure that the input is in the correct format.");
    }
  };

  return {
    showAddRawDialog,
    rawPermissionsJson,
    openImportRawDialog,
    importRawPermissions,
  };
}
