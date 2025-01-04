import { type AbiFunctionFragment } from "web3";
import { encodeFunctionCall } from "web3-eth-abi";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import type INAVMethod from "~/types/nav_method";
import { PositionType } from "~/types/enums/position_type";
import { generateNAVPermission, getMethodsPastNAVUpdateIndex } from "~/composables/nav/generateNAVPermission";
import { NAVExecutorBeaconProxyAddress } from "assets/contracts/rethinkContractAddresses";
import { NAVExecutor } from "assets/contracts/NAVExecutor";
import ZodiacRoles from "assets/contracts/zodiac/RolesFull.json";
import {
  encodedCollectFlowFeesAbiJSON,
  encodedCollectManagerFeesAbiJSON,
  encodedCollectPerformanceFeesAbiJSON,
} from "~/composables/nav/encodedCollectFees";

const updateNavABI = GovernableFund.abi.find(
  (func: any) => func.name === "updateNav" && func.type === "function",
);

const storeNAVDataABI = NAVExecutor.abi.find(
  (func: any) => func.name === "storeNAVData" && func.type === "function",
);

/**
 * Use updateNav ABI to encode NAV methods array <INAVMethod>.
 * @param navMethods<INAVMethod>: a list of NAV methods.
 * @param baseDecimals<number>: base token decimals
 * @param processWithdraw<boolean>: set to true to process withdraws after NAV update
 */
export const encodeUpdateNavMethods = (
  navMethods: INAVMethod[],
  baseDecimals?: number,
  processWithdraw: boolean = false,
) => {
  const navUpdateEntries = [];
  const pastNavUpdateEntryAddresses: any[] = [];

  for (const navEntry of navMethods as INAVMethod[]) {
    // Skip deleted entries in the new proposal.
    if (navEntry.deleted) continue;

    const navEntryDetails = JSON.parse(JSON.stringify(navEntry.details));

    if (navEntry.pastNAVUpdateEntryFundAddress) {
      pastNavUpdateEntryAddresses.push(navEntry.pastNAVUpdateEntryFundAddress);
    }

    let pastNAVUpdateIndex = 0;

    if (navEntry.positionType === PositionType.Liquid) {
      navEntryDetails.liquid = prepNAVMethodLiquid(navEntryDetails);
    } else if (navEntry.positionType === PositionType.Illiquid) {
      if (!baseDecimals) {
        throw new Error("Failed preparing NAV method, base decimals are not known.")
      }
      navEntryDetails.illiquid = prepNAVMethodIlliquid(
        navEntryDetails,
        baseDecimals,
      );
    } else if (navEntry.positionType === PositionType.NFT) {
      navEntryDetails.nft = prepNAVMethodNFT(navEntryDetails);
    } else if (navEntry.positionType === PositionType.Composable) {
      navEntryDetails.composable = prepNAVMethodComposable(navEntryDetails);
    }

    pastNAVUpdateIndex = getMethodsPastNAVUpdateIndex(
      navEntryDetails[navEntry.positionType],
    );

    // Stringify description, if it is not already.
    let descriptionJsonString = navEntryDetails.description;
    if (
      typeof descriptionJsonString === "object" &&
      descriptionJsonString !== null
    ) {
      descriptionJsonString = JSON.stringify(navEntryDetails.description);
    }
    navUpdateEntries.push([
      parseInt(navEntryDetails.entryType),
      toRaw(navEntryDetails.liquid),
      toRaw(navEntryDetails.illiquid),
      toRaw(navEntryDetails.nft),
      toRaw(navEntryDetails.composable),
      navEntryDetails.isPastNAVUpdate,
      pastNAVUpdateIndex,
      parseInt(navEntryDetails.pastNAVUpdateEntryIndex),
      descriptionJsonString,
    ]);
  }
  console.log("navUpdateEntries: ", navUpdateEntries);
  console.log("pastNavUpdateEntryAddresses: ", pastNavUpdateEntryAddresses);
  console.log("processWithdraw: ", processWithdraw);
  const encodedNavUpdateEntries = encodeFunctionCall(
    updateNavABI as AbiFunctionFragment,
    [
      navUpdateEntries,
      pastNavUpdateEntryAddresses,
      processWithdraw,
    ],
  );
  console.log("encodedNavUpdateEntries: ", encodedNavUpdateEntries);
  return encodedNavUpdateEntries;
}


/**
 * Permissions proposal to:
 * allow manager to keep updating NAV based on approved methods.
 * @param encodedNavUpdateEntries
 * @param fundAddress
 * @param fundChainId
 * @param roleModAddress
 */
export const getAllowManagerToUpdateNavCalldata = (
  encodedNavUpdateEntries: any,
  fundAddress: string,
  fundChainId: string,
  roleModAddress: string,
) => {
  const navExecutorAddress = NAVExecutorBeaconProxyAddress(fundChainId);
  const navPermissionEntries = generateNAVPermission(
    fundAddress,
    navExecutorAddress,
  );

  const [encodedRoleModEntries, roleModTargets, roleModGasValues] =
    encodeRoleModEntries(navPermissionEntries, roleModAddress);
  const encodedDataStoreNAVDataNavUpdateEntries =
    encodeFunctionCall(
      storeNAVDataABI as AbiFunctionFragment,
      [fundAddress, encodedNavUpdateEntries],
    );

  return [
    [navExecutorAddress].concat(roleModTargets),
    [0].concat(roleModGasValues),
    [encodedDataStoreNAVDataNavUpdateEntries].concat(encodedRoleModEntries),
  ];
}


const encodeRoleModEntries = (
  proposalEntries: any[],
  roleModAddress: string,
): [any[], any[], any[]] => {
  const proposalRoleModMethods = ZodiacRoles.abi.filter(
    (val) => val.type === "function",
  );
  console.log("roleModAddress: ", roleModAddress);

  const encodedRoleModEntries = [];

  const targets = [];
  const gasValues = [];

  for (let i = 0; i < proposalEntries.length; i++) {
    const roleModFunctionABI =
      proposalRoleModMethods[proposalEntries[i].valueMethodIdx];
    console.log(
      "roleModFunctionABI: ",
      JSON.stringify(roleModFunctionABI, null, 2),
    );
    const roleModFunctionData = [];
    for (let j = 0; j < proposalEntries[i].value.length; j++) {
      /*
        {
          "isArray": false,
          "data": "0xe977757dA5fd73Ca3D2bA6b7B544bdF42bb2CBf6",
          "internalType": "address",
          "name": "module"
        },
      */
      roleModFunctionData.push(
        prepRoleModEntryInput(proposalEntries[i].value[j]),
      );
    }
    const encodedRoleModFunction = encodeFunctionCall(
      roleModFunctionABI as AbiFunctionFragment,
      roleModFunctionData,
    );
    console.log(
      "roleModFunctionData: ",
      i,
      JSON.stringify(roleModFunctionData, null, 2),
    );
    encodedRoleModEntries.push(encodedRoleModFunction);
    targets.push(roleModAddress);
    gasValues.push(0);
  }

  return [encodedRoleModEntries, targets, gasValues];
};



export const getNavMethodsProposalCalldata = (
  encodedNavUpdateEntries: any,
  fundAddress: string,
  collectManagementFees: boolean = false,
  collectPerformanceFees: boolean = false,
) => {
  // Propose NAV update for fund (target: fund addr, payloadL bytes)
  const targetAddresses = [
    fundAddress, // encodedNavUpdateEntries
    fundAddress, // encodedCollectFlowFeesAbiJSON
  ];
  const gasValues = [
    0, // encodedNavUpdateEntries
    0, // encodedCollectFlowFeesAbiJSON
  ];
  const calldatas = [encodedNavUpdateEntries, encodedCollectFlowFeesAbiJSON];

  // Conditionally include collect Management fees.
  console.log("NAV collectManagementFees: ", collectManagementFees);
  if (collectManagementFees) {
    targetAddresses.push(fundAddress);
    gasValues.push(0);
    calldatas.push(encodedCollectManagerFeesAbiJSON);
  }

  // Conditionally include collect Performance fees.
  console.log("NAV collectPerformanceFees: ", collectPerformanceFees);
  if (collectPerformanceFees) {
    targetAddresses.push(fundAddress);
    gasValues.push(0);
    calldatas.push(encodedCollectPerformanceFeesAbiJSON);
  }

  console.log(
    "proposal1:",
    JSON.stringify(
      {
        targetAddresses,
        gasValues,
        calldatas,
      },
      null,
      2,
    ),
  );

  return [
    targetAddresses,
    gasValues,
    calldatas,
  ];
}
