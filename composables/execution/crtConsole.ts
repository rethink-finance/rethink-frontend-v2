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
  RPCS: ["https://rpc.hyperliquid.xyz/evm", "https://rpc.hypurrscan.io"],
  INFO_API: "https://api.hyperliquid.xyz/info",
  EXPLORER: "https://hyperevmscan.io",
  ADDR: {
    roles: "0xe081b03dbaca5f0dacdd4c61e5bb665db1c2396d",
    safe: "0xb3dca456864678b906854b3d118369c021b0df66",
    fund: "0x7890e0ff3d76f71a3d33b17fb5b3f3866512485b",
    manager: "0xB5d01172e73559B07ef3CD53dE84459c6BA3a054",
    payoutSafe: "0xAda3dF31614438Ec8C96470148D52Ce30A037071",
    payoutEOA: "0x77F252b5a4C1192efe09fCd7f9934A39c62ec85E",
    usdc: "0xb88339cb7199b77e23db6e890353e22632ba630f",
    coreWriter: "0x3333333333333333333333333333333333333333",
    cdw: "0x6b9e773128f453f5c2c60935ee2de2cbc5390a24",
    coreBridge: "0x2000000000000000000000000000000000000000",
    felix: "0x8a862fd6c12f9ad34c9c2ff45ab2b6712e8cea27",
    pool: "0x00a89d7a5a02160f20150ebea7a2b5e4879a1a8b",
    hToken: "0x744e4f26ee30213989216e1632d9be3547c4885b",
  },
  APPROVE_CAP: 500000,
  AMOUNTS: [1, 10, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
  AGENTS: [
    { addr: "0x6e6d2B190DB578CDeB7156B283B4587b379Ca39C", name: "", label: "Primary agent", kind: "primary", desc: "Unnamed. Already registered; re-submitting is a no-op." },
    { addr: "0x9c80C909DDCa672ccEb35C4C70a143021679C095", name: "", label: "Backup agent", kind: "backup", desc: "Unnamed. Registering it DEREGISTERS the primary (only one unnamed agent allowed). Break-glass only." },
  ],
  ERRORS: crtErrors([
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
};

export const usdc6 = (v: string | number) => ethers.parseUnits(String(v).trim(), 6);
// Fixed at dp on both ends: USDC is quoted to the cent everywhere it is read,
// and the full six decimals only ever made the balance strip hard to scan.
export const fmt6 = (bi: bigint, dp = 2) => Number(ethers.formatUnits(bi ?? 0n, 6)).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const shortAddr = (a?: string) => (a ? a.slice(0, 6) + "\u2026" + a.slice(-4) : "\u2014");

export interface CrtParam { k: string; v: string; pinned?: boolean }
export interface CrtInner { to: string; data: string; sig: string; params: CrtParam[] }

// HyperCore raw-action payloads (must be byte-identical to the whitelist entries)
const pUsdClassTransfer = (usdcInt: number, toPerp: boolean) => "0x01000007" + coder().encode(["uint64", "bool"], [BigInt(usdcInt) * 1000000n, toPerp]).slice(2);
const pSendAsset = (usdcInt: number) => "0x0100000d" + coder().encode(["address", "address", "uint32", "uint32", "uint64", "uint64"], [A.coreBridge, ethers.ZeroAddress, 0xffffffff, 0xffffffff, 0, BigInt(usdcInt) * 100000000n]).slice(2);
const pAddApiWallet = (agent: string, name: string) => "0x01000009" + coder().encode(["address", "string"], [agent, name]).slice(2);

export const crtInner = {
  approve: (spender: string, spenderLabel: string, amt: string): CrtInner => ({ to: A.usdc, data: IF.erc20.encodeFunctionData("approve", [spender, usdc6(amt)]), sig: "USDC.approve(spender, amount)", params: [{ k: "spender", v: spenderLabel + " " + shortAddr(spender), pinned: true }, { k: "amount", v: amt + " USDC" }] }),
  payout: (amt: string): CrtInner => ({ to: A.usdc, data: IF.erc20.encodeFunctionData("transfer", [A.payoutEOA, usdc6(amt)]), sig: "USDC.transfer(to, amount)", params: [{ k: "to", v: "Payout EOA " + shortAddr(A.payoutEOA), pinned: true }, { k: "amount", v: amt + " USDC" }] }),
  felixDeposit: (amt: string): CrtInner => ({ to: A.felix, data: IF.felix.encodeFunctionData("deposit", [usdc6(amt), A.safe]), sig: "Felix.deposit(assets, receiver)", params: [{ k: "assets", v: amt + " USDC" }, { k: "receiver", v: "Main Safe " + shortAddr(A.safe), pinned: true }] }),
  felixWithdraw: (amt: string): CrtInner => ({ to: A.felix, data: IF.felix.encodeFunctionData("withdraw", [usdc6(amt), A.safe, A.safe]), sig: "Felix.withdraw(assets, receiver, owner)", params: [{ k: "assets", v: amt + " USDC (exact out)" }, { k: "receiver", v: "Main Safe", pinned: true }, { k: "owner", v: "Main Safe", pinned: true }] }),
  felixRedeem: (shares18: bigint): CrtInner => ({ to: A.felix, data: IF.felix.encodeFunctionData("redeem", [shares18, A.safe, A.safe]), sig: "Felix.redeem(shares, receiver, owner)", params: [{ k: "shares", v: ethers.formatUnits(shares18, 18) + " shares (full exit)" }, { k: "receiver", v: "Main Safe", pinned: true }, { k: "owner", v: "Main Safe", pinned: true }] }),
  poolSupply: (amt: string): CrtInner => ({ to: A.pool, data: IF.pool.encodeFunctionData("supply", [A.usdc, usdc6(amt), A.safe, 0]), sig: "HyperLend.supply(asset, amount, onBehalfOf, ref)", params: [{ k: "asset", v: "USDC", pinned: true }, { k: "amount", v: amt + " USDC" }, { k: "onBehalfOf", v: "Main Safe", pinned: true }] }),
  poolWithdraw: (amtOrMax: string): CrtInner => { const max = amtOrMax === "max"; return { to: A.pool, data: IF.pool.encodeFunctionData("withdraw", [A.usdc, max ? ethers.MaxUint256 : usdc6(amtOrMax), A.safe]), sig: "HyperLend.withdraw(asset, amount, to)", params: [{ k: "asset", v: "USDC", pinned: true }, { k: "amount", v: max ? "uint256.max (withdraw all + interest)" : amtOrMax + " USDC" }, { k: "to", v: "Main Safe", pinned: true }] }; },
  cdwDepositFor: (amt: string): CrtInner => ({ to: A.cdw, data: IF.cdw.encodeFunctionData("depositFor", [A.safe, usdc6(amt), 0]), sig: "CoreDepositWallet.depositFor(receiver, amount, dex)", params: [{ k: "receiver", v: "Main Safe " + shortAddr(A.safe), pinned: true }, { k: "amount", v: amt + " USDC" }, { k: "dex", v: "0", pinned: true }] }),
  usdClassTransfer: (usdcInt: number, toPerp: boolean): CrtInner => ({ to: A.coreWriter, data: IF.writer.encodeFunctionData("sendRawAction", [pUsdClassTransfer(usdcInt, toPerp)]), sig: "CoreWriter.sendRawAction(usdClassTransfer)", params: [{ k: "amount", v: usdcInt.toLocaleString("en-US") + " USDC", pinned: true }, { k: "direction", v: toPerp ? "spot \u2192 perp" : "perp \u2192 spot" }] }),
  sendAssetToEvm: (usdcInt: number): CrtInner => ({ to: A.coreWriter, data: IF.writer.encodeFunctionData("sendRawAction", [pSendAsset(usdcInt)]), sig: "CoreWriter.sendRawAction(sendAsset)", params: [{ k: "amount", v: usdcInt.toLocaleString("en-US") + " USDC", pinned: true }, { k: "route", v: "Core spot \u2192 EVM Safe", pinned: true }] }),
  addApiWallet: (agent: string, name: string): CrtInner => ({ to: A.coreWriter, data: IF.writer.encodeFunctionData("sendRawAction", [pAddApiWallet(agent, name)]), sig: "CoreWriter.sendRawAction(addApiWallet)", params: [{ k: "agent", v: shortAddr(agent), pinned: true }, { k: "name", v: name === "" ? "(unnamed)" : "\u201C" + name + "\u201D", pinned: true }] }),
};

export const crtWrap = (inner: CrtInner, role: 1 | 2) => ({
  to: A.roles,
  data: IF.roles.encodeFunctionData("execTransactionWithRole", [inner.to, 0n, inner.data, 0, role, true]),
  role,
  inner,
});
export const crtValidateWrapped = (hex: string) => typeof hex === "string" && hex.startsWith("0x6928e74b") && hex.length % 2 === 0;

let rpcId = 1;
async function rpc(method: string, params: any[]): Promise<any> {
  let lastErr: any;
  for (const url of CRT.RPCS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }) });
      const j = await r.json();
      if (j.error) { const e: any = new Error(j.error.message); e.data = j.error.data; e.rpcError = true; throw e; }
      return j.result;
    } catch (e: any) { if (e.rpcError) throw e; lastErr = e; }
  }
  throw lastErr || new Error("all RPCs failed");
}
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
  const [safeUsdc, fundUsdc, felixAssets, felixShares, hlend, payoutUsdc] = await Promise.all([
    b(A.usdc, A.safe), b(A.usdc, A.fund),
    ethCall(A.felix, IF.felix.encodeFunctionData("maxWithdraw", [A.safe])).then((h: string) => dec(["uint256"], h)[0] as bigint),
    ethCall(A.felix, IF.felix.encodeFunctionData("balanceOf", [A.safe])).then((h: string) => dec(["uint256"], h)[0] as bigint),
    b(A.hToken, A.safe), b(A.usdc, A.payoutEOA),
  ]);
  let felixExact = felixAssets;
  try { felixExact = dec(["uint256"], await ethCall(A.felix, IF.felix.encodeFunctionData("convertToAssets", [felixShares])))[0] as bigint; } catch { /* maxWithdraw fallback */ }
  let felixSymbol = "shares";
  try { felixSymbol = dec(["string"], await ethCall(A.felix, IF.erc20.encodeFunctionData("symbol", [])))[0] as string; } catch { /* keep fallback */ }
  return { safeUsdc, fundUsdc, felixAssets: felixExact, felixShares, felixSymbol, hlend, payoutUsdc };
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
// Agent status: use userRole, never extraAgents (it returns [] for unnamed agents even when live)
export async function crtAgentStatus(agentAddr: string) {
  try {
    const j = await info({ type: "userRole", user: agentAddr });
    if (j?.role === "agent") return { live: true, ours: (j.data?.user || "").toLowerCase() === A.safe.toLowerCase() };
    return { live: false };
  } catch { return { error: true }; }
}
