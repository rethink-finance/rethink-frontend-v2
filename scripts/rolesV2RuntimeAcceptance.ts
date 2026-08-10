/**
 * Runtime acceptance matrix for the generated Roles V2 permission batch.
 *
 * Runs the EXACT deployed Roles v2.1 bytecode (the mastercopy the V1.5
 * factory's beacon points at, plus its linked Integrity/Packer libraries
 * and the EIP-2470 singleton factory WriteOnce deploys through — identical
 * bytecode on HyperEVM / Base / Arbitrum) inside an in-process EVM, applies
 * the exact permission batch the frontend generates with every toggle on,
 * and asserts the allow/deny matrix for execTransactionWithRole.
 *
 * This is the fork-test substitute that needs no fork node. What it cannot
 * cover (fund-side behavior, not Roles encoding): the GovernableFund
 * governance gate before/after activation and the slot-268 whitelist flip —
 * those need a real fork with a deployed V1.5 fund.
 *
 * Run with:  npm run test:roles-v2-acceptance
 * (fetches the four code blobs from an Arbitrum RPC; override with
 *  ROLES_V2_ACCEPTANCE_RPC)
 */
import { VM } from "@ethereumjs/vm";
import { Common, Hardfork } from "@ethereumjs/common";
import { Address, bytesToHex, hexToBytes } from "@ethereumjs/util";
import { ethers } from "ethers";
import { encodeFunctionCall } from "web3-eth-abi";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import {
  DEFAULT_ROLE_KEY_V2,
  defaultScopedTargetPermissionRolesV2,
  generateNAVPermissionRolesV2,
  getScopeTargetV2,
  rolesV2WriteFunctionAbiMap,
} from "~/composables/nav/generateNAVPermission";
import {
  generateManageRoleMembersPermissionRolesV2,
  generateUpdateSettingsPermissionRolesV2,
  parseUpdateSettingsPinnedValues,
} from "~/composables/permissions/rolesV2Permissions";

const RPC =
  process.env.ROLES_V2_ACCEPTANCE_RPC ?? "https://arb1.arbitrum.io/rpc";

// Canonical Roles v2.1 mastercopy + linked code, deployed deterministically
// on all supported chains (verified identical on HyperEVM/Base/Arbitrum).
const MASTERCOPY = "0x9646fDAD06d3e24444381f44362a3B0eB343D337";
const LINKED_CODE = [
  MASTERCOPY,
  "0x6a6af4b16458bc39817e4019fb02bd3b26d41049", // Integrity
  "0x61c5b1be435391fdd7bc6703f3740c0d11728a8c", // Packer
  "0xce0042b868300000d44a59004da54a005ffdcf9f", // EIP-2470 singleton factory
];

// Fixture world
const OWNER = "0x0000000000000000000000000000000000000111";
const MANAGER = "0x0000000000000000000000000000000000000222";
const FUND = "0x00000000000000000000000000000000000f00d1";
const BASE_TOKEN = "0x00000000000000000000000000000000000b0001";
const NAV_EXECUTOR = "0x000000000000000000000000000000000000aa01";
const PERF_FEE = "0x000000000000000000000000000000000000fee1";
const SAFE = "0x000000000000000000000000000000000005afe1";
const OLD_GOVERNOR = "0x0000000000000000000000000000000000006041";

const ROLE_KEY = ethers.encodeBytes32String(DEFAULT_ROLE_KEY_V2);
const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

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

/**
 * The batch storePermissionsV2 submits with every toggle on. The
 * collect-fees entry mirrors the inline block in
 * components/onboarding/Permissions.vue.
 */
const buildFullBatch = (): string[] => {
  const entries: string[] = [];
  entries.push(...generateNAVPermissionRolesV2(FUND, NAV_EXECUTOR));
  entries.push(getScopeTargetV2(DEFAULT_ROLE_KEY_V2, BASE_TOKEN));
  entries.push(
    defaultScopedTargetPermissionRolesV2(
      DEFAULT_ROLE_KEY_V2,
      BASE_TOKEN,
      "0xa9059cbb",
      FUND,
    ),
  );
  const innerBytes =
    "0xa52eb8be" + abiCoder.encode(["address"], [PERF_FEE]).slice(2);
  entries.push(
    encodeFunctionCall(rolesV2WriteFunctionAbiMap.scopeFunction, [
      ROLE_KEY,
      FUND,
      "0xec68ac8d",
      [
        [0, 5, 5, "0x"],
        [0, 2, 16, abiCoder.encode(["bytes"], [innerBytes])],
      ] as any,
      0,
    ]),
  );
  entries.push(getScopeTargetV2(DEFAULT_ROLE_KEY_V2, FUND));
  const pinned = parseUpdateSettingsPinnedValues(rawSettings, "90", "0");
  entries.push(...generateUpdateSettingsPermissionRolesV2(FUND, pinned));
  entries.push(...generateManageRoleMembersPermissionRolesV2(MASTERCOPY));
  return entries;
};

const main = async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const common = new Common({ chain: "mainnet", hardfork: Hardfork.Cancun });
  const vm = await VM.create({ common });
  const putCode = (addr: string, codeHex: string) =>
    vm.stateManager.putContractCode(
      Address.fromString(addr),
      hexToBytes(codeHex),
    );

  for (const addr of LINKED_CODE) {
    const code = await provider.getCode(addr);
    if (code === "0x") throw new Error(`No code at ${addr} on ${RPC}`);
    await putCode(addr, code);
  }
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
    const err = res.execResult.exceptionError;
    return {
      ok: !err,
      ret: bytesToHex(res.execResult.returnValue ?? new Uint8Array()),
    };
  };

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

  // Fresh storage in this VM, so the mastercopy is uninitialized here and
  // setUp works: owner = OWNER, avatar = target = mock SAFE.
  const setUp = await call(
    OWNER,
    MASTERCOPY,
    rolesIface.encodeFunctionData("setUp", [
      abiCoder.encode(
        ["address", "address", "address"],
        [OWNER, SAFE, SAFE],
      ),
    ]),
  );
  if (!setUp.ok) throw new Error(`setUp failed: ${decodeErr(setUp.ret)}`);

  for (const [i, entry] of buildFullBatch().entries()) {
    const res = await call(OWNER, MASTERCOPY, entry);
    const label = rolesIface.parseTransaction({ data: entry })?.name;
    if (!res.ok) {
      throw new Error(`batch[${i}] ${label} rejected: ${decodeErr(res.ret)}`);
    }
    console.log(`batch[${i}] ${label}: accepted`);
  }
  const assign = await call(
    OWNER,
    MASTERCOPY,
    rolesIface.encodeFunctionData("assignRoles", [MANAGER, [ROLE_KEY], [true]]),
  );
  if (!assign.ok) throw new Error("assignRoles failed");

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
    meta = "{\"photoUrl\":\"x\"}",
    perf = 90n,
    manage = 0n,
  ) => {
    const s = baseSettings();
    mutate(s);
    return fundIface.encodeFunctionData("updateSettings", [
      s,
      meta,
      perf,
      manage,
    ]);
  };

  const scenarios: [string, string, string, boolean][] = [
    ["whitelist delta only", FUND, updateSettingsData((s) => { s.allowedDepositAddrs = [MANAGER]; }), true],
    ["metadata only", FUND, updateSettingsData(), true],
    ["performanceFee +1", FUND, updateSettingsData((s) => { s.performanceFee = 2001n; }), false],
    ["depositFee -1", FUND, updateSettingsData((s) => { s.depositFee = 99n; }), false],
    ["fundName changed", FUND, updateSettingsData((s) => { s.fundName = "Evil Fund"; }), false],
    ["fundSymbol changed", FUND, updateSettingsData((s) => { s.fundSymbol = "EVL"; }), false],
    ["governor echoed as old governor", FUND, updateSettingsData((s) => { s.governor = OLD_GOVERNOR; }), false],
    ["baseToken changed", FUND, updateSettingsData((s) => { s.baseToken = MANAGER; }), false],
    ["safe changed", FUND, updateSettingsData((s) => { s.safe = MANAGER; }), false],
    ["isWhitelistedDeposits flipped", FUND, updateSettingsData((s) => { s.isWhitelistedDeposits = false; }), false],
    ["feeCollectors[0] changed", FUND, updateSettingsData((s) => { s.feeCollectors = [MANAGER, ...s.feeCollectors.slice(1)]; }), false],
    ["allowedManagers non-empty", FUND, updateSettingsData((s) => { s.allowedManagers = [MANAGER]; }), false],
    ["feePerformancePeriod +1", FUND, updateSettingsData(() => {}, "{\"m\":1}", 91n, 0n), false],
    ["feeManagePeriod +1", FUND, updateSettingsData(() => {}, "{\"m\":1}", 90n, 1n), false],
    ["ERC20 transfer to fund", BASE_TOKEN, fundIface.encodeFunctionData("transfer", [FUND, 12345n]), true],
    ["ERC20 transfer elsewhere", BASE_TOKEN, fundIface.encodeFunctionData("transfer", [MANAGER, 12345n]), false],
    ["executeNAVUpdate(executor)", FUND, fundIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR]), true],
    ["executeNAVUpdate(other)", FUND, fundIface.encodeFunctionData("executeNAVUpdate", [MANAGER]), false],
    ["fundFlowsCall(mint perf fee)", FUND, fundIface.encodeFunctionData("fundFlowsCall", ["0xa52eb8be" + abiCoder.encode(["address"], [PERF_FEE]).slice(2)]), true],
    ["fundFlowsCall(other payload)", FUND, fundIface.encodeFunctionData("fundFlowsCall", ["0xa52eb8be" + abiCoder.encode(["address"], [MANAGER]).slice(2)]), false],
    ["assignRoles via role", MASTERCOPY, rolesIface.encodeFunctionData("assignRoles", ["0x0000000000000000000000000000000000000333", [ROLE_KEY], [true]]), true],
    ["scopeTarget via role", MASTERCOPY, rolesIface.encodeFunctionData("scopeTarget", [ROLE_KEY, MANAGER]), false],
    ["scopeFunction via role", MASTERCOPY, rolesIface.encodeFunctionData("scopeFunction", [ROLE_KEY, MANAGER, "0x11223344", [[0, 5, 5, "0x"]], 0]), false],
    ["transferOwnership via role", MASTERCOPY, rolesIface.encodeFunctionData("transferOwnership", [SAFE]), false],
    ["enableModule via role", MASTERCOPY, rolesIface.encodeFunctionData("enableModule", [MANAGER]), false],
    ["unscoped target", MANAGER, "0xdeadbeef", false],
  ];

  let failures = 0;
  for (const [label, to, data, expectAllowed] of scenarios) {
    const res = await call(
      MANAGER,
      MASTERCOPY,
      rolesIface.encodeFunctionData("execTransactionWithRole", [
        to,
        0n,
        data,
        0,
        ROLE_KEY,
        true,
      ]),
    );
    const pass = res.ok === expectAllowed;
    if (!pass) failures++;
    console.log(
      `${pass ? "PASS" : "FAIL"} | ${label} | expected ${
        expectAllowed ? "allow" : "deny"
      }, got ${res.ok ? "allowed" : `denied ${decodeErr(res.ret)}`}`,
    );
  }

  if (failures > 0) {
    throw new Error(`${failures} scenario(s) failed`);
  }
  console.log("\nALL SCENARIOS PASS");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
