import { toRaw } from "vue";
import { type AbiFunctionFragment } from "web3";
import { decodeFunctionCall, encodeFunctionCall } from "web3-eth-abi";
import { NAVExecutor } from "assets/contracts/NAVExecutor";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import {
  prepNAVMethodComposable,
  prepNAVMethodIlliquid,
  prepNAVMethodLiquid,
  prepNAVMethodNFT,
  prepRoleModEntryInput,
} from "~/composables/parseNavMethodDetails";
import { useContractAddresses } from "~/composables/useContractAddresses";
import {
  encodedCollectFlowFeesAbiJSON,
  encodedCollectManagerFeesAbiJSON,
  encodedCollectPerformanceFeesAbiJSON,
} from "~/composables/nav/encodedCollectFees";
import {
  DEFAULT_ROLE_KEY,
  DEFAULT_ROLE_KEY_V2,
  generateNAVPermission,
  generateNAVPermissionRolesV2,
  getMethodsPastNAVUpdateIndex,
} from "~/composables/nav/generateNAVPermission";
import type { ChainId } from "~/types/enums/chain_id";
import { roleModFunctions } from "~/types/enums/delegated_permission";
import { PositionType } from "~/types/enums/position_type";
import { RolesVersion } from "~/types/enums/roles_version";
import type INAVMethod from "~/types/nav_method";
import type IProposalData from "~/types/proposal/proposalData";

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
): string => {
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

export const decodeUpdateNavMethods = (
  encodedNavMethods: string,
): any => decodeFunctionCall(
  updateNavABI as AbiFunctionFragment,
  encodedNavMethods,
)


/** storeNAVData(fund, updateNavCalldata) — the NAV executor's copy. */
export const encodeStoreNAVData = (
  fundAddress: string,
  encodedNavUpdateEntries: string,
): string =>
  encodeFunctionCall(storeNAVDataABI as AbiFunctionFragment, [
    fundAddress,
    encodedNavUpdateEntries,
  ]);

/**
 * The NAV-methods proposal: updateNav on the vault, then — when the chain's
 * NAV executor is given — storeNAVData on it with the SAME calldata, then the
 * fee collections.
 *
 * The executor copy belongs in this proposal, not in the optional
 * permissions one: the manager's Update NAV button (executeNAVUpdate) never
 * reads the vault's method list, it replays whatever the executor stores, and
 * storeNAVData is governor-only. A proposal that changes the vault's methods
 * without refreshing that copy leaves the manager replaying the OLD list —
 * on INDEFI that was 26 methods at 17.5M gas, above Base's transaction cap,
 * while the vault itself already held two.
 */
export const getNavMethodsProposalData = (
  encodedNavUpdateEntries: any,
  fundAddress: string,
  collectFlowFees: boolean = false,
  collectManagementFees: boolean = false,
  collectPerformanceFees: boolean = false,
  navExecutorAddress?: string,
): IProposalData => {
  // Propose NAV update for fund (target: fund addr, payloadL bytes)
  const targets = [fundAddress];
  const gasValues = [0];
  const calldatas = [encodedNavUpdateEntries];

  if (navExecutorAddress) {
    targets.push(navExecutorAddress);
    gasValues.push(0);
    calldatas.push(encodeStoreNAVData(fundAddress, encodedNavUpdateEntries));
  }

  // Conditionally include collect Flow fees.
  console.log("NAV collectFlowFees: ", collectFlowFees);
  if (collectFlowFees) {
    targets.push(fundAddress);
    gasValues.push(0);
    calldatas.push(encodedCollectFlowFeesAbiJSON);
  }

  // Conditionally include collect Management fees.
  console.log("NAV collectManagementFees: ", collectManagementFees);
  if (collectManagementFees) {
    targets.push(fundAddress);
    gasValues.push(0);
    calldatas.push(encodedCollectManagerFeesAbiJSON);
  }

  // Conditionally include collect Performance fees.
  console.log("NAV collectPerformanceFees: ", collectPerformanceFees);
  if (collectPerformanceFees) {
    targets.push(fundAddress);
    gasValues.push(0);
    calldatas.push(encodedCollectPerformanceFeesAbiJSON);
  }

  return {
    targets,
    gasValues,
    calldatas,
  };
}


/**
 * Permissions proposal to:
 * allow manager to keep updating NAV based on approved methods.
 * Kept for callers that want the executor copy bundled with the permission
 * calls; the NAV manage page now ships the copy in the methods proposal
 * itself (see getNavMethodsProposalData) and only adds the permissions.
 * @param encodedNavUpdateEntries
 * @param fundAddress
 * @param fundChainId
 * @param roleModAddress
 * @param version which modifier generation `roleModAddress` is (probe it —
 *                see resolveRolesModifierProfile); defaults to V1, which is
 *                what this used to assume unconditionally
 * @param role the manager's role on that modifier
 */
export const getAllowManagerToUpdateNavProposalData = (
  encodedNavUpdateEntries: any,
  fundAddress: string,
  fundChainId: ChainId,
  roleModAddress: string,
  version: RolesVersion = RolesVersion.V1,
  role?: string,
): IProposalData => {
  const { getNAVExecutorBeaconProxyAddress } = useContractAddresses();
  const navExecutorAddress = getNAVExecutorBeaconProxyAddress(fundChainId);

  const permissionsData = buildManagerNavPermissionCalls(
    fundAddress,
    navExecutorAddress,
    roleModAddress,
    version,
    role,
  );

  return {
    targets: [navExecutorAddress].concat(permissionsData.targets),
    gasValues: [0].concat(permissionsData.gasValues),
    calldatas: [encodeStoreNAVData(fundAddress, encodedNavUpdateEntries)].concat(
      permissionsData.calldatas,
    ),
  };
}

export const getAllowManagerToUpdateNavPermissionsData = (
  fundAddress: string,
  fundChainId: ChainId,
  roleModAddress: string,
  version: RolesVersion = RolesVersion.V1,
  role?: string,
): IProposalData => {
  const { getNAVExecutorBeaconProxyAddress } = useContractAddresses();
  const navExecutorAddress = getNAVExecutorBeaconProxyAddress(fundChainId);
  return buildManagerNavPermissionCalls(
    fundAddress,
    navExecutorAddress,
    roleModAddress,
    version,
    role,
  );
}

/**
 * The two modifier calls that let `role` run executeNAVUpdate(navExecutor)
 * on the vault, encoded for the modifier generation actually deployed:
 *
 * - V1: scopeFunction(uint16 role, fund, 0xa61f5814, [scoped], [Static],
 *       [EqualTo], [navExecutor], options) + scopeTarget(uint16 role, fund)
 * - V2: scopeFunction(bytes32 roleKey, fund, 0xa61f5814, conditions
 *       [Calldata/Matches, Static/EqualTo navExecutor], None) +
 *       scopeTarget(bytes32 roleKey, fund)
 *
 * Pure: no store access, so it can be unit-tested and the page can show
 * what it is about to propose. `role` is the id as the modifier reports it
 * (a decimal string on V1; a bytes32 hex or the "defaulManagerRole" label on
 * V2) and defaults to the role Rethink vaults are created with.
 */
export const buildManagerNavPermissionCalls = (
  fundAddress: string,
  navExecutorAddress: string,
  roleModAddress: string,
  version: RolesVersion,
  role?: string,
): IProposalData => {
  if (version === RolesVersion.V2) {
    const calldatas = generateNAVPermissionRolesV2(
      fundAddress,
      navExecutorAddress,
      role ?? DEFAULT_ROLE_KEY_V2,
    );
    return {
      targets: calldatas.map(() => roleModAddress),
      gasValues: calldatas.map(() => 0),
      calldatas,
    };
  }

  const navPermissionEntries = generateNAVPermission(
    fundAddress,
    navExecutorAddress,
    role ?? DEFAULT_ROLE_KEY,
  );
  const [encodedRoleModEntries, roleModTargets, roleModGasValues] =
    encodeRoleModEntries(navPermissionEntries, roleModAddress);

  return {
    targets: roleModTargets,
    gasValues: roleModGasValues,
    calldatas: encodedRoleModEntries,
  };
};

const encodeRoleModEntries = (
  proposalEntries: any[],
  roleModAddress: string,
): [any[], any[], any[]] => {
  console.log("roleModAddress: ", roleModAddress);
  const encodedRoleModEntries = [];

  const targets = [];
  const gasValues = [];

  for (let i = 0; i < proposalEntries.length; i++) {
    const roleModFunctionABI = roleModFunctions[proposalEntries[i].valueMethodIdx];
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
