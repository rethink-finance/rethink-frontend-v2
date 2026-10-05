/**
 * Allow / deny matrix for the CarrotFunding Vault's raw Roles v2 permissions
 * (composables/execution/crtV2Permissions.ts), run against the EXACT Roles
 * v2 bytecode the vault's modifier runs — the 2.1.1 mastercopy its beacon
 * points at (0xF296…83D5, identical on HyperEVM and Arbitrum) and the 2.1.0
 * one before it — inside an in-process EVM. Same harness as
 * rolesV2RuntimeAcceptance.ts; this one applies the Carrot batches and asks
 * the questions that matter for them: can the executor move any amount
 * between the Safe's own venues and nowhere else, can the admin pay the
 * payout wallet and manage API wallets and nothing else.
 *
 * Run with:  npm run test:crt-v2-acceptance
 * (reads the code blobs from HyperEVM; override with CRT_V2_ACCEPTANCE_RPC)
 */
import { VM } from "@ethereumjs/vm";
import { Common, Hardfork } from "@ethereumjs/common";
import { Address, bytesToHex, hexToBytes } from "@ethereumjs/util";
import { ethers } from "ethers";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import {
  ARBITRUM_CHAIN_ID,
  CRT_V2_ADDR,
  CRT_V2_ROLE_KEYS,
  SPOT_DEX,
  encodeAddApiWallet,
  encodeSendAsset,
  encodeSendUsdcToEvm,
  encodeUsdClassTransfer,
  hypercoreHeader,
} from "~/composables/execution/crtV2Vault";
import {
  CRT_V2_IFACES,
  buildCrtV2AdminRawPermissions,
  buildCrtV2ExecutorRawPermissions,
} from "~/composables/execution/crtV2Permissions";

const RPC = process.env.CRT_V2_ACCEPTANCE_RPC ?? "https://rpc.purroofgroup.com";

const MASTERCOPIES: [string, string][] = [
  ["2.1.1 (the vault's beacon implementation)", "0xF2964CE6161ce0e75964Fe7927cE114cb0B283D5"],
  ["2.1.0", "0x9646fDAD06d3e24444381f44362a3B0eB343D337"],
];

const OWNER = "0x0000000000000000000000000000000000000111";
const STRANGER = "0x0000000000000000000000000000000000000333";
const A = CRT_V2_ADDR;
const ADMIN = A.adminSafe;
const EXECUTOR = A.executor;
const ADMIN_KEY = CRT_V2_ROLE_KEYS.admin;
const EXECUTOR_KEY = CRT_V2_ROLE_KEYS.executor;

const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const IF = CRT_V2_IFACES;
const usdc = (v: string) => ethers.parseUnits(v, 6);

const writer = (payload: string) => IF.writer.encodeFunctionData("sendRawAction", [payload]);
const across = (overrides: Partial<Record<string, unknown>> = {}) => {
  const args: Record<string, unknown> = {
    depositor: A.safe,
    recipient: A.payout,
    inputToken: A.usdc,
    outputToken: A.arbUsdc,
    inputAmount: usdc("2000"),
    outputAmount: usdc("1999.5"),
    destinationChainId: ARBITRUM_CHAIN_ID,
    exclusiveRelayer: ethers.ZeroAddress,
    fillDeadlineOffset: 18000,
    exclusivityPeriod: 0,
    message: "0x",
    ...overrides,
  };
  return IF.spoke.encodeFunctionData("depositV3Now", Object.values(args));
};

type Sender = "admin" | "executor";
// [label, sender, role key, target, calldata, expected to be allowed]
type Scenario = [string, Sender, string, string, string, boolean];

const SCENARIOS: Scenario[] = [
  // ─── Executor: HyperCore ─────────────────────────────────────────────────
  ["executor: spot → perp 1 USDC", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeUsdClassTransfer(usdc("1"), true)), true],
  ["executor: perp → spot 123,456.789012 USDC (any amount)", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeUsdClassTransfer(usdc("123456.789012"), false)), true],
  ["executor: spot → perp max uint64", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeUsdClassTransfer(2n ** 64n - 1n, true)), true],
  ["executor: Core → EVM 1 USDC", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeSendUsdcToEvm(100000000n)), true],
  ["executor: Core → EVM 50,000 USDC (any amount)", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeSendUsdcToEvm(5000000000000n)), true],
  ["executor: Core → EVM max uint64", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeSendUsdcToEvm(2n ** 64n - 1n)), true],
  ["executor: sendAsset to a stranger", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeSendAsset(STRANGER, ethers.ZeroAddress, SPOT_DEX, SPOT_DEX, 0n, 100000000n)), false],
  ["executor: sendAsset to the payout wallet", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeSendAsset(A.payout, ethers.ZeroAddress, SPOT_DEX, SPOT_DEX, 0n, 100000000n)), false],
  ["executor: sendAsset of another token", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeSendAsset(A.coreBridge, ethers.ZeroAddress, SPOT_DEX, SPOT_DEX, 150n, 100000000n)), false],
  ["executor: sendAsset from perp dex", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeSendAsset(A.coreBridge, ethers.ZeroAddress, 0, SPOT_DEX, 0n, 100000000n)), false],
  ["executor: sendAsset to perp dex", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeSendAsset(A.coreBridge, ethers.ZeroAddress, SPOT_DEX, 0, 0n, 100000000n)), false],
  ["executor: sendAsset with a sub-account", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeSendAsset(A.coreBridge, STRANGER, SPOT_DEX, SPOT_DEX, 0n, 100000000n)), false],
  ["executor: sendAsset destination off by one bit", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeSendAsset("0x2000000000000000000000000000000000000001", ethers.ZeroAddress, SPOT_DEX, SPOT_DEX, 0n, 100000000n)), false],
  ["executor: addApiWallet (agents are the admin's)", "executor", EXECUTOR_KEY, A.coreWriter, writer(encodeAddApiWallet(A.payout, "carrot valid_until 1800000000000")), false],
  ["executor: spotSend (action 6)", "executor", EXECUTOR_KEY, A.coreWriter, writer(hypercoreHeader(6) + ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint64", "uint64"], [STRANGER, 0n, 100000000n]).slice(2)), false],
  ["executor: limitOrder (action 1)", "executor", EXECUTOR_KEY, A.coreWriter, writer(hypercoreHeader(1) + "00".repeat(32 * 7)), false],
  ["executor: vaultTransfer (action 2)", "executor", EXECUTOR_KEY, A.coreWriter, writer(hypercoreHeader(2) + ethers.AbiCoder.defaultAbiCoder().encode(["address", "bool", "uint64"], [STRANGER, true, 1n]).slice(2)), false],
  ["executor: usdClassTransfer header with wrong version byte", "executor", EXECUTOR_KEY, A.coreWriter, writer("0x02000007" + encodeUsdClassTransfer(usdc("1"), true).slice(10)), false],
  ["executor: payload shorter than the header", "executor", EXECUTOR_KEY, A.coreWriter, writer("0x010000"), false],
  ["executor: empty payload", "executor", EXECUTOR_KEY, A.coreWriter, writer("0x"), false],
  // ─── Executor: EVM → Core ────────────────────────────────────────────────
  ["executor: approve CoreDepositWallet", "executor", EXECUTOR_KEY, A.usdc, IF.erc20.encodeFunctionData("approve", [A.cdw, usdc("250000")]), true],
  ["executor: approve Felix", "executor", EXECUTOR_KEY, A.usdc, IF.erc20.encodeFunctionData("approve", [A.felix, ethers.MaxUint256]), true],
  ["executor: approve HyperLend", "executor", EXECUTOR_KEY, A.usdc, IF.erc20.encodeFunctionData("approve", [A.pool, usdc("1")]), true],
  ["executor: approve the Across SpokePool", "executor", EXECUTOR_KEY, A.usdc, IF.erc20.encodeFunctionData("approve", [A.spokePool, usdc("1")]), false],
  ["executor: approve a stranger", "executor", EXECUTOR_KEY, A.usdc, IF.erc20.encodeFunctionData("approve", [STRANGER, usdc("1")]), false],
  ["executor: approve the payout wallet", "executor", EXECUTOR_KEY, A.usdc, IF.erc20.encodeFunctionData("approve", [A.payout, usdc("1")]), false],
  ["executor: USDC.transfer to the payout wallet (payouts are the admin's)", "executor", EXECUTOR_KEY, A.usdc, IF.erc20.encodeFunctionData("transfer", [A.payout, usdc("1")]), false],
  ["executor: USDC.transfer to a stranger", "executor", EXECUTOR_KEY, A.usdc, IF.erc20.encodeFunctionData("transfer", [STRANGER, usdc("1")]), false],
  ["executor: depositFor(Safe, any, dex 0)", "executor", EXECUTOR_KEY, A.cdw, IF.cdw.encodeFunctionData("depositFor", [A.safe, usdc("75000"), 0]), true],
  ["executor: depositFor a stranger", "executor", EXECUTOR_KEY, A.cdw, IF.cdw.encodeFunctionData("depositFor", [STRANGER, usdc("1"), 0]), false],
  ["executor: depositFor another dex", "executor", EXECUTOR_KEY, A.cdw, IF.cdw.encodeFunctionData("depositFor", [A.safe, usdc("1"), 1]), false],
  // ─── Executor: yield venues ──────────────────────────────────────────────
  ["executor: Felix deposit to the Safe", "executor", EXECUTOR_KEY, A.felix, IF.felix.encodeFunctionData("deposit", [usdc("10000"), A.safe]), true],
  ["executor: Felix deposit to a stranger", "executor", EXECUTOR_KEY, A.felix, IF.felix.encodeFunctionData("deposit", [usdc("1"), STRANGER]), false],
  ["executor: Felix withdraw to the Safe", "executor", EXECUTOR_KEY, A.felix, IF.felix.encodeFunctionData("withdraw", [usdc("10000"), A.safe, A.safe]), true],
  ["executor: Felix withdraw to a stranger", "executor", EXECUTOR_KEY, A.felix, IF.felix.encodeFunctionData("withdraw", [usdc("1"), STRANGER, A.safe]), false],
  ["executor: Felix withdraw from a stranger", "executor", EXECUTOR_KEY, A.felix, IF.felix.encodeFunctionData("withdraw", [usdc("1"), A.safe, STRANGER]), false],
  ["executor: Felix redeem all to the Safe", "executor", EXECUTOR_KEY, A.felix, IF.felix.encodeFunctionData("redeem", [ethers.parseUnits("9999.123456789", 18), A.safe, A.safe]), true],
  ["executor: Felix redeem to a stranger", "executor", EXECUTOR_KEY, A.felix, IF.felix.encodeFunctionData("redeem", [1n, STRANGER, A.safe]), false],
  ["executor: HyperLend supply for the Safe", "executor", EXECUTOR_KEY, A.pool, IF.pool.encodeFunctionData("supply", [A.usdc, usdc("10000"), A.safe, 0]), true],
  ["executor: HyperLend supply with a referral code", "executor", EXECUTOR_KEY, A.pool, IF.pool.encodeFunctionData("supply", [A.usdc, usdc("1"), A.safe, 7]), true],
  ["executor: HyperLend supply for a stranger", "executor", EXECUTOR_KEY, A.pool, IF.pool.encodeFunctionData("supply", [A.usdc, usdc("1"), STRANGER, 0]), false],
  ["executor: HyperLend supply another asset", "executor", EXECUTOR_KEY, A.pool, IF.pool.encodeFunctionData("supply", [A.arbUsdc, usdc("1"), A.safe, 0]), false],
  ["executor: HyperLend withdraw all to the Safe", "executor", EXECUTOR_KEY, A.pool, IF.pool.encodeFunctionData("withdraw", [A.usdc, ethers.MaxUint256, A.safe]), true],
  ["executor: HyperLend withdraw to a stranger", "executor", EXECUTOR_KEY, A.pool, IF.pool.encodeFunctionData("withdraw", [A.usdc, usdc("1"), STRANGER]), false],
  ["executor: Across depositV3Now (payouts are the admin's)", "executor", EXECUTOR_KEY, A.spokePool, across(), false],
  ["executor: unscoped target", "executor", EXECUTOR_KEY, STRANGER, "0xdeadbeef", false],
  ["executor: under the admin role key", "executor", ADMIN_KEY, A.usdc, IF.erc20.encodeFunctionData("transfer", [A.payout, usdc("1")]), false],
  // ─── Admin: payouts ──────────────────────────────────────────────────────
  ["admin: USDC.transfer to the payout wallet, 2,000", "admin", ADMIN_KEY, A.usdc, IF.erc20.encodeFunctionData("transfer", [A.payout, usdc("2000")]), true],
  ["admin: USDC.transfer to the payout wallet, 1,000,000 (no cap)", "admin", ADMIN_KEY, A.usdc, IF.erc20.encodeFunctionData("transfer", [A.payout, usdc("1000000")]), true],
  ["admin: USDC.transfer to a stranger", "admin", ADMIN_KEY, A.usdc, IF.erc20.encodeFunctionData("transfer", [STRANGER, usdc("1")]), false],
  ["admin: USDC.transfer to the admin Safe itself", "admin", ADMIN_KEY, A.usdc, IF.erc20.encodeFunctionData("transfer", [A.adminSafe, usdc("1")]), false],
  ["admin: USDC.transfer to the executor", "admin", ADMIN_KEY, A.usdc, IF.erc20.encodeFunctionData("transfer", [A.executor, usdc("1")]), false],
  ["admin: approve the Across SpokePool", "admin", ADMIN_KEY, A.usdc, IF.erc20.encodeFunctionData("approve", [A.spokePool, usdc("2000")]), true],
  ["admin: approve the payout wallet", "admin", ADMIN_KEY, A.usdc, IF.erc20.encodeFunctionData("approve", [A.payout, usdc("1")]), false],
  ["admin: approve Felix (venues are the executor's)", "admin", ADMIN_KEY, A.usdc, IF.erc20.encodeFunctionData("approve", [A.felix, usdc("1")]), false],
  ["admin: Across deposit as pinned", "admin", ADMIN_KEY, A.spokePool, across(), true],
  ["admin: Across deposit, other amounts and a 6 h window", "admin", ADMIN_KEY, A.spokePool, across({ inputAmount: usdc("1"), outputAmount: 0n, fillDeadlineOffset: 21600 }), true],
  ["admin: Across deposit with an exclusive relayer", "admin", ADMIN_KEY, A.spokePool, across({ exclusiveRelayer: STRANGER, exclusivityPeriod: 60 }), true],
  ["admin: Across deposit to a stranger", "admin", ADMIN_KEY, A.spokePool, across({ recipient: STRANGER }), false],
  ["admin: Across deposit refunding a stranger", "admin", ADMIN_KEY, A.spokePool, across({ depositor: STRANGER }), false],
  ["admin: Across deposit of another input token", "admin", ADMIN_KEY, A.spokePool, across({ inputToken: A.arbUsdc }), false],
  ["admin: Across deposit to another output token", "admin", ADMIN_KEY, A.spokePool, across({ outputToken: A.usdc }), false],
  ["admin: Across deposit to another chain", "admin", ADMIN_KEY, A.spokePool, across({ destinationChainId: 8453 }), false],
  ["admin: Across deposit carrying a message", "admin", ADMIN_KEY, A.spokePool, across({ message: "0x1234" }), false],
  // ─── Admin: API wallets ──────────────────────────────────────────────────
  ["admin: register the trading agent for 180 days", "admin", ADMIN_KEY, A.coreWriter, writer(encodeAddApiWallet(A.payout, "carrot valid_until 1807000000000")), true],
  ["admin: register any other agent, any name", "admin", ADMIN_KEY, A.coreWriter, writer(encodeAddApiWallet(STRANGER, "some other bot valid_until 1795000000000")), true],
  ["admin: register an unnamed agent", "admin", ADMIN_KEY, A.coreWriter, writer(encodeAddApiWallet(STRANGER, "")), true],
  ["admin: remove the named agent (zero address)", "admin", ADMIN_KEY, A.coreWriter, writer(encodeAddApiWallet(ethers.ZeroAddress, "carrot")), true],
  ["admin: usdClassTransfer (capital moves are the executor's)", "admin", ADMIN_KEY, A.coreWriter, writer(encodeUsdClassTransfer(usdc("1"), true)), false],
  ["admin: sendAsset Core → EVM", "admin", ADMIN_KEY, A.coreWriter, writer(encodeSendUsdcToEvm(100000000n)), false],
  ["admin: spotSend (action 6)", "admin", ADMIN_KEY, A.coreWriter, writer(hypercoreHeader(6) + ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint64", "uint64"], [STRANGER, 0n, 100000000n]).slice(2)), false],
  ["admin: addApiWallet header with wrong version byte", "admin", ADMIN_KEY, A.coreWriter, writer("0x02000009" + encodeAddApiWallet(STRANGER, "x").slice(10)), false],
  ["admin: empty payload", "admin", ADMIN_KEY, A.coreWriter, writer("0x"), false],
  ["admin: Felix deposit", "admin", ADMIN_KEY, A.felix, IF.felix.encodeFunctionData("deposit", [usdc("1"), A.safe]), false],
  ["admin: depositFor", "admin", ADMIN_KEY, A.cdw, IF.cdw.encodeFunctionData("depositFor", [A.safe, usdc("1"), 0]), false],
  ["admin: under the executor role key", "admin", EXECUTOR_KEY, A.usdc, IF.erc20.encodeFunctionData("approve", [A.cdw, usdc("1")]), false],
  ["admin: unscoped target", "admin", ADMIN_KEY, STRANGER, "0xdeadbeef", false],
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

/** The mastercopy's code plus every library its bytecode links (read out of the PUSH20s). */
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
  if (!blobs.has(root.toLowerCase())) throw new Error(`No code at ${root} on ${RPC}`);
  return blobs;
};

const run = async (mastercopy: string, blobs: Map<string, string>): Promise<number> => {
  const common = new Common({ chain: "mainnet", hardfork: Hardfork.Cancun });
  const vm = await VM.create({ common });
  const putCode = (addr: string, codeHex: string) =>
    vm.stateManager.putContractCode(Address.fromString(addr), hexToBytes(codeHex as `0x${string}`));
  for (const [address, code] of blobs) await putCode(address, code);
  // The avatar/target Safe as a stub that answers success to every call: the
  // permission check under test runs before the modifier ever reaches it.
  await putCode(A.safe, "0x600160005260206000f3");

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

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const setUp = await call(
    OWNER,
    mastercopy,
    rolesIface.encodeFunctionData("setUp", [abiCoder.encode(["address", "address", "address"], [OWNER, A.safe, A.safe])]),
  );
  if (!setUp.ok) throw new Error(`setUp failed: ${decodeErr(setUp.ret)}`);

  // The raw batches, applied as the owner — exactly what submitPermissions
  // does with them. Integrity.enforce runs here, so a malformed condition
  // tree fails the run before any scenario.
  const batch = [...buildCrtV2AdminRawPermissions(), ...buildCrtV2ExecutorRawPermissions()];
  for (const [i, entry] of batch.entries()) {
    const res = await call(OWNER, mastercopy, entry.data);
    if (!res.ok) throw new Error(`entry ${i} (${entry.label}) rejected: ${decodeErr(res.ret)}`);
  }
  for (const [member, key] of [[ADMIN, ADMIN_KEY], [EXECUTOR, EXECUTOR_KEY]]) {
    const assign = await call(OWNER, mastercopy, rolesIface.encodeFunctionData("assignRoles", [member, [key], [true]]));
    if (!assign.ok) throw new Error("assignRoles failed");
  }

  let failures = 0;
  for (const [label, sender, key, to, data, expectAllowed] of SCENARIOS) {
    const res = await call(
      sender === "admin" ? ADMIN : EXECUTOR,
      mastercopy,
      rolesIface.encodeFunctionData("execTransactionWithRole", [to, 0n, data, 0, key, true]),
    );
    const pass = res.ok === expectAllowed;
    if (!pass) failures++;
    if (!pass || process.env.VERBOSE) {
      console.log(`  ${pass ? "PASS" : "FAIL"} | ${label} | expected ${expectAllowed ? "allow" : "deny"}, got ${res.ok ? "allowed" : `denied ${decodeErr(res.ret)}`}`);
    }
  }
  console.log(`${failures ? "FAIL" : "PASS"} | ${batch.length} entries applied, ${SCENARIOS.length - failures}/${SCENARIOS.length} scenarios`);
  return failures;
};

const main = async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  let failures = 0;
  for (const [version, mastercopy] of MASTERCOPIES) {
    const blobs = await loadLinkedCode(provider, mastercopy);
    console.log(`\nRoles ${version} ${mastercopy} (+${blobs.size - 1} linked contracts)`);
    failures += await run(mastercopy, blobs);
  }
  if (failures > 0) throw new Error(`${failures} scenario(s) failed`);
  console.log("\nALL SCENARIOS PASS");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
