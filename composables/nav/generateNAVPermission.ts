import { ethers } from "ethers";
import { encodeFunctionCall, encodeParameter } from "web3-eth-abi";
import { padLeft } from "web3-utils";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";

export const DEFAULT_ROLE_KEY = "1";
export const DEFAULT_ROLE_KEY_V2 = "defaulManagerRole"; // typo is intentional

// Build a minimal ABI map for Roles V2 write functions we need
const rolesV2WriteFunctionAbiMap: Record<string, any> = {
  scopeFunction: (RolesFullV2 as any).abi.find(
    (f: any) => f.name === "scopeFunction",
  ),
  scopeTarget: (RolesFullV2 as any).abi.find(
    (f: any) => f.name === "scopeTarget",
  ),
};

/**
 * Generate NAV permissions to allow manager to keep
 * updating NAV based on these methods
 * @param fundAddress
 * @param navExecutorAddress
 */
export const generateNAVPermission = (
  fundAddress: string,
  navExecutorAddress: string,
) => {
  // Default NAV entry permission
  const navEntryPermission: Record<string, any> = {
    value: [
      {
        isArray: false,
        data: "1",
        internalType: "uint16",
        name: "role",
      },
      {
        isArray: false,
        data: null,
        internalType: "address",
        name: "targetAddress",
      },
      {
        isArray: false,
        data: null,
        internalType: "bytes4",
        name: "functionSig",
      },
      {
        isArray: true,
        data: [],
        internalType: "bool[]",
        name: "isParamScoped",
      },
      {
        isArray: true,
        data: [],
        internalType: "enum ParameterType[]",
        name: "paramType",
      },
      {
        isArray: true,
        data: [],
        internalType: "enum Comparison[]",
        name: "paramComp",
      },
      {
        isArray: true,
        data: [],
        internalType: "bytes[]",
        name: "compValue",
      },
      {
        isArray: false,
        data: "1",
        internalType: "enum ExecutionOptions",
        name: "options",
      },
    ],
    valueMethodIdx: 19,
  };

  const recalculateNavEntryPermission: Record<string, any> = {
    value: [
      {
        idx: 0,
        isArray: false,
        // TODO: ASSUMES ROLE ID OF 1, BUT COULD BE ANY OTHER ID, NEED A WAY TO POPULATE IT SMARTLY
        data: "1",
        internalType: "uint16",
        name: "role",
      },
      {
        idx: 1,
        isArray: false,
        data: null,
        internalType: "address",
        name: "targetAddress",
      },
    ],
    valueMethodIdx: 24,
  };

  // Target address is admin contract
  navEntryPermission.value[1].data = fundAddress;
  // again, need to set target addr for scope target
  recalculateNavEntryPermission.value[1].data = fundAddress;

  // functionSig
  // TODO add comment, what functionSig is this one? 0xa61f5814
  navEntryPermission.value[2].data = "0xa61f5814";
  const navWords = ["0x000000000000000000000000" + navExecutorAddress.slice(2)];
  const navIsScoped = [true];
  const navTypeNComp = ["0"];

  // isParamScoped
  navEntryPermission.value[3].data = navIsScoped;
  // paramType
  navEntryPermission.value[4].data = navTypeNComp;
  // paramComp
  navEntryPermission.value[5].data = navTypeNComp;
  // compValue
  navEntryPermission.value[6].data = navWords;

  return [navEntryPermission, recalculateNavEntryPermission];
};


export const defaultScopedTargetPermissionRolesV2 = (
  roleKey: string,
  targetAddress: string,
  selector: string, // 4-byte function selector
  compValue: string, // address (Static) or full bytes blob (Dynamic)
  paramType: number = 1, // default ParameterType.Static = 1; use 2 for Dynamic
): string => {
  // Encode roleKey from a string to bytes32
  const encodedRoleKey = ethers.encodeBytes32String(roleKey);

  // Encode compValue depending on paramType
  // - Static (1): treat compValue as address and left-pad to 32 bytes
  // - Dynamic (2): compValue is expected to be a full bytes blob (0x...)
  const byteEncodedCompValue =
    paramType === 1
      ? encodeParameter("bytes32", padLeft(compValue, 64))
      : compValue;

  // Conditions follow the V2 struct ConditionFlat(parent, paramType, operator, compValue)
  // Note: numeric enum values depend on the Roles V2 contract.
  const conditions: any[] = [
    // @param parent: “Which previous condition am I logically attached to?”
    // Generic placeholder condition
    [
      0, // parent=0, // Root condition
      5, // paramType=5, // ParameterType.Calldata
      5, // operator=5, // Operator.Matches
      "0x", // compValue=0x
    ],
    // Equality condition for parameter depending on paramType
    [
      0, // parent=0,  // Root condition
      paramType, // ParameterType (1=Static, 2=Dynamic)
      16, // operator=16,  // Operator.EqualTo
      byteEncodedCompValue, // compValue
    ],
  ];

  const options = 0; // ExecutionOptions.None (uint8)

  return encodeFunctionCall(
    rolesV2WriteFunctionAbiMap.scopeFunction,
    [encodedRoleKey, targetAddress, selector, conditions, options],
  );
};
/**
 * Generate NAV permissions to allow manager to keep
 * updating NAV based on these methods
 * @param fundAddress
 * @param navExecutorAddress
 * @param roleKey
 */
export const generateNAVPermissionRolesV2 = (
  fundAddress: string,
  navExecutorAddress: string,
  roleKey: string = DEFAULT_ROLE_KEY_V2,
) => {
  const encodedRoleModEntries: string[] = [];

  // Encode roleKey from a string to bytes32
  const encodedRoleKey = ethers.encodeBytes32String(roleKey);

  const encodedScopeFunction = defaultScopedTargetPermissionRolesV2(
    roleKey,
    fundAddress,
    "0xa61f5814", // 4-byte function selector of "executeNAVUpdate(address)"
    navExecutorAddress,
    1, // Static paramType by default for address equality
  );
  encodedRoleModEntries.push(encodedScopeFunction);

  // Scope the target as well for the same roleKey
  const encodedScopeTargetV2 = encodeFunctionCall(
    rolesV2WriteFunctionAbiMap.scopeTarget,
    [encodedRoleKey, fundAddress],
  );
  encodedRoleModEntries.push(encodedScopeTargetV2);

  return encodedRoleModEntries;
};


export const getMethodsPastNAVUpdateIndex = (
  methods: Record<string, any>[],
) => {
  return (
    methods.find((method) => "pastNAVUpdateIndex" in method)
      ?.pastNAVUpdateIndex ?? 0
  );
};


export interface IAssignMemberChange {
  address: string;
  action: "ADD" | "REMOVE";
}

export const getAssignMembersRoleV2 = (
  roleKey: string = DEFAULT_ROLE_KEY_V2,
  members: IAssignMemberChange[],
) => {
  if (!members.length) return [];
  const assignRolesAbi: any = (RolesFullV2 as any).abi.find(
    (f: any) => f?.type === "function" && f?.name === "assignRoles",
  );
  const roleKeyBytes = ethers.encodeBytes32String(roleKey);
  const encodedRoleModEntries: string[] = [];

  for (const member of members) {
    const memberOf = member.action === "ADD";

    const encodedAssign = encodeFunctionCall(assignRolesAbi, [
      member.address,
      [roleKeyBytes],
      [memberOf],
    ]);
    encodedRoleModEntries.push(encodedAssign);
  }

  return encodedRoleModEntries;
};
