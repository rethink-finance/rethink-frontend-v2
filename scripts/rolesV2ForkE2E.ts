/* eslint-disable no-lone-blocks -- bare blocks group each scenario's checks */
/**
 * End-to-end test of the create flow's Roles V2 permissions against the REAL
 * contracts, on a local fork of Arbitrum.
 *
 * Nothing here is mocked. A vault is created through the deployed V1.5
 * factory exactly as the create flow does it — initCreateFund, the
 * Permissions step's submitPermissions (switches, members and protocols in
 * one batch), storeNAV, finalizeCreateFund — with the batches the app's own code builds
 * from the factory's init cache. Governance activation is then executed as
 * the vault's governor, and every permission is exercised through the real
 * Roles modifier, Safe and vault, checking what actually changed on chain.
 *
 * What only this test can show (the in-process audit runs the modifier
 * against a mock Safe):
 *  - the values the permissions pin, taken from the init cache, are the
 *    values the vault stores once finalized;
 *  - the vault really applies what a permission allows (metadata, whitelist
 *    mapping, fee destinations, membership) and nothing else moves;
 *  - calldata the modifier lets through but the target cannot decode
 *    reverts in the target;
 *  - a registry integration works against the live protocol.
 *
 * Run with:  npm run test:roles-v2-fork   (needs foundry's anvil)
 */
import { spawn, type ChildProcess } from "node:child_process";
import { homedir } from "node:os";
import { getProtocolEntry } from "@rethink-finance/positions-registry";
import { ethers } from "ethers";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { GovernableFundFactory } from "~/assets/contracts/GovernableFundFactory";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import {
  ADMIN_ROLE_KEY_V2,
  EXECUTOR_ROLE_KEY_V2,
  getAssignMembersRoleV2,
  type IAssignMemberChange,
} from "~/composables/nav/generateNAVPermission";
import { buildPermissionsPageBatch } from "~/composables/permissions/integrationsBatch";
import { buildProtocolPermissionEntries } from "~/composables/permissions/protocolPermissions";
import {
  buildAssignRolesCalldata,
  buildCuratorUpdateSettingsCalldata,
  type ILiveFundSettingsState,
} from "~/composables/permissions/roleCalldata";
import {
  type IRoleScopeLog,
  reduceRoleScopeLogs,
} from "~/composables/permissions/roleScopeLogs";
import {
  buildPrepopulatedPermissionsBatch,
  defaultVaultRolePermissions,
  fullVaultRolePermissions,
  type IVaultRolePermissions,
} from "~/composables/permissions/vaultRoles";

const PORT = Number(process.env.ROLES_V2_FORK_PORT ?? 8577);
const ANVIL = process.env.ANVIL ?? `${homedir()}/.foundry/bin/anvil`;

/**
 * The chains this can run on (ROLES_V2_FORK_CHAIN). They differ in what
 * matters here: Arbitrum's Roles beacon points at the patched mastercopy,
 * Ethereum's still at the older one. Addresses are the deployed ones from
 * composables/useContractAddresses.ts.
 */
const aaveArb = getProtocolEntry(42161, "aave_v3")?.data as any;
const aaveEth = getProtocolEntry(1, "aave_v3")?.data as any;
const aaveBase = getProtocolEntry(8453, "aave_v3")?.data as any;
const CHAINS = {
  arbitrum: {
    rpc: "https://arb1.arbitrum.io/rpc",
    chainId: "0xa4b1",
    factory: "0x37E5E0ec7Fde0d8794db1FF54A3C2e69E801A9dE",
    navExecutor: "0xf25af37E48EE46EDE9489f80E73b9669915d8337",
    perfFee: "0xb358913726F3bAc8626f18a1b2C007F1a59c4fF4",
    rolesBeacon: "0x5b25Ad35BA684A85EBF02A032678884F94eEfd89",
    usdc: aaveArb.reserves.find((r: any) => r.symbol === "USDC").token as string,
    aUsdc: aaveArb.reserves.find((r: any) => r.symbol === "USDC").aTokenAddress as string,
    aavePool: aaveArb.addresses.POOL as string,
  },
  ethereum: {
    rpc: "https://ethereum-rpc.publicnode.com",
    chainId: "0x1",
    factory: "0x0F46b4A1B4C794fc078A87A8118dB47ab76B25A7",
    navExecutor: "0x6Bcbc7959CE79b8F27efe1EAe504f98CBe2647A8",
    perfFee: "0x6414575854d174dd59392846007deb3369d7480d",
    rolesBeacon: "0x52ccf6dc5668d5e80bc450cecac5f3c05b9e19e8",
    usdc: aaveEth.reserves.find((r: any) => r.symbol === "USDC").token as string,
    // The Core market's aUSDC (the registry's flat reserve list keeps one
    // aToken per symbol, not necessarily Core's).
    aUsdc: "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c",
    aavePool: aaveEth.markets.Core.pool as string,
  },
  base: {
    rpc: "https://mainnet.base.org",
    chainId: "0x2105",
    factory: "0xf42694C10a80b36D51Fe6b6F0590a0d8949C4C1e",
    navExecutor: "0x5FA5a70A3A143E3F7B8906cbc08CAd606E4622b3",
    perfFee: "0x751545c0D7F2a696c9975c9d90428225A1e139cd",
    rolesBeacon: "0x2003990E02d5963CF7Cc023e90B14be062c9b808",
    usdc: aaveBase.reserves.find((r: any) => r.symbol === "USDC").token as string,
    aUsdc: aaveBase.reserves.find((r: any) => r.symbol === "USDC").aTokenAddress as string,
    aavePool: aaveBase.addresses.POOL as string,
  },
  hyperevm: {
    rpc: "https://rpc.purroofgroup.com",
    chainId: "0x3e7",
    factory: "0x8Ac19ed0280c3ea1A89C6209ACA862Db0Cb5Ffa8",
    navExecutor: "0x49a2Ec2De6CbdB3282c5BdEc3b6ceb0157d84A47",
    perfFee: "0xA290641Ecce7C0D7835Ca128810B240F74a399Be",
    rolesBeacon: "0x12f237116acb50444c88e8af5da9845783e1c584",
    usdc: "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
    // The registry has no protocol on HyperEVM: no integration to exercise.
    aUsdc: "",
    aavePool: "",
  },
} as const;
const CHAIN_NAME = (process.env.ROLES_V2_FORK_CHAIN ?? "arbitrum") as keyof typeof CHAINS;
const CHAIN = CHAINS[CHAIN_NAME];
if (!CHAIN) throw new Error(`Unknown ROLES_V2_FORK_CHAIN: ${CHAIN_NAME}`);

const FORK_RPC = process.env.ROLES_V2_FORK_RPC ?? CHAIN.rpc;
const CHAIN_ID = CHAIN.chainId;
const FACTORY = ethers.getAddress(CHAIN.factory);
const NAV_EXECUTOR = ethers.getAddress(CHAIN.navExecutor);
const PERF_FEE = ethers.getAddress(CHAIN.perfFee);
const ROLES_BEACON = ethers.getAddress(CHAIN.rolesBeacon);
const USDC = CHAIN.usdc;
const A_USDC = CHAIN.aUsdc;
const AAVE_POOL = CHAIN.aavePool;
// Ethereum's Aave has several markets; the schema's default is spelled out.
const AAVE_PARAMS: Record<string, unknown> =
  CHAIN_NAME === "ethereum" ? { market: "Core" } : {};

const addr = (n: number) => ethers.getAddress("0x" + n.toString(16).padStart(40, "0"));
const ADMIN = addr(0xa11ce001);
const NEW_ADMIN = addr(0xa11ce002);
const EXECUTOR = addr(0xe8ec0001);
const EXECUTOR_2 = addr(0xe8ec0002);
const NEW_EXECUTOR = addr(0xe8ec0003);
const STRANGER = addr(0x5712a9e1);
const DEPOSITOR = addr(0xde905170);
const NEW_DEPOSITOR = addr(0xde905171);
const COLLECTORS = [addr(0xfee1), addr(0xfee2), addr(0xfee3), addr(0xfee4)];
const NEW_COLLECTORS = [addr(0xfee5), addr(0xfee6), addr(0xfee7), addr(0xfee8)];

const ADMIN_KEY = ethers.encodeBytes32String(ADMIN_ROLE_KEY_V2);
const EXECUTOR_KEY = ethers.encodeBytes32String(EXECUTOR_ROLE_KEY_V2);

const factoryIface = new ethers.Interface(GovernableFundFactory.abi as any);
const fundIface = new ethers.Interface(GovernableFund.abi as any);
const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const erc20 = new ethers.Interface([
  "function transfer(address,uint256)",
  "function approve(address,uint256)",
  "function balanceOf(address) view returns (uint256)",
]);
const navExecutorIface = new ethers.Interface([
  "function storeNAVData(address oiv, bytes data)",
]);
const poolIface = new ethers.Interface([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
]);
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

let provider: ethers.JsonRpcProvider;
// Every vault here is created after this block, so its logs start here; a
// query from genesis would be sent upstream, to an archive the public RPCs
// do not serve.
let forkBlock = 0;
let failures = 0;
const check = (ok: boolean, label: string, detail = "") => {
  if (!ok) failures++;
  console.log(`    ${ok ? "PASS" : "FAIL"} | ${label}${detail ? ` — ${detail}` : ""}`);
};

// ---------------------------------------------------------------------------
// Chain helpers
// ---------------------------------------------------------------------------

const funded = new Set<string>();
const fund = async (account: string) => {
  if (funded.has(account)) return;
  await provider.send("anvil_setBalance", [account, "0x56BC75E2D63100000"]);
  funded.add(account);
};

/** Send a transaction from any address (anvil auto-impersonates). */
const send = async (from: string, to: string, data: string) => {
  await fund(from);
  const hash = await provider.send("eth_sendTransaction", [
    { from, to, data, gas: "0x1c9c380" },
  ]);
  // anvil mines on submission, so the receipt is there at once; asking for
  // it directly avoids ethers' multi-second block polling on every send.
  for (let attempt = 0; attempt < 600; attempt++) {
    const receipt = await provider.send("eth_getTransactionReceipt", [hash]);
    if (receipt) {
      return { status: Number(receipt.status), gasUsed: BigInt(receipt.gasUsed) };
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`No receipt for ${hash} after 30s`);
};

const mustSend = async (from: string, to: string, data: string, what: string) => {
  const receipt = await send(from, to, data);
  if (receipt.status !== 1) {
    let reason = "";
    try {
      await provider.call({ from, to, data });
    } catch (error: any) {
      reason = error?.shortMessage ?? error?.message ?? "";
    }
    throw new Error(`${what} reverted. ${reason}`);
  }
  return receipt;
};

const view = async (to: string, iface: ethers.Interface, fn: string, args: any[] = []) =>
  iface.decodeFunctionResult(fn, await provider.call({ to, data: iface.encodeFunctionData(fn, args) }));

type Outcome = "ok" | "denied" | "inner-revert" | "no-membership" | "reverted";

/**
 * What the modifier answers to a role holder's call, read the way the app's
 * pre-flight reads it, and — when it would go through — actually sent.
 */
const execAsRole = async (
  modifier: string,
  sender: string,
  roleKey: string,
  to: string,
  data: string,
): Promise<{ outcome: Outcome; detail: string }> => {
  await fund(sender);
  const calldata = rolesIface.encodeFunctionData("execTransactionWithRole", [
    to, 0n, data, 0, roleKey, true,
  ]);
  try {
    await provider.call({ from: sender, to: modifier, data: calldata });
  } catch (error: any) {
    const revert: string = error?.data ?? error?.info?.error?.data ?? "";
    const parsed = (() => {
      try {
        return rolesIface.parseError(revert);
      } catch {
        return null;
      }
    })();
    if (parsed?.name === "ConditionViolation") {
      return { outcome: "denied", detail: `ConditionViolation(status=${parsed.args[0]})` };
    }
    // NoMembership: the modifier knows the wallet but it lacks this role.
    // NotAuthorized: the modifier has never been told about the wallet at
    // all (assignRoles is what enables a module). Locked out either way.
    if (parsed?.name === "NoMembership" || parsed?.name === "NotAuthorized") {
      return { outcome: "no-membership", detail: parsed.name };
    }
    if (parsed?.name === "ModuleTransactionFailed") {
      return { outcome: "inner-revert", detail: "ModuleTransactionFailed" };
    }
    return { outcome: "reverted", detail: parsed?.name ?? (revert.slice(0, 10) || error?.shortMessage) };
  }
  const receipt = await send(sender, modifier, calldata);
  return receipt.status === 1
    ? { outcome: "ok", detail: "" }
    : { outcome: "reverted", detail: "the simulation passed but the transaction reverted" };
};

const expectOutcome = async (
  label: string,
  expected: Outcome,
  run: Promise<{ outcome: Outcome; detail: string }>,
) => {
  const { outcome, detail } = await run;
  check(outcome === expected, label, outcome === expected ? detail : `expected ${expected}, got ${outcome} ${detail}`);
  return outcome === expected;
};

/** The modifier's permission events, as the Permissions step reads them. */
const readScopeLogs = async (modifier: string): Promise<IRoleScopeLog[]> =>
  (await provider.getLogs({ address: modifier, fromBlock: forkBlock, toBlock: "latest" })).map((log) => ({
    topics: [...log.topics],
    data: log.data,
    blockNumber: log.blockNumber,
    logIndex: log.index,
  }));

/**
 * Give `to` a token balance by writing the token's balance mapping directly
 * (the slot is found by trial), so the test needs no funded holder to borrow
 * from on any chain.
 */
const deal = async (token: string, to: string, amount: bigint) => {
  const balance = async () => (await view(token, erc20, "balanceOf", [to]))[0] as bigint;
  for (let slot = 0; slot < 120; slot++) {
    const key = ethers.keccak256(abiCoder.encode(["address", "uint256"], [to, slot]));
    const previous = await provider.getStorage(token, key);
    await provider.send("anvil_setStorageAt", [token, key, ethers.toBeHex(amount, 32)]);
    if ((await balance()) === amount) return;
    await provider.send("anvil_setStorageAt", [token, key, previous]);
  }
  throw new Error(`Could not find the balance slot of ${token}`);
};

const WHITELIST_SLOT = 268n; // mapping(address => bool) whitelistedDepositors
const isWhitelisted = async (vault: string, depositor: string) =>
  BigInt(
    await provider.getStorage(
      vault,
      ethers.keccak256(abiCoder.encode(["address", "uint256"], [depositor, WHITELIST_SLOT])),
    ),
  ) === 1n;

// ---------------------------------------------------------------------------
// Creating a vault the way the create flow does
// ---------------------------------------------------------------------------

interface IVault {
  label: string;
  vault: string;
  modifier: string;
  safe: string;
  governor: string;
  metadata: string;
}

const SETTINGS_KEYS = [
  "depositFee", "withdrawFee", "performanceFee", "managementFee",
  "performaceHurdleRateBps", "baseToken", "safe", "isExternalGovTokenInUse",
  "isWhitelistedDeposits", "allowedDepositAddrs", "allowedManagers",
  "governanceToken", "fundAddress", "governor", "fundName", "fundSymbol",
  "feeCollectors",
] as const;

/** A Settings struct read off chain, as a plain object with named fields. */
const plainSettings = (result: ethers.Result): Record<string, any> =>
  Object.fromEntries(
    SETTINGS_KEYS.map((key) => {
      const value = result[key];
      return [key, value instanceof ethers.Result ? [...value] : value];
    }),
  );

const sameSettings = (a: Record<string, any>, b: Record<string, any>, skip: string[] = []) =>
  SETTINGS_KEYS.filter((key) => !skip.includes(key)).filter(
    (key) => JSON.stringify(a[key], (_, v) => (typeof v === "bigint" ? v.toString() : v)).toLowerCase() !==
      JSON.stringify(b[key], (_, v) => (typeof v === "bigint" ? v.toString() : v)).toLowerCase(),
  );

const readLive = async (vault: string): Promise<ILiveFundSettingsState> => {
  const [settings] = await view(vault, fundIface, "getFundSettings");
  const [fundMetadata] = await view(vault, fundIface, "fundMetadata");
  const [perf] = await view(vault, fundIface, "feePerformancePeriod");
  const [manage] = await view(vault, fundIface, "feeManagePeriod");
  return {
    settings: plainSettings(settings),
    fundMetadata,
    feePerformancePeriod: String(perf),
    feeManagePeriod: String(manage),
  };
};

const createVault = async (options: {
  label: string;
  deployer: string;
  whitelist: string[];
  permissions: IVaultRolePermissions;
  admins: string[];
  executors: string[];
  /** Aave reserves the executor's protocol card grants, by symbol. */
  integrations: string[];
}): Promise<IVault> => {
  const { deployer, label } = options;
  console.log(`\n  Creating "${label}"`);
  const metadata = JSON.stringify({ description: `fork vault ${label}`, photoUrl: "" });

  // 1. Initialize, with the arguments the create page builds.
  await mustSend(
    deployer,
    FACTORY,
    factoryIface.encodeFunctionData("initCreateFund", [
      [
        0, 0, 2000, 100, 0,
        USDC,
        ethers.ZeroAddress,
        false,
        false,
        options.whitelist,
        [],
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        `Fork ${label}`,
        "FRK",
        COLLECTORS,
      ],
      [10, 0, 0, 86400, 0],
      metadata,
      0,
      0,
    ]),
    "initCreateFund",
  );

  // 2. The init cache, which is all the Permissions step knows about the vault.
  const [cache] = await view(FACTORY, factoryIface, "getFundInitializationCache", [deployer]);
  const vault: string = cache.fundContractAddr;
  const modifier: string = cache.rolesModifier;
  const cachedSettings = plainSettings(cache.fundSettings);
  const safe: string = cachedSettings.safe;

  // 3. The switches' batch, built by the app's own code from that cache.
  const prepopulated = buildPrepopulatedPermissionsBatch(
    {
      fundAddress: vault,
      baseToken: cachedSettings.baseToken,
      rolesModifier: modifier,
      navExecutor: NAV_EXECUTOR,
      poolPerformanceFee: PERF_FEE,
      rawSettings: cachedSettings,
      fundMetadata: cache._fundMetadata,
      feePerformancePeriod: cache._feePerformancePeriod,
      feeManagePeriod: cache._feeManagePeriod,
    },
    options.permissions,
  );
  const members = (list: string[]): IAssignMemberChange[] =>
    list.map((address) => ({ address, action: "ADD" }));
  // 4. The page's one save: switches, members and the executor's protocol
  // card together, the card diffed against the modifier's own event log.
  const save = buildPermissionsPageBatch({
    prepopulated,
    memberEntries: [
      ...getAssignMembersRoleV2(
        ADMIN_ROLE_KEY_V2,
        options.permissions.adminEnabled ? members(options.admins) : [],
      ),
      ...getAssignMembersRoleV2(EXECUTOR_ROLE_KEY_V2, members(options.executors)),
    ],
    roles: options.integrations.length
      ? [{
        chainId: CHAIN_ID,
        protocolBuild: buildProtocolPermissionEntries({
          chainId: CHAIN_ID,
          rolesModAddress: modifier,
          selections: [{
            protocol: "aave_v3",
            enabled: true,
            actions: [{ action: "deposit", enabled: true, params: { targets: options.integrations, ...AAVE_PARAMS } }],
          }],
        }),
        current: reduceRoleScopeLogs(await readScopeLogs(modifier), EXECUTOR_KEY),
        fundAddress: vault,
        baseToken: cachedSettings.baseToken,
        rolesModifier: modifier,
      }]
      : [],
    rawEntries: [],
  });
  const saveReceipt = await mustSend(
    deployer,
    FACTORY,
    factoryIface.encodeFunctionData("submitPermissions", [save]),
    "Permissions step submitPermissions",
  );
  console.log(`    Permissions step: ${save.length} calls, ${saveReceipt.gasUsed} gas`);

  // 5. Finalize. (The NAV methods step is left out on purpose: on this
  // chain the deployed NAV executor does not know the V1.5 factory, so the
  // factory's storeNAV reverts with "not authorized: gov" — checked below —
  // and NAV data is stored by the vault's governor after finalizing.)
  const storeNav = await send(
    deployer,
    FACTORY,
    factoryIface.encodeFunctionData("storeNAV", [
      NAV_EXECUTOR,
      fundIface.encodeFunctionData("updateNav", [[], [], false]),
    ]),
  );
  console.log(`    NAV methods step through the factory: ${storeNav.status === 1 ? "stored" : "REVERTS on this chain"}`);
  await mustSend(deployer, FACTORY, factoryIface.encodeFunctionData("finalizeCreateFund", []), "finalizeCreateFund");

  // 6. The pins came from the cache; the vault must store exactly that.
  const live = await readLive(vault);
  const differing = sameSettings(cachedSettings, live.settings);
  check(!differing.length, "the finalized vault stores exactly the cached settings the permissions were pinned to", differing.join(", "));
  check(live.fundMetadata === cache._fundMetadata, "…and the cached metadata");
  check(
    live.feePerformancePeriod === String(cache._feePerformancePeriod) &&
      live.feeManagePeriod === String(cache._feeManagePeriod),
    "…and the cached fee periods",
  );
  check(
    live.settings.isWhitelistedDeposits === options.whitelist.length > 0,
    `whitelist enforcement is ${options.whitelist.length ? "on" : "off"}, as the factory derives it`,
  );

  if (storeNav.status !== 1) {
    await mustSend(
      live.settings.governor,
      NAV_EXECUTOR,
      navExecutorIface.encodeFunctionData("storeNAVData", [
        vault,
        fundIface.encodeFunctionData("updateNav", [[], [], false]),
      ]),
      "storeNAVData as the governor",
    );
  }

  return { label, vault, modifier, safe, governor: live.settings.governor, metadata };
};

/** The one-time activation, executed as the vault's governor. */
const activate = async (
  v: IVault,
  // false: only the modifier's ownership moves, the vault's configuration
  // (who holds settings authority) stays as created.
  options: { settingsAuthority?: boolean } = {},
) => {
  if (options.settingsAuthority === false) {
    const before = await readLive(v.vault);
    await mustSend(
      v.governor,
      v.modifier,
      rolesIface.encodeFunctionData("transferOwnership", [v.safe]),
      "activation transferOwnership",
    );
    const after = await readLive(v.vault);
    const [owner] = await view(v.modifier, rolesIface, "owner");
    check(
      owner.toLowerCase() === v.safe.toLowerCase() &&
        !sameSettings(before.settings, after.settings).length &&
        after.settings.governor.toLowerCase() === v.governor.toLowerCase(),
      "activation: only the modifier's ownership moved; the vault's configuration is untouched",
    );
    return;
  }
  const live = await readLive(v.vault);
  const s = live.settings;
  // Same echo the app's activation proposal encodes: every live value,
  // governor = safe, both toggle arrays empty.
  const echoed = [
    s.depositFee, s.withdrawFee, s.performanceFee, s.managementFee,
    s.performaceHurdleRateBps, s.baseToken, s.safe, s.isExternalGovTokenInUse,
    s.isWhitelistedDeposits, [], [], s.governanceToken, s.fundAddress,
    s.safe, s.fundName, s.fundSymbol, s.feeCollectors,
  ];
  await mustSend(
    v.governor,
    v.vault,
    fundIface.encodeFunctionData("updateSettings", [
      echoed, live.fundMetadata, live.feePerformancePeriod, live.feeManagePeriod,
    ]),
    "activation updateSettings",
  );
  // The ownership half is skipped where an earlier, ownership-only
  // activation already ran: the governor no longer owns the modifier.
  const [currentOwner] = await view(v.modifier, rolesIface, "owner");
  if (currentOwner.toLowerCase() !== v.safe.toLowerCase()) {
    await mustSend(
      v.governor,
      v.modifier,
      rolesIface.encodeFunctionData("transferOwnership", [v.safe]),
      "activation transferOwnership",
    );
  }
  const after = await readLive(v.vault);
  const [owner] = await view(v.modifier, rolesIface, "owner");
  check(
    after.settings.governor.toLowerCase() === v.safe.toLowerCase() &&
      owner.toLowerCase() === v.safe.toLowerCase(),
    "activation: settings authority and the modifier's ownership are with the Safe",
  );
};

const settingsCall = async (
  v: IVault,
  changes: Parameters<typeof buildCuratorUpdateSettingsCalldata>[1],
) => buildCuratorUpdateSettingsCalldata(await readLive(v.vault), changes);

/** updateSettings with one frozen field tampered, everything else echoed. */
const tamperedCall = async (v: IVault, mutate: (s: Record<string, any>) => void) => {
  const live = await readLive(v.vault);
  const s = { ...live.settings };
  mutate(s);
  return buildCuratorUpdateSettingsCalldata({ ...live, settings: s }, {});
};

// ---------------------------------------------------------------------------
// The scenarios
// ---------------------------------------------------------------------------

const everySwitchOn = async () => {
  console.log("\nVault 1: every switch on, whitelist with one depositor, Aave USDC integration");
  const deployer = addr(0xdeb10001);
  const v = await createVault({
    label: "all-on",
    deployer,
    whitelist: [DEPOSITOR],
    permissions: fullVaultRolePermissions(),
    admins: [ADMIN],
    executors: [EXECUTOR, EXECUTOR_2],
    integrations: AAVE_POOL ? ["USDC"] : [],
  });
  const asAdmin = (to: string, data: string) => execAsRole(v.modifier, ADMIN, ADMIN_KEY, to, data);
  const asExecutor = (to: string, data: string, who = EXECUTOR) =>
    execAsRole(v.modifier, who, EXECUTOR_KEY, to, data);

  check(await isWhitelisted(v.vault, DEPOSITOR), "the initial depositor is whitelisted (confirms the mapping slot read)");
  check(!(await isWhitelisted(v.vault, NEW_DEPOSITOR)), "…and a stranger is not");

  // Give the Safe some USDC to move.
  const usdcAmount = 5_000_000n; // 5 USDC
  await deal(USDC, v.safe, usdcAmount * 4n);

  console.log("  Before governance activation");
  await expectOutcome("admin: edit metadata passes the permission but the vault refuses it", "inner-revert",
    asAdmin(v.vault, await settingsCall(v, { fundMetadata: "{\"description\":\"early\"}" })));
  await expectOutcome("admin: add an executor passes the permission but the modifier refuses it", "inner-revert",
    asAdmin(v.modifier, buildAssignRolesCalldata(NEW_EXECUTOR, true, EXECUTOR_ROLE_KEY_V2)));
  await expectOutcome("executor: self-revoke passes the permission but the modifier refuses it", "inner-revert",
    asExecutor(v.modifier, buildAssignRolesCalldata(EXECUTOR, false, EXECUTOR_ROLE_KEY_V2)));
  check((await readLive(v.vault)).fundMetadata === v.metadata, "nothing changed on the vault");
  {
    const before = (await view(USDC, erc20, "balanceOf", [v.vault]))[0] as bigint;
    await expectOutcome("executor: send base token to the vault works without activation", "ok",
      asExecutor(USDC, erc20.encodeFunctionData("transfer", [v.vault, usdcAmount])));
    const after = (await view(USDC, erc20, "balanceOf", [v.vault]))[0] as bigint;
    check(after - before === usdcAmount, "the vault received exactly that amount");
  }

  await activate(v);

  console.log("  Admin, after activation");
  {
    const before = await readLive(v.vault);
    const metadata = "{\"description\":\"edited by the admin\",\"photoUrl\":\"https://example.org/a.png\"}";
    await expectOutcome("edit metadata", "ok", asAdmin(v.vault, await settingsCall(v, { fundMetadata: metadata })));
    const after = await readLive(v.vault);
    check(after.fundMetadata === metadata, "the vault stores the new metadata");
    check(!sameSettings(before.settings, after.settings).length, "no setting moved with it");
  }
  {
    await expectOutcome("whitelist: add a depositor", "ok",
      asAdmin(v.vault, await settingsCall(v, { whitelistDeltas: [NEW_DEPOSITOR] })));
    check(await isWhitelisted(v.vault, NEW_DEPOSITOR), "the new depositor is whitelisted");
    check(await isWhitelisted(v.vault, DEPOSITOR), "the existing one still is");
    await expectOutcome("whitelist: remove a depositor", "ok",
      asAdmin(v.vault, await settingsCall(v, { whitelistDeltas: [DEPOSITOR] })));
    check(!(await isWhitelisted(v.vault, DEPOSITOR)), "the removed depositor is off the whitelist");
    check(await isWhitelisted(v.vault, NEW_DEPOSITOR), "the other one is untouched");
    await expectOutcome("whitelist: switch enforcement off", "ok",
      asAdmin(v.vault, await settingsCall(v, { isWhitelistedDeposits: false })));
    check((await readLive(v.vault)).settings.isWhitelistedDeposits === false, "deposits are open to anyone");
    check(await isWhitelisted(v.vault, NEW_DEPOSITOR), "flipping the flag toggled no address");
    await expectOutcome("whitelist: switch enforcement back on", "ok",
      asAdmin(v.vault, await settingsCall(v, { isWhitelistedDeposits: true })));
  }
  {
    const before = await readLive(v.vault);
    await expectOutcome("move the fee destinations", "ok",
      asAdmin(v.vault, await settingsCall(v, { feeCollectors: NEW_COLLECTORS })));
    const after = await readLive(v.vault);
    check(
      NEW_COLLECTORS.every((c, i) => after.settings.feeCollectors[i].toLowerCase() === c.toLowerCase()),
      "the vault pays fees to the new addresses",
    );
    check(
      ["depositFee", "withdrawFee", "performanceFee", "managementFee", "performaceHurdleRateBps"].every(
        (key) => String(after.settings[key]) === String(before.settings[key]),
      ) && after.feePerformancePeriod === before.feePerformancePeriod && after.feeManagePeriod === before.feeManagePeriod,
      "no fee rate or period moved",
    );
    check(!sameSettings(before.settings, after.settings, ["feeCollectors"]).length, "nothing else moved");
  }
  {
    const before = await readLive(v.vault);
    const frozen: [string, (s: Record<string, any>) => void][] = [
      ["raise the performance fee", (s) => { s.performanceFee = 9000n; }],
      ["raise the management fee", (s) => { s.managementFee = 9000n; }],
      ["set a deposit fee", (s) => { s.depositFee = 500n; }],
      ["set a withdraw fee", (s) => { s.withdrawFee = 500n; }],
      ["set a hurdle rate", (s) => { s.performaceHurdleRateBps = 1n; }],
      ["rename the vault", (s) => { s.fundName = "Renamed"; }],
      ["change the symbol", (s) => { s.fundSymbol = "XXX"; }],
      ["swap the base token", (s) => { s.baseToken = STRANGER; }],
      ["swap the Safe (the builder then echoes it as governor)", (s) => { s.safe = STRANGER; }],
      ["swap the governance token", (s) => { s.governanceToken = STRANGER; }],
      ["repoint the vault address", (s) => { s.fundAddress = STRANGER; }],
      ["flip the external-token flag", (s) => { s.isExternalGovTokenInUse = true; }],
    ];
    for (const [label, mutate] of frozen) {
      await expectOutcome(`denied: ${label}`, "denied", asAdmin(v.vault, await tamperedCall(v, mutate)));
    }
    const s = before.settings;
    const raw = (governor: string, managers: string[], perf: string, manage: string) =>
      fundIface.encodeFunctionData("updateSettings", [
        [s.depositFee, s.withdrawFee, s.performanceFee, s.managementFee, s.performaceHurdleRateBps,
          s.baseToken, s.safe, s.isExternalGovTokenInUse, s.isWhitelistedDeposits, [], managers,
          s.governanceToken, s.fundAddress, governor, s.fundName, s.fundSymbol, s.feeCollectors],
        before.fundMetadata, perf, manage,
      ]);
    await expectOutcome("denied: hand settings authority to the admin itself", "denied",
      asAdmin(v.vault, raw(ADMIN, [], before.feePerformancePeriod, before.feeManagePeriod)));
    await expectOutcome("denied: hand settings authority back to the old governor", "denied",
      asAdmin(v.vault, raw(v.governor, [], before.feePerformancePeriod, before.feeManagePeriod)));
    await expectOutcome("denied: add a fund manager", "denied",
      asAdmin(v.vault, raw(s.safe, [ADMIN], before.feePerformancePeriod, before.feeManagePeriod)));
    await expectOutcome("denied: change the performance fee period", "denied",
      asAdmin(v.vault, raw(s.safe, [], "1", before.feeManagePeriod)));
    await expectOutcome("denied: change the management fee period", "denied",
      asAdmin(v.vault, raw(s.safe, [], before.feePerformancePeriod, "1")));
    const after = await readLive(v.vault);
    check(
      !sameSettings(before.settings, after.settings).length && after.fundMetadata === before.fundMetadata,
      "none of the denied calls changed anything on the vault",
    );

    // Calldata cut short behind the pinned values passes the modifier (it
    // only reads what it has a condition for); the vault itself must refuse.
    const cut = (await settingsCall(v, { fundMetadata: "{\"description\":\"cut\"}" })).slice(0, -64);
    await expectOutcome("truncated settings calldata reverts in the vault", "inner-revert", asAdmin(v.vault, cut));
    check((await readLive(v.vault)).fundMetadata === before.fundMetadata, "…and changes nothing");
  }

  console.log("  Membership, after activation");
  await expectOutcome("a wallet with no role cannot act as executor", "no-membership",
    asExecutor(USDC, erc20.encodeFunctionData("transfer", [v.vault, 1n]), NEW_EXECUTOR));
  await expectOutcome("admin: add an executor", "ok",
    asAdmin(v.modifier, buildAssignRolesCalldata(NEW_EXECUTOR, true, EXECUTOR_ROLE_KEY_V2)));
  await expectOutcome("the new executor can now act", "ok",
    asExecutor(USDC, erc20.encodeFunctionData("transfer", [v.vault, 1n]), NEW_EXECUTOR));
  await expectOutcome("admin: remove that executor", "ok",
    asAdmin(v.modifier, buildAssignRolesCalldata(NEW_EXECUTOR, false, EXECUTOR_ROLE_KEY_V2)));
  await expectOutcome("the removed executor is locked out", "no-membership",
    asExecutor(USDC, erc20.encodeFunctionData("transfer", [v.vault, 1n]), NEW_EXECUTOR));
  await expectOutcome("admin denied: assign a role it does not manage", "denied",
    asAdmin(v.modifier, buildAssignRolesCalldata(STRANGER, true, "someOtherRole")));
  await expectOutcome("admin denied: two roles in one call", "denied",
    asAdmin(v.modifier, rolesIface.encodeFunctionData("assignRoles", [STRANGER, [EXECUTOR_KEY, ADMIN_KEY], [true, true]])));
  await expectOutcome("admin denied: re-scope a target", "denied",
    asAdmin(v.modifier, rolesIface.encodeFunctionData("scopeTarget", [ADMIN_KEY, STRANGER])));
  await expectOutcome("admin denied: allow itself a whole target", "denied",
    asAdmin(v.modifier, rolesIface.encodeFunctionData("allowTarget", [ADMIN_KEY, USDC, 3])));
  await expectOutcome("admin denied: take the modifier's ownership", "denied",
    asAdmin(v.modifier, rolesIface.encodeFunctionData("transferOwnership", [ADMIN])));
  await expectOutcome("admin denied: move the Safe's USDC", "denied",
    asAdmin(USDC, erc20.encodeFunctionData("transfer", [ADMIN, 1n])));
  await expectOutcome("admin denied: update NAV", "denied",
    asAdmin(v.vault, fundIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR])));
  await expectOutcome("truncated assignRoles calldata reverts in the modifier", "inner-revert",
    asAdmin(v.modifier, buildAssignRolesCalldata(STRANGER, true, EXECUTOR_ROLE_KEY_V2).slice(0, -64)));
  await expectOutcome("…and the address it named got no role", "no-membership",
    asExecutor(USDC, erc20.encodeFunctionData("transfer", [v.vault, 1n]), STRANGER));

  console.log("  Executor, after activation");
  {
    const strangerBefore = (await view(USDC, erc20, "balanceOf", [STRANGER]))[0] as bigint;
    await expectOutcome("denied: send the base token anywhere but the vault", "denied",
      asExecutor(USDC, erc20.encodeFunctionData("transfer", [STRANGER, 1n])));
    await expectOutcome("denied: approve the base token to a stranger", "denied",
      asExecutor(USDC, erc20.encodeFunctionData("approve", [STRANGER, 1n])));
    check(((await view(USDC, erc20, "balanceOf", [STRANGER]))[0] as bigint) === strangerBefore, "the stranger received nothing");
    await expectOutcome("update NAV", "ok",
      asExecutor(v.vault, fundIface.encodeFunctionData("executeNAVUpdate", [NAV_EXECUTOR])));
    const [navIndex] = await view(v.vault, fundIface, "_navUpdateLatestIndex");
    check(navIndex > 0n, "the vault recorded a NAV update", `index ${navIndex}`);
    await expectOutcome("denied: update NAV through another executor contract", "denied",
      asExecutor(v.vault, fundIface.encodeFunctionData("executeNAVUpdate", [STRANGER])));
    const collect = await asExecutor(
      v.vault,
      fundIface.encodeFunctionData("fundFlowsCall", ["0xa52eb8be" + abiCoder.encode(["address"], [PERF_FEE]).slice(2)]),
    );
    check(collect.outcome === "ok" || collect.outcome === "inner-revert",
      "collect fee passes the permission", collect.outcome === "ok" ? "and executed" : "the vault itself refused (nothing accrued)");
    await expectOutcome("denied: another flows payload", "denied",
      asExecutor(v.vault, fundIface.encodeFunctionData("fundFlowsCall", ["0xa52eb8be" + abiCoder.encode(["address"], [STRANGER]).slice(2)])));
    await expectOutcome("denied: edit metadata", "denied",
      asExecutor(v.vault, await settingsCall(v, { fundMetadata: "{}" })));
    await expectOutcome("denied: move the fee destinations", "denied",
      asExecutor(v.vault, await settingsCall(v, { feeCollectors: COLLECTORS })));
    await expectOutcome("denied: add an executor", "denied",
      asExecutor(v.modifier, buildAssignRolesCalldata(NEW_EXECUTOR, true, EXECUTOR_ROLE_KEY_V2)));
    await expectOutcome("denied: take the admin role", "denied",
      asExecutor(v.modifier, buildAssignRolesCalldata(EXECUTOR, true, ADMIN_ROLE_KEY_V2)));
    await expectOutcome("denied: remove the admin", "denied",
      asExecutor(v.modifier, buildAssignRolesCalldata(ADMIN, false, ADMIN_ROLE_KEY_V2)));
  }
  if (AAVE_POOL) {
    // The protocol card's grant, against the live Aave pool.
    const amount = 2_000_000n;
    const before = (await view(A_USDC, erc20, "balanceOf", [v.safe]))[0] as bigint;
    await expectOutcome("integration: approve USDC to the Aave pool", "ok",
      asExecutor(USDC, erc20.encodeFunctionData("approve", [AAVE_POOL, amount])));
    await expectOutcome("integration: supply USDC to Aave for the Safe", "ok",
      asExecutor(AAVE_POOL, poolIface.encodeFunctionData("supply", [USDC, amount, v.safe, 0])));
    const after = (await view(A_USDC, erc20, "balanceOf", [v.safe]))[0] as bigint;
    check(after - before >= amount - 2n, "the Safe holds the aUSDC", `${after - before} units`);
    await expectOutcome("integration denied: supply on behalf of someone else", "denied",
      asExecutor(AAVE_POOL, poolIface.encodeFunctionData("supply", [USDC, 1n, STRANGER, 0])));
  }
  {
    await expectOutcome("executor: revoke its own role", "ok",
      asExecutor(v.modifier, buildAssignRolesCalldata(EXECUTOR, false, EXECUTOR_ROLE_KEY_V2)));
    await expectOutcome("…and is locked out afterwards", "no-membership",
      asExecutor(USDC, erc20.encodeFunctionData("transfer", [v.vault, 1n])));
    await expectOutcome("…and cannot let itself back in", "no-membership",
      asExecutor(v.modifier, buildAssignRolesCalldata(EXECUTOR, true, EXECUTOR_ROLE_KEY_V2)));
    await expectOutcome("the other executor is unaffected", "ok",
      asExecutor(USDC, erc20.encodeFunctionData("transfer", [v.vault, 1n]), EXECUTOR_2));
  }

  console.log("  Transferring the admin role");
  await expectOutcome("admin: assign the role to the new admin", "ok",
    asAdmin(v.modifier, buildAssignRolesCalldata(NEW_ADMIN, true, ADMIN_ROLE_KEY_V2)));
  await expectOutcome("admin: remove itself", "ok",
    asAdmin(v.modifier, buildAssignRolesCalldata(ADMIN, false, ADMIN_ROLE_KEY_V2)));
  await expectOutcome("the old admin is locked out", "no-membership",
    asAdmin(v.vault, await settingsCall(v, { fundMetadata: "{}" })));
  await expectOutcome("the new admin can edit metadata", "ok",
    execAsRole(v.modifier, NEW_ADMIN, ADMIN_KEY, v.vault, await settingsCall(v, { fundMetadata: "{\"description\":\"new admin\"}" })));
};

const narrowAdmin = async () => {
  console.log("\nVault 2: admin may only move fee destinations (metadata and whitelist closed), whitelist in use");
  const v = await createVault({
    label: "fee-destinations-only",
    deployer: addr(0xdeb10002),
    whitelist: [DEPOSITOR],
    permissions: (() => {
      const p = fullVaultRolePermissions();
      p.admin.updateMetadata = false;
      p.admin.manageWhitelist = false;
      p.admin.manageExecutorMembers = false;
      p.admin.transferAdminRole = false;
      p.executor.selfRevoke = false;
      return p;
    })(),
    admins: [ADMIN],
    executors: [EXECUTOR],
    integrations: [],
  });
  await activate(v);
  const asAdmin = (to: string, data: string) => execAsRole(v.modifier, ADMIN, ADMIN_KEY, to, data);
  const before = await readLive(v.vault);
  // The pins that are only live in this configuration: the metadata string,
  // the whitelist flag the FACTORY switched on, and the empty delta.
  await expectOutcome("move the fee destinations (metadata and whitelist echoed unchanged)", "ok",
    asAdmin(v.vault, await settingsCall(v, { feeCollectors: NEW_COLLECTORS })));
  const after = await readLive(v.vault);
  check(
    NEW_COLLECTORS.every((c, i) => after.settings.feeCollectors[i].toLowerCase() === c.toLowerCase()),
    "the vault pays fees to the new addresses",
  );
  check(after.fundMetadata === before.fundMetadata && after.settings.isWhitelistedDeposits === true, "metadata and whitelist enforcement unchanged");
  await expectOutcome("denied: edit metadata", "denied", asAdmin(v.vault, await settingsCall(v, { fundMetadata: "{}" })));
  await expectOutcome("denied: add a depositor", "denied", asAdmin(v.vault, await settingsCall(v, { whitelistDeltas: [NEW_DEPOSITOR] })));
  await expectOutcome("denied: switch whitelist enforcement off", "denied", asAdmin(v.vault, await settingsCall(v, { isWhitelistedDeposits: false })));
  await expectOutcome("denied: a fee destination plus a fee change", "denied",
    asAdmin(v.vault, await tamperedCall(v, (s) => { s.performanceFee = 9000n; s.feeCollectors = COLLECTORS; })));
  await expectOutcome("denied: add an executor", "denied", asAdmin(v.modifier, buildAssignRolesCalldata(NEW_EXECUTOR, true, EXECUTOR_ROLE_KEY_V2)));
  await expectOutcome("denied: assign the admin role", "denied", asAdmin(v.modifier, buildAssignRolesCalldata(NEW_ADMIN, true, ADMIN_ROLE_KEY_V2)));
  await expectOutcome("executor denied: revoke its own role (switch off)", "denied",
    execAsRole(v.modifier, EXECUTOR, EXECUTOR_KEY, v.modifier, buildAssignRolesCalldata(EXECUTOR, false, EXECUTOR_ROLE_KEY_V2)));
  check(!(await isWhitelisted(v.vault, NEW_DEPOSITOR)) && (await isWhitelisted(v.vault, DEPOSITOR)), "the whitelist is as it was");
};

const metadataOnlyAdmin = async () => {
  console.log("\nVault 3: admin may only edit metadata, no whitelist at creation");
  const v = await createVault({
    label: "metadata-only",
    deployer: addr(0xdeb10003),
    whitelist: [],
    permissions: (() => {
      const p = fullVaultRolePermissions();
      p.admin.manageWhitelist = false;
      p.admin.changeFeeDestinations = false;
      p.admin.transferAdminRole = false;
      return p;
    })(),
    admins: [ADMIN],
    executors: [EXECUTOR],
    integrations: [],
  });
  await activate(v);
  const asAdmin = (to: string, data: string) => execAsRole(v.modifier, ADMIN, ADMIN_KEY, to, data);
  await expectOutcome("edit metadata", "ok", asAdmin(v.vault, await settingsCall(v, { fundMetadata: "{\"description\":\"only this\"}" })));
  check((await readLive(v.vault)).fundMetadata === "{\"description\":\"only this\"}", "the vault stores the new metadata");
  await expectOutcome("denied: move the fee destinations", "denied", asAdmin(v.vault, await settingsCall(v, { feeCollectors: NEW_COLLECTORS })));
  await expectOutcome("denied: add a depositor", "denied", asAdmin(v.vault, await settingsCall(v, { whitelistDeltas: [NEW_DEPOSITOR] })));
  await expectOutcome("denied: switch whitelist enforcement on", "denied", asAdmin(v.vault, await settingsCall(v, { isWhitelistedDeposits: true })));
  await expectOutcome("add an executor", "ok", asAdmin(v.modifier, buildAssignRolesCalldata(NEW_EXECUTOR, true, EXECUTOR_ROLE_KEY_V2)));
  await expectOutcome("denied: assign the admin role", "denied", asAdmin(v.modifier, buildAssignRolesCalldata(NEW_ADMIN, true, ADMIN_ROLE_KEY_V2)));
};

const defaultSwitches = async () => {
  console.log("\nVault 5: the step's default switches (every switch on), ownership-only activation");
  const v = await createVault({
    label: "defaults",
    deployer: addr(0xdeb10005),
    whitelist: [],
    permissions: defaultVaultRolePermissions(),
    admins: [ADMIN],
    executors: [EXECUTOR],
    integrations: [],
  });
  const asAdmin = (to: string, data: string) => execAsRole(v.modifier, ADMIN, ADMIN_KEY, to, data);
  await expectOutcome("before activation: add an executor passes the permission but the modifier refuses it", "inner-revert",
    asAdmin(v.modifier, buildAssignRolesCalldata(NEW_EXECUTOR, true, EXECUTOR_ROLE_KEY_V2)));
  // Ownership only: the vault's configuration keeps settings authority with
  // the governor, so the admin's settings permissions stay inert.
  await activate(v, { settingsAuthority: false });
  await expectOutcome("admin: add an executor", "ok",
    asAdmin(v.modifier, buildAssignRolesCalldata(NEW_EXECUTOR, true, EXECUTOR_ROLE_KEY_V2)));
  await deal(USDC, v.safe, 1_000_000n);
  await expectOutcome("the new executor can act", "ok",
    execAsRole(v.modifier, NEW_EXECUTOR, EXECUTOR_KEY, USDC, erc20.encodeFunctionData("transfer", [v.vault, 1000n])));
  await expectOutcome("admin: hand the admin role to a new admin", "ok",
    asAdmin(v.modifier, buildAssignRolesCalldata(NEW_ADMIN, true, ADMIN_ROLE_KEY_V2)));
  await expectOutcome("executor: revoke its own role", "ok",
    execAsRole(v.modifier, EXECUTOR, EXECUTOR_KEY, v.modifier, buildAssignRolesCalldata(EXECUTOR, false, EXECUTOR_ROLE_KEY_V2)));
  await expectOutcome("ownership-only activation: edit metadata passes the permission but the vault refuses it", "inner-revert",
    asAdmin(v.vault, await settingsCall(v, { fundMetadata: "{}" })));
  await expectOutcome("ownership-only activation: add a depositor passes the permission but the vault refuses it", "inner-revert",
    asAdmin(v.vault, await settingsCall(v, { whitelistDeltas: [NEW_DEPOSITOR] })));
  await expectOutcome("ownership-only activation: move the fee destinations passes the permission but the vault refuses it", "inner-revert",
    asAdmin(v.vault, await settingsCall(v, { feeCollectors: NEW_COLLECTORS })));
};

const defaultSwitchesWithWhitelist = async () => {
  console.log("\nVault 6: default switches on a vault created with a whitelist, full activation");
  const v = await createVault({
    label: "defaults-whitelisted",
    deployer: addr(0xdeb10006),
    whitelist: [DEPOSITOR],
    permissions: defaultVaultRolePermissions(),
    admins: [ADMIN],
    executors: [EXECUTOR],
    integrations: [],
  });
  const asAdmin = (to: string, data: string) => execAsRole(v.modifier, ADMIN, ADMIN_KEY, to, data);
  // Ownership alone is not enough for a settings permission…
  await activate(v, { settingsAuthority: false });
  await expectOutcome("ownership-only activation: whitelist change passes the permission but the vault refuses it", "inner-revert",
    asAdmin(v.vault, await settingsCall(v, { whitelistDeltas: [NEW_DEPOSITOR] })));
  // …the configuration change the switches' hints ask for is what enables it.
  await activate(v);
  await expectOutcome("after the configuration change: add a depositor", "ok",
    asAdmin(v.vault, await settingsCall(v, { whitelistDeltas: [NEW_DEPOSITOR] })));
  check(await isWhitelisted(v.vault, NEW_DEPOSITOR), "the new depositor is whitelisted");
  await expectOutcome("after the configuration change: edit metadata", "ok",
    asAdmin(v.vault, await settingsCall(v, { fundMetadata: "{\"description\":\"defaults\"}" })));
  await expectOutcome("after the configuration change: move the fee destinations", "ok",
    asAdmin(v.vault, await settingsCall(v, { feeCollectors: NEW_COLLECTORS })));
};

const noAdmin = async () => {
  console.log("\nVault 4: admin role disabled");
  const v = await createVault({
    label: "no-admin",
    deployer: addr(0xdeb10004),
    whitelist: [],
    permissions: { ...fullVaultRolePermissions(), adminEnabled: false },
    admins: [ADMIN],
    executors: [EXECUTOR],
    integrations: [],
  });
  await activate(v);
  await deal(USDC, v.safe, 1_000_000n);
  await expectOutcome("the would-be admin holds no role", "no-membership",
    execAsRole(v.modifier, ADMIN, ADMIN_KEY, v.vault, await settingsCall(v, { fundMetadata: "{}" })));
  await expectOutcome("the executor still runs the vault", "ok",
    execAsRole(v.modifier, EXECUTOR, EXECUTOR_KEY, USDC, erc20.encodeFunctionData("transfer", [v.vault, 1000n])));
  await expectOutcome("the executor did not inherit the admin's settings powers", "denied",
    execAsRole(v.modifier, EXECUTOR, EXECUTOR_KEY, v.vault, await settingsCall(v, { fundMetadata: "{}" })));
  await expectOutcome("…nor the power to add executors", "denied",
    execAsRole(v.modifier, EXECUTOR, EXECUTOR_KEY, v.modifier, buildAssignRolesCalldata(NEW_EXECUTOR, true, EXECUTOR_ROLE_KEY_V2)));
};

// ---------------------------------------------------------------------------

const startAnvil = async (): Promise<ChildProcess> => {
  const anvil = spawn(
    ANVIL,
    [
      "--fork-url", FORK_RPC,
      // A pinned block is cached on disk, so reruns do not re-fetch state.
      ...(process.env.ROLES_V2_FORK_BLOCK ? ["--fork-block-number", process.env.ROLES_V2_FORK_BLOCK] : []),
      "--port", String(PORT),
      "--auto-impersonate",
      // HyperEVM's standard blocks hold 3M gas, less than creating a vault
      // takes; the fork runs with its 30M "big block" limit throughout.
      "--gas-limit", "30000000",
      "--no-rate-limit",
      "--retries", "10",
      "--timeout", "60000",
      "--silent",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${PORT}`, undefined, {
    staticNetwork: true,
    batchMaxCount: 1,
    // ethers answers a repeated identical read from a 250 ms cache. Here the
    // same slot is read before and after a transaction that changes it,
    // often faster than that, and the stale answer looks like a failed
    // check.
    cacheTimeout: -1,
  });
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      await provider.send("eth_blockNumber", []);
      // Calls against the forked block itself fail ("Excess blob gas not
      // set": Arbitrum headers carry no blob fields). One locally mined block
      // gives every later call a complete header to run on.
      await provider.send("anvil_mine", ["0x1"]);
      return anvil;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  anvil.kill();
  throw new Error("anvil did not come up");
};

const main = async () => {
  const anvil = await startAnvil();
  try {
    const block = await provider.getBlockNumber();
    forkBlock = block;
    const beacon = new ethers.Interface(["function implementation() view returns (address)"]);
    const [mastercopy] = await view(ROLES_BEACON, beacon, "implementation");
    console.log(`${CHAIN_NAME} fork at block ${block}; new vaults get Roles mastercopy ${mastercopy}`);

    await everySwitchOn();
    await narrowAdmin();
    await metadataOnlyAdmin();
    await noAdmin();
    await defaultSwitches();
    await defaultSwitchesWithWhitelist();
  } finally {
    anvil.kill();
  }
  if (failures) {
    console.log(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
  console.log("\nFORK E2E PASSED");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
