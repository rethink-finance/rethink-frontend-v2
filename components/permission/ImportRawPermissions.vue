<template>
  <div>
    <v-btn
      v-if="!disabled"
      class="text-secondary me-4"
      variant="outlined"
      @click="openImportRawDialog"
    >
      Import Raw Permissions
    </v-btn>

    <!-- Import raw permissions JSON modal -->
    <UiConfirmDialog
      v-model="showAddRawDialog"
      title="Import Permissions JSON"
      max-width="80%"
      confirm-text="Import Permissions"
      cancel-text="Cancel"
      @confirm="importRawPermissions"
    >
      <div class="mb-2">
        Enter raw permissions JSON below
      </div>
      <v-textarea
        v-model="rawPermissionsJson"
        label="Raw proposal"
        outlined
        placeholder="Enter the raw proposal here"
        rows="20"
        class="raw-method-textarea"
      />
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { useImportRawPermissions } from "~/composables/permissions/useImportRawPermissions";

defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
});

const {
  showAddRawDialog,
  rawPermissionsJson,
  openImportRawDialog,
  importRawPermissions,
} = useImportRawPermissions();
</script>
