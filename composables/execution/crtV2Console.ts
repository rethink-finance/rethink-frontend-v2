import { ethers } from "ethers";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import { crtPackMultiSend } from "~/composables/execution/crtConsole";
import {
  ACROSS_TRANCHES_USDC,
  ARBITRUM_CHAIN_ID,
  acrossMaxRelayerShare,
  acrossMinOutput,
  splitIntoAcrossTranches,
  CRT_V2_ADDR,
  CRT_V2_AGENT_MAX_DAYS,
  CRT_V2_AGENT_MIN_DAYS,
  CRT_V2_AGENT_NAME,
  CRT_V2_CHAIN_HEX,
  CRT_V2_ROLE_KEYS,
  encodeAddApiWallet,
  encodeSendUsdcToEvm,
  encodeUsdClassTransfer,
  type CrtV2Role,
} from "~/composables/execution/crtV2Vault";
import {
  CRT_V2_IFACES,
  buildCrtV2AdminAcrossFix,
  buildCrtV2AdminRawPermissions,
  buildCrtV2ExecutorRawPermissions,
  crtV2RawPermissionsJson,
} from "~/composables/execution/crtV2Permissions";

/**
 * CarrotFunding Vault (Roles v2) execution console: calldata builders, the
 * Roles v2 wrap, the Safe-level batch the admin Safe proposes, the dry run
 * that reads the modifier's answer, and every read the screen shows.
 *
 * Two roles, two kinds of sender. The EXECUTOR is a key: it signs
 * execTransactionWithRole itself. The ADMIN is the Carrot 2-of-4 Safe: its
 * calls are proposed to it (one of its owners signs here, the rest in
 * Safe{Wallet}) and the Safe is what calls the modifier. Nothing here needs
 * the vault to be finalized — the Safe and the modifier exist from
 * initCreateFund — so the console works from the day the vault is deployed.
 */

const A = CRT_V2_ADDR;

export const CRT_V2 = {
  CHAIN_HEX: CRT_V2_CHAIN_HEX,
  // The official endpoint last: it meters block lookups ("More than 3000
  // archived blocks queried in one day") and the others answer the same.
  RPCS: ["https://rpc.purroofgroup.com", "https://rpc.hypurrscan.io", "https://rpc.hyperliquid.xyz/evm"],
  INFO_API: "https://api.hyperliquid.xyz/info",
  EXPLORER: "https://hyperevmscan.io",
  ADDR: A,
  ROLE_KEYS: CRT_V2_ROLE_KEYS,
  ARBITRUM: {
    CHAIN_ID: ARBITRUM_CHAIN_ID,
    RPCS: ["https://arb1.arbitrum.io/rpc", "https://arbitrum.gateway.tenderly.co", "https://arbitrum.drpc.org"],
    EXPLORER: "https://arbiscan.io",
  },
  ACROSS: {
    API: "https://app.across.to/api",
    // depositV3Now stamps the quote time when the Safe EXECUTES, so a
    // proposal never goes stale in the queue; the fill deadline is this far
    // past that moment (the pool caps it at 6 h).
    FILL_DEADLINE_OFFSET: 18000,
    // The relayer keeps inputAmount − outputAmount. Quoted when the proposal
    // is staged, executed whenever the signers get to it: reserve twice the
    // quoted fee with a floor, and any surplus is the relayer's tip.
    FEE_RESERVE_MULTIPLIER: 2n,
    MIN_FEE_RESERVE: 250000n, // 0.25 USDC
  },
  AGENT: {
    name: CRT_V2_AGENT_NAME,
    minDays: CRT_V2_AGENT_MIN_DAYS,
    maxDays: CRT_V2_AGENT_MAX_DAYS,
    defaultDays: CRT_V2_AGENT_MAX_DAYS,
    /** Keys the team already runs; any address may be registered. */
    presets: [
      { addr: "0x4aAbFCc667Caf17275624044CA0D96fAD11e2571", label: "Trading agent", desc: "The bot's signer on HyperCore. Also the payout wallet." },
      { addr: "0x772187016dac685593D04DCA8A79794e6fA70824", label: "Backup agent", desc: "Kept unused. Registering it under the same name replaces the trading agent." },
    ],
  },
};

const coder = () => ethers.AbiCoder.defaultAbiCoder();
const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const IF = {
  ...CRT_V2_IFACES,
  erc20: new ethers.Interface([
    "function approve(address spender, uint256 amount)",
    "function transfer(address to, uint256 amount)",
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
  ]),
  felixView: new ethers.Interface([
    "function maxWithdraw(address) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function convertToAssets(uint256) view returns (uint256)",
    "function symbol() view returns (string)",
  ]),
  safe: new ethers.Interface([
    "function getOwners() view returns (address[])",
    "function getThreshold() view returns (uint256)",
    "function nonce() view returns (uint256)",
  ]),
  multisend: new ethers.Interface(["function multiSend(bytes transactions)"]),
  fund: new ethers.Interface([
    "function getFundSettings() view returns ((uint256 depositFee,uint256 withdrawFee,uint256 performanceFee,uint256 managementFee,uint256 performaceHurdleRateBps,address baseToken,address safe,bool isExternalGovTokenInUse,bool isWhitelistedDeposits,address[] allowedDepositAddrs,address[] allowedManagers,address governanceToken,address fundAddress,address governor,string fundName,string fundSymbol,address[4] feeCollectors))",
  ]),
};

export const usdc6 = (v: string | number) => ethers.parseUnits(String(v).trim(), 6);
/** USDC to the cent: every balance on the screen is read that way. */
export const fmt6 = (bi: bigint, dp = 2) =>
  Number(ethers.formatUnits(bi ?? 0n, 6)).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const shortAddr = (a?: string) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "—");
const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export interface CrtV2Param { k: string; v: string; pinned?: boolean }
export interface CrtV2Inner { to: string; data: string; sig: string; params: CrtV2Param[] }
export interface CrtV2Wrapped { to: string; data: string; role: CrtV2Role; inner: CrtV2Inner }

// ─── Agent names and expiries ────────────────────────────────────────────────

/** The name HyperCore reads a validity from: "<name> valid_until <unix ms>". */
export const crtV2AgentName = (validUntilMs: number) => `${CRT_V2.AGENT.name} valid_until ${validUntilMs}`;
export const crtV2ParseAgentName = (name: string): { base: string; validUntil: number | null } => {
  const m = /^(.*?)\s*valid_until\s+(\d+)\s*$/.exec(name);
  return m ? { base: m[1], validUntil: Number(m[2]) } : { base: name, validUntil: null };
};
/**
 * The expiry a registration of `days` gets, counted from now. HyperCore
 * accepts at most 180 days from its own clock; the transaction is processed
 * after this is computed, so a full 180 from here always fits.
 */
export const crtV2ValidUntil = (days: number, now = Date.now()): number => {
  if (!Number.isInteger(days) || days < CRT_V2.AGENT.minDays || days > CRT_V2.AGENT.maxDays) {
    throw new Error(`An agent is valid for ${CRT_V2.AGENT.minDays} to ${CRT_V2.AGENT.maxDays} days.`);
  }
  return now + days * 86400000;
};
export const crtV2FormatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const crtV2DaysLeft = (ms: number, now = Date.now()) => Math.max(0, Math.ceil((ms - now) / 86400000));

// ─── Inner calls ─────────────────────────────────────────────────────────────

export const crtV2Inner = {
  approve: (spender: string, spenderLabel: string, amt: string): CrtV2Inner => ({
    to: A.usdc,
    data: IF.erc20.encodeFunctionData("approve", [spender, usdc6(amt)]),
    sig: "USDC.approve(spender, amount)",
    params: [{ k: "spender", v: `${spenderLabel} ${shortAddr(spender)}`, pinned: true }, { k: "amount", v: `${amt} USDC` }],
  }),
  payout: (amt: string): CrtV2Inner => ({
    to: A.usdc,
    data: IF.erc20.encodeFunctionData("transfer", [A.payout, usdc6(amt)]),
    sig: "USDC.transfer(to, amount)",
    params: [{ k: "to", v: `Payout wallet ${shortAddr(A.payout)}`, pinned: true }, { k: "amount", v: `${amt} USDC` }],
  }),
  /**
   * The Arbitrum leg of a payout. Depositor (refunds), recipient, both
   * tokens, the destination chain and the empty message are what the
   * whitelist pins; amounts, relayer exclusivity and the fill window are
   * the console's to choose.
   */
  acrossDeposit: (amt: string, outputAmount: bigint): CrtV2Inner => ({
    to: A.spokePool,
    data: IF.spoke.encodeFunctionData("depositV3Now", [A.safe, A.payout, A.usdc, A.arbUsdc, usdc6(amt), outputAmount, ARBITRUM_CHAIN_ID, ethers.ZeroAddress, CRT_V2.ACROSS.FILL_DEADLINE_OFFSET, 0, "0x"]),
    sig: "Across.depositV3Now(depositor, recipient, inputToken, outputToken, inputAmount, outputAmount, destinationChainId, exclusiveRelayer, fillDeadlineOffset, exclusivityPeriod, message)",
    params: [
      { k: "depositor (refunds)", v: `Vault Safe ${shortAddr(A.safe)}`, pinned: true },
      { k: "recipient", v: `Payout wallet ${shortAddr(A.payout)} on Arbitrum`, pinned: true },
      { k: "inputToken", v: "USDC (HyperEVM)", pinned: true },
      { k: "outputToken", v: `USDC (Arbitrum) ${shortAddr(A.arbUsdc)}`, pinned: true },
      { k: "inputAmount", v: `${amt} USDC` },
      { k: "outputAmount", v: `${fmt6(outputAmount, 6)} USDC (minimum received)` },
      { k: "destinationChainId", v: String(ARBITRUM_CHAIN_ID), pinned: true },
      { k: "exclusiveRelayer", v: "none (any relayer may fill)" },
      { k: "fillDeadlineOffset", v: `${CRT_V2.ACROSS.FILL_DEADLINE_OFFSET / 3600} h after execution` },
      { k: "message", v: "empty", pinned: true },
    ],
  }),
  felixDeposit: (amt: string): CrtV2Inner => ({ to: A.felix, data: IF.felix.encodeFunctionData("deposit", [usdc6(amt), A.safe]), sig: "Felix.deposit(assets, receiver)", params: [{ k: "assets", v: `${amt} USDC` }, { k: "receiver", v: "Vault Safe", pinned: true }] }),
  felixWithdraw: (amt: string): CrtV2Inner => ({ to: A.felix, data: IF.felix.encodeFunctionData("withdraw", [usdc6(amt), A.safe, A.safe]), sig: "Felix.withdraw(assets, receiver, owner)", params: [{ k: "assets", v: `${amt} USDC (exact out)` }, { k: "receiver", v: "Vault Safe", pinned: true }, { k: "owner", v: "Vault Safe", pinned: true }] }),
  felixRedeem: (shares18: bigint): CrtV2Inner => ({ to: A.felix, data: IF.felix.encodeFunctionData("redeem", [shares18, A.safe, A.safe]), sig: "Felix.redeem(shares, receiver, owner)", params: [{ k: "shares", v: `${ethers.formatUnits(shares18, 18)} shares (full exit)` }, { k: "receiver", v: "Vault Safe", pinned: true }, { k: "owner", v: "Vault Safe", pinned: true }] }),
  poolSupply: (amt: string): CrtV2Inner => ({ to: A.pool, data: IF.pool.encodeFunctionData("supply", [A.usdc, usdc6(amt), A.safe, 0]), sig: "HyperLend.supply(asset, amount, onBehalfOf, referralCode)", params: [{ k: "asset", v: "USDC", pinned: true }, { k: "amount", v: `${amt} USDC` }, { k: "onBehalfOf", v: "Vault Safe", pinned: true }] }),
  poolWithdraw: (amtOrMax: string): CrtV2Inner => {
    const max = amtOrMax === "max";
    return { to: A.pool, data: IF.pool.encodeFunctionData("withdraw", [A.usdc, max ? ethers.MaxUint256 : usdc6(amtOrMax), A.safe]), sig: "HyperLend.withdraw(asset, amount, to)", params: [{ k: "asset", v: "USDC", pinned: true }, { k: "amount", v: max ? "uint256.max (the whole position + interest)" : `${amtOrMax} USDC` }, { k: "to", v: "Vault Safe", pinned: true }] };
  },
  cdwDepositFor: (amt: string): CrtV2Inner => ({ to: A.cdw, data: IF.cdw.encodeFunctionData("depositFor", [A.safe, usdc6(amt), 0]), sig: "CoreDepositWallet.depositFor(receiver, amount, dex)", params: [{ k: "receiver", v: `Vault Safe ${shortAddr(A.safe)}`, pinned: true }, { k: "amount", v: `${amt} USDC` }, { k: "dex", v: "0", pinned: true }] }),
  /** Spot ↔ perp inside the Safe's HyperCore account; any amount, to the micro-USDC. */
  usdClassTransfer: (amt: string, toPerp: boolean): CrtV2Inner => ({ to: A.coreWriter, data: IF.writer.encodeFunctionData("sendRawAction", [encodeUsdClassTransfer(usdc6(amt), toPerp)]), sig: "CoreWriter.sendRawAction(usdClassTransfer)", params: [{ k: "amount", v: `${amt} USDC` }, { k: "direction", v: toPerp ? "spot → perp" : "perp → spot" }] }),
  /** Core spot → the Safe's HyperEVM balance; any amount (HyperCore keeps USDC in 1e8). */
  sendAssetToEvm: (amt: string): CrtV2Inner => ({ to: A.coreWriter, data: IF.writer.encodeFunctionData("sendRawAction", [encodeSendUsdcToEvm(ethers.parseUnits(String(amt).trim(), 8))]), sig: "CoreWriter.sendRawAction(sendAsset)", params: [{ k: "amount", v: `${amt} USDC` }, { k: "route", v: "Core spot → Vault Safe on HyperEVM", pinned: true }] }),
  addApiWallet: (agent: string, name: string): CrtV2Inner => {
    const { base, validUntil } = crtV2ParseAgentName(name);
    const removing = same(agent, ethers.ZeroAddress);
    return {
      to: A.coreWriter,
      data: IF.writer.encodeFunctionData("sendRawAction", [encodeAddApiWallet(agent, name)]),
      sig: "CoreWriter.sendRawAction(addApiWallet)",
      params: [
        { k: "agent", v: removing ? "none · empties the slot" : shortAddr(agent) },
        { k: "slot", v: base === "" ? "unnamed" : `named “${base}”` },
        { k: "valid until", v: validUntil ? `${crtV2FormatDate(validUntil)} (${crtV2DaysLeft(validUntil)} days)` : removing ? "—" : "HyperCore's default for an unnamed agent" },
      ],
    };
  },
  /** Register `agent` under the console's name for `days` (14–180). */
  registerAgent: (agent: string, days: number, now = Date.now()): CrtV2Inner => crtV2Inner.addApiWallet(agent, crtV2AgentName(crtV2ValidUntil(days, now))),
  /** Empty the slot `name` holds ("" for the unnamed one): Hyperliquid's own removal. */
  removeAgent: (name: string): CrtV2Inner => crtV2Inner.addApiWallet(ethers.ZeroAddress, name),
  /** Membership of one of the vault's two roles, as the admin may change it. */
  assignRole: (member: string, role: CrtV2Role, memberOf: boolean): CrtV2Inner => ({
    to: A.roles,
    data: rolesIface.encodeFunctionData("assignRoles", [member, [CRT_V2_ROLE_KEYS[role]], [memberOf]]),
    sig: "Roles.assignRoles(module, roleKeys, memberOf)",
    params: [{ k: "address", v: shortAddr(member) }, { k: "role", v: role === "admin" ? "Admin (adminRole)" : "Executor (defaultManagerRole)", pinned: true }, { k: "change", v: memberOf ? "add" : "remove" }],
  }),
};

// ─── The Roles v2 wrap and the admin Safe's batch ────────────────────────────

export const crtV2Wrap = (inner: CrtV2Inner, role: CrtV2Role): CrtV2Wrapped => ({
  to: A.roles,
  data: rolesIface.encodeFunctionData("execTransactionWithRole", [inner.to, 0n, inner.data, 0, CRT_V2_ROLE_KEYS[role], true]),
  role,
  inner,
});
export const EXEC_WITH_ROLE_SELECTOR = rolesIface.getFunction("execTransactionWithRole")!.selector;

export interface CrtV2SafeCall { to: string; data: string; value: string; operation: 0 | 1 }

/**
 * Several role calls as ONE Safe transaction: the admin Safe delegatecalls
 * Safe's own MultiSendCallOnly, which calls the modifier once per step from
 * the Safe's address — so each step is checked under the admin role on its
 * own, and the Safe signs a single transaction for approve + deposit.
 * (Roles v1 unwrapped batches itself; v2 needs an unwrapper the modifier
 * does not have, and this needs nothing from it.)
 */
export const crtV2SafeBatch = (steps: CrtV2Wrapped[]): CrtV2SafeCall => {
  if (steps.length === 1) return { to: steps[0].to, data: steps[0].data, value: "0", operation: 0 };
  return {
    to: A.multiSendCallOnly,
    data: IF.multisend.encodeFunctionData("multiSend", [crtPackMultiSend(steps.map((s) => ({ to: s.to, data: s.data })))]),
    value: "0",
    operation: 1,
  };
};

// ─── RPC and the dry run ─────────────────────────────────────────────────────

let rpcId = 1;
async function rpcOn(urls: string[], method: string, params: any[]): Promise<any> {
  let lastErr: any;
  for (const url of urls) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }) });
      const j = await r.json();
      // A revert carries a payload and IS the answer; an error without one is
      // the endpoint failing, so that one falls through to the next URL.
      if (j.error) { const e: any = new Error(j.error.message); e.data = j.error.data; e.rpcError = e.data !== undefined; throw e; }
      return j.result;
    } catch (e: any) { if (e.rpcError) throw e; lastErr = e; }
  }
  throw lastErr || new Error("all RPCs failed");
}
const rpc = (method: string, params: any[]) => rpcOn(CRT_V2.RPCS, method, params);
const ethCall = (to: string, data: string, from?: string) => rpc("eth_call", [{ to, data, ...(from ? { from } : {}) }, "latest"]);
const dec = (types: string[], hex: string) => coder().decode(types, hex);

/**
 * Roles v2.1 ConditionViolation statuses, in the contract's order
 * (Types.sol). The modifier answers one of these when a parameter fails.
 */
export const CRT_V2_CONDITION_STATUS: Record<number, string> = {
  1: "Delegate calls are not allowed by this permission.",
  2: "This contract is not on the whitelist for this role.",
  3: "This function is not on the whitelist for this role.",
  4: "Sending value is not allowed by this permission.",
  5: "None of the allowed alternatives matched (Or).",
  6: "A forbidden alternative matched (Nor).",
  7: "A pinned parameter (destination / receiver / spender / token) does not match the whitelist.",
  8: "A parameter is below the whitelisted minimum.",
  9: "A parameter is above the whitelisted maximum.",
  10: "A parameter does not match the whitelisted structure.",
  11: "Not every array element passes.",
  12: "No array element passes.",
  13: "An array is not a subset of what is allowed.",
  14: "The payload is shorter than the whitelist's pinned bytes.",
  15: "The payload's pinned bytes (HyperCore action id or pinned fields) do not match.",
  16: "A custom condition refused the call.",
  17: "An allowance is exceeded.",
  18: "A call allowance is exceeded.",
  19: "An ether allowance is exceeded.",
};
const SEL = {
  conditionViolation: ethers.id("ConditionViolation(uint8,bytes32)").slice(0, 10),
  noMembership: ethers.id("NoMembership()").slice(0, 10),
  notAuthorized: ethers.id("NotAuthorized(address)").slice(0, 10),
  moduleTransactionFailed: ethers.id("ModuleTransactionFailed()").slice(0, 10),
  errorString: "0x08c379a0",
  panic: "0x4e487b71",
};

export interface CrtV2Simulation {
  ok: boolean;
  name: string;
  hint: string;
  /** The permission PASSED and the wrapped call itself reverted (balance, allowance, an inert gate). */
  soft?: boolean;
  /** The sender does not hold the role. */
  noMembership?: boolean;
  /** The whitelist refused this (target, function or parameter). */
  denied?: boolean;
  status?: number;
}

/** Dry-run a wrapped role call from `from` and read the modifier's answer. */
export async function crtV2Simulate(wrapped: { to: string; data: string }, from: string): Promise<CrtV2Simulation> {
  try {
    await ethCall(wrapped.to, wrapped.data, from);
    return { ok: true, name: "OK", hint: "" };
  } catch (e: any) {
    const raw: string = typeof e.data === "string" ? e.data : (e.data && e.data.data) || "";
    const sel = raw && raw.length >= 10 ? raw.slice(0, 10) : "";
    if (sel === SEL.conditionViolation) {
      let status = -1;
      try { status = Number(dec(["uint8", "bytes32"], "0x" + raw.slice(10))[0]); } catch { /* keep -1 */ }
      return { ok: false, denied: true, status, name: `Whitelist refused (status ${status})`, hint: CRT_V2_CONDITION_STATUS[status] ?? "The Roles modifier denied this call." };
    }
    if (sel === SEL.noMembership || sel === SEL.notAuthorized || /NoMembership|NotAuthorized/.test(e.message || "")) {
      return { ok: false, noMembership: true, name: "No membership", hint: "The sender does not hold this role on the modifier." };
    }
    if (sel === SEL.moduleTransactionFailed) {
      return { ok: false, soft: true, name: "Permission passed · inner call reverted", hint: "Not a whitelist failure: the target refused (balance, allowance, or a gate that opens with the activation proposal)." };
    }
    if (sel === SEL.errorString) {
      let message = "";
      try { message = String(dec(["string"], "0x" + raw.slice(10))[0]); } catch { /* keep */ }
      return { ok: false, name: "Reverted", hint: message || e.message };
    }
    if (sel === SEL.panic) return { ok: false, name: "Panic", hint: "The call hit a Solidity panic." };
    return { ok: false, name: sel ? `Unknown revert ${sel}` : "Reverted", hint: e.message };
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function crtV2GetBalances() {
  const b = (token: string, holder: string) => ethCall(token, IF.erc20.encodeFunctionData("balanceOf", [holder])).then((h: string) => dec(["uint256"], h)[0] as bigint);
  const [safeUsdc, fundUsdc, felixAssets, felixShares, hlend] = await Promise.all([
    b(A.usdc, A.safe), b(A.usdc, A.fund),
    ethCall(A.felix, IF.felixView.encodeFunctionData("maxWithdraw", [A.safe])).then((h: string) => dec(["uint256"], h)[0] as bigint),
    ethCall(A.felix, IF.felixView.encodeFunctionData("balanceOf", [A.safe])).then((h: string) => dec(["uint256"], h)[0] as bigint),
    b(A.hToken, A.safe),
  ]);
  let felixExact = felixAssets;
  try { felixExact = dec(["uint256"], await ethCall(A.felix, IF.felixView.encodeFunctionData("convertToAssets", [felixShares])))[0] as bigint; } catch { /* maxWithdraw fallback */ }
  let felixSymbol = "shares";
  try { felixSymbol = dec(["string"], await ethCall(A.felix, IF.felixView.encodeFunctionData("symbol", [])))[0] as string; } catch { /* keep fallback */ }
  return { safeUsdc, fundUsdc, felixAssets: felixExact, felixShares, felixSymbol, hlend };
}

/** The payout wallet's USDC on both chains a payout can land on. */
export async function crtV2GetPayoutBalances() {
  const data = IF.erc20.encodeFunctionData("balanceOf", [A.payout]);
  const toBig = (h: string) => dec(["uint256"], h)[0] as bigint;
  const [hyperEvm, arbitrum] = await Promise.all([
    ethCall(A.usdc, data).then(toBig),
    rpcOn(CRT_V2.ARBITRUM.RPCS, "eth_call", [{ to: A.arbUsdc, data }, "latest"]).then(toBig),
  ]);
  return { hyperEvm, arbitrum };
}

export interface CrtV2AcrossQuote { fee: bigint; reserve: bigint; outputAmount: bigint; minDeposit: bigint; maxDeposit: bigint; estimatedFillTimeSec: number; quotedAt: number }
/** Across's price for this much USDC to Arbitrum, and the minimum the console pins into the deposit. */
export async function crtV2AcrossQuote(inputAmount: bigint): Promise<CrtV2AcrossQuote> {
  const q = new URLSearchParams({ inputToken: A.usdc, outputToken: A.arbUsdc, originChainId: "999", destinationChainId: String(ARBITRUM_CHAIN_ID), amount: inputAmount.toString(), recipient: A.payout, depositor: A.safe });
  const r = await fetch(`${CRT_V2.ACROSS.API}/suggested-fees?${q}`, { headers: { accept: "application/json" } });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || j?.error || `Across quote failed (${r.status})`);
  const fee = BigInt(j.totalRelayFee?.total ?? j.relayFeeTotal ?? 0);
  const floored = fee * CRT_V2.ACROSS.FEE_RESERVE_MULTIPLIER;
  const reserve = floored > CRT_V2.ACROSS.MIN_FEE_RESERVE ? floored : CRT_V2.ACROSS.MIN_FEE_RESERVE;
  return {
    fee,
    reserve,
    outputAmount: inputAmount > reserve ? inputAmount - reserve : 0n,
    minDeposit: BigInt(j.limits?.minDeposit ?? 0),
    maxDeposit: BigInt(j.limits?.maxDeposit ?? 0),
    estimatedFillTimeSec: Number(j.estimatedFillTimeSec ?? 0),
    quotedAt: Number(j.timestamp ?? Math.floor(Date.now() / 1000)),
  };
}

/**
 * How many tranche deposits one admin Safe transaction carries. Each costs
 * about 0.5M gas (the SpokePool ~0.14M, the tranche whitelist ~0.36–0.41M,
 * measured 2026-10-05), and a standard HyperEVM block holds 3M: four
 * deposits, their approve and a remainder transfer stay near 2.4M.
 */
export const ACROSS_DEPOSITS_PER_SAFE_TX = 4;

export interface CrtV2AcrossDeposit {
  inputAmount: bigint;
  outputAmount: bigint;
  /** What Across quoted for this size right now. */
  fee: bigint;
  /** The most the whitelist lets this size leave to its relayer. */
  maxShare: bigint;
  /** Across currently charges more than the whitelist allows: the deposit would not be filled and returns to the Safe after its deadline. */
  feeTooHigh: boolean;
}
export interface CrtV2AcrossPlan {
  deposits: CrtV2AcrossDeposit[];
  /** Deposits per admin Safe transaction, in order. */
  groups: CrtV2AcrossDeposit[][];
  /** Below the smallest tranche: paid to the payout wallet on HyperEVM instead. */
  remainder: bigint;
  bridged: bigint;
  minReceived: bigint;
  maxDeposit: bigint;
  estimatedFillTimeSec: number;
}
/**
 * An Arbitrum payout as the whitelist allows it: the amount split into the
 * tranche sizes, each quoted, each given the output Across needs (twice the
 * quoted fee, at least 0.25 USDC) but never below the whitelisted floor, and
 * the deposits grouped into admin Safe transactions.
 */
export async function crtV2PlanAcrossPayout(amount: bigint): Promise<CrtV2AcrossPlan> {
  const { tranches, remainder } = splitIntoAcrossTranches(amount);
  const sizes = [...new Set(tranches.map(String))].map(BigInt);
  const quotes = new Map<string, CrtV2AcrossQuote>();
  await Promise.all(sizes.map(async (size) => { quotes.set(String(size), await crtV2AcrossQuote(size)); }));
  const deposits = tranches.map((inputAmount): CrtV2AcrossDeposit => {
    const q = quotes.get(String(inputAmount))!;
    const maxShare = acrossMaxRelayerShare(inputAmount);
    const reserve = q.reserve < maxShare ? q.reserve : maxShare;
    return { inputAmount, outputAmount: inputAmount - reserve, fee: q.fee, maxShare, feeTooHigh: q.fee > maxShare };
  });
  const groups: CrtV2AcrossDeposit[][] = [];
  for (let i = 0; i < deposits.length; i += ACROSS_DEPOSITS_PER_SAFE_TX) groups.push(deposits.slice(i, i + ACROSS_DEPOSITS_PER_SAFE_TX));
  const anyQuote = quotes.values().next().value as CrtV2AcrossQuote | undefined;
  return {
    deposits,
    groups,
    remainder,
    bridged: amount - remainder,
    minReceived: deposits.reduce((sum, d) => sum + d.outputAmount, 0n),
    maxDeposit: anyQuote?.maxDeposit ?? 0n,
    estimatedFillTimeSec: Math.max(0, ...[...quotes.values()].map((q) => q.estimatedFillTimeSec)),
  };
}
/** The split alone, for the hint under the amount field (no quotes). */
export const crtV2DescribeAcrossSplit = (amount: bigint): string => {
  const { tranches, remainder } = splitIntoAcrossTranches(amount);
  if (!tranches.length) return `Across takes ${ACROSS_TRANCHES_USDC[ACROSS_TRANCHES_USDC.length - 1].toLocaleString("en-US")} USDC or more; pay smaller amounts on HyperEVM.`;
  const counts = new Map<string, number>();
  for (const t of tranches) counts.set(fmt6(t, 0), (counts.get(fmt6(t, 0)) ?? 0) + 1);
  const parts = [...counts].map(([size, n]) => (n > 1 ? `${n} × ${size}` : size)).join(" + ");
  const txs = Math.ceil(tranches.length / ACROSS_DEPOSITS_PER_SAFE_TX);
  return `Across: ${parts} USDC (${tranches.length} deposit${tranches.length === 1 ? "" : "s"}, ${txs} Safe transaction${txs === 1 ? "" : "s"})` +
    (remainder > 0n ? ` · ${fmt6(remainder)} USDC paid on HyperEVM` : "");
};

/** The admin Safe as the chain has it: who may sign, how many must, and its nonce. */
export async function crtV2GetAdminSafe() {
  const [ownersHex, thresholdHex, nonceHex] = await Promise.all([
    ethCall(A.adminSafe, IF.safe.encodeFunctionData("getOwners", [])),
    ethCall(A.adminSafe, IF.safe.encodeFunctionData("getThreshold", [])),
    ethCall(A.adminSafe, IF.safe.encodeFunctionData("nonce", [])),
  ]);
  return {
    owners: [...(IF.safe.decodeFunctionResult("getOwners", ownersHex)[0] as string[])],
    threshold: Number(IF.safe.decodeFunctionResult("getThreshold", thresholdHex)[0]),
    nonce: Number(IF.safe.decodeFunctionResult("nonce", nonceHex)[0]),
  };
}

export type CrtV2OwnerKind = "factory" | "governor" | "safe" | "other";
export interface CrtV2VaultState {
  /** finalizeCreateFund has run: the fund holds its settings. */
  finalized: boolean;
  rolesOwner: string;
  ownerKind: CrtV2OwnerKind;
  /** Settings authority: the governor until the activation proposal moves it to the Safe. */
  settingsGovernor: string | null;
  /** Both activation steps done: the modifier and the settings answer to the Safe. */
  activated: boolean;
}
/**
 * Where the vault stands between deployment and full activation. Three
 * stations: the factory owns the modifier until the vault is finalized; then
 * the governor does, until the activation proposal hands it (and settings
 * authority) to the Safe. Membership changes and settings changes through
 * the admin role only work at the last station.
 */
export async function crtV2GetVaultState(): Promise<CrtV2VaultState> {
  const [ownerHex, settingsHex] = await Promise.all([
    ethCall(A.roles, rolesIface.encodeFunctionData("owner", [])),
    ethCall(A.fund, IF.fund.encodeFunctionData("getFundSettings", [])).catch(() => null),
  ]);
  const rolesOwner = String(rolesIface.decodeFunctionResult("owner", ownerHex)[0]);
  let settingsGovernor: string | null = null;
  let finalized = false;
  if (settingsHex) {
    try {
      const s = IF.fund.decodeFunctionResult("getFundSettings", settingsHex)[0];
      finalized = !same(String(s.safe), ethers.ZeroAddress);
      settingsGovernor = finalized ? String(s.governor) : null;
    } catch { /* uninitialised proxy */ }
  }
  const ownerKind: CrtV2OwnerKind = same(rolesOwner, A.factory) ? "factory" : same(rolesOwner, A.governor) ? "governor" : same(rolesOwner, A.safe) ? "safe" : "other";
  return { finalized, rolesOwner, ownerKind, settingsGovernor, activated: ownerKind === "safe" && same(settingsGovernor ?? "", A.safe) };
}

/**
 * Whether `address` holds `role`: the modifier has no membership getter, so
 * the cheapest whitelisted call is dry-run from it and the answer read —
 * anything but NoMembership means the role is held (the call itself may
 * still be refused for other reasons, which is not the question here).
 */
export async function crtV2HoldsRole(address: string, role: CrtV2Role): Promise<boolean | null> {
  const probe = role === "admin" ? crtV2Inner.payout("1") : crtV2Inner.usdClassTransfer("1", true);
  try {
    const sim = await crtV2Simulate(crtV2Wrap(probe, role), address);
    return !sim.noMembership;
  } catch { return null; }
}

export interface CrtV2Readiness {
  role: CrtV2Role;
  label: string;
  /** ready: whitelisted and runnable · soft: whitelisted, the target itself refused · missing: not whitelisted · activation: whitelisted, waits for the activation proposal · unknown: no answer. */
  state: "ready" | "soft" | "missing" | "activation" | "unknown";
  detail: string;
  /** A missing row that one specific raw call fixes (see crtV2RawPermissions). */
  fix?: string;
}
/**
 * One dry run per thing the console does, from the address that will do it.
 * The outcome strip says what each button would meet right now, before
 * anyone reaches for it — which is how the vault's whitelist gets checked
 * on the day it is deployed, with no money in it yet.
 */
export function crtV2Readiness(): Promise<CrtV2Readiness[]> {
  const probes: { role: CrtV2Role; label: string; inner: CrtV2Inner; from: string; gate?: boolean; mustDeny?: string }[] = [
    { role: "executor", label: "Spot ↔ perp (any amount)", inner: crtV2Inner.usdClassTransfer("1", true), from: A.executor },
    { role: "executor", label: "Core → EVM (any amount)", inner: crtV2Inner.sendAssetToEvm("1"), from: A.executor },
    { role: "executor", label: "EVM → Core · approve", inner: crtV2Inner.approve(A.cdw, "CoreDepositWallet", "1"), from: A.executor },
    { role: "executor", label: "EVM → Core · depositFor", inner: crtV2Inner.cdwDepositFor("1"), from: A.executor },
    { role: "executor", label: "Felix deposit / withdraw / redeem", inner: crtV2Inner.felixDeposit("1"), from: A.executor },
    { role: "executor", label: "HyperLend supply / withdraw", inner: crtV2Inner.poolSupply("1"), from: A.executor },
    { role: "admin", label: "Payout on HyperEVM", inner: crtV2Inner.payout("1"), from: A.adminSafe },
    { role: "admin", label: "Payout to Arbitrum · approve", inner: crtV2Inner.approve(A.spokePool, "Across SpokePool", "1"), from: A.adminSafe },
    { role: "admin", label: "Payout to Arbitrum · Across deposit", inner: crtV2Inner.acrossDeposit("100", acrossMinOutput(usdc6("100"))), from: A.adminSafe },
    // Asked the other way round: a deposit that leaves almost all its value
    // to the relayer must be REFUSED. The scope stored on 2026-10-05 lets it
    // through; the Across fix closes it.
    { role: "admin", label: "Across: relayer share capped", inner: crtV2Inner.acrossDeposit("50000", 0n), from: A.adminSafe, mustDeny: "acrossFix" },
    { role: "admin", label: "API trader registration / removal", inner: crtV2Inner.registerAgent(A.payout, CRT_V2.AGENT.maxDays), from: A.adminSafe },
    { role: "admin", label: "Executor members · transfer admin", inner: crtV2Inner.assignRole(A.executor, "executor", true), from: A.adminSafe, gate: true },
  ];
  return Promise.all(probes.map(async (p): Promise<CrtV2Readiness> => {
    try {
      const sim = await crtV2Simulate(crtV2Wrap(p.inner, p.role), p.from);
      if (p.mustDeny) {
        if (sim.denied) return { role: p.role, label: p.label, state: "ready", detail: "enforced · a deposit that leaves its value to the relayer is refused" };
        if (sim.ok || sim.soft) return { role: p.role, label: p.label, state: "missing", detail: "NOT enforced · the stored Across scope lets a deposit's value go to the relayer instead of the payout wallet. Apply the Across fix.", fix: p.mustDeny };
      }
      if (sim.ok) return { role: p.role, label: p.label, state: "ready", detail: "whitelisted" };
      if (sim.soft) return { role: p.role, label: p.label, state: p.gate ? "activation" : "soft", detail: p.gate ? "whitelisted · the modifier still answers to the factory or governor, so this runs after the activation proposal" : "whitelisted · the target refused the 1 USDC dry run (balance or allowance)" };
      if (sim.noMembership) return { role: p.role, label: p.label, state: "missing", detail: `${shortAddr(p.from)} does not hold the ${p.role} role` };
      if (sim.denied) return { role: p.role, label: p.label, state: "missing", detail: `not whitelisted yet · ${sim.hint}` };
      return { role: p.role, label: p.label, state: "unknown", detail: sim.hint };
    } catch (e: any) {
      return { role: p.role, label: p.label, state: "unknown", detail: e?.message || "no answer from the RPC" };
    }
  }));
}

/** The raw permissions each role is still owed, for the console to hand out. */
export const crtV2RawPermissions = () => ({
  admin: { entries: buildCrtV2AdminRawPermissions(), json: crtV2RawPermissionsJson(buildCrtV2AdminRawPermissions()) },
  acrossFix: { entries: buildCrtV2AdminAcrossFix(), json: crtV2RawPermissionsJson(buildCrtV2AdminAcrossFix()) },
  executor: { entries: buildCrtV2ExecutorRawPermissions(), json: crtV2RawPermissionsJson(buildCrtV2ExecutorRawPermissions()) },
});

// ─── HyperCore ───────────────────────────────────────────────────────────────

async function info(body: any) {
  const r = await fetch(CRT_V2.INFO_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("info API " + r.status);
  return r.json();
}
export async function crtV2GetCore() {
  const [spot, perp] = await Promise.all([
    info({ type: "spotClearinghouseState", user: A.safe }),
    info({ type: "clearinghouseState", user: A.safe }),
  ]);
  const usdcRow = (spot.balances || []).find((x: any) => x.coin === "USDC");
  return { spotUsdc: usdcRow ? Number(usdcRow.total) : 0, perpValue: Number(perp.marginSummary?.accountValue || 0) };
}
export interface CrtV2AgentSlot { name: string; address: string; validUntil: number | null }
/**
 * Both kinds of HyperCore agent slot the Safe holds: the unnamed one from
 * webData2 (extraAgents never lists it) and the named ones from extraAgents,
 * each with its expiry.
 */
export async function crtV2GetAgents(): Promise<{ unnamed: CrtV2AgentSlot | null; named: CrtV2AgentSlot[] }> {
  const [web, extra] = await Promise.all([info({ type: "webData2", user: A.safe }), info({ type: "extraAgents", user: A.safe })]);
  const live = (address?: string) => !!address && !same(address, ethers.ZeroAddress);
  const unnamed = live(web?.agentAddress) ? { name: "", address: web.agentAddress, validUntil: Number(web.agentValidUntil) || null } : null;
  const named = (Array.isArray(extra) ? extra : [])
    .filter((e: any) => live(e?.address))
    .map((e: any) => ({ name: String(e.name ?? ""), address: e.address, validUntil: Number(e.validUntil) || null }));
  return { unnamed, named };
}
/** Whether a key is live as an agent anywhere on HyperCore, and whose. */
export async function crtV2AgentStatus(agentAddr: string) {
  try {
    const j = await info({ type: "userRole", user: agentAddr });
    if (j?.role === "agent") return { live: true, ours: same(j.data?.user || "", A.safe) };
    return { live: false };
  } catch { return { error: true }; }
}
