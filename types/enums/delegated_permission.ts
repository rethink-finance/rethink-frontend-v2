import { encodeFunctionCall } from "web3-eth-abi";
import { formRules } from "~/composables/formRules";
import { prepRoleModEntryInput } from "~/composables/parseNavMethodDetails";
import { InputType } from "~/types/enums/input_type";
import type { IStepperStep } from "~/types/stepper";

import ZodiacRoles from "~/assets/contracts/zodiac/RolesFull.json";
import ZodiacRolesV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import { isWriteFunction } from "~/composables/zodiac-roles/conditions";
import { RolesVersion } from "~/types/enums/roles_version";

export enum DelegatedStep {
  Setup = "setup",
  Details = "details",
}

// define step map
export const DelegatedStepMap: Record<DelegatedStep, IStepperStep> = {
  [DelegatedStep.Setup]: {
    name: "Permission Setup",
    formTitle: "Set up Permission Function",
    key: DelegatedStep.Setup,
  },
  [DelegatedStep.Details]: {
    name: "Proposal Details",
    formTitle: "Provide Proposal Information",
    key: DelegatedStep.Details,
  },
};

// get all methods from ZodiacRoles contract
export const roleModFunctions = ZodiacRoles.abi.filter(
  (func) => func.type === "function",
);
export const roleModFunctionsV2 = ZodiacRolesV2.abi.filter(
  (func) => func.type === "function",
);
// Note: should not use the getWriteFunctions as it is not returning internalType.
const roleModWriteFunctions = roleModFunctions.filter((func) =>
  isWriteFunction(func as any),
);
const roleModWriteFunctionsV2 = roleModFunctionsV2.filter((func) =>
  isWriteFunction(func as any),
);
export const roleModFunctionNameIndexMap: Record<string, number> = {};
roleModFunctions.forEach((func, index) => {
  if (func.name) {
    roleModFunctionNameIndexMap[func.name as string] = index;
  }
});

// make a list of choices for the select field out of the methods
export const roleModMethodChoices = roleModFunctions
  .map((func, i) => {
    return {
      title: func.name,
      value: func.name,
      valueMethodIdx: i,
      isWriteFunction: isWriteFunction(func as any),
    };
  })
  .filter((choice) => choice.isWriteFunction);

// define select field that will be used in all sub steps
const defaultSelectField = {
  label: "Contract Method",
  key: "contractMethod",
  type: InputType.Select,
  defaultValue: roleModMethodChoices[0].value,
  choices: roleModMethodChoices,
};

const parseFuncInputDetails = (input: any) => {
  const numberTypes = ["uint", "int"];
  const textTypes = ["address", "bytes"];
  const boolTypes = ["bool"];
  const addressPlaceholder = "E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  let type = InputType.Text;
  let placeholder = `E.g. ${input.type}`.replace("[]", "");
  let rules = [formRules.required];

  // default values for select boolean select field
  let choices = [] as { title: string; value: any }[];
  let defaultValue;

  if (numberTypes.some((type) => input.type.includes(type))) {
    type = InputType.Number;

    if (input.type.includes("uint8")) {
      rules = [formRules.required, formRules.isValidUint8];
    } else if (input.type.includes("uint16")) {
      rules = [formRules.required, formRules.isValidUint16];
    }
  } else if (textTypes.some((type) => input.type.includes(type))) {
    rules = [formRules.required];
    if (input.type.includes("address")) {
      placeholder = addressPlaceholder;
      rules.push(formRules.isValidAddress);
    }
    if (input.type.includes("bytes")) {
      const byteLength = Number(input.type.replace(/\D/g, "")); // remove all non-digits

      if (byteLength !== 0) {
        placeholder = `E.g. 0x${"00".repeat(byteLength)}`;
        rules.push(formRules.isValidByteLength(byteLength));
      }

      rules.push(formRules.isValidHexString);
    }
  } else if (boolTypes.some((type) => input.type.includes(type))) {
    type = InputType.Select;
    choices = [
      { title: "true", value: true },
      { title: "false", value: false },
    ];
    defaultValue = false;
  }

  return {
    label: input.name,
    key: input.name,
    internalType: input.internalType,
    input,
    type,
    rules,
    placeholder,
    isArray: input.type.includes("[]"),
    choices,
    defaultValue,
  };
};

/**
 * Encode the delegated-permissions form's transactions as calls to the Roles
 * modifier. `version` selects the ABI: the two modifier generations share
 * most function NAMES (scopeTarget, scopeFunction, assignRoles, ...) but not
 * their signatures — V1 takes a uint16 role, V2 a bytes32 role key — so the
 * same form filled for a V2 modifier must be encoded with the V2 fragments,
 * and a name that only exists in the other generation is refused here rather
 * than silently encoded into a call the modifier cannot dispatch.
 */
export const prepPermissionsProposalData = (
  roleModAddress: string,
  transactions: any[],
  version: RolesVersion = RolesVersion.V1,
) => {
  const encodedRoleModEntries = [];
  const targets = [];
  const gasValues = [];
  const stepsMap =
    version === RolesVersion.V2
      ? proposalRoleModMethodStepsMapV2
      : proposalRoleModMethodStepsMap;
  const abiMap =
    version === RolesVersion.V2
      ? roleModWriteFunctionAbiMapV2
      : roleModWriteFunctionAbiMap;

  for (let i = 0; i < transactions.length; i++) {
    const trx = transactions[i];
    const fields = stepsMap[trx.contractMethod];
    const functionAbi = abiMap[trx.contractMethod];
    if (!fields || !functionAbi) {
      const otherVersion =
        version === RolesVersion.V2 ? RolesVersion.V1 : RolesVersion.V2;
      const existsElsewhere =
        otherVersion === RolesVersion.V2
          ? trx.contractMethod in roleModWriteFunctionAbiMapV2
          : trx.contractMethod in roleModWriteFunctionAbiMap;
      throw new Error(
        `${trx.contractMethod} does not exist on a Roles ${version} modifier` +
          (existsElsewhere ? ` (it is a Roles ${otherVersion} function)` : "") +
          ".",
      );
    }
    // Make sure function parameters are in the correct order, take them from function ABI and copy from the trx data
    // that was filled from the form inputs. Then prepare data, parsing/casting to correct types.
    const roleModFunctionData = fields
      .filter((method: any) => method.key !== "contractMethod")
      .map((method: any) =>
        prepRoleModEntryInput({
          ...method,
          data: trx[method.key],
        }),
      );
    const encodedRoleModFunction = encodeFunctionCall(
      functionAbi,
      roleModFunctionData,
    );
    encodedRoleModEntries.push(encodedRoleModFunction);
    targets.push(roleModAddress);
    gasValues.push(0);
  }

  return { encodedRoleModEntries, targets, gasValues };
};

// shape sub step fields for each method from ZodiacRoles contract
export const roleModWriteFunctionAbiMap: Record<string, any> = {};
export const roleModWriteFunctionAbiMapV2: Record<string, any> = {};
export const proposalRoleModMethodStepsMap = roleModWriteFunctions.reduce(
  (acc: any, functionAbi: any) => {
    roleModWriteFunctionAbiMap[functionAbi.name] = functionAbi;
    const subStepFields = functionAbi.inputs.map(parseFuncInputDetails);

    const selectFieldForSubStep = JSON.parse(
      JSON.stringify(defaultSelectField),
    );
    selectFieldForSubStep.defaultValue = functionAbi.name;

    // add select field to the beginning of each sub-step
    acc[functionAbi.name] = [selectFieldForSubStep, ...subStepFields];
    return acc;
  },
  {},
);
export const proposalRoleModMethodStepsMapV2 = roleModWriteFunctionsV2.reduce(
  (acc: any, functionAbi: any) => {
    roleModWriteFunctionAbiMapV2[functionAbi.name] = functionAbi;
    const subStepFields = functionAbi.inputs.map(parseFuncInputDetails);

    const selectFieldForSubStep = JSON.parse(
      JSON.stringify(defaultSelectField),
    );
    selectFieldForSubStep.defaultValue = functionAbi.name;

    // add select field to the beginning of each sub-step
    acc[functionAbi.name] = [selectFieldForSubStep, ...subStepFields];
    return acc;
  },
  {},
);

// define fields map
export const DelegatedPermissionFieldsMap: any = {
  [DelegatedStep.Setup]: proposalRoleModMethodStepsMap,

  [DelegatedStep.Details]: [
    {
      label: "Proposal Title",
      key: "proposalTitle",
      type: InputType.Text,
      placeholder: "E.g. Proposal Title",
      charLimit: 150,
      rules: [formRules.required, formRules.charLimit(150)],
    },
    {
      label: "Proposal Description",
      key: "proposalDescription",
      type: InputType.Textarea,
      placeholder: "E.g. Proposal Description",
      rules: [formRules.required],
    },
    {
      label: "Transactions Overview",
      key: "transactionsOverview",
      type: InputType.ReadonlyJSON,
      required: false,
    },
    {
      label: "Transactions Raw JSON",
      key: "transactionsRawJSON",
      type: InputType.ReadonlyJSON,
      required: false,
    },
  ],
};

export const DelegatedPermissionFieldsMapV2 = {
  ...DelegatedPermissionFieldsMap,
  [DelegatedStep.Setup]: proposalRoleModMethodStepsMapV2,
}
