/**
 * SNI Yield Claim Vault: the weekly SYC mint to sniETH depositors.
 *
 * The amounts come from the backend (GET /syc-distribution/latest), which
 * keeps a running book of the Safes' WETH and SNI transfers. This module
 * reads that answer, refuses anything that does not add up, checks it against
 * the chain as it is now, and builds the one call the admin role may make:
 *
 *   vault.fundFlowsCall( mintToMany(amounts, recipients) )
 *
 * sent through the Roles modifier under `adminRole`, every amount drawn from
 * the allowance "sycMint" (scripts/sni-roles-v2/gen-admin-mint.ts).
 */
import { ethers } from "ethers";
import { ethCallOn, rpcRequestOn } from "./rpc";
import { IF, SYC, accruedAllowance, sycToken, type SycAllowance, type SycCall } from "./sycConsole";

export const SYC_DIST = {
  ROLE: "adminRole",
  ALLOWANCE: "sycMint",
  /** The backend recomputes every three hours; figures older than this mean it has stopped. */
  MAX_AGE_MS: 86_400_000,
  MAX_WALLETS: 200,
} as const;

export const DIST_IF = {
  fund: new ethers.Interface([
    "function fundFlowsCall(bytes flowCall)",
    "function totalSupply() view returns (uint256)",
    "function getFundSettings() view returns (tuple(uint256 depositFee,uint256 withdrawFee,uint256 performanceFee,uint256 managementFee,uint256 performaceHurdleRateBps,address baseToken,address safe,bool isExternalGovTokenInUse,bool isWhitelistedDeposits,address[] allowedDepositAddrs,address[] allowedManagers,address governanceToken,address fundAddress,address governor,string fundName,string fundSymbol,address[4] feeCollectors))",
  ]),
  flows: new ethers.Interface(["function mintToMany(uint256[] amounts,address[] recipients)"]),
};

export interface SycDistributionRow {
  wallet: string;
  /** Everything this wallet is owed since its first deposit. */
  owed: bigint;
  /** What earlier distributions already minted to it. */
  minted: bigint;
  /** What this distribution mints. */
  mint: bigint;
}

export interface SycDistribution {
  generatedAt: number;
  /** SYC supply when it was computed; a different supply now means it is stale. */
  supplyAtGeneration: bigint;
  rows: SycDistributionRow[];
  total: bigint;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const amount = (value: unknown, what: string): bigint => {
  if (typeof value !== "string" || !/^\d{1,60}$/.test(value)) throw new Error(`${what} is not a whole number of wei.`);
  return BigInt(value);
};

/** Read the backend's distribution. Throws with a sentence a signer can act on. */
export const parseDistribution = (text: string): SycDistribution => {
  let file: any;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("The backend's answer is not a distribution (it is not JSON).");
  }
  if (file?.kind !== "syc-distribution" || file?.version !== 1) {
    throw new Error("The backend's answer is not a distribution.");
  }
  if (file.chainId !== Number(SYC.CHAIN) || !same(String(file.fund), SYC.ADDR.fund) || !same(String(file.roles), SYC.ADDR.roles)) {
    throw new Error("This distribution is for a different vault.");
  }
  if (file.roleKey !== SYC_DIST.ROLE) throw new Error("This distribution is for a different role.");
  const generatedAt = Date.parse(file.generatedAt);
  if (!Number.isFinite(generatedAt)) throw new Error("The distribution has no creation time.");
  if (!Array.isArray(file.wallets) || !file.wallets.length) throw new Error("The distribution lists no wallets.");
  if (file.wallets.length > SYC_DIST.MAX_WALLETS) throw new Error("The distribution lists too many wallets for one transaction.");

  const reserved = [ethers.ZeroAddress, SYC.ADDR.fund, SYC.ADDR.safe, SYC.ADDR.roles];
  const seen = new Set<string>();
  const rows: SycDistributionRow[] = file.wallets.map((w: any, i: number) => {
    const where = `Wallet ${i + 1}`;
    if (typeof w?.wallet !== "string" || !ethers.isAddress(w.wallet)) throw new Error(`${where} is not an address.`);
    const wallet = ethers.getAddress(w.wallet);
    if (reserved.some((r) => same(r, wallet))) throw new Error(`${where} is the vault itself, not a depositor.`);
    if (seen.has(wallet)) throw new Error(`${wallet} is listed twice.`);
    seen.add(wallet);
    const row = {
      wallet,
      owed: amount(w.owed, `${where}'s total`),
      minted: amount(w.minted, `${where}'s minted amount`),
      mint: amount(w.mint, `${where}'s amount`),
    };
    const due = row.owed > row.minted ? row.owed - row.minted : 0n;
    if (row.mint !== due) throw new Error(`${where}'s amount is not what it is owed minus what it has received.`);
    return row;
  });
  const total = rows.reduce((sum, r) => sum + r.mint, 0n);
  if (total !== amount(file.total, "The total")) throw new Error("The amounts do not add up to the stated total.");
  return { generatedAt, supplyAtGeneration: amount(file.supplyAtGeneration, "The supply"), rows, total };
};

/** The mint, as the vault's Safe makes it. Wallets with nothing due are left out. */
export const buildMintCall = (d: SycDistribution): SycCall => {
  const paid = d.rows.filter((r) => r.mint > 0n);
  const mint = DIST_IF.flows.encodeFunctionData("mintToMany", [paid.map((r) => r.mint), paid.map((r) => r.wallet)]);
  return { to: SYC.ADDR.fund, data: DIST_IF.fund.encodeFunctionData("fundFlowsCall", [mint]) };
};

export interface SycDistributionChain {
  supply: bigint;
  safeSni: bigint;
  /** What the allowance lets the admin role mint right now. */
  available: bigint;
  /** False while the allowance has never been stored on the modifier. */
  allowanceStored: boolean;
  nextRefill: bigint;
  finalized: boolean;
}

export const readDistributionChain = async (): Promise<SycDistributionChain> => {
  const key = ethers.encodeBytes32String(SYC_DIST.ALLOWANCE);
  const [supplyHex, sniHex, allowanceHex, settingsHex] = await Promise.all([
    ethCallOn(SYC.CHAIN, SYC.ADDR.fund, DIST_IF.fund.encodeFunctionData("totalSupply")),
    ethCallOn(SYC.CHAIN, sycToken("SNI").address, IF.erc20.encodeFunctionData("balanceOf", [SYC.ADDR.safe])),
    ethCallOn(SYC.CHAIN, SYC.ADDR.roles, IF.roles.encodeFunctionData("allowances", [key])),
    ethCallOn(SYC.CHAIN, SYC.ADDR.fund, DIST_IF.fund.encodeFunctionData("getFundSettings")).catch(() => ""),
  ]);
  const a = IF.roles.decodeFunctionResult("allowances", allowanceHex);
  const allowance: SycAllowance = { refill: a.refill, maxRefill: a.maxRefill, period: a.period, balance: a.balance, timestamp: a.timestamp };
  const { available, nextRefill } = accruedAllowance(allowance, BigInt(Math.floor(Date.now() / 1000)));
  let finalized = false;
  try {
    // A vault that is still being set up has no Safe recorded and refuses every mint.
    finalized = DIST_IF.fund.decodeFunctionResult("getFundSettings", settingsHex)[0].safe !== ethers.ZeroAddress;
  } catch {
    finalized = false;
  }
  return {
    supply: BigInt(supplyHex),
    safeSni: BigInt(sniHex),
    available,
    allowanceStored: allowance.period > 0n || allowance.balance > 0n,
    nextRefill,
    finalized,
  };
};

const whole = (wei: bigint) => Number(ethers.formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** Reasons this distribution must not be proposed now. Empty when it may. */
export const distributionProblems = (d: SycDistribution, chain: SycDistributionChain, nowMs: number): string[] => {
  const problems: string[] = [];
  if (!chain.finalized) problems.push("The vault is not finalized yet, so nothing can be minted.");
  if (chain.supply !== d.supplyAtGeneration) {
    problems.push("SYC has been minted since these figures were computed. They refresh within three hours.");
  } else if (nowMs - d.generatedAt > SYC_DIST.MAX_AGE_MS) {
    problems.push("These figures are more than a day old: the backend has stopped refreshing them.");
  }
  if (!chain.allowanceStored) {
    problems.push("The mint allowance is not stored on the Roles modifier yet.");
  } else if (chain.available < d.total) {
    problems.push(`The allowance covers ${whole(chain.available)} SYC and this mint needs ${whole(d.total)}.`);
  }
  return problems;
};

/** SNI the Safe would be short of after the mint (1 SYC should be backed by 1 SNI). Zero when covered. */
export const distributionShortfall = (d: SycDistribution, chain: SycDistributionChain): bigint => {
  const after = chain.supply + d.total;
  return after > chain.safeSni ? after - chain.safeSni : 0n;
};

/** A multisig proposes rather than sends: its transaction is mined only once the other signers confirm. */
export const isContractAccount = async (account: string): Promise<boolean> => {
  const code = await rpcRequestOn(SYC.CHAIN, "eth_getCode", [account, "latest"]);
  return typeof code === "string" && code.length > 2;
};
