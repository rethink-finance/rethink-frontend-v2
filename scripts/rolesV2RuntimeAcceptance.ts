/**
 * Runtime acceptance matrix for the generated Roles V2 permission batch.
 *
 * Runs the EXACT deployed Roles v2 bytecode — both the 2.1.0 mastercopy the
 * V1.5 factory's beacon originally pointed at and the patched 2.1.1 one it
 * was upgraded to, each with the libraries its bytecode links (identical
 * bytecode on HyperEVM / Base / Arbitrum) — inside an in-process EVM,
 * applies the exact prepopulated batch the Permissions step generates for
 * its two roles (admin, executor), and asserts the allow/deny matrix for
 * execTransactionWithRole.
 *
 * This is the fork-test substitute that needs no fork node. What it cannot
 * cover (fund-side behavior, not Roles encoding): the GovernableFund
 * governance gate before/after activation and the slot-268 whitelist flip —
 * those need a real fork with a deployed V1.5 fund.
 *
 * Run with:  npm run test:roles-v2-acceptance
 * (fetches the code blobs from an Arbitrum RPC; override with
 *  ROLES_V2_ACCEPTANCE_RPC)
 */
import { VM } from "@ethereumjs/vm";
import { Common, Hardfork } from "@ethereumjs/common";
import { Address, bytesToHex, hexToBytes } from "@ethereumjs/util";
import { ethers } from "ethers";
import { encodeFunctionCall } from "web3-eth-abi";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import {
  ADMIN_ROLE_KEY_V2,
  EXECUTOR_ROLE_KEY_V2,
  generateNAVPermissionRolesV2,
  getScopeTargetV2,
} from "~/composables/nav/generateNAVPermission";
import {
  generateCollectFeesPermissionRolesV2,
  generateSendFundsPermissionRolesV2,
  generateUpdateSettingsPermissionRolesV2,
  parseUpdateSettingsPinnedValues,
} from "~/composables/permissions/rolesV2Permissions";
import {
  buildPrepopulatedPermissionsBatch,
  fullVaultRolePermissions,
  type IVaultRolePermissions,
} from "~/composables/permissions/vaultRoles";

const RPC =
  process.env.ROLES_V2_ACCEPTANCE_RPC ?? "https://arb1.arbitrum.io/rpc";

// Roles v2 mastercopies, deployed deterministically on all supported chains.
const MASTERCOPIES: [string, string][] = [
  ["2.1.0", "0x9646fDAD06d3e24444381f44362a3B0eB343D337"],
  ["2.1.1 (patched)", "0xF2964CE6161ce0e75964Fe7927cE114cb0B283D5"],
];

// Fixture world
const OWNER = "0x0000000000000000000000000000000000000111";
const ADMIN = "0x0000000000000000000000000000000000000a11";
const EXECUTOR = "0x0000000000000000000000000000000000000222";
const OTHER_EXECUTOR = "0x0000000000000000000000000000000000000223";
const STRANGER = "0x0000000000000000000000000000000000000333";
const FUND = "0x00000000000000000000000000000000000f00d1";
const BASE_TOKEN = "0x00000000000000000000000000000000000b0001";
const NAV_EXECUTOR = "0x000000000000000000000000000000000000aa01";
const PERF_FEE = "0x000000000000000000000000000000000000fee1";
const SAFE = "0x000000000000000000000000000000000005afe1";
const OLD_GOVERNOR = "0x0000000000000000000000000000000000006041";

const ADMIN_KEY = ethers.encodeBytes32String(ADMIN_ROLE_KEY_V2);
const EXECUTOR_KEY = ethers.encodeBytes32String(EXECUTOR_ROLE_KEY_V2);
const OTHER_KEY = ethers.encodeBytes32String("someOtherRole");
const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

const METADATA = "{\"photoUrl\":\"x\"}";

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
  allowedDepositAddrs: [],
  allowedManagers: [],
  governanceToken: "0x000000000000000000000000000000000000c0a1",
  fundAddress: FUND,
  governor: OLD_GOVERNOR,
  fundName: "Fixture Fund",
  fundSymbol: "FIX",
  feeCollectors: [
    "0x5555555555555555555555555555555555555555",
    "0x6666666666666666666666666666666666666666",
    "0x7777777777777777777777777777777777777777",
    "0x8888888888888888888888888888888888888888",
  ],
};

const SETTINGS_TYPE =
  "(uint256 depositFee, uint256 withdrawFee, uint256 performanceFee," +
  " uint256 managementFee, uint256 performaceHurdleRateBps," +
  " address baseToken, address safe, bool isExternalGovTokenInUse," +
  " bool isWhitelistedDeposits, address[] allowedDepositAddrs," +
  " address[] allowedManagers, address governanceToken," +
  " address fundAddress, address governor, string fundName," +
  " string fundSymbol, address[4] feeCollectors)";
const fundIface = new ethers.Interface([
  `function updateSettings(${SETTINGS_TYPE} _fundSettings, string _fundMetadata, uint256 _feePerformancePeriod, uint256 _feeManagePeriod)`,
  "function executeNAVUpdate(address navExecutor)",
  "function fundFlowsCall(bytes data)",
  "function transfer(address recipient, uint256 amount)",
]);

/** The batch the Permissions step submits for these switches. */
const buildBatch = (
  rolesModifier: string,
  permissions: IVaultRolePermissions,
): string[] => {
  const { revokes, grants } = buildPrepopulatedPermissionsBatch(
    {
      fundAddress: FUND,
      baseToken: BASE_TOKEN,
      rolesModifier,
      navExecutor: NAV_EXECUTOR,
      poolPerformanceFee: PERF_FEE,
      rawSettings,
      fundMetadata: METADATA,
      feePerformancePeriod: "90",
      feeManagePeriod: "0",
    },
    permissions,
  );
  return [...revokes, ...grants];
};

/**
 * What the step stored before the admin role existed: everything on the
 * executor role, with assignRoles wildcarded. A vault that saved this and
 * saves again must end up exactly where a fresh vault does.
 */
const buildLegacyBatch = (rolesModifier: string): string[] => {
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

const baseSettings = () => ({
  depositFee: 100n,
  withdrawFee: 0n,
  performanceFee: 2000n,
  managementFee: 100n,
  performaceHurdleRateBps: 0n,
  baseToken: BASE_TOKEN,
  safe: SAFE,
  isExternalGovTokenInUse: false,
  isWhitelistedDeposits: true,
  allowedDepositAddrs: [] as string[],
  allowedManagers: [] as string[],
  governanceToken: rawSettings.governanceToken,
  fundAddress: FUND,
  governor: SAFE, // the permission requires echoing the SAFE
  fundName: "Fixture Fund",
  fundSymbol: "FIX",
  feeCollectors: rawSettings.feeCollectors,
});

const updateSettingsData = (
  mutate: (s: ReturnType<typeof baseSettings>) => void = () => {},
  meta = METADATA,
  perf = 90n,
  manage = 0n,
) => {
  const s = baseSettings();
  mutate(s);
  return fundIface.encodeFunctionData("updateSettings", [s, meta, perf, manage]);
};

const assignRoles = (member: string, keys: string[], memberOf: boolean[]) =>
  rolesIface.encodeFunctionData("assignRoles", [member, keys, memberOf]);

const NEW_COLLECTORS = [
  "0x9999999999999999999999999999999999999999",
  "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
  "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
  "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
];

type Sender = "admin" | "executor";
// [label, sender, role key used, target, calldata, expected to be allowed]
type Scenario = [string, Sender, string, string, string, boolean];

const settingsFrozenScenarios = (sender: Sender, key: string): Scenario[] => [
  ["performanceFee +1", sender, key, FUND, updateSettingsData((s) => { s.performanceFee = 2001n; }), false],
  ["managementFee +1", sender, key, FUND, updateSettingsData((s) => { s.managementFee = 101n; }), false],
  ["depositFee -1", sender, key, FUND, updateSettingsData((s) => { s.depositFee = 99n; }), false],
  ["withdrawFee +1", sender, key, FUND, updateSettingsData((s) => { s.withdrawFee = 1n; }), false],
  ["hurdle rate +1", sender, key, FUND, updateSettingsData((s) => { s.performaceHurdleRateBps = 1n; }), false],
  ["fundName changed", sender, key, FUND, updateSettingsData((s) => { s.fundName = "Evil Fund"; }), false],
  ["fundSymbol changed", sender, key, FUND, updateSettingsData((s) => { s.fundSymbol = "EVL"; }), false],
  ["governor echoed as old governor", sender, key, FUND, updateSettingsData((s) => { s.governor = OLD_GOVERNOR; }), false],
  ["baseToken changed", sender, key, FUND, updateSettingsData((s) => { s.baseToken = STRANGER; }), false],
  ["safe changed", sender, key, FUND, updateSettingsData((s) => { s.safe = STRANGER; }), false],
  ["governanceToken changed", sender, key, FUND, updateSettingsData((s) => { s.governanceToken = STRANGER; }), false],
  ["allowedManagers non-empty", sender, key, FUND, updateSettingsData((s) => { s.allowedManagers = [STRANGER]; }), false],
  ["feePerformancePeriod +1", sender, key, FUND, updateSettingsData(() => {}, METADATA, 91n, 0n), false],
  ["feeManagePeriod +1", sender, key, FUND, updateSettingsData(() => {}, METADATA, 90n, 1n), false],
  // Moving a fee destination must never smuggle a fee change in with it.
  ["fee destination + performanceFee", sender, key, FUND, updateSettingsData((s) => { s.feeCollectors = NEW_COLLECTORS; s.performanceFee = 2001n; }), false],
];

const modifierAdminDenied = (
  sender: Sender,
  key: string,
  modifier: string,
): Scenario[] => [
  ["scopeTarget", sender, key, modifier, rolesIface.encodeFunctionData("scopeTarget", [key, STRANGER]), false],
  ["allowTarget", sender, key, modifier, rolesIface.encodeFunctionData("allowTarget", [key, STRANGER, 0]), false],
  ["scopeFunction", sender, key, modifier, rolesIface.encodeFunctionData("scopeFunction", [key, STRANGER, "0x11223344", [[0, 5, 5, "0x"]], 0]), false],
  ["allowFunction", sender, key, modifier, rolesIface.encodeFunctionData("allowFunction", [key, STRANGER, "0x11223344", 0]), false],
  ["revokeFunction", sender, key, modifier, rolesIface.encodeFunctionData("revokeFunction", [key, FUND, "0xa61f5814"]), false],
  ["setDefaultRole", sender, key, modifier, rolesIface.encodeFunctionData("setDefaultRole", [STRANGER, key]), false],
  ["transferOwnership", sender, key, modifier, rolesIface.encodeFunctionData("transferOwnership", [STRANGER]), false],
  ["enableModule", sender, key, modifier, rolesIface.encodeFunctionData("enableModule", [STRANGER]), false],
  ["unscoped target", sender, key, STRANGER, "0xdeadbeef", false],
];

/** Everything on: the batch a new vault gets by default. */
const fullMatrix = (modifier: string): Scenario[] => [
  // --- Admin (role 1) ---
  ["admin: whitelist delta only", "admin", ADMIN_KEY, FUND, updateSettingsData((s) => { s.allowedDepositAddrs = [STRANGER]; }), true],
  ["admin: metadata only", "admin", ADMIN_KEY, FUND, updateSettingsData(() => {}, "{\"photoUrl\":\"y\"}"), true],
  ["admin: whitelist enforcement off", "admin", ADMIN_KEY, FUND, updateSettingsData((s) => { s.isWhitelistedDeposits = false; }), true],
  ["admin: whitelist enforcement off + delta", "admin", ADMIN_KEY, FUND, updateSettingsData((s) => { s.isWhitelistedDeposits = false; s.allowedDepositAddrs = [STRANGER]; }), true],
  ["admin: one fee destination changed", "admin", ADMIN_KEY, FUND, updateSettingsData((s) => { s.feeCollectors = [STRANGER, ...s.feeCollectors.slice(1)]; }), true],
  ["admin: all fee destinations + metadata", "admin", ADMIN_KEY, FUND, updateSettingsData((s) => { s.feeCollectors = NEW_COLLECTORS; }, "{\"m\":1}"), true],
  ...settingsFrozenScenarios("admin", ADMIN_KEY).map(
    ([label, ...rest]) => [`admin: ${label}`, ...rest] as Scenario,
  ),
  ["admin: add an executor", "admin", ADMIN_KEY, modifier, assignRoles(STRANGER, [EXECUTOR_KEY], [true]), true],
  ["admin: remove an executor", "admin", ADMIN_KEY, modifier, assignRoles(EXECUTOR, [EXECUTOR_KEY], [false]), true],
  ["admin: assign the admin role (transfer, step 1)", "admin", ADMIN_KEY, modifier, assignRoles(STRANGER, [ADMIN_KEY], [true]), true],
  ["admin: drop its own admin role (transfer, step 2)", "admin", ADMIN_KEY, modifier, assignRoles(ADMIN, [ADMIN_KEY], [false]), true],
  ["admin: assign an unlisted role", "admin", ADMIN_KEY, modifier, assignRoles(STRANGER, [OTHER_KEY], [true]), false],
  ["admin: unlisted role beside the executor role", "admin", ADMIN_KEY, modifier, assignRoles(STRANGER, [EXECUTOR_KEY, OTHER_KEY], [true, true]), false],
  ["admin: unlisted role ahead of the executor role", "admin", ADMIN_KEY, modifier, assignRoles(STRANGER, [OTHER_KEY, EXECUTOR_KEY], [true, true]), false],
  ["admin: both listed roles in one call", "admin", ADMIN_KEY, modifier, assignRoles(STRANGER, [EXECUTOR_KEY, ADMIN_KEY], [true, true]), false],
  ["admin: empty role list", "admin", ADMIN_KEY, modifier, assignRoles(STRANGER, [], []), false],
  ["admin: executeNAVUpdate", "admin", ADMIN_KEY, FUND, fundIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR]), false],
  ["admin: ERC20 transfer to fund", "admin", ADMIN_KEY, BASE_TOKEN, fundIface.encodeFunctionData("transfer", [FUND, 12345n]), false],
  ["admin: fundFlowsCall(mint perf fee)", "admin", ADMIN_KEY, FUND, fundIface.encodeFunctionData("fundFlowsCall", ["0xa52eb8be" + abiCoder.encode(["address"], [PERF_FEE]).slice(2)]), false],
  ["admin: under the executor role key", "admin", EXECUTOR_KEY, FUND, fundIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR]), false],
  ...modifierAdminDenied("admin", ADMIN_KEY, modifier).map(
    ([label, ...rest]) => [`admin: ${label}`, ...rest] as Scenario,
  ),

  // --- Executor (role 2) ---
  ["executor: ERC20 transfer to fund", "executor", EXECUTOR_KEY, BASE_TOKEN, fundIface.encodeFunctionData("transfer", [FUND, 12345n]), true],
  ["executor: ERC20 transfer elsewhere", "executor", EXECUTOR_KEY, BASE_TOKEN, fundIface.encodeFunctionData("transfer", [EXECUTOR, 12345n]), false],
  ["executor: executeNAVUpdate(executor)", "executor", EXECUTOR_KEY, FUND, fundIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR]), true],
  ["executor: executeNAVUpdate(other)", "executor", EXECUTOR_KEY, FUND, fundIface.encodeFunctionData("executeNAVUpdate", [EXECUTOR]), false],
  ["executor: fundFlowsCall(mint perf fee)", "executor", EXECUTOR_KEY, FUND, fundIface.encodeFunctionData("fundFlowsCall", ["0xa52eb8be" + abiCoder.encode(["address"], [PERF_FEE]).slice(2)]), true],
  ["executor: fundFlowsCall(other payload)", "executor", EXECUTOR_KEY, FUND, fundIface.encodeFunctionData("fundFlowsCall", ["0xa52eb8be" + abiCoder.encode(["address"], [EXECUTOR]).slice(2)]), false],
  ["executor: revoke its own role", "executor", EXECUTOR_KEY, modifier, assignRoles(EXECUTOR, [EXECUTOR_KEY], [false]), true],
  // Not a wish, a fact to keep visible: a condition sees calldata, never
  // the caller, so removals cannot be limited to the sender's own address.
  ["executor: revoke ANOTHER executor (conditions cannot see the caller)", "executor", EXECUTOR_KEY, modifier, assignRoles(OTHER_EXECUTOR, [EXECUTOR_KEY], [false]), true],
  ["executor: add an executor", "executor", EXECUTOR_KEY, modifier, assignRoles(STRANGER, [EXECUTOR_KEY], [true]), false],
  ["executor: re-add itself", "executor", EXECUTOR_KEY, modifier, assignRoles(EXECUTOR, [EXECUTOR_KEY], [true]), false],
  ["executor: remove one, add one in the same call", "executor", EXECUTOR_KEY, modifier, assignRoles(STRANGER, [EXECUTOR_KEY, EXECUTOR_KEY], [false, true]), false],
  ["executor: take the admin role", "executor", EXECUTOR_KEY, modifier, assignRoles(EXECUTOR, [ADMIN_KEY], [true]), false],
  ["executor: remove an admin", "executor", EXECUTOR_KEY, modifier, assignRoles(ADMIN, [ADMIN_KEY], [false]), false],
  ["executor: metadata only", "executor", EXECUTOR_KEY, FUND, updateSettingsData(() => {}, "{\"photoUrl\":\"y\"}"), false],
  ["executor: whitelist delta", "executor", EXECUTOR_KEY, FUND, updateSettingsData((s) => { s.allowedDepositAddrs = [STRANGER]; }), false],
  ["executor: fee destination changed", "executor", EXECUTOR_KEY, FUND, updateSettingsData((s) => { s.feeCollectors = NEW_COLLECTORS; }), false],
  ["executor: under the admin role key", "executor", ADMIN_KEY, FUND, updateSettingsData(() => {}, "{\"photoUrl\":\"y\"}"), false],
  ...modifierAdminDenied("executor", EXECUTOR_KEY, modifier).map(
    ([label, ...rest]) => [`executor: ${label}`, ...rest] as Scenario,
  ),
];

const withPermissions = (
  change: (permissions: IVaultRolePermissions) => void,
): IVaultRolePermissions => {
  const permissions = fullVaultRolePermissions();
  change(permissions);
  return permissions;
};

const allOff = (): IVaultRolePermissions =>
  withPermissions((p) => {
    for (const key of Object.keys(p.admin)) (p.admin as any)[key] = false;
    for (const key of Object.keys(p.executor)) (p.executor as any)[key] = false;
  });

interface IWorld {
  label: string;
  /** Batches applied in order, as the modifier's owner. */
  batches: (modifier: string) => string[][];
  scenarios: (modifier: string) => Scenario[];
}

const adminSettingsProbe = (
  modifier: string,
  expected: { metadata: boolean; whitelist: boolean; feeDestinations: boolean },
): Scenario[] => [
  ["admin: metadata only", "admin", ADMIN_KEY, FUND, updateSettingsData(() => {}, "{\"photoUrl\":\"y\"}"), expected.metadata],
  ["admin: whitelist delta only", "admin", ADMIN_KEY, FUND, updateSettingsData((s) => { s.allowedDepositAddrs = [STRANGER]; }), expected.whitelist],
  ["admin: whitelist enforcement off", "admin", ADMIN_KEY, FUND, updateSettingsData((s) => { s.isWhitelistedDeposits = false; }), expected.whitelist],
  ["admin: fee destinations changed", "admin", ADMIN_KEY, FUND, updateSettingsData((s) => { s.feeCollectors = NEW_COLLECTORS; }), expected.feeDestinations],
  ["admin: performanceFee +1", "admin", ADMIN_KEY, FUND, updateSettingsData((s) => { s.performanceFee = 2001n; }), false],
  // An unchanged echo passes whenever any part of the permission is granted.
  ["admin: unchanged echo", "admin", ADMIN_KEY, FUND, updateSettingsData(), expected.metadata || expected.whitelist || expected.feeDestinations],
  ["admin: scopeTarget", "admin", ADMIN_KEY, modifier, rolesIface.encodeFunctionData("scopeTarget", [ADMIN_KEY, STRANGER]), false],
];

const settingsOnly = (
  open: { metadata: boolean; whitelist: boolean; feeDestinations: boolean },
) =>
  withPermissions((p) => {
    p.admin.updateMetadata = open.metadata;
    p.admin.manageWhitelist = open.whitelist;
    p.admin.changeFeeDestinations = open.feeDestinations;
  });

const SETTINGS_COMBINATIONS = [
  { metadata: true, whitelist: false, feeDestinations: false },
  { metadata: false, whitelist: true, feeDestinations: false },
  { metadata: false, whitelist: false, feeDestinations: true },
  { metadata: true, whitelist: true, feeDestinations: false },
  { metadata: false, whitelist: true, feeDestinations: true },
  { metadata: false, whitelist: false, feeDestinations: false },
];

const memberProbe = (
  modifier: string,
  expected: { executor: boolean; admin: boolean; selfRevoke: boolean },
): Scenario[] => [
  ["admin: add an executor", "admin", ADMIN_KEY, modifier, assignRoles(STRANGER, [EXECUTOR_KEY], [true]), expected.executor],
  ["admin: remove an executor", "admin", ADMIN_KEY, modifier, assignRoles(EXECUTOR, [EXECUTOR_KEY], [false]), expected.executor],
  ["admin: assign the admin role", "admin", ADMIN_KEY, modifier, assignRoles(STRANGER, [ADMIN_KEY], [true]), expected.admin],
  ["admin: drop its own admin role", "admin", ADMIN_KEY, modifier, assignRoles(ADMIN, [ADMIN_KEY], [false]), expected.admin],
  ["admin: assign an unlisted role", "admin", ADMIN_KEY, modifier, assignRoles(STRANGER, [OTHER_KEY], [true]), false],
  ["executor: revoke its own role", "executor", EXECUTOR_KEY, modifier, assignRoles(EXECUTOR, [EXECUTOR_KEY], [false]), expected.selfRevoke],
  ["executor: add an executor", "executor", EXECUTOR_KEY, modifier, assignRoles(STRANGER, [EXECUTOR_KEY], [true]), false],
  ["executor: take the admin role", "executor", EXECUTOR_KEY, modifier, assignRoles(EXECUTOR, [ADMIN_KEY], [true]), false],
];

const everythingDenied = (modifier: string): Scenario[] =>
  fullMatrix(modifier).map(
    ([label, sender, key, to, data]) =>
      [label, sender, key, to, data, false] as Scenario,
  );

const WORLDS: IWorld[] = [
  {
    label: "every switch on",
    batches: (m) => [buildBatch(m, fullVaultRolePermissions())],
    scenarios: fullMatrix,
  },
  ...SETTINGS_COMBINATIONS.map(
    (open): IWorld => ({
      label: `admin settings: ${
        Object.entries(open)
          .filter(([, on]) => on)
          .map(([name]) => name)
          .join(" + ") || "none"
      }`,
      batches: (m) => [buildBatch(m, settingsOnly(open))],
      scenarios: (m) => adminSettingsProbe(m, open),
    }),
  ),
  {
    label: "admin manages executors only; executor cannot self-revoke",
    batches: (m) => [
      buildBatch(
        m,
        withPermissions((p) => {
          p.admin.transferAdminRole = false;
          p.executor.selfRevoke = false;
        }),
      ),
    ],
    scenarios: (m) =>
      memberProbe(m, { executor: true, admin: false, selfRevoke: false }),
  },
  {
    label: "admin transfers the admin role only",
    batches: (m) => [
      buildBatch(
        m,
        withPermissions((p) => {
          p.admin.manageExecutorMembers = false;
        }),
      ),
    ],
    scenarios: (m) =>
      memberProbe(m, { executor: false, admin: true, selfRevoke: true }),
  },
  {
    label: "admin has no membership powers",
    batches: (m) => [
      buildBatch(
        m,
        withPermissions((p) => {
          p.admin.manageExecutorMembers = false;
          p.admin.transferAdminRole = false;
        }),
      ),
    ],
    scenarios: (m) =>
      memberProbe(m, { executor: false, admin: false, selfRevoke: true }),
  },
  {
    label: "admin role enabled, then disabled",
    batches: (m) => [
      buildBatch(m, fullVaultRolePermissions()),
      buildBatch(
        m,
        withPermissions((p) => {
          p.adminEnabled = false;
        }),
      ),
    ],
    // The admin loses everything; the executor keeps exactly what it had.
    scenarios: (m) =>
      fullMatrix(m).map(
        ([label, sender, key, to, data, allowed]) =>
          [label, sender, key, to, data, sender === "admin" ? false : allowed] as Scenario,
      ),
  },
  {
    label: "saved before the admin role existed, then saved again",
    batches: (m) => [
      buildLegacyBatch(m),
      buildBatch(m, fullVaultRolePermissions()),
    ],
    scenarios: fullMatrix,
  },
  {
    label: "every switch on, then every switch off",
    batches: (m) => [
      buildBatch(m, fullVaultRolePermissions()),
      buildBatch(m, allOff()),
    ],
    scenarios: everythingDenied,
  },
  {
    label: "legacy save, then every switch off",
    batches: (m) => [buildLegacyBatch(m), buildBatch(m, allOff())],
    scenarios: everythingDenied,
  },
];

const decodeErr = (ret: string) => {
  try {
    const parsed = rolesIface.parseError(ret);
    if (!parsed) return ret.slice(0, 10);
    return parsed.name === "ConditionViolation"
      ? `ConditionViolation(status=${parsed.args[0]})`
      : parsed.name;
  } catch {
    return ret.slice(0, 10);
  }
};

/**
 * The mastercopy's code plus every contract its bytecode links: addresses
 * are read out of the PUSH20s (Integrity, Packer, and through Packer the
 * EIP-2470 singleton factory WriteOnce deploys with), so a new mastercopy
 * needs no hand-kept list here.
 */
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

const runWorld = async (
  mastercopy: string,
  blobs: Map<string, string>,
  world: IWorld,
): Promise<number> => {
  const common = new Common({ chain: "mainnet", hardfork: Hardfork.Cancun });
  const vm = await VM.create({ common });
  const putCode = (addr: string, codeHex: string) =>
    vm.stateManager.putContractCode(
      Address.fromString(addr),
      hexToBytes(codeHex as `0x${string}`),
    );
  for (const [address, code] of blobs) await putCode(address, code);
  // Mock avatar/target Safe: any call returns one 32-byte word = 1, so
  // execTransactionFromModule reports success. The permission check under
  // test runs BEFORE this call.
  await putCode(SAFE, "0x600160005260206000f3");

  const call = async (from: string, to: string, dataHex: string) => {
    const res = await vm.evm.runCall({
      caller: Address.fromString(from),
      to: Address.fromString(to),
      data: hexToBytes(dataHex as `0x${string}`),
      gasLimit: 60_000_000n,
    });
    return {
      ok: !res.execResult.exceptionError,
      ret: bytesToHex(res.execResult.returnValue ?? new Uint8Array()),
    };
  };

  // Fresh storage in this VM, so the mastercopy is uninitialized here and
  // setUp works: owner = OWNER, avatar = target = mock SAFE.
  const setUp = await call(
    OWNER,
    mastercopy,
    rolesIface.encodeFunctionData("setUp", [
      abiCoder.encode(["address", "address", "address"], [OWNER, SAFE, SAFE]),
    ]),
  );
  if (!setUp.ok) throw new Error(`setUp failed: ${decodeErr(setUp.ret)}`);

  for (const [b, batch] of world.batches(mastercopy).entries()) {
    for (const [i, entry] of batch.entries()) {
      const res = await call(OWNER, mastercopy, entry);
      if (!res.ok) {
        const name = rolesIface.parseTransaction({ data: entry })?.name;
        throw new Error(
          `${world.label}: batch ${b}[${i}] ${name} rejected: ${decodeErr(res.ret)}`,
        );
      }
    }
  }
  for (const [member, key] of [
    [ADMIN, ADMIN_KEY],
    [EXECUTOR, EXECUTOR_KEY],
    [OTHER_EXECUTOR, EXECUTOR_KEY],
  ]) {
    const assign = await call(OWNER, mastercopy, assignRoles(member, [key], [true]));
    if (!assign.ok) throw new Error("assignRoles failed");
  }

  let failures = 0;
  const scenarios = world.scenarios(mastercopy);
  for (const [label, sender, key, to, data, expectAllowed] of scenarios) {
    const res = await call(
      sender === "admin" ? ADMIN : EXECUTOR,
      mastercopy,
      rolesIface.encodeFunctionData("execTransactionWithRole", [
        to,
        0n,
        data,
        0,
        key,
        true,
      ]),
    );
    const pass = res.ok === expectAllowed;
    if (!pass) failures++;
    if (!pass || process.env.VERBOSE) {
      console.log(
        `  ${pass ? "PASS" : "FAIL"} | ${label} | expected ${
          expectAllowed ? "allow" : "deny"
        }, got ${res.ok ? "allowed" : `denied ${decodeErr(res.ret)}`}`,
      );
    }
  }
  console.log(
    `${failures ? "FAIL" : "PASS"} | ${world.label} — ${
      scenarios.length - failures
    }/${scenarios.length}`,
  );
  return failures;
};

const main = async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  let failures = 0;
  for (const [version, mastercopy] of MASTERCOPIES) {
    const blobs = await loadLinkedCode(provider, mastercopy);
    console.log(
      `\nRoles ${version} ${mastercopy} (+${blobs.size - 1} linked contracts)`,
    );
    for (const world of WORLDS) {
      failures += await runWorld(mastercopy, blobs, world);
    }
  }
  if (failures > 0) throw new Error(`${failures} scenario(s) failed`);
  console.log("\nALL SCENARIOS PASS");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
