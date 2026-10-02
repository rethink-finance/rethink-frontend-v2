/**
 * Adversarial audit of the Roles V2 permissions the create flow generates.
 *
 * Where rolesV2RuntimeAcceptance.ts checks a hand-picked matrix, this one
 * tries to break the permissions. Everything runs against the EXACT deployed
 * Roles v2 bytecode (both mastercopies Rethink's beacons point at today),
 * with the batches and the calldata produced by the app's own code:
 *
 *  A. Every combination of the Roles step's switches, applied one after
 *     another on the same modifier in a shuffled order — so each save also
 *     proves it lands in the right state from an arbitrary earlier one — and
 *     probed with the calldata the vault pages really send.
 *  B. What a permission must never allow regardless of calldata: sending
 *     value, delegatecalls, the default-role entry point, a wallet that does
 *     not hold the role, truncated calldata.
 *  C. A differential fuzz. Calldata is mutated at random and sent through
 *     the modifier; whenever the modifier ALLOWS a call, the calldata is
 *     decoded the way the target contract would decode it, and every pinned
 *     value must still be the pinned value. A call the modifier lets through
 *     that the vault would read differently is a bypass.
 *  D. The Roles and Integrations saves interleaved, with a real registry
 *     build, each save diffing against the modifier's own event log: neither
 *     may switch off what the other granted.
 *
 * Run with:  npm run test:roles-v2-audit
 * (AUDIT_FUZZ=<cases per target> to change the fuzz depth, default 2500)
 */
import { VM } from "@ethereumjs/vm";
import { Common, Hardfork } from "@ethereumjs/common";
import { Address, bytesToHex, hexToBytes } from "@ethereumjs/util";
import { getProtocolEntry } from "@rethink-finance/positions-registry";
import { ethers } from "ethers";
import { encodeFunctionCall } from "web3-eth-abi";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import {
  ADMIN_ROLE_KEY_V2,
  EXECUTOR_ROLE_KEY_V2,
  generateNAVPermissionRolesV2,
  getAssignMembersRoleV2,
  getScopeTargetV2,
  toRoleKeyBytes32,
} from "~/composables/nav/generateNAVPermission";
import {
  buildIntegrationsBatch,
  buildPermissionsPageBatch,
} from "~/composables/permissions/integrationsBatch";
import {
  type IProtocolSelectionState,
  buildProtocolPermissionEntries,
} from "~/composables/permissions/protocolPermissions";
import {
  buildAssignRolesCalldata,
  buildCuratorUpdateSettingsCalldata,
  type ILiveFundSettingsState,
} from "~/composables/permissions/roleCalldata";
import {
  type IRoleScopeLog,
  listLiveRoleKeys,
  reduceRoleScopeLogs,
  storedRolePermissionCalls,
} from "~/composables/permissions/roleScopeLogs";
import {
  generateCollectFeesPermissionRolesV2,
  generateSendFundsPermissionRolesV2,
  generateUpdateSettingsPermissionRolesV2,
  parseUpdateSettingsPinnedValues,
} from "~/composables/permissions/rolesV2Permissions";
import {
  buildPrepopulatedPermissionsBatch,
  fullVaultRolePermissions,
  resolveCustomRoles,
  type IAdminPermissions,
  type IExecutorPermissions,
  type IVaultRolePermissions,
} from "~/composables/permissions/vaultRoles";

const RPC =
  process.env.ROLES_V2_ACCEPTANCE_RPC ?? "https://arb1.arbitrum.io/rpc";
const FUZZ_CASES = Number(process.env.AUDIT_FUZZ ?? 2500);

const MASTERCOPIES: [string, string][] = [
  ["2.1.1 (patched)", "0xF2964CE6161ce0e75964Fe7927cE114cb0B283D5"],
  ["2.1.0", "0x9646fDAD06d3e24444381f44362a3B0eB343D337"],
];

// Fixture world
const OWNER = "0x0000000000000000000000000000000000000111";
const ADMIN = "0x0000000000000000000000000000000000000a11";
const EXECUTOR = "0x0000000000000000000000000000000000000222";
const OTHER_EXECUTOR = "0x0000000000000000000000000000000000000223";
const STRANGER = "0x0000000000000000000000000000000000000333";
const FUND = "0x00000000000000000000000000000000000f00d1";
const NAV_EXECUTOR = "0x000000000000000000000000000000000000aa01";
const PERF_FEE = "0x000000000000000000000000000000000000fee1";
const SAFE = "0x000000000000000000000000000000000005afe1";
const OLD_GOVERNOR = "0x0000000000000000000000000000000000006041";

// The base token is Arbitrum USDC, a real Aave reserve: the integration test
// needs the Roles step's transfer grant and the registry's approve grant to
// land on the same target.
const aave = getProtocolEntry(42161, "aave_v3")?.data as any;
const reserve = (symbol: string): string =>
  (aave.reserves.find((r: any) => r.symbol === symbol).token as string).toLowerCase();
const AAVE_POOL = (aave.addresses.POOL as string).toLowerCase();
const USDC = reserve("USDC");
const DAI = reserve("DAI");
const BASE_TOKEN = USDC;

const ADMIN_KEY = ethers.encodeBytes32String(ADMIN_ROLE_KEY_V2);
const EXECUTOR_KEY = ethers.encodeBytes32String(EXECUTOR_ROLE_KEY_V2);
const OTHER_KEY = ethers.encodeBytes32String("someOtherRole");
const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

const METADATA = "{\"photoUrl\":\"x\",\"description\":\"A fixture vault\"}";
const FEE_COLLECTORS = [
  "0x5555555555555555555555555555555555555555",
  "0x6666666666666666666666666666666666666666",
  "0x7777777777777777777777777777777777777777",
  "0x8888888888888888888888888888888888888888",
];
const NEW_COLLECTORS = [
  "0x9999999999999999999999999999999999999999",
  "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
  "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
  "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
];

/** The Settings struct as the factory caches it and the vault stores it. */
const rawSettings = {
  depositFee: "100",
  withdrawFee: "0",
  performanceFee: "2000",
  managementFee: "100",
  performaceHurdleRateBps: "0",
  baseToken: BASE_TOKEN,
  safe: SAFE,
  isExternalGovTokenInUse: false,
  isWhitelistedDeposits: true,
  allowedDepositAddrs: [] as string[],
  allowedManagers: [] as string[],
  governanceToken: "0x000000000000000000000000000000000000c0a1",
  fundAddress: FUND,
  governor: OLD_GOVERNOR,
  fundName: "Fixture Fund",
  fundSymbol: "FIX",
  feeCollectors: FEE_COLLECTORS,
};

/** What a vault page reads live before it builds its calldata. */
const LIVE: ILiveFundSettingsState = {
  settings: rawSettings,
  fundMetadata: METADATA,
  feePerformancePeriod: "90",
  feeManagePeriod: "0",
};

const SETTINGS_TYPE =
  "(uint256 depositFee, uint256 withdrawFee, uint256 performanceFee," +
  " uint256 managementFee, uint256 performaceHurdleRateBps," +
  " address baseToken, address safe, bool isExternalGovTokenInUse," +
  " bool isWhitelistedDeposits, address[] allowedDepositAddrs," +
  " address[] allowedManagers, address governanceToken," +
  " address fundAddress, address governor, string fundName," +
  " string fundSymbol, address[4] feeCollectors)";
const targetIface = new ethers.Interface([
  `function updateSettings(${SETTINGS_TYPE} _fundSettings, string _fundMetadata, uint256 _feePerformancePeriod, uint256 _feeManagePeriod)`,
  "function executeNAVUpdate(address navExecutor)",
  "function fundFlowsCall(bytes data)",
  "function transfer(address recipient, uint256 amount)",
  "function approve(address spender, uint256 amount)",
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function assignRoles(address module, bytes32[] roleKeys, bool[] memberOf)",
]);

const PERF_FEE_PAYLOAD =
  "0xa52eb8be" + abiCoder.encode(["address"], [PERF_FEE]).slice(2);

const context = (rolesModifier: string) => ({
  fundAddress: FUND,
  baseToken: BASE_TOKEN,
  rolesModifier,
  navExecutor: NAV_EXECUTOR,
  poolPerformanceFee: PERF_FEE,
  rawSettings,
  fundMetadata: METADATA,
  feePerformancePeriod: "90",
  feeManagePeriod: "0",
});

/** The Roles step's batch for these switches, exactly as the step sends it. */
const rolesBatch = (
  rolesModifier: string,
  permissions: IVaultRolePermissions,
): string[] => {
  const { revokes, grants } = buildPrepopulatedPermissionsBatch(
    context(rolesModifier),
    permissions,
  );
  return [...revokes, ...grants];
};

/** What the step stored before the admin role existed. */
const legacyBatch = (rolesModifier: string): string[] => {
  const allowFunctionAbi = (RolesFullV2 as any).abi.find(
    (f: any) => f?.type === "function" && f?.name === "allowFunction",
  );
  return [
    ...generateNAVPermissionRolesV2(FUND, NAV_EXECUTOR),
    ...generateSendFundsPermissionRolesV2(BASE_TOKEN, FUND),
    ...generateCollectFeesPermissionRolesV2(FUND, PERF_FEE),
    ...generateUpdateSettingsPermissionRolesV2(
      FUND,
      parseUpdateSettingsPinnedValues(rawSettings, "90", "0"),
    ),
    getScopeTargetV2(EXECUTOR_ROLE_KEY_V2, rolesModifier),
    encodeFunctionCall(allowFunctionAbi, [
      EXECUTOR_KEY,
      rolesModifier,
      "0x957ed2b3",
      0,
    ]),
  ];
};

const withPermissions = (
  change: (permissions: IVaultRolePermissions) => void,
): IVaultRolePermissions => {
  const permissions = fullVaultRolePermissions();
  change(permissions);
  return permissions;
};

// ---------------------------------------------------------------------------
// The EVM
// ---------------------------------------------------------------------------

const decodeErr = (ret: string) => {
  try {
    const parsed = rolesIface.parseError(ret);
    if (!parsed) return ret.slice(0, 10);
    return parsed.name === "ConditionViolation"
      ? `ConditionViolation(status=${parsed.args[0]})`
      : parsed.name;
  } catch {
    return ret.slice(0, 10) || "(no revert data)";
  }
};

/** The mastercopy plus every contract its bytecode links (see acceptance). */
const loadLinkedCode = async (
  provider: ethers.JsonRpcProvider,
  root: string,
): Promise<Map<string, string>> => {
  const blobs = new Map<string, string>();
  const queue = [root.toLowerCase()];
  while (queue.length) {
    const address = queue.shift()!;
    if (blobs.has(address)) continue;
    const code = await provider.getCode(address);
    if (code === "0x") continue;
    blobs.set(address, code);
    for (const match of code.matchAll(/73([0-9a-f]{40})/g)) {
      const linked = "0x" + match[1];
      if (!blobs.has(linked) && !queue.includes(linked) && !/^0x0{30}/.test(linked)) {
        queue.push(linked);
      }
    }
  }
  if (!blobs.has(root.toLowerCase())) {
    throw new Error(`No code at ${root} on ${RPC}`);
  }
  return blobs;
};

interface IExecOptions {
  value?: bigint;
  operation?: number;
  entry?: "execTransactionWithRole" | "execTransactionWithRoleReturnData" | "execTransactionFromModule";
}

interface IWorld {
  modifier: string;
  /** Every permission event the modifier has emitted, oldest first. */
  logs: IRoleScopeLog[];
  /** Apply admin calls as the modifier's owner; throws if one is rejected. */
  owner: (entries: string[], label: string) => Promise<void>;
  exec: (
    sender: string,
    roleKey: string,
    to: string,
    data: string,
    options?: IExecOptions,
  ) => Promise<{ ok: boolean; err: string }>;
}

const createWorld = async (
  mastercopy: string,
  blobs: Map<string, string>,
): Promise<IWorld> => {
  const common = new Common({ chain: "mainnet", hardfork: Hardfork.Cancun });
  const vm = await VM.create({ common });
  const putCode = (addr: string, codeHex: string) =>
    vm.stateManager.putContractCode(
      Address.fromString(addr),
      hexToBytes(codeHex as `0x${string}`),
    );
  for (const [address, code] of blobs) await putCode(address, code);
  // Mock avatar: any call returns abi.encode(true, bytes("")), which reads
  // as success for both execTransactionFromModule (bool) and its ReturnData
  // variant (bool, bytes). The permission check under test runs BEFORE this
  // call.
  await putCode(SAFE, "0x6001600052604060205260606000f3");

  const logs: IRoleScopeLog[] = [];
  let block = 0;
  const call = async (from: string, to: string, dataHex: string) => {
    const res = await vm.evm.runCall({
      caller: Address.fromString(from),
      to: Address.fromString(to),
      data: hexToBytes(dataHex as `0x${string}`),
      gasLimit: 60_000_000n,
    });
    const ok = !res.execResult.exceptionError;
    if (ok) {
      block++;
      (res.execResult.logs ?? []).forEach(([, topics, data], logIndex) =>
        logs.push({
          topics: topics.map((topic) => bytesToHex(topic)),
          data: bytesToHex(data),
          blockNumber: block,
          logIndex,
        }),
      );
    }
    return {
      ok,
      ret: bytesToHex(res.execResult.returnValue ?? new Uint8Array()),
    };
  };

  const setUp = await call(
    OWNER,
    mastercopy,
    rolesIface.encodeFunctionData("setUp", [
      abiCoder.encode(["address", "address", "address"], [OWNER, SAFE, SAFE]),
    ]),
  );
  if (!setUp.ok) throw new Error(`setUp failed: ${decodeErr(setUp.ret)}`);

  const world: IWorld = {
    modifier: mastercopy,
    logs,
    owner: async (entries, label) => {
      for (const [i, entry] of entries.entries()) {
        const res = await call(OWNER, mastercopy, entry);
        if (!res.ok) {
          const name = rolesIface.parseTransaction({ data: entry })?.name;
          throw new Error(
            `${label}: [${i}] ${name} rejected by the modifier: ${decodeErr(res.ret)}`,
          );
        }
      }
    },
    exec: async (sender, roleKey, to, data, options = {}) => {
      const entry = options.entry ?? "execTransactionWithRole";
      const head = [to, options.value ?? 0n, data, options.operation ?? 0];
      const res = await call(
        sender,
        mastercopy,
        rolesIface.encodeFunctionData(
          entry,
          entry === "execTransactionFromModule" ? head : [...head, roleKey, true],
        ),
      );
      return { ok: res.ok, err: res.ok ? "" : decodeErr(res.ret) };
    },
  };

  await world.owner(
    [
      [ADMIN, ADMIN_KEY],
      [EXECUTOR, EXECUTOR_KEY],
      [OTHER_EXECUTOR, EXECUTOR_KEY],
    ].map(([member, key]) =>
      rolesIface.encodeFunctionData("assignRoles", [member, [key], [true]]),
    ),
    "assign members",
  );
  return world;
};

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

let failures = 0;
const failureLines: string[] = [];
const fail = (line: string) => {
  failures++;
  if (failureLines.length < 60) failureLines.push(line);
};

const section = (title: string) => console.log(`\n  ${title}`);
const result = (ok: boolean, line: string) =>
  console.log(`    ${ok ? "PASS" : "FAIL"} | ${line}`);

// ---------------------------------------------------------------------------
// A. Every switch combination, probed with the pages' own calldata
// ---------------------------------------------------------------------------

type Sender = "admin" | "executor";
interface IProbe {
  label: string;
  sender: Sender;
  key: string;
  to: string;
  data: string;
  allowed: boolean;
}

const settings = (changes: Parameters<typeof buildCuratorUpdateSettingsCalldata>[1]) =>
  buildCuratorUpdateSettingsCalldata(LIVE, changes);

/** updateSettings with one frozen field changed by hand. */
const tamperedSettings = (
  mutate: (s: Record<string, any>) => void,
  changes: Parameters<typeof buildCuratorUpdateSettingsCalldata>[1] = {},
  periods: [string, string] = ["90", "0"],
) => {
  const s: Record<string, any> = { ...rawSettings, governor: SAFE };
  mutate(s);
  // The builder echoes `safe` as the governor; build from a live state whose
  // values are the tampered ones.
  return buildCuratorUpdateSettingsCalldata(
    {
      settings: s,
      fundMetadata: METADATA,
      feePerformancePeriod: periods[0],
      feeManagePeriod: periods[1],
    },
    changes,
  );
};

const NEW_METADATA = "{\"photoUrl\":\"y\",\"description\":\"Edited\"}";

const probesFor = (
  permissions: IVaultRolePermissions,
  modifier: string,
): IProbe[] => {
  const off: IAdminPermissions = {
    updateMetadata: false,
    manageWhitelist: false,
    manageExecutorMembers: false,
    transferAdminRole: false,
    changeFeeDestinations: false,
  };
  const a = permissions.adminEnabled ? permissions.admin : off;
  const e = permissions.executor;
  const anySettings = a.updateMetadata || a.manageWhitelist || a.changeFeeDestinations;
  const admin = (label: string, to: string, data: string, allowed: boolean): IProbe =>
    ({ label: `admin: ${label}`, sender: "admin", key: ADMIN_KEY, to, data, allowed });
  const executor = (label: string, to: string, data: string, allowed: boolean): IProbe =>
    ({ label: `executor: ${label}`, sender: "executor", key: EXECUTOR_KEY, to, data, allowed });

  return [
    // --- settings, with the bytes the Profile / Whitelist pages send ---
    admin("edit metadata", FUND, settings({ fundMetadata: NEW_METADATA }), a.updateMetadata),
    admin("whitelist: add two addresses", FUND, settings({ whitelistDeltas: [STRANGER, ADMIN] }), a.manageWhitelist),
    admin("whitelist: switch enforcement off", FUND, settings({ isWhitelistedDeposits: false }), a.manageWhitelist),
    admin("whitelist: enforcement off + delta", FUND, settings({ isWhitelistedDeposits: false, whitelistDeltas: [STRANGER] }), a.manageWhitelist),
    admin("move the fee destinations", FUND, settings({ feeCollectors: NEW_COLLECTORS }), a.changeFeeDestinations),
    admin("move one fee destination", FUND, settings({ feeCollectors: [STRANGER, ...FEE_COLLECTORS.slice(1)] }), a.changeFeeDestinations),
    admin("metadata + whitelist + fee destinations at once", FUND, settings({ fundMetadata: NEW_METADATA, whitelistDeltas: [STRANGER], feeCollectors: NEW_COLLECTORS }), a.updateMetadata && a.manageWhitelist && a.changeFeeDestinations),
    admin("metadata + whitelist", FUND, settings({ fundMetadata: NEW_METADATA, whitelistDeltas: [STRANGER] }), a.updateMetadata && a.manageWhitelist),
    admin("unchanged echo", FUND, settings({}), anySettings),
    // --- settings that must never pass ---
    admin("raise the performance fee", FUND, tamperedSettings((s) => { s.performanceFee = "2001"; }), false),
    admin("raise the management fee", FUND, tamperedSettings((s) => { s.managementFee = "101"; }), false),
    admin("change the deposit fee", FUND, tamperedSettings((s) => { s.depositFee = "99"; }), false),
    admin("change the withdraw fee", FUND, tamperedSettings((s) => { s.withdrawFee = "1"; }), false),
    admin("change the hurdle rate", FUND, tamperedSettings((s) => { s.performaceHurdleRateBps = "1"; }), false),
    admin("fee destinations + a fee change", FUND, tamperedSettings((s) => { s.performanceFee = "2001"; }, { feeCollectors: NEW_COLLECTORS }), false),
    admin("metadata + a fee change", FUND, tamperedSettings((s) => { s.managementFee = "0"; }, { fundMetadata: NEW_METADATA }), false),
    admin("change the performance fee period", FUND, tamperedSettings(() => {}, {}, ["91", "0"]), false),
    admin("change the management fee period", FUND, tamperedSettings(() => {}, {}, ["90", "1"]), false),
    admin("rename the vault", FUND, tamperedSettings((s) => { s.fundName = "Evil Fund"; }), false),
    admin("change the symbol", FUND, tamperedSettings((s) => { s.fundSymbol = "EVL"; }), false),
    admin("swap the base token", FUND, tamperedSettings((s) => { s.baseToken = STRANGER; }), false),
    admin("swap the Safe", FUND, tamperedSettings((s) => { s.safe = STRANGER; }), false),
    admin("swap the governance token", FUND, tamperedSettings((s) => { s.governanceToken = STRANGER; }), false),
    admin("flip the external-token flag", FUND, tamperedSettings((s) => { s.isExternalGovTokenInUse = true; }), false),
    admin("repoint the vault address", FUND, tamperedSettings((s) => { s.fundAddress = STRANGER; }), false),
    admin("hand the governor to someone else", FUND, targetIface.encodeFunctionData("updateSettings", [{ ...rawSettings, governor: STRANGER }, METADATA, 90n, 0n]), false),
    admin("echo the old governor", FUND, targetIface.encodeFunctionData("updateSettings", [{ ...rawSettings, governor: OLD_GOVERNOR }, METADATA, 90n, 0n]), false),
    admin("add a fund manager", FUND, targetIface.encodeFunctionData("updateSettings", [{ ...rawSettings, governor: SAFE, allowedManagers: [ADMIN] }, METADATA, 90n, 0n]), false),
    // --- membership, with the bytes the Permissions page sends ---
    admin("add an executor", modifier, buildAssignRolesCalldata(STRANGER, true, EXECUTOR_ROLE_KEY_V2), a.manageExecutorMembers),
    admin("remove an executor", modifier, buildAssignRolesCalldata(EXECUTOR, false, EXECUTOR_ROLE_KEY_V2), a.manageExecutorMembers),
    admin("assign the admin role", modifier, buildAssignRolesCalldata(STRANGER, true, ADMIN_ROLE_KEY_V2), a.transferAdminRole),
    admin("drop its own admin role", modifier, buildAssignRolesCalldata(ADMIN, false, ADMIN_ROLE_KEY_V2), a.transferAdminRole),
    admin("assign an unlisted role", modifier, buildAssignRolesCalldata(STRANGER, true, "someOtherRole"), false),
    admin("both roles in one call", modifier, rolesIface.encodeFunctionData("assignRoles", [STRANGER, [EXECUTOR_KEY, ADMIN_KEY], [true, true]]), false),
    admin("an unlisted role beside a listed one", modifier, rolesIface.encodeFunctionData("assignRoles", [STRANGER, [EXECUTOR_KEY, OTHER_KEY], [true, true]]), false),
    admin("the same role twice", modifier, rolesIface.encodeFunctionData("assignRoles", [STRANGER, [EXECUTOR_KEY, EXECUTOR_KEY], [true, true]]), false),
    admin("an empty role list", modifier, rolesIface.encodeFunctionData("assignRoles", [STRANGER, [], []]), false),
    // --- the admin holds none of the executor's powers ---
    admin("update NAV", FUND, targetIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR]), false),
    admin("send the base token to the vault", BASE_TOKEN, targetIface.encodeFunctionData("transfer", [FUND, 1n]), false),
    admin("collect fees", FUND, targetIface.encodeFunctionData("fundFlowsCall", [PERF_FEE_PAYLOAD]), false),
    admin("scope a target", modifier, rolesIface.encodeFunctionData("scopeTarget", [ADMIN_KEY, STRANGER]), false),
    admin("allow a target", modifier, rolesIface.encodeFunctionData("allowTarget", [ADMIN_KEY, STRANGER, 3]), false),
    admin("scope a function", modifier, rolesIface.encodeFunctionData("scopeFunction", [ADMIN_KEY, STRANGER, "0x11223344", [[0, 5, 5, "0x"]], 0]), false),
    admin("take the modifier's ownership", modifier, rolesIface.encodeFunctionData("transferOwnership", [ADMIN]), false),
    admin("enable a module", modifier, rolesIface.encodeFunctionData("enableModule", [ADMIN]), false),
    admin("set a default role", modifier, rolesIface.encodeFunctionData("setDefaultRole", [ADMIN, ADMIN_KEY]), false),
    admin("an unscoped contract", STRANGER, "0xdeadbeef", false),

    // --- the executor ---
    executor("send the base token to the vault", BASE_TOKEN, targetIface.encodeFunctionData("transfer", [FUND, 12345n]), e.sendFunds),
    executor("send the base token elsewhere", BASE_TOKEN, targetIface.encodeFunctionData("transfer", [EXECUTOR, 12345n]), false),
    executor("approve the base token", BASE_TOKEN, targetIface.encodeFunctionData("approve", [EXECUTOR, 12345n]), false),
    executor("update NAV", FUND, targetIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR]), e.updateNav),
    executor("update NAV through another executor contract", FUND, targetIface.encodeFunctionData("executeNAVUpdate", [EXECUTOR]), false),
    executor("collect fees", FUND, targetIface.encodeFunctionData("fundFlowsCall", [PERF_FEE_PAYLOAD]), e.collectFees),
    executor("another flows payload", FUND, targetIface.encodeFunctionData("fundFlowsCall", ["0xa52eb8be" + abiCoder.encode(["address"], [EXECUTOR]).slice(2)]), false),
    executor("revoke its own role", modifier, buildAssignRolesCalldata(EXECUTOR, false, EXECUTOR_ROLE_KEY_V2), e.selfRevoke),
    // Known and stated: a condition sees calldata, never the caller.
    executor("revoke ANOTHER executor", modifier, buildAssignRolesCalldata(OTHER_EXECUTOR, false, EXECUTOR_ROLE_KEY_V2), e.selfRevoke),
    executor("add an executor", modifier, buildAssignRolesCalldata(STRANGER, true, EXECUTOR_ROLE_KEY_V2), false),
    executor("re-add itself", modifier, buildAssignRolesCalldata(EXECUTOR, true, EXECUTOR_ROLE_KEY_V2), false),
    executor("remove one, add one in the same call", modifier, rolesIface.encodeFunctionData("assignRoles", [STRANGER, [EXECUTOR_KEY, EXECUTOR_KEY], [false, true]]), false),
    executor("take the admin role", modifier, buildAssignRolesCalldata(EXECUTOR, true, ADMIN_ROLE_KEY_V2), false),
    executor("remove an admin", modifier, buildAssignRolesCalldata(ADMIN, false, ADMIN_ROLE_KEY_V2), false),
    executor("edit metadata", FUND, settings({ fundMetadata: NEW_METADATA }), false),
    executor("edit the whitelist", FUND, settings({ whitelistDeltas: [STRANGER] }), false),
    executor("move the fee destinations", FUND, settings({ feeCollectors: NEW_COLLECTORS }), false),
    executor("unchanged settings echo", FUND, settings({}), false),
    executor("scope a target", modifier, rolesIface.encodeFunctionData("scopeTarget", [EXECUTOR_KEY, STRANGER]), false),
    executor("take the modifier's ownership", modifier, rolesIface.encodeFunctionData("transferOwnership", [EXECUTOR]), false),
    executor("an unscoped contract", STRANGER, "0xdeadbeef", false),
  ];
};

const senderAddress = (sender: Sender) => (sender === "admin" ? ADMIN : EXECUTOR);

const describe = (permissions: IVaultRolePermissions) => {
  const on = (o: Record<string, boolean>) =>
    Object.entries(o).filter(([, v]) => v).map(([k]) => k).join("+") || "none";
  return `admin[${permissions.adminEnabled ? on(permissions.admin as any) : "DISABLED"}] executor[${on(permissions.executor as any)}]`;
};

const checkProbes = async (
  world: IWorld,
  permissions: IVaultRolePermissions,
  where: string,
): Promise<number> => {
  let bad = 0;
  for (const probe of probesFor(permissions, world.modifier)) {
    const res = await world.exec(senderAddress(probe.sender), probe.key, probe.to, probe.data);
    if (res.ok !== probe.allowed) {
      bad++;
      fail(
        `${where} | ${describe(permissions)} | ${probe.label}: expected ${
          probe.allowed ? "allow" : "deny"
        }, got ${res.ok ? "allowed" : `denied ${res.err}`}`,
      );
    }
  }
  return bad;
};

/** Deterministic PRNG, so a failure can be reproduced. */
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const allCombinations = (): IVaultRolePermissions[] => {
  const adminKeys = Object.keys(fullVaultRolePermissions().admin) as (keyof IAdminPermissions)[];
  const executorKeys = Object.keys(fullVaultRolePermissions().executor) as (keyof IExecutorPermissions)[];
  const combos: IVaultRolePermissions[] = [];
  for (let e = 0; e < 1 << executorKeys.length; e++) {
    const executor = Object.fromEntries(
      executorKeys.map((key, i) => [key, Boolean(e & (1 << i))]),
    ) as unknown as IExecutorPermissions;
    for (let a = 0; a < 1 << adminKeys.length; a++) {
      const admin = Object.fromEntries(
        adminKeys.map((key, i) => [key, Boolean(a & (1 << i))]),
      ) as unknown as IAdminPermissions;
      combos.push({ adminEnabled: true, admin, executor });
    }
    // Disabled, with every admin switch still on: the role being off wins.
    combos.push({
      adminEnabled: false,
      admin: fullVaultRolePermissions().admin,
      executor,
    });
  }
  return combos;
};

const shuffled = <T>(items: T[], seed: number): T[] => {
  const rng = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const auditCombinations = async (
  mastercopy: string,
  blobs: Map<string, string>,
) => {
  section("A. Every switch combination, saved one after another on one modifier");
  const combos = allCombinations();

  // Walk 1: a fresh vault, through every combination in a shuffled order.
  let world = await createWorld(mastercopy, blobs);
  let bad = 0;
  let probes = 0;
  for (const permissions of shuffled(combos, 0xc0ffee)) {
    await world.owner(rolesBatch(world.modifier, permissions), describe(permissions));
    bad += await checkProbes(world, permissions, "walk from a fresh vault");
    probes += probesFor(permissions, world.modifier).length;
  }
  result(!bad, `${combos.length} combinations from a fresh vault, ${probes} checks, ${bad} wrong`);

  // Walk 2: a vault that first saved under the old single-role scheme.
  world = await createWorld(mastercopy, blobs);
  await world.owner(legacyBatch(world.modifier), "legacy save");
  bad = 0;
  probes = 0;
  const sample = shuffled(combos, 0xbeef).slice(0, 120);
  for (const permissions of sample) {
    await world.owner(rolesBatch(world.modifier, permissions), describe(permissions));
    bad += await checkProbes(world, permissions, "walk from a legacy save");
    probes += probesFor(permissions, world.modifier).length;
  }
  result(!bad, `${sample.length} combinations after a pre-split save, ${probes} checks, ${bad} wrong`);

  // Each combination also on a modifier that has seen nothing else.
  bad = 0;
  const fresh = shuffled(combos, 0xfeed).slice(0, 40);
  for (const permissions of fresh) {
    world = await createWorld(mastercopy, blobs);
    await world.owner(rolesBatch(world.modifier, permissions), describe(permissions));
    bad += await checkProbes(world, permissions, "fresh modifier");
  }
  result(!bad, `${fresh.length} combinations each on its own fresh modifier, ${bad} wrong`);
};

// ---------------------------------------------------------------------------
// B. What no calldata may get through
// ---------------------------------------------------------------------------

const auditHardLimits = async (
  mastercopy: string,
  blobs: Map<string, string>,
) => {
  section("B. Value, delegatecall, entry points, non-members, truncated calldata");
  const permissions = fullVaultRolePermissions();
  const world = await createWorld(mastercopy, blobs);
  await world.owner(rolesBatch(world.modifier, permissions), "all on");
  const allowed = probesFor(permissions, world.modifier).filter((p) => p.allowed);

  const sweep = async (
    label: string,
    run: (probe: IProbe) => Promise<{ ok: boolean; err: string }>,
    expectAllowed: boolean,
  ) => {
    let bad = 0;
    for (const probe of allowed) {
      const res = await run(probe);
      if (res.ok !== expectAllowed) {
        bad++;
        fail(`${label} | ${probe.label}: ${res.ok ? "ALLOWED" : `denied ${res.err}`}`);
      }
    }
    result(!bad, `${label}: ${allowed.length} granted calls, ${bad} wrong`);
  };

  await sweep("baseline, every granted call passes", (p) =>
    world.exec(senderAddress(p.sender), p.key, p.to, p.data), true);
  await sweep("with 1 wei of value attached", (p) =>
    world.exec(senderAddress(p.sender), p.key, p.to, p.data, { value: 1n }), false);
  await sweep("as a delegatecall", (p) =>
    world.exec(senderAddress(p.sender), p.key, p.to, p.data, { operation: 1 }), false);
  await sweep("through execTransactionFromModule (default role)", (p) =>
    world.exec(senderAddress(p.sender), p.key, p.to, p.data, { entry: "execTransactionFromModule" }), false);
  await sweep("through execTransactionWithRoleReturnData", (p) =>
    world.exec(senderAddress(p.sender), p.key, p.to, p.data, { entry: "execTransactionWithRoleReturnData" }), true);
  await sweep("from a wallet holding no role", (p) =>
    world.exec(STRANGER, p.key, p.to, p.data), false);
  await sweep("from the other role's member under this role's key", (p) =>
    world.exec(p.sender === "admin" ? EXECUTOR : ADMIN, p.key, p.to, p.data), false);
  await sweep("under the other role's key", (p) =>
    world.exec(senderAddress(p.sender), p.key === ADMIN_KEY ? EXECUTOR_KEY : ADMIN_KEY, p.to, p.data), false);
  await sweep("under a role key nobody defined", (p) =>
    world.exec(senderAddress(p.sender), OTHER_KEY, p.to, p.data), false);
  await sweep("with the selector alone", (p) =>
    world.exec(senderAddress(p.sender), p.key, p.to, p.data.slice(0, 10)), false);
  await sweep("with empty calldata", (p) =>
    world.exec(senderAddress(p.sender), p.key, p.to, "0x"), false);

  // A permission only reads the parameters it has a condition for, so
  // calldata cut short behind them can pass the modifier. That is harmless
  // exactly when the target's own ABI decoder refuses it — which is what is
  // asserted here, and against the real contracts in the fork test.
  let truncatedBad = 0;
  let truncatedAllowed = 0;
  for (const probe of allowed) {
    for (const cut of [64, 2, 128]) {
      const data = probe.data.slice(0, -cut);
      if (data.length < 10) continue;
      const res = await world.exec(senderAddress(probe.sender), probe.key, probe.to, data);
      if (!res.ok) continue;
      truncatedAllowed++;
      const iface = probe.to === world.modifier ? rolesIface : targetIface;
      let decodes = true;
      try {
        iface.decodeFunctionData(data.slice(0, 10), data).toArray(true);
      } catch {
        decodes = false;
      }
      if (decodes) {
        truncatedBad++;
        fail(`truncated by ${cut / 2} bytes | ${probe.label}: allowed AND the target can decode it`);
      }
    }
  }
  result(
    !truncatedBad,
    `truncated calldata: ${truncatedAllowed} cut calls pass the modifier, ${truncatedBad} of them decodable by the target`,
  );
  await sweep("with the selector's last byte changed", (p) =>
    world.exec(senderAddress(p.sender), p.key, p.to, p.data.slice(0, 8) + (p.data.slice(8, 10) === "ff" ? "00" : "ff") + p.data.slice(10)), false);
};

// ---------------------------------------------------------------------------
// C. Differential fuzz: allowed by the modifier ⇒ pinned as the target reads it
// ---------------------------------------------------------------------------

const toWords = (body: string): string[] => body.match(/.{1,64}/g) ?? [];
const word = (value: bigint) => value.toString(16).padStart(64, "0").slice(-64);

interface IFuzzTarget {
  name: string;
  sender: Sender;
  key: string;
  to: (modifier: string) => string;
  /** Valid calls to start from. */
  seeds: (modifier: string) => string[];
  /** The same calls with frozen values changed, to splice words from. */
  evil: (modifier: string) => string[];
  fragment: string;
  /** Throws when decoded arguments break what the permission pins. */
  invariant: (args: ethers.Result) => void;
}

const same = (a: unknown, b: unknown) =>
  String(a).toLowerCase() === String(b).toLowerCase();
const must = (ok: boolean, what: string) => {
  if (!ok) throw new Error(what);
};

const settingsInvariant = (open: { metadata: boolean; whitelist: boolean; feeDestinations: boolean }) =>
  (args: ethers.Result) => {
    const [s, metadata, perfPeriod, managePeriod] = args;
    must(s.depositFee === 100n, "depositFee");
    must(s.withdrawFee === 0n, "withdrawFee");
    must(s.performanceFee === 2000n, "performanceFee");
    must(s.managementFee === 100n, "managementFee");
    must(s.performaceHurdleRateBps === 0n, "hurdle");
    must(same(s.baseToken, BASE_TOKEN), "baseToken");
    must(same(s.safe, SAFE), "safe");
    must(s.isExternalGovTokenInUse === false, "isExternalGovTokenInUse");
    must(s.allowedManagers.length === 0, "allowedManagers");
    must(same(s.governanceToken, rawSettings.governanceToken), "governanceToken");
    must(same(s.fundAddress, FUND), "fundAddress");
    must(same(s.governor, SAFE), "governor");
    must(s.fundName === "Fixture Fund", "fundName");
    must(s.fundSymbol === "FIX", "fundSymbol");
    must(perfPeriod === 90n, "feePerformancePeriod");
    must(managePeriod === 0n, "feeManagePeriod");
    if (!open.metadata) must(metadata === METADATA, "metadata");
    if (!open.whitelist) {
      must(s.isWhitelistedDeposits === true, "isWhitelistedDeposits");
      must(s.allowedDepositAddrs.length === 0, "allowedDepositAddrs");
    }
    if (!open.feeDestinations) {
      must(
        FEE_COLLECTORS.every((collector, i) => same(s.feeCollectors[i], collector)),
        "feeCollectors",
      );
    }
  };

const settingsSeeds = () => [
  settings({}),
  settings({ fundMetadata: NEW_METADATA }),
  settings({ whitelistDeltas: [STRANGER] }),
  settings({ whitelistDeltas: [STRANGER, ADMIN, EXECUTOR], isWhitelistedDeposits: false }),
  settings({ feeCollectors: NEW_COLLECTORS }),
  settings({ fundMetadata: "x".repeat(300), feeCollectors: NEW_COLLECTORS, whitelistDeltas: [STRANGER] }),
];
const settingsEvil = () => [
  tamperedSettings((s) => { s.performanceFee = "9999"; s.managementFee = "9999"; s.depositFee = "9999"; s.withdrawFee = "9999"; s.performaceHurdleRateBps = "9999"; }),
  tamperedSettings((s) => { s.baseToken = STRANGER; s.safe = STRANGER; s.governanceToken = STRANGER; s.fundAddress = STRANGER; s.isExternalGovTokenInUse = true; }),
  tamperedSettings((s) => { s.fundName = "Evil Fund"; s.fundSymbol = "EVL"; }, {}, ["91", "1"]),
  targetIface.encodeFunctionData("updateSettings", [{ ...rawSettings, governor: STRANGER, allowedManagers: [STRANGER, ADMIN] }, NEW_METADATA, 90n, 0n]),
  targetIface.encodeFunctionData("updateSettings", [{ ...rawSettings, governor: SAFE, allowedDepositAddrs: [STRANGER], isWhitelistedDeposits: false, feeCollectors: NEW_COLLECTORS }, NEW_METADATA, 90n, 0n]),
];

const assignInvariant = (allowedKeys: string[], removalsOnly: boolean) =>
  (args: ethers.Result) => {
    const [, roleKeys, memberOf] = args;
    for (let i = 0; i < roleKeys.length; i++) {
      must(allowedKeys.some((key) => same(key, roleKeys[i])), `role key ${roleKeys[i]}`);
      // The modifier reverts on arrays of different lengths; a key with no
      // flag beside it never takes effect.
      if (removalsOnly && i < memberOf.length) must(memberOf[i] === false, "an addition");
    }
  };

const assignSeeds = (keys: string[], removalsOnly: boolean) => [
  ...keys.flatMap((key) => [
    rolesIface.encodeFunctionData("assignRoles", [STRANGER, [key], [false]]),
    ...(removalsOnly ? [] : [rolesIface.encodeFunctionData("assignRoles", [EXECUTOR, [key], [true]])]),
  ]),
];
const assignEvil = () => [
  rolesIface.encodeFunctionData("assignRoles", [STRANGER, [OTHER_KEY], [true]]),
  rolesIface.encodeFunctionData("assignRoles", [STRANGER, [OTHER_KEY, ADMIN_KEY, EXECUTOR_KEY], [true, true, true]]),
  rolesIface.encodeFunctionData("assignRoles", [STRANGER, [ADMIN_KEY, OTHER_KEY], [true, true]]),
  rolesIface.encodeFunctionData("assignRoles", [STRANGER, [EXECUTOR_KEY, EXECUTOR_KEY], [false, true]]),
];

interface IFuzzWorld {
  label: string;
  permissions: IVaultRolePermissions;
  targets: IFuzzTarget[];
}

const settingsTarget = (
  open: { metadata: boolean; whitelist: boolean; feeDestinations: boolean },
): IFuzzTarget => ({
  name: "updateSettings",
  sender: "admin",
  key: ADMIN_KEY,
  to: () => FUND,
  seeds: settingsSeeds,
  evil: settingsEvil,
  fragment: "updateSettings",
  invariant: settingsInvariant(open),
});

const settingsWorld = (
  open: { metadata: boolean; whitelist: boolean; feeDestinations: boolean },
): IFuzzWorld => ({
  label: `settings open: ${Object.entries(open).filter(([, v]) => v).map(([k]) => k).join("+") || "none"}`,
  permissions: withPermissions((p) => {
    p.admin.updateMetadata = open.metadata;
    p.admin.manageWhitelist = open.whitelist;
    p.admin.changeFeeDestinations = open.feeDestinations;
  }),
  targets: [settingsTarget(open)],
});

const FUZZ_WORLDS: IFuzzWorld[] = [
  {
    label: "every switch on",
    permissions: fullVaultRolePermissions(),
    targets: [
      settingsTarget({ metadata: true, whitelist: true, feeDestinations: true }),
      {
        name: "assignRoles (admin: executor or admin role)",
        sender: "admin",
        key: ADMIN_KEY,
        to: (m) => m,
        seeds: () => assignSeeds([EXECUTOR_KEY, ADMIN_KEY], false),
        evil: assignEvil,
        fragment: "assignRoles",
        invariant: assignInvariant([EXECUTOR_KEY, ADMIN_KEY], false),
      },
      {
        name: "assignRoles (executor: self-revoke)",
        sender: "executor",
        key: EXECUTOR_KEY,
        to: (m) => m,
        seeds: () => assignSeeds([EXECUTOR_KEY], true),
        evil: () => [
          ...assignEvil(),
          rolesIface.encodeFunctionData("assignRoles", [STRANGER, [EXECUTOR_KEY], [true]]),
          rolesIface.encodeFunctionData("assignRoles", [STRANGER, [ADMIN_KEY], [false]]),
        ],
        fragment: "assignRoles",
        invariant: assignInvariant([EXECUTOR_KEY], true),
      },
      {
        name: "transfer (base token to the vault)",
        sender: "executor",
        key: EXECUTOR_KEY,
        to: () => BASE_TOKEN,
        seeds: () => [targetIface.encodeFunctionData("transfer", [FUND, 12345n])],
        evil: () => [targetIface.encodeFunctionData("transfer", [STRANGER, 2n ** 255n])],
        fragment: "transfer",
        invariant: (args) => must(same(args[0], FUND), "recipient"),
      },
      {
        name: "executeNAVUpdate",
        sender: "executor",
        key: EXECUTOR_KEY,
        to: () => FUND,
        seeds: () => [targetIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR])],
        evil: () => [targetIface.encodeFunctionData("executeNAVUpdate", [STRANGER])],
        fragment: "executeNAVUpdate",
        invariant: (args) => must(same(args[0], NAV_EXECUTOR), "nav executor"),
      },
      {
        name: "fundFlowsCall (collect fees)",
        sender: "executor",
        key: EXECUTOR_KEY,
        to: () => FUND,
        seeds: () => [targetIface.encodeFunctionData("fundFlowsCall", [PERF_FEE_PAYLOAD])],
        evil: () => [
          targetIface.encodeFunctionData("fundFlowsCall", ["0xa52eb8be" + abiCoder.encode(["address"], [STRANGER]).slice(2)]),
          targetIface.encodeFunctionData("fundFlowsCall", ["0xdeadbeef" + abiCoder.encode(["address", "uint256"], [PERF_FEE, 1n]).slice(2)]),
        ],
        fragment: "fundFlowsCall",
        invariant: (args) => must(same(args[0], PERF_FEE_PAYLOAD), "flows payload"),
      },
    ],
  },
  settingsWorld({ metadata: false, whitelist: true, feeDestinations: true }),
  settingsWorld({ metadata: true, whitelist: false, feeDestinations: true }),
  settingsWorld({ metadata: true, whitelist: true, feeDestinations: false }),
  settingsWorld({ metadata: true, whitelist: false, feeDestinations: false }),
  settingsWorld({ metadata: false, whitelist: false, feeDestinations: true }),
  {
    label: "admin manages executors only",
    permissions: withPermissions((p) => { p.admin.transferAdminRole = false; }),
    targets: [{
      name: "assignRoles (admin: executor role only)",
      sender: "admin",
      key: ADMIN_KEY,
      to: (m) => m,
      seeds: () => assignSeeds([EXECUTOR_KEY], false),
      evil: () => [...assignEvil(), rolesIface.encodeFunctionData("assignRoles", [STRANGER, [ADMIN_KEY], [true]])],
      fragment: "assignRoles",
      invariant: assignInvariant([EXECUTOR_KEY], false),
    }],
  },
  {
    label: "admin transfers the admin role only",
    permissions: withPermissions((p) => { p.admin.manageExecutorMembers = false; }),
    targets: [{
      name: "assignRoles (admin: admin role only)",
      sender: "admin",
      key: ADMIN_KEY,
      to: (m) => m,
      seeds: () => assignSeeds([ADMIN_KEY], false),
      evil: () => [...assignEvil(), rolesIface.encodeFunctionData("assignRoles", [STRANGER, [EXECUTOR_KEY], [true]])],
      fragment: "assignRoles",
      invariant: assignInvariant([ADMIN_KEY], false),
    }],
  },
];

const DICTIONARY: bigint[] = [
  0n, 1n, 2n, 3n, 4n, 5n, 2n ** 256n - 1n, 2n ** 255n, 2n ** 160n, 2n ** 160n - 1n,
  ...Array.from({ length: 48 }, (_, i) => BigInt(i * 32)),
  ...[STRANGER, ADMIN, EXECUTOR, FUND, SAFE, OLD_GOVERNOR, BASE_TOKEN, NAV_EXECUTOR, PERF_FEE].map((a) => BigInt(a)),
  // An address with dirty upper bits, and a "true" that is not 1.
  BigInt(SAFE) | (1n << 200n), BigInt(FUND) | (1n << 255n),
  ...[ADMIN_KEY, EXECUTOR_KEY, OTHER_KEY].map((k) => BigInt(k)),
];

const mutate = (
  seed: string,
  evil: string[],
  rng: () => number,
): string => {
  const pick = <T>(items: T[]): T => items[Math.floor(rng() * items.length)];
  const selector = seed.slice(0, 10);
  let words = toWords(seed.slice(10));
  const rounds = 1 + Math.floor(rng() * 3);
  for (let round = 0; round < rounds && words.length; round++) {
    const i = Math.floor(rng() * words.length);
    const strategy = Math.floor(rng() * 9);
    if (strategy === 0) {
      words[i] = word(pick(DICTIONARY));
    } else if (strategy === 1) {
      const j = Math.floor(rng() * words.length);
      [words[i], words[j]] = [words[j], words[i]];
    } else if (strategy === 2) {
      words.splice(i, 0, word(pick(DICTIONARY)));
    } else if (strategy === 3) {
      words.splice(i, 1);
    } else if (strategy === 4) {
      // Nudge a word that could be an offset or a length.
      words[i] = word(BigInt("0x" + words[i]) + pick([32n, -32n, 64n, -64n, 1n, -1n]) & (2n ** 256n - 1n));
    } else if (strategy === 5) {
      // Copy a tail to the end and point a plausible offset at the copy.
      const from = Math.floor(rng() * words.length);
      const start = words.length;
      const copy = words.slice(from);
      const twin = toWords(pick(evil).slice(10));
      // The copy carries one word from a forbidden call.
      if (copy.length && twin.length) copy[Math.floor(rng() * copy.length)] = pick(twin);
      words = [...words, ...copy];
      const offsets = words
        .map((w, index) => ({ value: BigInt("0x" + w), index }))
        .filter(({ value, index }) => index < start && value % 32n === 0n && value > 0n && value < BigInt(start * 32));
      if (offsets.length) words[pick(offsets).index] = word(BigInt((start - Math.floor(rng() * 3)) * 32));
    } else if (strategy === 6 || strategy === 7) {
      // Splice a run of words out of a forbidden call with the same layout.
      const twin = toWords(pick(evil).slice(10));
      const length = 1 + Math.floor(rng() * 4);
      for (let k = i; k < i + length && k < words.length && k < twin.length; k++) words[k] = twin[k];
    } else {
      // A forbidden call, with a run of words from the valid one.
      const twin = toWords(pick(evil).slice(10));
      const length = 1 + Math.floor(rng() * 6);
      for (let k = i; k < i + length && k < words.length && k < twin.length; k++) twin[k] = words[k];
      words = twin;
    }
  }
  let body = words.join("");
  const tail = rng();
  if (tail < 0.06) body = body.slice(0, Math.floor(rng() * body.length));
  else if (tail < 0.1) body += word(pick(DICTIONARY));
  if (body.length % 2) body = body.slice(0, -1);
  return selector + body;
};

const auditFuzz = async (
  mastercopy: string,
  blobs: Map<string, string>,
) => {
  section(`C. Differential fuzz, ${FUZZ_CASES} mutated calls per target`);
  // AUDIT_FUZZ_WORLDS=0,1,2 runs a subset, to spread the worlds over
  // several processes; seeds depend on the world's index, not on the subset.
  const wanted = process.env.AUDIT_FUZZ_WORLDS?.split(",").map(Number);
  for (const [index, fuzzWorld] of FUZZ_WORLDS.entries()) {
    if (wanted && !wanted.includes(index)) continue;
    const world = await createWorld(mastercopy, blobs);
    await world.owner(rolesBatch(world.modifier, fuzzWorld.permissions), fuzzWorld.label);
    for (const target of fuzzWorld.targets) {
      const rng = mulberry32(0x5eed + index * 977 + target.name.length);
      const seeds = target.seeds(world.modifier);
      const evil = target.evil(world.modifier);
      const sender = senderAddress(target.sender);
      const to = target.to(world.modifier);

      // Before mutating anything, the permission has to be live in both
      // directions. The seeds and twins are shared between worlds, so what
      // is expected of each is read off this world's own pins: a seed that
      // keeps every pin must pass, and any call that breaks one — seed or
      // twin — must be refused. (A twin that breaks no pin may still be
      // refused for its shape, e.g. two role keys in one call; that is the
      // permission being stricter than the invariant, which is fine.)
      const breaksPin = (data: string) => {
        try {
          target.invariant(targetIface.decodeFunctionData(target.fragment, data));
          return false;
        } catch {
          return true;
        }
      };
      let live = 0;
      let refused = 0;
      for (const seed of seeds) {
        const res = await world.exec(sender, target.key, to, seed);
        if (breaksPin(seed)) {
          refused++;
          if (res.ok) fail(`fuzz ${fuzzWorld.label} | ${target.name}: a seed that breaks a pin was ALLOWED`);
        } else {
          live++;
          if (!res.ok) fail(`fuzz ${fuzzWorld.label} | ${target.name}: a valid seed was denied (${res.err})`);
        }
      }
      for (const [twinIndex, twin] of evil.entries()) {
        if (!breaksPin(twin)) continue;
        refused++;
        const res = await world.exec(sender, target.key, to, twin);
        if (res.ok) fail(`fuzz ${fuzzWorld.label} | ${target.name}: twin #${twinIndex} breaks a pin and was ALLOWED`);
      }
      if (!live || !refused) {
        fail(`fuzz ${fuzzWorld.label} | ${target.name}: needs both a passing and a refused starting call (${live} / ${refused})`);
      }

      let allowed = 0;
      let decodable = 0;
      let violations = 0;
      const seen = new Set<string>();
      for (let n = 0; n < FUZZ_CASES; n++) {
        const data = mutate(seeds[Math.floor(rng() * seeds.length)], evil, rng);
        if (seen.has(data)) continue;
        seen.add(data);
        const res = await world.exec(sender, target.key, to, data);
        if (!res.ok) continue;
        allowed++;
        let args: ethers.Result;
        try {
          args = targetIface.decodeFunctionData(target.fragment, data);
          // Force every lazy field, so a malformed one throws here.
          args.toArray(true);
        } catch {
          // The target's own ABI decoder rejects it too: the call reverts.
          continue;
        }
        decodable++;
        try {
          target.invariant(args);
        } catch (error: any) {
          violations++;
          fail(
            `BYPASS | ${fuzzWorld.label} | ${target.name}: the modifier allowed a call that changes ${error.message}\n      ${data}`,
          );
        }
      }
      result(
        !violations,
        `${fuzzWorld.label} | ${target.name}: ${seen.size} distinct calls, ${allowed} allowed (${decodable} the target can decode), ${violations} break a pin`,
      );
    }
  }
};

// ---------------------------------------------------------------------------
// D. The two saves interleaved
// ---------------------------------------------------------------------------

const aaveSelection = (targets: string[]): IProtocolSelectionState[] =>
  targets.length
    ? [{
      protocol: "aave_v3",
      enabled: true,
      actions: [{ action: "deposit", enabled: true, params: { targets } }],
    }]
    : [];

const integrationsBatch = (world: IWorld, targets: string[], raw: string[] = []) =>
  buildIntegrationsBatch({
    chainId: "0xa4b1",
    protocolBuild: buildProtocolPermissionEntries({
      chainId: "0xa4b1",
      rolesModAddress: world.modifier,
      selections: aaveSelection(targets),
    }),
    rawEntries: raw,
    // What the step reads before saving: the modifier's own event log.
    current: reduceRoleScopeLogs(world.logs, EXECUTOR_KEY),
    fundAddress: FUND,
    baseToken: BASE_TOKEN,
    rolesModifier: world.modifier,
    // Aave is the protocol on the card throughout, including when every
    // asset is unticked: its stale grants are this save's to take back.
    protocols: ["aave_v3"],
  });

const auditInterleavedSaves = async (
  mastercopy: string,
  blobs: Map<string, string>,
) => {
  section("D. Roles and Integrations saves interleaved (Aave v3, base token = USDC)");
  const world = await createWorld(mastercopy, blobs);
  const erc20 = (fn: "transfer" | "approve", to: string, amount = 1000n) =>
    targetIface.encodeFunctionData(fn, [to, amount]);
  const supply = (asset: string) =>
    targetIface.encodeFunctionData("supply", [asset, 1000n, SAFE, 0]);

  type Expect = Partial<Record<
    | "transferToVault" | "transferElsewhere" | "approveUsdcToPool" | "approveUsdcToStranger"
    | "approveDaiToPool" | "supplyUsdc" | "supplyDai" | "updateNav" | "collectFees"
    | "adminMetadata" | "adminAddExecutor",
    boolean
  >>;
  const calls: Record<keyof Required<Expect>, [Sender, string, string, string]> = {
    transferToVault: ["executor", EXECUTOR_KEY, USDC, erc20("transfer", FUND)],
    transferElsewhere: ["executor", EXECUTOR_KEY, USDC, erc20("transfer", STRANGER)],
    approveUsdcToPool: ["executor", EXECUTOR_KEY, USDC, erc20("approve", AAVE_POOL)],
    approveUsdcToStranger: ["executor", EXECUTOR_KEY, USDC, erc20("approve", STRANGER)],
    approveDaiToPool: ["executor", EXECUTOR_KEY, DAI, erc20("approve", AAVE_POOL)],
    supplyUsdc: ["executor", EXECUTOR_KEY, AAVE_POOL, supply(USDC)],
    supplyDai: ["executor", EXECUTOR_KEY, AAVE_POOL, supply(DAI)],
    updateNav: ["executor", EXECUTOR_KEY, FUND, targetIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR])],
    collectFees: ["executor", EXECUTOR_KEY, FUND, targetIface.encodeFunctionData("fundFlowsCall", [PERF_FEE_PAYLOAD])],
    adminMetadata: ["admin", ADMIN_KEY, FUND, settings({ fundMetadata: NEW_METADATA })],
    adminAddExecutor: ["admin", ADMIN_KEY, world.modifier, buildAssignRolesCalldata(STRANGER, true, EXECUTOR_ROLE_KEY_V2)],
  };

  /**
   * The step's "Saved on the vault" list is rebuilt from the modifier's
   * event log. To prove the rebuild is exact, the rebuilt calls of both
   * roles are applied to a modifier that has seen nothing else, which must
   * then answer every probe exactly as the original does.
   */
  const mirrorMatches = async (label: string): Promise<boolean> => {
    const mirror = await createWorld(mastercopy, blobs);
    await mirror.owner(
      [
        ...storedRolePermissionCalls(world.logs, EXECUTOR_KEY),
        ...storedRolePermissionCalls(world.logs, ADMIN_KEY),
      ],
      `mirror of "${label}"`,
    );
    let same = true;
    for (const [name, [sender, key, to, data]] of Object.entries(calls)) {
      const target = to === world.modifier ? mirror.modifier : to;
      const [original, rebuilt] = await Promise.all([
        world.exec(senderAddress(sender), key, to, data),
        mirror.exec(senderAddress(sender), key, target, data),
      ]);
      if (original.ok !== rebuilt.ok) {
        same = false;
        fail(`interleaved | after "${label}" | ${name}: the rebuilt permissions ${rebuilt.ok ? "allow" : "deny"} what the stored ones ${original.ok ? "allow" : "deny"}`);
      }
    }
    return same;
  };

  const step = async (label: string, entries: string[], expected: Required<Expect>) => {
    await world.owner(entries, label);
    let bad = 0;
    if (!(await mirrorMatches(label))) bad++;
    for (const [name, [sender, key, to, data]] of Object.entries(calls)) {
      const res = await world.exec(senderAddress(sender), key, to, data);
      const want = expected[name as keyof Expect];
      if (res.ok !== want) {
        bad++;
        fail(`interleaved | after "${label}" | ${name}: expected ${want ? "allow" : "deny"}, got ${res.ok ? "allowed" : `denied ${res.err}`}`);
      }
    }
    result(!bad, `${label} (${entries.length} calls)`);
  };

  const rolesOn: Required<Expect> = {
    transferToVault: true, transferElsewhere: false, approveUsdcToPool: false, approveUsdcToStranger: false,
    approveDaiToPool: false, supplyUsdc: false, supplyDai: false, updateNav: true, collectFees: true,
    adminMetadata: true, adminAddExecutor: true,
  };
  const all = fullVaultRolePermissions();
  const noSendFunds = withPermissions((p) => { p.executor.sendFunds = false; });

  await step("Roles: every switch on", rolesBatch(world.modifier, all), rolesOn);
  // A visit that never opens a protocol on the card speaks for none: even
  // with nothing selected it must not send a single call.
  {
    const untouched = buildIntegrationsBatch({
      chainId: "0xa4b1",
      protocolBuild: buildProtocolPermissionEntries({
        chainId: "0xa4b1",
        rolesModAddress: world.modifier,
        selections: [],
      }),
      rawEntries: [],
      current: reduceRoleScopeLogs(world.logs, EXECUTOR_KEY),
      fundAddress: FUND,
      baseToken: BASE_TOKEN,
      rolesModifier: world.modifier,
      protocols: [],
    });
    if (untouched.length) fail(`interleaved | a save that touched no protocol would send ${untouched.length} call(s)`);
    result(!untouched.length, "a save that opened no protocol sends nothing");
  }
  await step("Integrations: add Aave USDC + DAI", integrationsBatch(world, ["USDC", "DAI"]),
    { ...rolesOn, approveUsdcToPool: true, approveDaiToPool: true, supplyUsdc: true, supplyDai: true });
  {
    const untouched = buildIntegrationsBatch({
      chainId: "0xa4b1",
      protocolBuild: buildProtocolPermissionEntries({
        chainId: "0xa4b1",
        rolesModAddress: world.modifier,
        selections: [],
      }),
      rawEntries: [],
      current: reduceRoleScopeLogs(world.logs, EXECUTOR_KEY),
      fundAddress: FUND,
      baseToken: BASE_TOKEN,
      rolesModifier: world.modifier,
      protocols: [],
    });
    if (untouched.length) fail(`interleaved | a later visit that opened no protocol would revoke the saved Aave grants (${untouched.length} calls)`);
    result(!untouched.length, "a later visit that opens no protocol leaves the saved Aave grants alone");
  }
  await step("Roles: switch Send funds off (base token is also an Aave reserve)", rolesBatch(world.modifier, noSendFunds),
    { ...rolesOn, transferToVault: false, approveUsdcToPool: true, approveDaiToPool: true, supplyUsdc: true, supplyDai: true });
  await step("Roles: Send funds back on", rolesBatch(world.modifier, all),
    { ...rolesOn, approveUsdcToPool: true, approveDaiToPool: true, supplyUsdc: true, supplyDai: true });
  await step("Integrations: drop USDC, keep DAI", integrationsBatch(world, ["DAI"]),
    { ...rolesOn, approveDaiToPool: true, supplyDai: true });
  await step("Roles: disable the admin role", rolesBatch(world.modifier, withPermissions((p) => { p.adminEnabled = false; })),
    { ...rolesOn, approveDaiToPool: true, supplyDai: true, adminMetadata: false, adminAddExecutor: false });
  await step("Integrations: saved again unchanged", integrationsBatch(world, ["DAI"]),
    { ...rolesOn, approveDaiToPool: true, supplyDai: true, adminMetadata: false, adminAddExecutor: false });
  await step("Roles: admin back, Send funds off", rolesBatch(world.modifier, noSendFunds),
    { ...rolesOn, transferToVault: false, approveDaiToPool: true, supplyDai: true });
  await step("Integrations: remove everything", integrationsBatch(world, []),
    { ...rolesOn, transferToVault: false });
  await step("Integrations: add USDC while Send funds is off", integrationsBatch(world, ["USDC"]),
    { ...rolesOn, transferToVault: false, approveUsdcToPool: true, supplyUsdc: true });
  await step("Roles: every switch on again", rolesBatch(world.modifier, all),
    { ...rolesOn, approveUsdcToPool: true, supplyUsdc: true });
  await step("Roles: every switch off", rolesBatch(world.modifier, withPermissions((p) => {
    for (const k of Object.keys(p.admin)) (p.admin as any)[k] = false;
    for (const k of Object.keys(p.executor)) (p.executor as any)[k] = false;
  })),
  {
    transferToVault: false, transferElsewhere: false, approveUsdcToPool: true, approveUsdcToStranger: false,
    approveDaiToPool: false, supplyUsdc: true, supplyDai: false, updateNav: false, collectFees: false,
    adminMetadata: false, adminAddExecutor: false,
  });
  await step("Integrations: remove everything", integrationsBatch(world, []),
    {
      transferToVault: false, transferElsewhere: false, approveUsdcToPool: false, approveUsdcToStranger: false,
      approveDaiToPool: false, supplyUsdc: false, supplyDai: false, updateNav: false, collectFees: false,
      adminMetadata: false, adminAddExecutor: false,
    });

  // Nothing is left granted to the executor once both steps are saved empty.
  const leftover = reduceRoleScopeLogs(world.logs, EXECUTOR_KEY);
  const clean = leftover.scopes.length === 0;
  if (!clean) fail(`interleaved | scopes left after everything was switched off: ${JSON.stringify(leftover.scopes)}`);
  result(clean, `no function grant left on the executor role (${leftover.targets.length} empty target clearance(s) remain by design)`);
};

// ---------------------------------------------------------------------------
// E. A custom role next to the two built-in ones
// ---------------------------------------------------------------------------

const auditCustomRole = async (
  mastercopy: string,
  blobs: Map<string, string>,
) => {
  section("E. A custom role beside admin and executor (Aave v3, one save for every role)");
  const world = await createWorld(mastercopy, blobs);
  const TRADER = "0x0000000000000000000000000000000000000444";
  const TRADER_ROLE = "Trader";
  const TRADER_KEY = toRoleKeyBytes32(TRADER_ROLE);

  const erc20 = (fn: "transfer" | "approve", to: string, amount = 1000n) =>
    targetIface.encodeFunctionData(fn, [to, amount]);
  const supply = (asset: string) =>
    targetIface.encodeFunctionData("supply", [asset, 1000n, SAFE, 0]);

  /** One role's share of the Permissions step's save. */
  const roleShare = (roleKey: string, targets: string[]) => ({
    chainId: "0xa4b1",
    protocolBuild: buildProtocolPermissionEntries({
      chainId: "0xa4b1",
      rolesModAddress: world.modifier,
      selections: aaveSelection(targets),
      roleKey,
    }),
    current: reduceRoleScopeLogs(world.logs, toRoleKeyBytes32(roleKey)),
    fundAddress: FUND,
    baseToken: BASE_TOKEN,
    rolesModifier: world.modifier,
    roleKey,
    protocols: ["aave_v3"],
  });
  /** The step's save: only the roles whose card was touched take part. */
  const save = (shares: Partial<Record<"executor" | "trader", string[]>>, raw: string[] = []) =>
    buildPermissionsPageBatch({
      // The switches and members are section F's subject; here only the
      // protocol cards are stored.
      prepopulated: { revokes: [], grants: [] },
      memberEntries: [],
      roles: [
        ...(shares.executor ? [roleShare(EXECUTOR_ROLE_KEY_V2, shares.executor)] : []),
        ...(shares.trader ? [roleShare(TRADER_ROLE, shares.trader)] : []),
      ],
      rawEntries: raw,
    });

  const calls = {
    executorSupplyUsdc: [EXECUTOR, EXECUTOR_KEY, AAVE_POOL, supply(USDC)],
    executorSupplyDai: [EXECUTOR, EXECUTOR_KEY, AAVE_POOL, supply(DAI)],
    executorApproveDai: [EXECUTOR, EXECUTOR_KEY, DAI, erc20("approve", AAVE_POOL)],
    executorTransferToVault: [EXECUTOR, EXECUTOR_KEY, USDC, erc20("transfer", FUND)],
    executorUpdateNav: [EXECUTOR, EXECUTOR_KEY, FUND, targetIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR])],
    traderSupplyUsdc: [TRADER, TRADER_KEY, AAVE_POOL, supply(USDC)],
    traderSupplyDai: [TRADER, TRADER_KEY, AAVE_POOL, supply(DAI)],
    traderApproveUsdc: [TRADER, TRADER_KEY, USDC, erc20("approve", AAVE_POOL)],
    traderApproveUsdcToStranger: [TRADER, TRADER_KEY, USDC, erc20("approve", STRANGER)],
    // The executor's prepopulated permissions are the executor's alone.
    traderTransferToVault: [TRADER, TRADER_KEY, USDC, erc20("transfer", FUND)],
    traderUpdateNav: [TRADER, TRADER_KEY, FUND, targetIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR])],
    traderAddsTrader: [TRADER, TRADER_KEY, world.modifier, buildAssignRolesCalldata(STRANGER, true, TRADER_ROLE)],
    // Holding one role is no way into another's permissions.
    traderAsExecutor: [TRADER, EXECUTOR_KEY, AAVE_POOL, supply(DAI)],
    executorAsTrader: [EXECUTOR, TRADER_KEY, AAVE_POOL, supply(USDC)],
    strangerAsTrader: [STRANGER, TRADER_KEY, AAVE_POOL, supply(USDC)],
    adminAsTrader: [ADMIN, TRADER_KEY, AAVE_POOL, supply(USDC)],
  } satisfies Record<string, [string, string, string, string]>;
  type Name = keyof typeof calls;
  const NEVER: Name[] = [
    "traderApproveUsdcToStranger", "traderTransferToVault", "traderUpdateNav",
    "traderAddsTrader", "traderAsExecutor", "executorAsTrader", "strangerAsTrader",
    "adminAsTrader",
  ];

  const step = async (label: string, entries: string[], allowed: Name[]) => {
    await world.owner(entries, label);
    let bad = 0;
    // What the step lists as stored for each role, replayed on a fresh
    // modifier, must answer every probe the same way.
    const mirror = await createWorld(mastercopy, blobs);
    await mirror.owner(
      [
        ...getAssignMembersRoleV2(TRADER_ROLE, [{ address: TRADER, action: "ADD" }]),
        ...[EXECUTOR_KEY, ADMIN_KEY, TRADER_KEY].flatMap((key) =>
          storedRolePermissionCalls(world.logs, key),
        ),
      ],
      `mirror of "${label}"`,
    );
    for (const name of Object.keys(calls) as Name[]) {
      const [sender, key, to, data] = calls[name];
      const res = await world.exec(sender, key, to, data);
      const rebuilt = await mirror.exec(sender, key, to === world.modifier ? mirror.modifier : to, data);
      const want = allowed.includes(name);
      if (NEVER.includes(name) && want) throw new Error(`${name} must never be expected`);
      if (res.ok !== want) {
        bad++;
        fail(`custom role | after "${label}" | ${name}: expected ${want ? "allow" : "deny"}, got ${res.ok ? "allowed" : `denied ${res.err}`}`);
      }
      if (rebuilt.ok !== res.ok) {
        bad++;
        fail(`custom role | after "${label}" | ${name}: the rebuilt permissions ${rebuilt.ok ? "allow" : "deny"} what the stored ones ${res.ok ? "allow" : "deny"}`);
      }
    }
    result(!bad, `${label} (${entries.length} calls)`);
  };

  const prepopulated: Name[] = ["executorTransferToVault", "executorUpdateNav"];
  const all = fullVaultRolePermissions();

  await step(
    "Roles: every switch on, Trader gets a member",
    [
      ...rolesBatch(world.modifier, all),
      ...getAssignMembersRoleV2(TRADER_ROLE, [{ address: TRADER, action: "ADD" }]),
    ],
    prepopulated,
  );
  {
    const custom = resolveCustomRoles(listLiveRoleKeys(world.logs), []);
    const found = custom.length === 1 && custom[0].roleKey === TRADER_ROLE && custom[0].stored;
    if (!found) fail(`custom role | the modifier's log should list exactly the Trader role, got ${JSON.stringify(custom)}`);
    result(found, "the role is found on the modifier once it has a member, under its name");
  }
  await step(
    "Permissions: executor gets Aave DAI, Trader gets Aave USDC, in one save",
    save({ executor: ["DAI"], trader: ["USDC"] }),
    [...prepopulated, "executorSupplyDai", "executorApproveDai", "traderSupplyUsdc", "traderApproveUsdc"],
  );
  await step(
    "Permissions: Trader swaps USDC for DAI, executor's card untouched",
    save({ trader: ["DAI"] }),
    [...prepopulated, "executorSupplyDai", "executorApproveDai", "traderSupplyDai"],
  );
  await step(
    "Roles: saved again with every switch on",
    rolesBatch(world.modifier, all),
    [...prepopulated, "executorSupplyDai", "executorApproveDai", "traderSupplyDai"],
  );
  await step(
    "Permissions: executor removes everything, Trader's card untouched",
    save({ executor: [] }),
    [...prepopulated, "traderSupplyDai"],
  );
  await step(
    "Permissions: Trader back to USDC, with a raw call for the executor in the same batch",
    save({ trader: ["USDC"] }, save({ executor: ["DAI"] })),
    [...prepopulated, "executorSupplyDai", "executorApproveDai", "traderSupplyUsdc", "traderApproveUsdc"],
  );
  await step(
    "Roles: the executor's Send funds switched off (Trader holds a grant on the same token)",
    rolesBatch(world.modifier, withPermissions((p) => { p.executor.sendFunds = false; })),
    ["executorUpdateNav", "executorSupplyDai", "executorApproveDai", "traderSupplyUsdc", "traderApproveUsdc"],
  );
  await step(
    "Permissions: both roles remove everything",
    save({ executor: [], trader: [] }),
    ["executorUpdateNav"],
  );
  {
    const leftover = reduceRoleScopeLogs(world.logs, TRADER_KEY);
    const clean = leftover.scopes.length === 0;
    if (!clean) fail(`custom role | scopes left on the Trader role: ${JSON.stringify(leftover.scopes)}`);
    result(clean, "no function grant left on the Trader role");
  }
  await step(
    "Roles: Trader's member removed",
    getAssignMembersRoleV2(TRADER_ROLE, [{ address: TRADER, action: "REMOVE" }]),
    ["executorUpdateNav"],
  );
};

// ---------------------------------------------------------------------------
// F. The Permissions page: every role's members, switches and protocols in
//    ONE batch
// ---------------------------------------------------------------------------

const auditPageSaves = async (
  mastercopy: string,
  blobs: Map<string, string>,
) => {
  section("F. One save for everything (switches + members + protocols of three roles + raw)");
  const world = await createWorld(mastercopy, blobs);
  const TRADER = "0x0000000000000000000000000000000000000444";
  const TRADER_ROLE = "Trader";
  const TRADER_KEY = toRoleKeyBytes32(TRADER_ROLE);

  const erc20 = (fn: "transfer" | "approve", to: string, amount = 1000n) =>
    targetIface.encodeFunctionData(fn, [to, amount]);
  const supply = (asset: string) =>
    targetIface.encodeFunctionData("supply", [asset, 1000n, SAFE, 0]);
  const navUpdate = targetIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR]);

  /** The page's save, built the way the page builds it. */
  const pageSave = (
    permissions: IVaultRolePermissions,
    cards: Partial<Record<"executor" | "trader", string[]>>,
    extra: { members?: string[]; raw?: string[] } = {},
  ) =>
    buildPermissionsPageBatch({
      prepopulated: buildPrepopulatedPermissionsBatch(context(world.modifier), permissions),
      memberEntries: extra.members ?? [],
      roles: (Object.entries(cards) as ["executor" | "trader", string[]][]).map(
        ([card, targets]) => {
          const roleKey = card === "executor" ? EXECUTOR_ROLE_KEY_V2 : TRADER_ROLE;
          return {
            chainId: "0xa4b1",
            protocolBuild: buildProtocolPermissionEntries({
              chainId: "0xa4b1",
              rolesModAddress: world.modifier,
              selections: aaveSelection(targets),
              roleKey,
            }),
            current: reduceRoleScopeLogs(world.logs, toRoleKeyBytes32(roleKey)),
            fundAddress: FUND,
            baseToken: BASE_TOKEN,
            rolesModifier: world.modifier,
            roleKey,
            protocols: ["aave_v3"],
          };
        },
      ),
      rawEntries: extra.raw ?? [],
    });

  const calls = {
    transferToVault: [EXECUTOR, EXECUTOR_KEY, USDC, erc20("transfer", FUND)],
    transferElsewhere: [EXECUTOR, EXECUTOR_KEY, USDC, erc20("transfer", STRANGER)],
    approveUsdcToPool: [EXECUTOR, EXECUTOR_KEY, USDC, erc20("approve", AAVE_POOL)],
    approveUsdcToStranger: [EXECUTOR, EXECUTOR_KEY, USDC, erc20("approve", STRANGER)],
    supplyUsdc: [EXECUTOR, EXECUTOR_KEY, AAVE_POOL, supply(USDC)],
    supplyDai: [EXECUTOR, EXECUTOR_KEY, AAVE_POOL, supply(DAI)],
    updateNav: [EXECUTOR, EXECUTOR_KEY, FUND, navUpdate],
    collectFees: [EXECUTOR, EXECUTOR_KEY, FUND, targetIface.encodeFunctionData("fundFlowsCall", [PERF_FEE_PAYLOAD])],
    executorSettings: [EXECUTOR, EXECUTOR_KEY, FUND, settings({ fundMetadata: NEW_METADATA })],
    adminMetadata: [ADMIN, ADMIN_KEY, FUND, settings({ fundMetadata: NEW_METADATA })],
    adminAddExecutor: [ADMIN, ADMIN_KEY, world.modifier, buildAssignRolesCalldata(STRANGER, true, EXECUTOR_ROLE_KEY_V2)],
    adminAddTrader: [ADMIN, ADMIN_KEY, world.modifier, buildAssignRolesCalldata(STRANGER, true, TRADER_ROLE)],
    traderSupplyDai: [TRADER, TRADER_KEY, AAVE_POOL, supply(DAI)],
    traderSupplyUsdc: [TRADER, TRADER_KEY, AAVE_POOL, supply(USDC)],
    traderTransferToVault: [TRADER, TRADER_KEY, USDC, erc20("transfer", FUND)],
    traderUpdateNav: [TRADER, TRADER_KEY, FUND, navUpdate],
  } satisfies Record<string, [string, string, string, string]>;
  type Name = keyof typeof calls;

  const step = async (label: string, entries: string[], allowed: Name[]) => {
    await world.owner(entries, label);
    let bad = 0;
    for (const name of Object.keys(calls) as Name[]) {
      const [sender, key, to, data] = calls[name];
      const res = await world.exec(sender, key, to, data);
      const want = allowed.includes(name);
      if (res.ok !== want) {
        bad++;
        fail(`one save | after "${label}" | ${name}: expected ${want ? "allow" : "deny"}, got ${res.ok ? "allowed" : `denied ${res.err}`}`);
      }
    }
    result(!bad, `${label} (${entries.length} calls)`);
  };

  const all = fullVaultRolePermissions();
  const noSendFunds = withPermissions((p) => { p.executor.sendFunds = false; });
  const switchesOn: Name[] = ["transferToVault", "updateNav", "collectFees", "adminMetadata", "adminAddExecutor"];
  const addTrader = getAssignMembersRoleV2(TRADER_ROLE, [{ address: TRADER, action: "ADD" }]);

  await step(
    "First save: every switch on, executor gets Aave USDC + DAI, Trader gets a member and Aave DAI",
    pageSave(all, { executor: ["USDC", "DAI"], trader: ["DAI"] }, { members: addTrader }),
    [...switchesOn, "approveUsdcToPool", "supplyUsdc", "supplyDai", "traderSupplyDai"],
  );
  await step(
    "Saved again, nothing changed",
    pageSave(all, { executor: ["USDC", "DAI"], trader: ["DAI"] }),
    [...switchesOn, "approveUsdcToPool", "supplyUsdc", "supplyDai", "traderSupplyDai"],
  );
  await step(
    "Send funds off, cards unchanged (the base token is also an Aave reserve)",
    pageSave(noSendFunds, { executor: ["USDC", "DAI"], trader: ["DAI"] }),
    ["updateNav", "collectFees", "adminMetadata", "adminAddExecutor", "approveUsdcToPool", "supplyUsdc", "supplyDai", "traderSupplyDai"],
  );
  await step(
    "Executor's card drops USDC while Send funds stays off: the token is closed",
    pageSave(noSendFunds, { executor: ["DAI"], trader: ["DAI"] }),
    ["updateNav", "collectFees", "adminMetadata", "adminAddExecutor", "supplyDai", "traderSupplyDai"],
  );
  await step(
    "Send funds back on and USDC added, in the same save",
    pageSave(all, { executor: ["USDC", "DAI"], trader: ["DAI"] }),
    [...switchesOn, "approveUsdcToPool", "supplyUsdc", "supplyDai", "traderSupplyDai"],
  );
  // The case the batch order exists for: the protocol diff takes the base
  // token's approve back (and would clear the token), while a switch in the
  // same save grants transfer on that same token.
  await world.owner(pageSave(noSendFunds, { executor: ["USDC", "DAI"] }), "send funds off");
  await step(
    "… Send funds on and Aave USDC removed, together",
    pageSave(all, { executor: ["DAI"] }),
    [...switchesOn, "supplyDai", "traderSupplyDai"],
  );
  await step(
    "A save that touches no protocol card leaves every stored protocol grant alone",
    pageSave(all, {}),
    [...switchesOn, "supplyDai", "traderSupplyDai"],
  );
  await step(
    "Admin switched off, Trader swaps DAI for USDC",
    pageSave(withPermissions((p) => { p.adminEnabled = false; }), { trader: ["USDC"] }),
    ["transferToVault", "updateNav", "collectFees", "supplyDai", "traderSupplyUsdc"],
  );
  // Raw calls are sent last and keep the last word, over a switch too.
  await step(
    "A raw call takes Update NAV back in the save whose switch grants it",
    pageSave(all, {}, {
      raw: [rolesIface.encodeFunctionData("revokeFunction", [EXECUTOR_KEY, FUND, navUpdate.slice(0, 10)])],
    }),
    ["transferToVault", "collectFees", "adminMetadata", "adminAddExecutor", "supplyDai", "traderSupplyUsdc"],
  );
  await step(
    "Everything off and every card emptied",
    pageSave(
      withPermissions((p) => {
        for (const k of Object.keys(p.admin)) (p.admin as any)[k] = false;
        for (const k of Object.keys(p.executor)) (p.executor as any)[k] = false;
      }),
      { executor: [], trader: [] },
      { members: getAssignMembersRoleV2(TRADER_ROLE, [{ address: TRADER, action: "REMOVE" }]) },
    ),
    [],
  );
  for (const [name, key] of [["executor", EXECUTOR_KEY], ["admin", ADMIN_KEY], ["Trader", TRADER_KEY]]) {
    const leftover = reduceRoleScopeLogs(world.logs, key);
    const clean = leftover.scopes.length === 0;
    if (!clean) fail(`one save | scopes left on the ${name} role: ${JSON.stringify(leftover.scopes)}`);
    result(clean, `no function grant left on the ${name} role`);
  }
};

const main = async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const only = process.env.AUDIT_ONLY?.split(",");
  const runs = (part: string) => !only || only.includes(part);
  for (const [version, mastercopy] of MASTERCOPIES) {
    // AUDIT_MASTERCOPY=<address prefix> runs one build only, so the two can
    // be audited side by side in separate processes.
    const wanted = process.env.AUDIT_MASTERCOPY?.toLowerCase();
    if (wanted && !mastercopy.toLowerCase().startsWith(wanted)) continue;
    const blobs = await loadLinkedCode(provider, mastercopy);
    console.log(`\nRoles ${version} ${mastercopy}`);
    const started = Date.now();
    if (runs("A")) await auditCombinations(mastercopy, blobs);
    if (runs("B")) await auditHardLimits(mastercopy, blobs);
    if (runs("C")) await auditFuzz(mastercopy, blobs);
    if (runs("D")) await auditInterleavedSaves(mastercopy, blobs);
    if (runs("E")) await auditCustomRole(mastercopy, blobs);
    if (runs("F")) await auditPageSaves(mastercopy, blobs);
    console.log(`  (${Math.round((Date.now() - started) / 1000)}s)`);
  }
  if (failures) {
    console.log(`\n${failures} FAILURE(S):`);
    for (const line of failureLines) console.log("  " + line);
    process.exit(1);
  }
  console.log("\nAUDIT PASSED");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
