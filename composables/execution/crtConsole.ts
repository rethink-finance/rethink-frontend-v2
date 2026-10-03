import { ethers } from "ethers";

// CRT vault execution console — addresses, whitelist facts and calldata builders.
// Everything verified live on HyperEVM mainnet (chain 999). See rethink NOTES.

interface CrtError { name: string; hint: string; soft?: boolean }
// Selectors are derived from the signature at module load, the way V1_ERROR_HINTS
// does in composables/permissions/useRoleExecution.ts: a wrong signature then simply
// never matches instead of mislabelling a real revert.
const crtErrors = (rows: [string, CrtError][]): Record<string, CrtError> =>
  Object.fromEntries(rows.map(([signature, e]) => [ethers.id(signature).slice(0, 10), e]));

export const CRT = {
  CHAIN_HEX: "0x3e7",
  // Same order networksMap.ts vets for this chain: the official endpoint last,
  // because it answers block lookups with "More than 3000 archived blocks
  // queried in one day" and meters everything else against the same quota.
  // All three return an identical revert payload (error.data as a hex string),
  // so the decoding in crtSimulate reads the same whichever one answers.
  RPCS: ["https://rpc.purroofgroup.com", "https://rpc.hypurrscan.io", "https://rpc.hyperliquid.xyz/evm"],
  INFO_API: "https://api.hyperliquid.xyz/info",
  EXPLORER: "https://hyperevmscan.io",
  ADDR: {
    roles: "0xe081b03dbaca5f0dacdd4c61e5bb665db1c2396d",
    safe: "0xb3dca456864678b906854b3d118369c021b0df66",
    fund: "0x7890e0ff3d76f71a3d33b17fb5b3f3866512485b",
    manager: "0xB5d01172e73559B07ef3CD53dE84459c6BA3a054",
    payoutSafe: "0xAda3dF31614438Ec8C96470148D52Ce30A037071",
    // Role 2's only allowed recipient, on HyperEVM (USDC.transfer) and on
    // Arbitrum (Across depositV3Now). The governance proposal of 2026-09-26,
    // executed on 2026-10-03, moved the pin here from the Carrot payout key
    // that was stolen on 2026-09-23.
    payout: "0x4aAbFCc667Caf17275624044CA0D96fAD11e2571",
    usdc: "0xb88339cb7199b77e23db6e890353e22632ba630f",
    coreWriter: "0x3333333333333333333333333333333333333333",
    cdw: "0x6b9e773128f453f5c2c60935ee2de2cbc5390a24",
    coreBridge: "0x2000000000000000000000000000000000000000",
    felix: "0x8a862fd6c12f9ad34c9c2ff45ab2b6712e8cea27",
    pool: "0x00a89d7a5a02160f20150ebea7a2b5e4879a1a8b",
    hToken: "0x744e4f26ee30213989216e1632d9be3547c4885b",
    // Across SpokePool on HyperEVM (ERC1967 proxy) and the modifier's own
    // MultiSendCallOnly, which Roles v1 unwraps so approve + deposit ride in
    // one Safe transaction.
    spokePool: "0x35E63eA3eb0fb7A3bc543C71FB66412e1F6B0E04",
    multisend: "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D",
    arbUsdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },
  ARBITRUM: {
    CHAIN_ID: 42161,
    RPCS: ["https://arb1.arbitrum.io/rpc", "https://arbitrum.gateway.tenderly.co", "https://arbitrum.drpc.org"],
    EXPLORER: "https://arbiscan.io",
  },
  ACROSS: {
    API: "https://app.across.to/api",
    // depositV3Now stamps the quote time when the Safe EXECUTES, so a proposal
    // never goes stale in the queue; the fill deadline is this far past that
    // moment (the pool caps it at fillDeadlineBuffer = 6 h).
    FILL_DEADLINE_OFFSET: 18000,
    // The relayer keeps inputAmount − outputAmount. The quote is taken when the
    // proposal is staged and the deposit runs whenever the signers get to it,
    // so the reserve is twice the quoted fee with a floor, and any surplus is
    // the relayer's tip rather than a stuck deposit.
    FEE_RESERVE_MULTIPLIER: 2n,
    MIN_FEE_RESERVE: 250000n, // 0.25 USDC
  },
  APPROVE_CAP: 500000,
  AMOUNTS: [1, 10, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
  AGENTS: [
    { addr: "0x4aAbFCc667Caf17275624044CA0D96fAD11e2571", label: "Trading agent", kind: "primary", desc: "The bot's signer on HyperCore. Also the payout wallet." },
    { addr: "0x772187016dac685593D04DCA8A79794e6fA70824", label: "Backup agent", kind: "backup", desc: "Kept unused. Registering it replaces the trading agent." },
  ],
  // HyperCore reads a validity from the agent's name: "<name> valid_until <unix ms>",
  // at most 180 days out, the way Hyperliquid's own API page builds it
  // (serverTime + days × 86,400,000). Without it an agent gets 14 days. Both
  // agents share one name so that registering one replaces the other.
  AGENT_NAME: "carrot",
  // Roles v1 matches the whole payload, so every expiry has to be whitelisted
  // exactly: the 1st of each month, 00:00 UTC. The latest date within 180 days
  // is picked, so a registration lasts between about 150 and 180 days. Add
  // dates only together with a proposal that whitelists them.
  AGENT_DATES: [1803859200000, 1806537600000, 1809129600000, 1811808000000, 1814400000000, 1817078400000, 1819756800000, 1822348800000, 1825027200000, 1827619200000, 1830297600000, 1832976000000, 1835481600000, 1838160000000],
  AGENT_MAX_VALIDITY_MS: 180 * 86400000,
  ERRORS: crtErrors([
    ["TargetAddressNotAllowed()", { name: "TargetAddressNotAllowed", hint: "This contract isn't on the whitelist for this role." }],
    ["FunctionNotAllowed()", { name: "FunctionNotAllowed", hint: "This function isn't on the whitelist for this role." }],
    ["ParameterNotAllowed()", { name: "ParameterNotAllowed", hint: "A pinned parameter (destination / receiver / spender) doesn't match the whitelist." }],
    ["ParameterGreaterThanAllowed()", { name: "ParameterGreaterThanAllowed", hint: "Amount above the whitelisted cap (approvals: 500,000 USDC)." }],
    ["ParameterNotOneOfAllowed()", { name: "ParameterNotOneOfAllowed", hint: "Value isn't one of the whitelisted exact options (use a fixed amount)." }],
    ["DelegateCallNotAllowed()", { name: "DelegateCallNotAllowed", hint: "The role does not allow delegate calls." }],
    ["ModuleTransactionFailed()", { name: "ERC-20 balance/allowance", hint: "NOT a permission failure: insufficient balance or allowance. Expected when simulating step 2 before step 1 is mined.", soft: true }],
  ]),
};

const A = CRT.ADDR;
const coder = () => ethers.AbiCoder.defaultAbiCoder();
const IF = {
  erc20: new ethers.Interface(["function approve(address spender,uint256 amount)", "function transfer(address to,uint256 amount)", "function balanceOf(address) view returns (uint256)", "function symbol() view returns (string)"]),
  roles: new ethers.Interface(["function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,uint16 role,bool shouldRevert) returns (bool)"]),
  felix: new ethers.Interface(["function deposit(uint256 assets,address receiver) returns (uint256)", "function withdraw(uint256 assets,address receiver,address owner) returns (uint256)", "function redeem(uint256 shares,address receiver,address owner) returns (uint256)", "function maxWithdraw(address) view returns (uint256)", "function balanceOf(address) view returns (uint256)", "function convertToAssets(uint256) view returns (uint256)"]),
  pool: new ethers.Interface(["function supply(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)", "function withdraw(address asset,uint256 amount,address to) returns (uint256)"]),
  cdw: new ethers.Interface(["function depositFor(address receiver,uint256 amount,uint32 dex)"]),
  writer: new ethers.Interface(["function sendRawAction(bytes payload)"]),
  safe: new ethers.Interface(["function getOwners() view returns (address[])", "function getThreshold() view returns (uint256)", "function nonce() view returns (uint256)"]),
  spoke: new ethers.Interface(["function depositV3Now(address depositor,address recipient,address inputToken,address outputToken,uint256 inputAmount,uint256 outputAmount,uint256 destinationChainId,address exclusiveRelayer,uint32 fillDeadlineOffset,uint32 exclusivityPeriod,bytes message)"]),
  multisend: new ethers.Interface(["function multiSend(bytes transactions)"]),
};

export const usdc6 = (v: string | number) => ethers.parseUnits(String(v).trim(), 6);
// Fixed at dp on both ends: USDC is quoted to the cent everywhere it is read,
// and the full six decimals only ever made the balance strip hard to scan.
export const fmt6 = (bi: bigint, dp = 2) => Number(ethers.formatUnits(bi ?? 0n, 6)).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const shortAddr = (a?: string) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "—");

export interface CrtParam { k: string; v: string; pinned?: boolean }
export interface CrtInner { to: string; data: string; sig: string; params: CrtParam[] }
export interface CrtWrapped { to: string; data: string; role: 1 | 2; inner: CrtInner; batch?: CrtInner[] }

// HyperCore raw-action payloads (must be byte-identical to the whitelist entries)
const pUsdClassTransfer = (usdcInt: number, toPerp: boolean) => "0x01000007" + coder().encode(["uint64", "bool"], [BigInt(usdcInt) * 1000000n, toPerp]).slice(2);
const pSendAsset = (usdcInt: number) => "0x0100000d" + coder().encode(["address", "address", "uint32", "uint32", "uint64", "uint64"], [A.coreBridge, ethers.ZeroAddress, 0xffffffff, 0xffffffff, 0, BigInt(usdcInt) * 100000000n]).slice(2);
const pAddApiWallet = (agent: string, name: string) => "0x01000009" + coder().encode(["address", "string"], [agent, name]).slice(2);

/** The name HyperCore reads a validity from: "<name> valid_until <unix ms>". */
export const crtAgentName = (validUntilMs: number) => `${CRT.AGENT_NAME} valid_until ${validUntilMs}`;
export const crtParseAgentName = (name: string): { base: string; validUntil: number | null } => {
  const m = /^(.*?)\s*valid_until\s+(\d+)\s*$/.exec(name);
  return m ? { base: m[1], validUntil: Number(m[2]) } : { base: name, validUntil: null };
};
/** The latest whitelisted expiry HyperCore would accept right now, or null when none fits. */
export const crtPickValidUntil = (now = Date.now()): number | null => {
  const fits = CRT.AGENT_DATES.filter((d) => d > now && d <= now + CRT.AGENT_MAX_VALIDITY_MS);
  return fits.length ? Math.max(...fits) : null;
};
export const crtFormatDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const crtInner = {
  approve: (spender: string, spenderLabel: string, amt: string): CrtInner => ({ to: A.usdc, data: IF.erc20.encodeFunctionData("approve", [spender, usdc6(amt)]), sig: "USDC.approve(spender, amount)", params: [{ k: "spender", v: spenderLabel + " " + shortAddr(spender), pinned: true }, { k: "amount", v: amt + " USDC" }] }),
  payout: (amt: string): CrtInner => ({ to: A.usdc, data: IF.erc20.encodeFunctionData("transfer", [A.payout, usdc6(amt)]), sig: "USDC.transfer(to, amount)", params: [{ k: "to", v: "Payout wallet " + shortAddr(A.payout), pinned: true }, { k: "amount", v: amt + " USDC" }] }),
  /**
   * The Arbitrum leg of a payout: Across's depositV3Now, with the depositor
   * (refund address), recipient, both tokens, the destination chain and an
   * empty message all pinned by the role-2 whitelist. Only the amounts, the
   * relayer exclusivity and the fill window are the console's to choose.
   */
  acrossDeposit: (amt: string, outputAmount: bigint): CrtInner => ({
    to: A.spokePool,
    data: IF.spoke.encodeFunctionData("depositV3Now", [A.safe, A.payout, A.usdc, A.arbUsdc, usdc6(amt), outputAmount, CRT.ARBITRUM.CHAIN_ID, ethers.ZeroAddress, CRT.ACROSS.FILL_DEADLINE_OFFSET, 0, "0x"]),
    sig: "Across.depositV3Now(depositor, recipient, inputToken, outputToken, inputAmount, outputAmount, destinationChainId, exclusiveRelayer, fillDeadlineOffset, exclusivityPeriod, message)",
    params: [
      { k: "depositor (refunds)", v: "Main Safe " + shortAddr(A.safe), pinned: true },
      { k: "recipient", v: "Payout wallet " + shortAddr(A.payout) + " on Arbitrum", pinned: true },
      { k: "inputToken", v: "USDC (HyperEVM)", pinned: true },
      { k: "outputToken", v: "USDC (Arbitrum) " + shortAddr(A.arbUsdc), pinned: true },
      { k: "inputAmount", v: amt + " USDC" },
      { k: "outputAmount", v: fmt6(outputAmount, 6) + " USDC (minimum received)" },
      { k: "destinationChainId", v: String(CRT.ARBITRUM.CHAIN_ID), pinned: true },
      { k: "exclusiveRelayer", v: "none (any relayer may fill)" },
      { k: "fillDeadlineOffset", v: `${CRT.ACROSS.FILL_DEADLINE_OFFSET / 3600} h after execution` },
      { k: "message", v: "empty", pinned: true },
    ],
  }),
  felixDeposit: (amt: string): CrtInner => ({ to: A.felix, data: IF.felix.encodeFunctionData("deposit", [usdc6(amt), A.safe]), sig: "Felix.deposit(assets, receiver)", params: [{ k: "assets", v: amt + " USDC" }, { k: "receiver", v: "Main Safe " + shortAddr(A.safe), pinned: true }] }),
  felixWithdraw: (amt: string): CrtInner => ({ to: A.felix, data: IF.felix.encodeFunctionData("withdraw", [usdc6(amt), A.safe, A.safe]), sig: "Felix.withdraw(assets, receiver, owner)", params: [{ k: "assets", v: amt + " USDC (exact out)" }, { k: "receiver", v: "Main Safe", pinned: true }, { k: "owner", v: "Main Safe", pinned: true }] }),
  felixRedeem: (shares18: bigint): CrtInner => ({ to: A.felix, data: IF.felix.encodeFunctionData("redeem", [shares18, A.safe, A.safe]), sig: "Felix.redeem(shares, receiver, owner)", params: [{ k: "shares", v: ethers.formatUnits(shares18, 18) + " shares (full exit)" }, { k: "receiver", v: "Main Safe", pinned: true }, { k: "owner", v: "Main Safe", pinned: true }] }),
  poolSupply: (amt: string): CrtInner => ({ to: A.pool, data: IF.pool.encodeFunctionData("supply", [A.usdc, usdc6(amt), A.safe, 0]), sig: "HyperLend.supply(asset, amount, onBehalfOf, ref)", params: [{ k: "asset", v: "USDC", pinned: true }, { k: "amount", v: amt + " USDC" }, { k: "onBehalfOf", v: "Main Safe", pinned: true }] }),
  poolWithdraw: (amtOrMax: string): CrtInner => { const max = amtOrMax === "max"; return { to: A.pool, data: IF.pool.encodeFunctionData("withdraw", [A.usdc, max ? ethers.MaxUint256 : usdc6(amtOrMax), A.safe]), sig: "HyperLend.withdraw(asset, amount, to)", params: [{ k: "asset", v: "USDC", pinned: true }, { k: "amount", v: max ? "uint256.max (withdraw all + interest)" : amtOrMax + " USDC" }, { k: "to", v: "Main Safe", pinned: true }] }; },
  cdwDepositFor: (amt: string): CrtInner => ({ to: A.cdw, data: IF.cdw.encodeFunctionData("depositFor", [A.safe, usdc6(amt), 0]), sig: "CoreDepositWallet.depositFor(receiver, amount, dex)", params: [{ k: "receiver", v: "Main Safe " + shortAddr(A.safe), pinned: true }, { k: "amount", v: amt + " USDC" }, { k: "dex", v: "0", pinned: true }] }),
  usdClassTransfer: (usdcInt: number, toPerp: boolean): CrtInner => ({ to: A.coreWriter, data: IF.writer.encodeFunctionData("sendRawAction", [pUsdClassTransfer(usdcInt, toPerp)]), sig: "CoreWriter.sendRawAction(usdClassTransfer)", params: [{ k: "amount", v: usdcInt.toLocaleString("en-US") + " USDC", pinned: true }, { k: "direction", v: toPerp ? "spot → perp" : "perp → spot" }] }),
  sendAssetToEvm: (usdcInt: number): CrtInner => ({ to: A.coreWriter, data: IF.writer.encodeFunctionData("sendRawAction", [pSendAsset(usdcInt)]), sig: "CoreWriter.sendRawAction(sendAsset)", params: [{ k: "amount", v: usdcInt.toLocaleString("en-US") + " USDC", pinned: true }, { k: "route", v: "Core spot → EVM Safe", pinned: true }] }),
  addApiWallet: (agent: string, name: string): CrtInner => {
    const { base, validUntil } = crtParseAgentName(name);
    const removing = agent.toLowerCase() === ethers.ZeroAddress;
    return {
      to: A.coreWriter,
      data: IF.writer.encodeFunctionData("sendRawAction", [pAddApiWallet(agent, name)]),
      sig: "CoreWriter.sendRawAction(addApiWallet)",
      params: [
        { k: "agent", v: removing ? "none · removes the agent in this slot" : shortAddr(agent), pinned: true },
        { k: "slot", v: base === "" ? "unnamed" : "named \u201C" + base + "\u201D", pinned: true },
        { k: "valid until", v: validUntil ? crtFormatDate(validUntil) : removing ? "\u2014" : "14 days after registration", pinned: true },
      ],
    };
  },
  /** A named registration until a whitelisted date, or the 14-day unnamed one when no date is given. */
  registerAgent: (agent: string, validUntil: number | null): CrtInner => crtInner.addApiWallet(agent, validUntil ? crtAgentName(validUntil) : ""),
  /** Hyperliquid's own removal: approve the zero address in that slot, named or unnamed. */
  removeAgent: (named: boolean): CrtInner => crtInner.addApiWallet(ethers.ZeroAddress, named ? CRT.AGENT_NAME : ""),
};

export const crtWrap = (inner: CrtInner, role: 1 | 2): CrtWrapped => ({
  to: A.roles,
  data: IF.roles.encodeFunctionData("execTransactionWithRole", [inner.to, 0n, inner.data, 0, role, true]),
  role,
  inner,
});

/**
 * MultiSend's packed list: per call one byte of operation (always a plain
 * call here), 20 of target, 32 of value, 32 of data length, then the data.
 * The inverse of unpackMultiSend in composables/proposal/describeProposalActions.ts.
 */
export const crtPackMultiSend = (calls: { to: string; data: string; value?: bigint }[]) =>
  "0x" + calls.map((c) => {
    const data = c.data.startsWith("0x") ? c.data.slice(2) : c.data;
    return "00" + c.to.slice(2).toLowerCase() + (c.value ?? 0n).toString(16).padStart(64, "0") + (data.length / 2).toString(16).padStart(64, "0") + data;
  }).join("");

/**
 * Several inner calls as ONE role transaction: the modifier is asked to
 * delegatecall its own MultiSendCallOnly, and Roles v1 checks every call in
 * the batch against the role's whitelist before the Safe runs them in order.
 * That is what lets an approve and the deposit that spends it share a single
 * Safe signature round.
 */
export const crtWrapBatch = (inners: CrtInner[], role: 1 | 2): CrtWrapped => {
  const data = IF.multisend.encodeFunctionData("multiSend", [crtPackMultiSend(inners.map((i) => ({ to: i.to, data: i.data })))]);
  return {
    to: A.roles,
    data: IF.roles.encodeFunctionData("execTransactionWithRole", [A.multisend, 0n, data, 1, role, true]),
    role,
    inner: { to: A.multisend, data, sig: `MultiSendCallOnly.multiSend(${inners.length} calls, one Safe transaction)`, params: inners.flatMap((i, n) => i.params.map((p) => ({ ...p, k: `${n + 1} · ${p.k}` }))) },
    batch: inners,
  };
};
export const crtValidateWrapped = (hex: string) => typeof hex === "string" && hex.startsWith("0x6928e74b") && hex.length % 2 === 0;

let rpcId = 1;
async function rpcOn(urls: string[], method: string, params: any[]): Promise<any> {
  let lastErr: any;
  for (const url of urls) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }) });
      const j = await r.json();
      // A revert carries a payload, and a revert IS the answer — asking a
      // second RPC would only get the same one. Errors with no payload are the
      // endpoint failing rather than the chain answering (quota, method not
      // served), so those fall through to the next URL.
      if (j.error) { const e: any = new Error(j.error.message); e.data = j.error.data; e.rpcError = e.data !== undefined; throw e; }
      return j.result;
    } catch (e: any) { if (e.rpcError) throw e; lastErr = e; }
  }
  throw lastErr || new Error("all RPCs failed");
}
const rpc = (method: string, params: any[]) => rpcOn(CRT.RPCS, method, params);
const ethCall = (to: string, data: string, from?: string) => rpc("eth_call", [{ to, data, ...(from ? { from } : {}) }, "latest"]);

export async function crtSimulate(wrapped: { to: string; data: string; role: number }, from: string) {
  try {
    await ethCall(wrapped.to, wrapped.data, from);
    return { ok: true } as any;
  } catch (e: any) {
    const raw = typeof e.data === "string" ? e.data : (e.data && e.data.data) || "";
    const sel = raw && raw.length >= 10 ? raw.slice(0, 10) : null;
    const known = sel ? CRT.ERRORS[sel] : null;
    const noMembership = /NoMembership/i.test(e.message + raw);
    return { ok: false, name: known ? known.name : noMembership ? "NoMembership" : sel ? "Unknown revert " + sel : "Reverted", hint: known ? known.hint : noMembership ? "Wrong role or wrong signer for this action." : e.message, soft: !!(known && known.soft) };
  }
}

const dec = (types: string[], hex: string) => coder().decode(types, hex);
export async function crtGetBalances() {
  const b = (token: string, holder: string) => ethCall(token, IF.erc20.encodeFunctionData("balanceOf", [holder])).then((h: string) => dec(["uint256"], h)[0] as bigint);
  const [safeUsdc, fundUsdc, felixAssets, felixShares, hlend] = await Promise.all([
    b(A.usdc, A.safe), b(A.usdc, A.fund),
    ethCall(A.felix, IF.felix.encodeFunctionData("maxWithdraw", [A.safe])).then((h: string) => dec(["uint256"], h)[0] as bigint),
    ethCall(A.felix, IF.felix.encodeFunctionData("balanceOf", [A.safe])).then((h: string) => dec(["uint256"], h)[0] as bigint),
    b(A.hToken, A.safe),
  ]);
  let felixExact = felixAssets;
  try { felixExact = dec(["uint256"], await ethCall(A.felix, IF.felix.encodeFunctionData("convertToAssets", [felixShares])))[0] as bigint; } catch { /* maxWithdraw fallback */ }
  let felixSymbol = "shares";
  try { felixSymbol = dec(["string"], await ethCall(A.felix, IF.erc20.encodeFunctionData("symbol", [])))[0] as string; } catch { /* keep fallback */ }
  return { safeUsdc, fundUsdc, felixAssets: felixExact, felixShares, felixSymbol, hlend };
}

/** The payout wallet's USDC on both chains a payout can land on. */
export async function crtGetPayoutBalances() {
  const data = IF.erc20.encodeFunctionData("balanceOf", [A.payout]);
  const toBig = (h: string) => dec(["uint256"], h)[0] as bigint;
  const [hyperEvm, arbitrum] = await Promise.all([
    ethCall(A.usdc, data).then(toBig),
    rpcOn(CRT.ARBITRUM.RPCS, "eth_call", [{ to: A.arbUsdc, data }, "latest"]).then(toBig),
  ]);
  return { hyperEvm, arbitrum };
}

export interface CrtAcrossQuote { fee: bigint; reserve: bigint; outputAmount: bigint; minDeposit: bigint; maxDeposit: bigint; estimatedFillTimeSec: number; quotedAt: number }
/**
 * What Across would charge right now to move this much USDC to Arbitrum, and
 * the output amount the console pins into the deposit: the input minus a
 * reserve of twice the quoted relayer fee (floored), so the deposit still
 * clears if fees have moved by the time the signers execute it.
 */
export async function crtAcrossQuote(inputAmount: bigint): Promise<CrtAcrossQuote> {
  const q = new URLSearchParams({ inputToken: A.usdc, outputToken: A.arbUsdc, originChainId: "999", destinationChainId: String(CRT.ARBITRUM.CHAIN_ID), amount: inputAmount.toString(), recipient: A.payout, depositor: A.safe });
  const r = await fetch(`${CRT.ACROSS.API}/suggested-fees?${q}`, { headers: { accept: "application/json" } });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || j?.error || `Across quote failed (${r.status})`);
  const fee = BigInt(j.totalRelayFee?.total ?? j.relayFeeTotal ?? 0);
  const floored = fee * CRT.ACROSS.FEE_RESERVE_MULTIPLIER;
  const reserve = floored > CRT.ACROSS.MIN_FEE_RESERVE ? floored : CRT.ACROSS.MIN_FEE_RESERVE;
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
 * The payout Safe as the chain has it: who may sign, how many of them must,
 * and its nonce. The console reads these to tell an owner from a bystander
 * before offering to propose, and to place a proposal after whatever the
 * chain has already executed (the Safe service's copy of the nonce lags).
 */
export async function crtGetPayoutSafe() {
  const [ownersHex, thresholdHex, nonceHex] = await Promise.all([
    ethCall(A.payoutSafe, IF.safe.encodeFunctionData("getOwners", [])),
    ethCall(A.payoutSafe, IF.safe.encodeFunctionData("getThreshold", [])),
    ethCall(A.payoutSafe, IF.safe.encodeFunctionData("nonce", [])),
  ]);
  return {
    owners: [...(IF.safe.decodeFunctionResult("getOwners", ownersHex)[0] as string[])],
    threshold: Number(IF.safe.decodeFunctionResult("getThreshold", thresholdHex)[0]),
    nonce: Number(IF.safe.decodeFunctionResult("nonce", nonceHex)[0]),
  };
}

async function info(body: any) {
  const r = await fetch(CRT.INFO_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("info API " + r.status);
  return r.json();
}
export async function crtGetCore() {
  const [spot, perp] = await Promise.all([
    info({ type: "spotClearinghouseState", user: A.safe }),
    info({ type: "clearinghouseState", user: A.safe }),
  ]);
  const usdcRow = (spot.balances || []).find((x: any) => x.coin === "USDC");
  return { spotUsdc: usdcRow ? Number(usdcRow.total) : 0, perpValue: Number(perp.marginSummary?.accountValue || 0) };
}
export interface CrtAgentSlot { name: string; address: string; validUntil: number | null }
/**
 * Both kinds of HyperCore agent slot the Safe holds: the unnamed one comes
 * from webData2 (extraAgents never lists it) and the named ones from
 * extraAgents, each with its expiry. A zero address means an emptied slot.
 */
export async function crtGetAgents(): Promise<{ unnamed: CrtAgentSlot | null; named: CrtAgentSlot[] }> {
  const [web, extra] = await Promise.all([info({ type: "webData2", user: A.safe }), info({ type: "extraAgents", user: A.safe })]);
  const live = (address?: string) => !!address && address.toLowerCase() !== ethers.ZeroAddress;
  const unnamed = live(web?.agentAddress) ? { name: "", address: web.agentAddress, validUntil: Number(web.agentValidUntil) || null } : null;
  const named = (Array.isArray(extra) ? extra : [])
    .filter((e: any) => live(e?.address))
    .map((e: any) => ({ name: String(e.name ?? ""), address: e.address, validUntil: Number(e.validUntil) || null }));
  return { unnamed, named };
}
// Agent status: use userRole, never extraAgents (it returns [] for unnamed agents even when live)
export async function crtAgentStatus(agentAddr: string) {
  try {
    const j = await info({ type: "userRole", user: agentAddr });
    if (j?.role === "agent") return { live: true, ours: (j.data?.user || "").toLowerCase() === A.safe.toLowerCase() };
    return { live: false };
  } catch { return { error: true }; }
}
