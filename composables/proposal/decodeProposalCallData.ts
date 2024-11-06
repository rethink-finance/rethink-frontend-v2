import { eth } from "web3";
import type { AbiFunctionFragment, AbiInput } from "web3";
import { cleanComplexWeb3Data } from "~/composables/utils";
import { ProposalCalldataType } from "~/types/enums/proposal_calldata_type";
import GnosisSafeL2JSON from "~/assets/contracts/safe/GnosisSafeL2_v1_3_0.json";
import ZodiacRoles from "~/assets/contracts/zodiac/RolesFull.json";
import { GovernableFund } from "~/assets/contracts/GovernableFund";


export const decodeProposalCallData = (
  roleModAddress: string,
  calldata: string,
  targetAddress: string,
  safeAddress: string,
): Record<any, any> | undefined => {
  // Iterate over each method in ABI to find a match
  const signature = calldata.slice(0, 10);
  const encodedParameters = calldata.slice(10);
  const functionAbi = functionSignaturesMap[signature];

  if (!functionAbi?.function?.name) {
    console.warn(
      "No existing function signature found in the GovernableFund ABI for ",
      signature,
      functionAbi,
    );
    return undefined;
  }
  const functionAbiInputs = functionAbi?.function?.inputs as AbiInput[];

  try {
    let decoded = eth.abi.decodeParameters(
      functionAbiInputs,
      encodedParameters,
    );
    decoded = cleanComplexWeb3Data(decoded);

    let calldataType = ProposalCalldataType.UNDEFINED;
    const functionName = functionAbi.function.name;
    const targetAddressLowerCase = targetAddress.toLocaleLowerCase();

    if (functionName === "updateNav") {
      calldataType = ProposalCalldataType.NAV_UPDATE;
    } else if (targetAddressLowerCase === safeAddress?.toLocaleLowerCase()) {
      calldataType = ProposalCalldataType.DIRECT_EXECUTION;
    } else if (targetAddressLowerCase === roleModAddress?.toLocaleLowerCase()) {
      calldataType = ProposalCalldataType.PERMISSIONS;
    } else if(functionName === "updateSettings") {
      calldataType = ProposalCalldataType.FUND_SETTINGS;
    }

    return {
      functionName,
      contractName: functionAbi.contractName,
      calldataType,
      calldataDecoded: decoded,
      calldata,
    };
  } catch (error: any) {
    console.error("error while decoding signature: ", signature, error);
  }
  console.error(
    "FAILED decoding signature: ",
    signature,
    functionSignaturesMap[signature],
  );

  return undefined;
};

/**
 * Extract all function signatures from GovernableFund ABI
 * Iterate over all functions in GovernableFund ABI and generate a map of functionSignatureHash as key
 * and ABI function fragment as value. This will be used when decoding proposal call datas.
 */
const functionSignaturesMap: Record<string, any> = {};

// Iterate over different ABIs to extract function signatures that will later be used
// to decode proposal call data.
const contractsToExtractFunctionSignatures = [
  {
    abi: GovernableFund.abi,
    name: "GovernableFund",
  },
  {
    abi: GnosisSafeL2JSON.abi,
    name: "GnosisSafeL2",
  },
  {
    abi: ZodiacRoles.abi,
    name: "ZodiacRoles",
  },
];

contractsToExtractFunctionSignatures.forEach(contract => {
  contract.abi.forEach(item => {
    if (item.type === "function") {
      const functionSignatureHash = eth.abi.encodeFunctionSignature(item as AbiFunctionFragment);
      functionSignaturesMap[functionSignatureHash] = {
        function: item,
        contractName: contract.name,
      };
    }
  });
});
