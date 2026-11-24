/**
 * SNI Yield Claim Vault: the weekly SYC mint by the admin multisig, worked out
 * in the console the same way scripts/syc-distribution/weekly.mjs does it.
 *
 * What each sniETH depositor is owed is cumulative: everything owed since the
 * first deposit, minus everything already minted to it through the mint role
 * (`SYC-Distributor`). The mint is one call, the vault's `mintToMany`, which the
 * admin multisig sends through the Roles modifier.
 *
 * The expensive part of the script is history on Ethereum: sniETH deposits,
 * bridged yield claims and the staking vault's accrual. All of it ends before
 * this console's starting point. sniETH deposits are counted only up to the
 * 2026-09-08 incident, so from then on every depositor's weight is fixed, and
 * every new SNI the depositors are owed is split by those same weights:
 *
 *  - an incentive mint of exactly 34,000 SNI into a Safe, and
 *  - SNI bought with yield: WETH that reached a Safe and was swapped to SNI.
 *    WETH received for SNI the Safe sold is not yield, and buys nothing that
 *    is owed (06-compute.mjs's "recycled" SNI).
 *
 * So the console starts from the script's own result at BASE.block (the data
 * behind the one-off mint, when no yield WETH was left unswapped) and only
 * reads Polygon from there. Every split floors each share and gives the
 * remainder to the largest weight, as the script does, so the amounts match
 * it to the wei.
 */
import { ethers } from "ethers";
import { ethCallOn, rpcRequestOn } from "./rpc";
import { SYC } from "./sycConsole";
import { SAFE_TX_SERVICE_URLS } from "~/composables/safe/safeTransactionService";

const E18 = 10n ** 18n;

export interface SycMintHolder {
  wallet: string;
  /** sniETH deposited before the incident: the weight of every new split. */
  weight: bigint;
  /** SYC owed at BASE.block, from 06-compute.mjs. */
  base: bigint;
}

export const SYC_MINT = {
  ROLE_KEY: "SYC-Distributor",
  ADMIN_SAFE: "0x78E35296B8C0d0e31EF3584504289B4908416dc8",
  OLD_SAFE: "0x979AeA92BbfC33BE4F3d4Cf328133d695B88952B",
  SNI: "0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57",
  WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  INCENTIVE: 34_000n * E18,
  /** WETH below this that is not a swap is test dust: it joins the latest yield lot. */
  DUST: E18 / 100n,
  /** SYC mints are searched from here (weekly.mjs's fundFromBlock). */
  FUND_FROM_BLOCK: 96_000_000,
  /** SNI minted to the Safe before this block is in the retroactive computation; later odd sizes are flagged. */
  IGNORE_SNI_MINTS_BEFORE: 97_819_000,
  BASE: {
    /** Polygon block of scripts/syc-distribution/data (06-compute.mjs, run 2026-11-24). */
    block: 97_866_642,
    /** In the script's order: it breaks ties in the rounding remainder. */
    holders: [
      {
        wallet: "0xC419021546FDfEa5e097Bd48951cF1c8ACF9769B",
        weight: 32_000_000_000_000_000_000n,
        base: 55_192_413_815_566_323_801_602n,
      },
      {
        wallet: "0x1271836313a2B692858F96D88118176E72d9eD74",
        weight: 2_015_999_990_726_584_449_636n,
        base: 3_225_389_837_007_956_651_361_390n,
      },
      {
        wallet: "0xecE11276F7297389151dDA0B3Ab5bCfA3FAC2f59",
        weight: 49_999_743_137_846_477n,
        base: 83_178_974_309_924_664_111n,
      },
    ] as SycMintHolder[],
  },
} as const;

export const MINT_IF = {
  erc20: new ethers.Interface([
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]),
  flows: new ethers.Interface(["function mintToMany(uint256[] amounts, address[] recipients)"]),
  fund: new ethers.Interface(["function fundFlowsCall(bytes flowCall)"]),
  roles: new ethers.Interface([
    "function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool)",
  ]),
};
const TRANSFER_TOPIC = MINT_IF.erc20.getEvent("Transfer")!.topicHash;
const MINT_SELECTOR = MINT_IF.flows.getFunction("mintToMany")!.selector.slice(2);
const ROLE_SELECTOR = MINT_IF.roles.getFunction("execTransactionWithRole")!.selector.slice(2);

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const fmt = (wei: bigint, digits = 4) =>
  Number(ethers.formatEther(wei)).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/* ------------------------------------------------------------ the arithmetic */

/**
 * `amount` split by `weights`, each share floored, the remainder to the
 * largest weight (the first one, on a tie) — 06-compute.mjs's `split`.
 */
export const splitByWeight = (amount: bigint, weights: readonly bigint[]): bigint[] => {
  const total = weights.reduce((sum, w) => sum + w, 0n);
  if (total === 0n) return weights.map(() => 0n);
  const out = weights.map((w) => (amount * w) / total);
  const used = out.reduce((sum, x) => sum + x, 0n);
  let top = 0;
  weights.forEach((w, i) => {
    if (w > weights[top]) top = i;
  });
  out[top] += amount - used;
  return out;
};

/** One WETH or SNI transfer into or out of a vault Safe. */
export interface SafeFlowRow {
  safe: "old" | "new";
  token: "WETH" | "SNI";
  dir: "in" | "out";
  block: number;
  logIndex: number;
  tx: string;
  from: string;
  to: string;
  amount: bigint;
}

interface Lot {
  yield: boolean;
  weth: bigint;
  left: bigint;
  sni: bigint;
  tx: string;
  block: number;
}

export interface NewFlows {
  /** Owed per holder for what arrived after BASE.block, in holder order. */
  owed: bigint[];
  incentives: { tx: string; block: number; amount: bigint }[];
  /** SNI bought with yield WETH since BASE.block. */
  yieldSni: bigint;
  /** Yield WETH still in a Safe, owed once it is swapped. */
  unswappedWeth: bigint;
  warnings: string[];
}

/**
 * Everything owed for flows after BASE.block, by the rules of 06-compute.mjs.
 * Only `rows` after BASE.block are read; the caller may pass more (for the
 * checks), they are filtered here.
 */
export const accountNewFlows = (
  rows: readonly SafeFlowRow[],
  holders: readonly SycMintHolder[] = SYC_MINT.BASE.holders,
  baseBlock: number = SYC_MINT.BASE.block,
): NewFlows => {
  const weights = holders.map((h) => h.weight);
  const owed = holders.map(() => 0n);
  const warnings: string[] = [];
  const after = rows
    .filter((r) => r.block > baseBlock)
    .slice()
    .sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
  const safes = [SYC.ADDR.safe, SYC_MINT.OLD_SAFE];

  // Both Safes are one book: a transfer between them is not a flow.
  const byTx = new Map<string, { block: number; idx: number; wethIn: SafeFlowRow[]; wethOut: bigint; sniIn: bigint; sniOut: bigint }>();
  for (const r of after) {
    const counterparty = r.dir === "in" ? r.from : r.to;
    if (safes.some((s) => same(s, counterparty))) continue;
    let g = byTx.get(r.tx);
    if (!g) {
      g = { block: r.block, idx: r.logIndex, wethIn: [], wethOut: 0n, sniIn: 0n, sniOut: 0n };
      byTx.set(r.tx, g);
    }
    const mint = same(r.from, ethers.ZeroAddress);
    if (r.token === "WETH" && r.dir === "in") g.wethIn.push(r);
    else if (r.token === "WETH") g.wethOut += r.amount;
    else if (r.dir === "in" && !mint) g.sniIn += r.amount;
    else if (r.dir === "out") g.sniOut += r.amount;
  }
  const txs = [...byTx.entries()]
    .map(([tx, g]) => ({ tx, ...g }))
    .sort((a, b) => a.block - b.block || a.idx - b.idx);

  // Every WETH arrival in order; swaps draw on the oldest lot first.
  const queue: Lot[] = [];
  let carry = 0n;
  const lastYield = () => [...queue].reverse().find((l) => l.yield);
  for (const g of txs) {
    if (g.wethIn.length && g.wethOut === 0n) {
      for (const r of g.wethIn) {
        if (g.sniOut > 0n) {
          queue.push({ yield: false, weth: r.amount, left: r.amount, sni: 0n, tx: r.tx, block: r.block });
          continue;
        }
        // A bridged claim, or any real amount of WETH: a yield lot, split by the
        // weights (fixed since the incident, so the claim's own period adds nothing).
        if (r.amount >= SYC_MINT.DUST) {
          const weth = r.amount + carry;
          carry = 0n;
          queue.push({ yield: true, weth, left: weth, sni: 0n, tx: r.tx, block: r.block });
          continue;
        }
        const l = lastYield();
        if (!l) {
          carry += r.amount;
          continue;
        }
        l.weth += r.amount;
        l.left += r.amount;
      }
    }
    if (g.wethOut === 0n) continue;
    let need = g.wethOut;
    while (need > 0n) {
      let l = queue.find((x) => x.left > 0n);
      let take: bigint;
      if (l) {
        take = need < l.left ? need : l.left;
      } else {
        l = queue.at(-1);
        if (!l) {
          warnings.push(`${fmt(need, 6)} WETH left a Safe in ${g.tx} with none arriving since block ${baseBlock}; not counted.`);
          break;
        }
        take = need;
        l.left += take;
        warnings.push(`${fmt(take, 6)} more WETH left the Safe than had arrived (${g.tx}).`);
      }
      const part = (g.sniIn * take) / g.wethOut;
      if (l.yield) l.sni += part;
      l.left -= take;
      need -= take;
    }
  }

  const lots = queue.filter((l) => l.yield);
  for (const l of lots) {
    splitByWeight(l.sni, weights).forEach((x, i) => {
      owed[i] += x;
    });
  }

  const incentives = after
    .filter((r) => r.token === "SNI" && r.dir === "in" && same(r.from, ethers.ZeroAddress) && r.amount === SYC_MINT.INCENTIVE)
    .map((r) => ({ tx: r.tx, block: r.block, amount: r.amount }));
  for (const m of incentives) {
    splitByWeight(m.amount, weights).forEach((x, i) => {
      owed[i] += x;
    });
  }

  return {
    owed,
    incentives,
    yieldSni: lots.reduce((sum, l) => sum + l.sni, 0n),
    unswappedWeth: lots.reduce((sum, l) => sum + l.left, 0n),
    warnings,
  };
};

/** One SYC mint, and whether it went through the mint role. */
export interface SycMintRecord {
  to: string;
  amount: bigint;
  tx: string;
  block: number;
  viaRole: boolean;
}

export interface SycDueRow {
  wallet: string;
  owed: bigint;
  minted: bigint;
  /** What to mint now; never below 0. */
  due: bigint;
}

export interface SycMintPlan {
  rows: SycDueRow[];
  recipients: string[];
  amounts: bigint[];
  totalDue: bigint;
  /** Mints through the role, one per transaction, oldest first. */
  distributions: { tx: string; block: number; total: bigint }[];
  flags: string[];
  flows: NewFlows;
}

/**
 * What is due now: owed in total (BASE plus everything since), minus what the
 * mint role has minted to each wallet. Mints made any other way (deposits,
 * fees) are never counted as paid; they are flagged instead.
 */
export const planMint = (
  flowRows: readonly SafeFlowRow[],
  mints: readonly SycMintRecord[],
  holders: readonly SycMintHolder[] = SYC_MINT.BASE.holders,
  baseBlock: number = SYC_MINT.BASE.block,
): SycMintPlan => {
  const flows = accountNewFlows(flowRows, holders, baseBlock);
  const flags = [...flows.warnings];
  const minted = holders.map(() => 0n);
  const distributions = new Map<string, { tx: string; block: number; total: bigint }>();
  const other: SycMintRecord[] = [];
  const stray: SycMintRecord[] = [];
  for (const m of mints) {
    const i = holders.findIndex((h) => same(h.wallet, m.to));
    if (m.viaRole && i >= 0) {
      minted[i] += m.amount;
      const d = distributions.get(m.tx) ?? { tx: m.tx, block: m.block, total: 0n };
      d.total += m.amount;
      distributions.set(m.tx, d);
    } else if (m.viaRole) stray.push(m);
    else other.push(m);
  }

  const rows = holders
    .map((h, i) => {
      const owed = h.base + flows.owed[i];
      const diff = owed - minted[i];
      if (diff < 0n) flags.push(`${h.wallet} has received ${fmt(-diff)} SYC more than it is owed; nothing is minted to it.`);
      return { wallet: h.wallet, owed, minted: minted[i], due: diff > 0n ? diff : 0n };
    })
    // Largest first, as weekly.mjs lists them, so the calldata is the script's to the byte.
    .sort((a, b) => (b.owed > a.owed ? 1 : b.owed < a.owed ? -1 : 0));
  const pay = rows.filter((r) => r.due > 0n);

  if (other.length) {
    flags.push(
      `${other.length} SYC mint(s) that are not distributions (deposits or fees), ${fmt(other.reduce((s, m) => s + m.amount, 0n))} SYC in total. They are not counted as paid to anyone.`,
    );
  }
  if (stray.length) {
    flags.push(
      `${stray.length} mint(s) through the mint role went to wallets that are not depositors: ${stray.map((m) => `${fmt(m.amount)} SYC to ${m.to}`).join("; ")}. Check who sent them.`,
    );
  }

  // What is new since the last distribution and not distributed: odd-sized SNI
  // mints, and SNI that left the Safe (the depositors are still owed it).
  const dist = [...distributions.values()].sort((a, b) => a.block - b.block);
  const sinceBlock = Math.max(dist.at(-1)?.block ?? 0, SYC_MINT.IGNORE_SNI_MINTS_BEFORE);
  const newSafe = flowRows.filter((r) => r.safe === "new" && r.token === "SNI" && r.block > sinceBlock);
  const odd = newSafe.filter((r) => r.dir === "in" && same(r.from, ethers.ZeroAddress) && r.amount !== SYC_MINT.INCENTIVE);
  if (odd.length) {
    flags.push(
      `${odd.length} SNI mint(s) into the Safe that are not the 34,000 incentive and are not distributed: ${odd.map((r) => `${fmt(r.amount)} SNI (${r.tx})`).join("; ")}. If they are incentives, scripts/syc-distribution/06-compute.mjs needs to know.`,
    );
  }
  const out = newSafe.filter((r) => r.dir === "out");
  if (out.length) {
    flags.push(
      `${out.length} SNI transfer(s) out of the Safe since the last distribution (${fmt(out.reduce((s, r) => s + r.amount, 0n))} SNI). Depositors are still owed the full amount; make sure the Safe can back it.`,
    );
  }

  return {
    rows,
    recipients: pay.map((r) => r.wallet),
    amounts: pay.map((r) => r.due),
    totalDue: pay.reduce((s, r) => s + r.due, 0n),
    distributions: dist,
    flags,
    flows,
  };
};

/* -------------------------------------------------------- the transaction */

/** The vault call the Safe makes: `fundFlowsCall(mintToMany(amounts, recipients))`. */
export const buildMintCall = (amounts: readonly bigint[], recipients: readonly string[]): string =>
  MINT_IF.fund.encodeFunctionData("fundFlowsCall", [
    MINT_IF.flows.encodeFunctionData("mintToMany", [[...amounts], [...recipients]]),
  ]);

/** What the admin multisig sends: the vault call through the Roles modifier, as the mint role. */
export const buildRoleCall = (amounts: readonly bigint[], recipients: readonly string[]) => ({
  to: SYC.ADDR.roles,
  value: "0",
  data: MINT_IF.roles.encodeFunctionData("execTransactionWithRole", [
    SYC.ADDR.fund,
    0,
    buildMintCall(amounts, recipients),
    0,
    ethers.encodeBytes32String(SYC_MINT.ROLE_KEY),
    true,
  ]),
});

/** The Safe Transaction Builder file weekly.mjs writes, for loading by hand. */
export const transactionBuilderFile = (plan: SycMintPlan, date: string, createdAt = Date.now()) => {
  const call = buildRoleCall(plan.amounts, plan.recipients);
  return {
    version: "1.0",
    chainId: String(Number(SYC.CHAIN)),
    createdAt,
    meta: {
      name: `SYC distribution ${date}`,
      description: `mintToMany for ${plan.recipients.length} wallets, ${fmt(plan.totalDue)} SYC in total`,
      txBuilderVersion: "1.16.5",
      createdFromSafeAddress: SYC_MINT.ADMIN_SAFE,
      createdFromOwnerAddress: "",
    },
    transactions: plan.totalDue > 0n ? [{ ...call, contractMethod: null, contractInputsValues: null }] : [],
  };
};

/* ------------------------------------------------------------------ reads */

const hex = (n: number) => `0x${n.toString(16)}`;
const topicOf = (address: string) => ethers.zeroPadValue(address, 32);
const addressOf = (topic: string) => ethers.getAddress(`0x${topic.slice(26)}`);

/** eth_getLogs over [from, to], halving the range whenever no node will serve it. */
export const getLogsChunked = async (filter: Record<string, unknown>, from: number, to: number): Promise<any[]> => {
  const out: any[] = [];
  const walk = async (a: number, b: number): Promise<void> => {
    try {
      out.push(...(await rpcRequestOn(SYC.CHAIN, "eth_getLogs", [{ ...filter, fromBlock: hex(a), toBlock: hex(b) }])));
    } catch (error) {
      if (a >= b) throw error;
      const mid = Math.floor((a + b) / 2);
      await walk(a, mid);
      await walk(mid + 1, b);
    }
  };
  await walk(from, to);
  return out;
};

/** WETH and SNI moving in and out of both vault Safes, from `fromBlock`. */
export const readSafeFlows = async (fromBlock: number, head: number): Promise<SafeFlowRow[]> => {
  const safes = { old: SYC_MINT.OLD_SAFE, new: SYC.ADDR.safe } as const;
  const tokens = { WETH: SYC_MINT.WETH, SNI: SYC_MINT.SNI } as const;
  const jobs = (Object.keys(safes) as ("old" | "new")[]).flatMap((safe) =>
    (Object.keys(tokens) as ("WETH" | "SNI")[]).flatMap((token) =>
      (["in", "out"] as const).map(async (dir) => {
        const topics = dir === "in" ? [TRANSFER_TOPIC, null, topicOf(safes[safe])] : [TRANSFER_TOPIC, topicOf(safes[safe])];
        const logs = await getLogsChunked({ address: tokens[token], topics }, fromBlock, head);
        return logs
          .filter((l) => l.topics.length === 3)
          .map((l): SafeFlowRow => ({
            safe,
            token,
            dir,
            block: Number(l.blockNumber),
            logIndex: Number(l.logIndex),
            tx: l.transactionHash,
            from: addressOf(l.topics[1]),
            to: addressOf(l.topics[2]),
            amount: BigInt(l.data),
          }));
      }),
    ),
  );
  return (await Promise.all(jobs)).flat();
};

/** Every SYC mint, and whether its transaction went through the Roles modifier's `mintToMany`. */
export const readSycMints = async (head: number): Promise<SycMintRecord[]> => {
  const logs = await getLogsChunked(
    { address: SYC.ADDR.fund, topics: [TRANSFER_TOPIC, topicOf(ethers.ZeroAddress)] },
    SYC_MINT.FUND_FROM_BLOCK,
    head,
  );
  const inputs = new Map<string, string>();
  for (const hash of new Set(logs.map((l) => l.transactionHash as string))) {
    const tx = await rpcRequestOn(SYC.CHAIN, "eth_getTransactionByHash", [hash]);
    inputs.set(hash, String(tx?.input ?? "").toLowerCase());
  }
  return logs.map((l) => {
    const input = inputs.get(l.transactionHash) ?? "";
    return {
      to: addressOf(l.topics[2]),
      amount: BigInt(l.data),
      tx: l.transactionHash,
      block: Number(l.blockNumber),
      viaRole: input.includes(MINT_SELECTOR) && input.includes(ROLE_SELECTOR),
    };
  });
};

export interface SycMintCheck {
  /** "pass", or why it would fail. */
  mint: string;
  permission: string;
  ok: boolean;
}

/**
 * The two dry runs weekly.mjs makes, as eth_calls: the admin multisig sending
 * the whole thing through the modifier, and, if that fails, the Safe calling
 * the vault directly, to tell a refused permission from a refused mint.
 */
export const dryRunMint = async (plan: SycMintPlan): Promise<SycMintCheck> => {
  if (plan.totalDue === 0n) return { mint: "nothing to mint", permission: "nothing to mint", ok: true };
  const call = buildRoleCall(plan.amounts, plan.recipients);
  try {
    await ethCallOn(SYC.CHAIN, call.to, call.data, SYC_MINT.ADMIN_SAFE);
    return { mint: "pass", permission: "pass", ok: true };
  } catch (outer: any) {
    try {
      await ethCallOn(SYC.CHAIN, SYC.ADDR.fund, buildMintCall(plan.amounts, plan.recipients), SYC.ADDR.safe);
      return {
        mint: "pass",
        permission: "the Roles modifier refuses it from the admin multisig: is the mint role stored, and the multisig its member?",
        ok: false,
      };
    } catch (inner: any) {
      return {
        mint: `the vault refuses the mint (${inner?.message || "no reason given"})`,
        permission: "cannot be judged while the mint itself fails",
        ok: false,
      };
    }
  }
};

export interface SycMintState {
  head: number;
  plan: SycMintPlan;
  check: SycMintCheck;
  supply: bigint;
  safeSni: bigint;
  /** SNI in the Safe with no SYC against it once this mint is made. Negative is a shortfall. */
  spare: bigint;
}

/** Everything the card shows, read fresh. */
export const readMintState = async (): Promise<SycMintState> => {
  const head = Number(await rpcRequestOn(SYC.CHAIN, "eth_blockNumber", []));
  const [flowRows, mints, supplyHex, safeSniHex] = await Promise.all([
    readSafeFlows(SYC_MINT.IGNORE_SNI_MINTS_BEFORE, head),
    readSycMints(head),
    ethCallOn(SYC.CHAIN, SYC.ADDR.fund, MINT_IF.erc20.encodeFunctionData("totalSupply")),
    ethCallOn(SYC.CHAIN, SYC_MINT.SNI, MINT_IF.erc20.encodeFunctionData("balanceOf", [SYC.ADDR.safe])),
  ]);
  const plan = planMint(flowRows, mints);
  const supply = BigInt(supplyHex);
  const safeSni = BigInt(safeSniHex);
  const spare = safeSni - supply - plan.totalDue;
  if (spare < 0n) plan.flags.push(`After this mint there would be ${fmt(-spare)} more SYC than SNI in the Safe.`);
  const check = await dryRunMint(plan);
  if (!check.ok) plan.flags.push(`Dry run: ${check.mint === "pass" ? check.permission : check.mint}.`);
  return { head, plan, check, supply, safeSni, spare };
};

/* ---------------------------------------------------------- the proposal */

/**
 * A proposal already waiting in the admin Safe's queue with exactly this call,
 * so the console shows it instead of filing a second one.
 */
export const findQueuedProposal = async (
  data: string,
): Promise<{ safeTxHash: string; nonce: number; confirmations: number; required: number } | null> => {
  const base = SAFE_TX_SERVICE_URLS[SYC.CHAIN];
  if (!base) return null;
  const safe = ethers.getAddress(SYC_MINT.ADMIN_SAFE);
  const response = await fetch(
    `${base}/api/v1/safes/${safe}/multisig-transactions/?executed=false&to=${ethers.getAddress(SYC.ADDR.roles)}&limit=20`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) return null;
  const body = await response.json();
  const match = (body?.results ?? []).find((tx: any) => String(tx?.data ?? "").toLowerCase() === data.toLowerCase());
  if (!match) return null;
  return {
    safeTxHash: match.safeTxHash,
    nonce: Number(match.nonce),
    confirmations: (match.confirmations ?? []).length,
    required: Number(match.confirmationsRequired ?? 0),
  };
};
