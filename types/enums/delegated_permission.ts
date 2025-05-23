import { encodeFunctionCall } from "web3-eth-abi";
import { InputType } from "~/types/enums/input_type";
import type { IStepperStep } from "~/types/stepper";

import ZodiacRoles from "~/assets/contracts/zodiac/RolesFull.json";
import { isWriteFunction } from "~/composables/zodiac-roles/conditions";

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
// Note: should not use the getWriteFunctions as it is not returning internalType.
const roleModWriteFunctions = roleModFunctions.filter(
  func => isWriteFunction(func as any),
);
export const roleModFunctionNameIndexMap: Record<string, number> = {};
roleModFunctions.forEach((func, index) => {
  if (func.name) {
    roleModFunctionNameIndexMap[func.name as string] = index;
  }
})

// make a list of choices for the select field out of the methods
export const roleModMethodChoices = roleModFunctions.map((func,i) => {
  return { title: func.name, value: func.name, valueMethodIdx: i, isWriteFunction: isWriteFunction(func as any) };
}).filter(choice => choice.isWriteFunction);

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
  }
};

export const prepPermissionsProposalData = (roleModAddress: string, transactions: any[]) => {
  const encodedRoleModEntries = [];
  const targets = [];
  const gasValues = [];

  for (let i = 0; i < transactions.length; i++) {
    const trx = transactions[i];
    // Make sure function parameters are in the correct order, take them from function ABI and copy from the trx data
    // that was filled from the form inputs. Then prepare data, parsing/casting to correct types.
    const roleModFunctionData = proposalRoleModMethodStepsMap[
      trx.contractMethod
    ]
      .filter((method: any) => method.key !== "contractMethod")
      .map((method: any) =>
        prepRoleModEntryInput({
          ...method,
          data: trx[method.key],
        }),
      );
    console.warn("roleModFunctionData", trx.contractMethod, roleModFunctionData);
    console.warn("roleModWriteFunctionAbiMap[trx.contractMethod]", roleModWriteFunctionAbiMap[trx.contractMethod]);
    const encodedRoleModFunction = encodeFunctionCall(
      roleModWriteFunctionAbiMap[trx.contractMethod],
      roleModFunctionData,
    );
    encodedRoleModEntries.push(encodedRoleModFunction);
    targets.push(roleModAddress);
    gasValues.push(0);
  }

  return { encodedRoleModEntries, targets, gasValues };
}

// shape sub step fields for each method from ZodiacRoles contract
export const roleModWriteFunctionAbiMap: Record<string, any> = {};
export const proposalRoleModMethodStepsMap = roleModWriteFunctions.reduce((acc: any, functionAbi: any) => {
  roleModWriteFunctionAbiMap[functionAbi.name] = functionAbi;
  const subStepFields = functionAbi.inputs.map(parseFuncInputDetails);

  const selectFieldForSubStep = JSON.parse(JSON.stringify(defaultSelectField));
  selectFieldForSubStep.defaultValue = functionAbi.name;

  // add select field to the beginning of each sub-step
  acc[functionAbi.name] = [selectFieldForSubStep, ...subStepFields];
  return acc;
}, {});

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
