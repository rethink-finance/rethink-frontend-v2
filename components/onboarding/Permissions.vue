<template>
  <FundGovernanceDelegatedPermissions
    ref="delegatedPermissionsRef"
    v-model="delegatedPermissionsEntry"
    :fields-map="DelegatedPermissionFieldsMap"
    submit-label="Store Permissions"
    title="Permissions"
    :always-show-last-step="true"
    @submit="storePermissions"
  />
</template>

<script setup lang="ts">
import {
  DelegatedPermissionFieldsMap,
  DelegatedStep,
  DelegatedStepMap,
  proposalRoleModMethodStepsMap,
} from "~/types/enums/delegated_permission";
import { formatInputToObject } from "~/composables/stepper/formatInputToObject";

const defaultMethod = formatInputToObject(
  proposalRoleModMethodStepsMap.scopeFunction,
);
const delegatedPermissionsEntry = ref([
  {
    stepName: DelegatedStep.Setup,
    stepLabel: DelegatedStepMap[DelegatedStep.Setup].name,
    formTitle: DelegatedStepMap[DelegatedStep.Setup].formTitle,
    formText: DelegatedStepMap[DelegatedStep.Setup].formText,

    // default value when adding a new sub step
    stepDefaultValues: JSON.parse(JSON.stringify(defaultMethod)),

    subStepKey: "contractMethod",
    multipleSteps: true,
    subStepLabel: "Permission",
    // default values for the first sub step
    steps: [defaultMethod],
  },
]);

const storePermissions = () => {
  console.log("storePermissions")
}
</script>


<style scoped lang="scss">
</style>
