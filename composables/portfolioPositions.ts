import { ethers } from "ethers";
import type IFund from "~/types/fund";
import type { ChainId } from "~/types/enums/chain_id";
import { useFundsStore } from "~/store/funds/funds.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import {
  fetchAllSubgraphUserFlows,
  type FundFlow,
} from "~/services/subgraph";
import { SUBGRAPH_FLOW_COVERAGE } from "~/types/enums/subgraph";
import { fetchExplorerUserFlows } from "~/services/vaultFlows";
import {
  fetchFundDailyNavSnapshotsAction,
  fetchFundNavUpdatesAction,
} from "~/store/funds/actions/fetchFundNavUpdates.action";
import { collectSeries } from "~/composables/monthlyReturns";
import {
  buildShareBalanceHistory,
  buildVaultValueSeries,
  calibrateToPosition,
  measureFlows,
  type PricePoint,
  type ShareBalanceHistory,
  type ValuePoint,
} from "~/composables/portfolioSeries";
import { resolveSettledAmounts } from "~/composables/vaultOperations";

/**
 * What a wallet holds across every vault, and what it has done to get there.
 *
 * Three sources, in this order: the chain says what is held right now, the
 * subgraph says how it was acquired, and the backend says what a share has been
 * worth along the way. Nothing here needs the vault detail page's store, so a
 * position can be assembled for any vault without selecting it first.
 */

/**
 * A flow with its vault and chain resolved.
 *
 * `amount` is what the subgraph recorded, which is nothing at all for a settled
 * operation; `resolvedAmount` is what actually moved, paired with the request
 * that settled — see resolveSettledAmounts.
 */
export interface PortfolioFlow {
  id: string;
  chainId: ChainId;
  fundAddress: string;
  name: string;
  amount: bigint | null;
  resolvedAmount: bigint | null;
  flag?: boolean | null;
  timestamp: number;
  txHash?: string;
}

export interface PortfolioPosition {
  key: string;
  fund: IFund;
  /** Vault tokens held, on chain. */
  shares: bigint;
  /** What those tokens are worth in the vault's base asset, on chain. */
  valueRaw: bigint;
  value: number;
  /** Paid in less taken out, in the base asset — the cash cost of the position. */
  netInvested?: number;
  /**
   * Gain in percent on the measurable cost: in-series flows at their own
   * prices, anything held before the vault's first recorded price booked at
   * that opening price. Absent where nothing is measurable. See measureFlows.
   */
  returnPercent?: number;
  /** Base-asset price per share, calibrated against the position above. */
  prices: PricePoint[];
  history: ShareBalanceHistory;
  /** When the vault last settled its cycle, in ms. Zero if it never has. */
  lastSettlement: number;
}

/**
 * A position with its dollar figures worked out. Kept apart from the position
 * itself because those figures depend on vault metadata that arrives later, so
 * they belong in a computed rather than in a snapshot.
 */
export interface PricedPosition extends PortfolioPosition {
  valueUSD?: number;
  valueSeries: ValuePoint[];
}

const toNumber = (value: bigint, decimals: number) =>
  parseFloat(ethers.formatUnits(value, decimals));

/**
 * The wallet's balance in one vault, straight from the reader contract. Returns
 * nothing where the wallet holds nothing, which is most vaults for most people.
 */
const fetchPosition = async (fund: IFund, account: string) => {
  const web3Store = useWeb3Store();
  const readerContract =
    web3Store.chainContracts[fund.chainId]?.rethinkReaderContract;
  if (!readerContract) return undefined;

  const userData = await web3Store.callWithRetry(fund.chainId, () =>
    readerContract.methods.getFundUserData(fund.address, account).call(),
  );

  const shares = BigInt(userData?.fundTokenBalance ?? 0);
  const valueRaw = BigInt(userData?.fundShareValue ?? 0);
  if (shares <= 0n && valueRaw <= 0n) return undefined;

  return { shares, valueRaw };
};

/**
 * Base assets the app treats as a dollar when the backend has no quote for the
 * vault holding them. Not a price feed — a stablecoin's whole purpose is to be
 * worth a dollar, and a position shown at nothing is a worse answer than one
 * shown at par.
 */
const USD_STABLECOINS = new Set(["USDC", "USDC.E", "USDBC", "USDT", "DAI"]);

/**
 * USD per unit of a vault's base asset, from the vault's own valuation.
 *
 * Only today's rate is available, so it is applied to the whole history: the
 * chart measures what the vaults did, not what their denominations did against
 * the dollar. For the stablecoin-denominated vaults that is the same thing.
 *
 * Read inside a computed rather than stored on the position — a vault's USD
 * quote arrives with its metadata, which lands after the balances do, and a
 * rate snapshotted at load time would stay at whatever it was then.
 */
export const usdPerBaseToken = (fund: IFund): number => {
  const usd = Number(fund.totalSimulatedNavUSD ?? 0);
  const nav = fund.totalSimulatedNav ?? fund.lastNAVUpdateTotalNAV;
  const decimals = fund.baseToken?.decimals;
  if (decimals == null) return 0;

  if (usd && nav) {
    const navTokens = toNumber(nav as bigint, decimals);
    if (navTokens > 0) return usd / navTokens;
  }

  return USD_STABLECOINS.has((fund.baseToken?.symbol ?? "").toUpperCase())
    ? 1
    : 0;
};

/** What the position is worth in dollars, or nothing where it cannot be priced. */
export const positionValueUSD = (
  position: PortfolioPosition,
): number | undefined => {
  const rate = usdPerBaseToken(position.fund);
  return rate ? position.value * rate : undefined;
};

/** The position's worth over time, in USD. */
export const positionValueSeries = (
  position: PortfolioPosition,
): ValuePoint[] => {
  const rate = usdPerBaseToken(position.fund);
  if (!rate) return [];

  return buildVaultValueSeries(position.prices, position.history).map(
    (point) => ({ timestamp: point.timestamp, value: point.value * rate }),
  );
};

/**
 * The vault's price history, on whatever scale the backend reports it, plus
 * when it last settled — the same fetch answers both, and a pending request is
 * only ready to process once a settlement has happened after it.
 */
const fetchPriceSeries = async (
  fund: IFund,
): Promise<{ prices: PricePoint[]; lastSettlement: number }> => {
  const [navUpdates, snapshots] = await Promise.all([
    fetchFundNavUpdatesAction(fund.chainId, fund.address).catch(() => []),
    fetchFundDailyNavSnapshotsAction(fund.chainId, fund.address).catch(() => []),
  ]);

  // Same series the monthly returns table measures, including its fallback to
  // NAV for a vault that never minted shares — see collectSeries.
  const { points } = collectSeries(
    navUpdates.map((update) => ({
      timestamp: update.timestamp,
      sharePrice: update.sharePrice,
      totalNav: update.totalNAV,
      totalSupply: update.totalSupply,
    })),
    snapshots.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      sharePrice: snapshot.sharePrice,
      totalNav: snapshot.totalSimulatedNav,
      totalSupply: snapshot.totalSupply,
    })),
  );

  const lastSettlement = navUpdates.reduce(
    (latest, update) => Math.max(latest, update.timestamp ?? 0),
    0,
  );

  return { prices: points, lastSettlement };
};

/** A flow as its source gave it, before settlements borrow their amounts. */
type UnresolvedFlow = Omit<PortfolioFlow, "resolvedAmount">;

const subgraphChainFlows = async (
  chainId: ChainId,
  account: string,
): Promise<UnresolvedFlow[]> => {
  const flows = await fetchAllSubgraphUserFlows(chainId, account);
  return flows.map<UnresolvedFlow>((flow: FundFlow) => ({
    id: `${chainId}-${flow.id}`,
    chainId,
    fundAddress: (flow.fund?.fundContractAddr ?? "").toLowerCase(),
    name: flow.name,
    amount: flow.amount == null ? null : BigInt(flow.amount),
    flag: flow.flag,
    // Flows carry unix seconds; everything else in the app is milliseconds.
    timestamp: (parseInt(flow.timestamp, 10) || 0) * 1000,
    txHash: flow.transaction?.id,
  }));
};

const explorerChainFlows = async (
  chainId: ChainId,
  account: string,
  vaultAddresses: string[],
  etherscanApiKey: string,
): Promise<UnresolvedFlow[]> => {
  const flows = await fetchExplorerUserFlows(
    chainId,
    account,
    vaultAddresses,
    etherscanApiKey,
  );
  return flows.map<UnresolvedFlow>((flow) => ({
    id: `${chainId}-explorer-${flow.id}`,
    chainId,
    fundAddress: flow.fundAddress,
    name: flow.name,
    amount: flow.amount == null ? null : BigInt(flow.amount),
    // The explorer reports calldata, not decoded arguments, so a revoke's
    // direction is not read back out of it. Left unknown, resolveSettledAmounts
    // clears both books, which is the safe reading.
    flag: null,
    timestamp: flow.timestamp * 1000,
    txHash: flow.txHash,
  }));
};

/**
 * Every flow the wallet has signed, from both places they are recorded.
 *
 * The subgraph is the natural source and is used wherever it works, but it does
 * not work everywhere — there is no Polygon or HyperEVM deployment and the
 * Arbitrum one indexed nothing — so a wallet's history there came back empty
 * and the portfolio showed no activity at all. The block explorer covers the
 * same ground from the wallet's own transaction list, and the two are merged.
 *
 * Where both saw a transaction, the subgraph's row wins: it decoded the call
 * rather than inferring it from calldata, and it carries the revoke flag the
 * explorer cannot give. This is the same merge, and the same precedence, the
 * vault's own activity table uses.
 */
export const fetchPortfolioFlows = async (
  vaultsByChain: Record<string, string[]>,
  account: string,
  etherscanApiKey = "",
): Promise<PortfolioFlow[]> => {
  const chainIds = Object.keys(vaultsByChain) as ChainId[];

  // A chain failing costs that chain and that feed, nothing else.
  const settle = async (tasks: Promise<UnresolvedFlow[]>[]) =>
    (await Promise.allSettled(tasks))
      .filter(
        (result): result is PromiseFulfilledResult<UnresolvedFlow[]> =>
          result.status === "fulfilled",
      )
      .flatMap((result) => result.value);

  // The explorer walk is the expensive feed — Base's blockscout pages at
  // multiple seconds each — so it only runs where the subgraph cannot stand
  // alone. On a covered chain it returns the identical rows anyway, and if the
  // subgraph errors there, the walk steps back in as that chain's fallback.
  const explorerFor = (chainId: ChainId) =>
    explorerChainFlows(
      chainId,
      account,
      vaultsByChain[chainId] ?? [],
      etherscanApiKey,
    );

  const [explorerFlows, subgraphFlows] = await Promise.all([
    settle(
      chainIds
        .filter((chainId) => !SUBGRAPH_FLOW_COVERAGE.has(chainId))
        .map(explorerFor),
    ),
    settle(
      chainIds.map((chainId) =>
        SUBGRAPH_FLOW_COVERAGE.has(chainId)
          ? subgraphChainFlows(chainId, account).catch(() => explorerFor(chainId))
          : subgraphChainFlows(chainId, account),
      ),
    ),
  ]);

  // One transaction calls the vault once, so a hash and an operation name
  // identify it whichever feed reported it. The subgraph goes in second and
  // overwrites the explorer's version of the same row.
  const byTransaction = new Map<string, UnresolvedFlow>();
  const merged: UnresolvedFlow[] = [];
  for (const flow of [...explorerFlows, ...subgraphFlows]) {
    // Nothing to deduplicate against without a hash, and nothing to link to
    // either; the row is still real, so it is kept as it stands.
    if (!flow.txHash) {
      merged.push(flow);
      continue;
    }
    byTransaction.set(`${flow.txHash.toLowerCase()}:${flow.name}`, flow);
  }

  // A settled deposit records no amount of its own — it takes the one from the
  // request it completed, per vault and per direction.
  return resolveSettledAmounts(
    [...merged, ...byTransaction.values()],
    (flow) => `${flow.chainId}-${flow.fundAddress}`,
  );
};

/** A vault the wallet holds, with everything known before the flows arrive. */
interface HeldVault {
  fund: IFund;
  shares: bigint;
  valueRaw: bigint;
  prices: PricePoint[];
  lastSettlement: number;
}

/**
 * The fast half of a position: balance from the chain, price history from the
 * backend. Nothing here needs the flows, so the whole scan runs while they are
 * still being fetched.
 */
const scanHeldVault = async (
  fund: IFund,
  account: string,
): Promise<HeldVault | undefined> => {
  const held = await fetchPosition(fund, account);
  if (!held) return undefined;

  const shares = toNumber(held.shares, fund.fundToken?.decimals ?? 18);
  const value = toNumber(held.valueRaw, fund.baseToken?.decimals ?? 18);

  const series = await fetchPriceSeries(fund);
  const prices = calibrateToPosition(series.prices, shares, value);

  return { fund, ...held, prices, lastSettlement: series.lastSettlement };
};

/**
 * The slow half: what the flows say the position cost. With no flows yet, the
 * cost figures stay absent and the history reads as the current balance held
 * throughout — the honest reading of "balance known, deposits not yet".
 */
const assemblePosition = (
  held: HeldVault,
  flows: PortfolioFlow[],
): PortfolioPosition => {
  const { fund } = held;
  const baseDecimals = fund.baseToken?.decimals ?? 18;
  const shareDecimals = fund.fundToken?.decimals ?? 18;
  const shares = toNumber(held.shares, shareDecimals);
  const value = toNumber(held.valueRaw, baseDecimals);

  const vaultFlows = flows.filter(
    (flow) =>
      flow.chainId === fund.chainId &&
      flow.fundAddress === fund.address.toLowerCase(),
  );
  const { deltas, netInvested, canMeasure, measurableCost } = measureFlows(
    vaultFlows,
    held.prices,
    baseDecimals,
    shareDecimals,
    shares,
  );
  const hasCost = canMeasure && netInvested > 0;

  return {
    key: `${fund.chainId}-${fund.address}`,
    fund,
    shares: held.shares,
    valueRaw: held.valueRaw,
    value,
    // A wallet that has taken out more than it put in has no cost left to
    // measure a return against, so the figure is withheld rather than invented.
    netInvested: hasCost ? netInvested : undefined,
    returnPercent:
      measurableCost > 0 ? (value / measurableCost - 1) * 100 : undefined,
    prices: held.prices,
    history: buildShareBalanceHistory(shares, deltas),
    lastSettlement: held.lastSettlement,
  };
};

/**
 * Every vault the wallet has a position in.
 *
 * The scan is one reader call per vault, fanned out with allSettled so a dead
 * RPC only costs its own chain. Vaults the wallet has nothing in drop out
 * before any of the expensive history work is done for them.
 *
 * Nothing waits for the slowest feed. `onBalances` fires with cost-less
 * positions as each held vault answers — one hanging RPC on some other chain
 * cannot hold back the rows the wallet actually has — and once more when the
 * scan completes, so an empty portfolio also gets its answer. `onFlows` fires
 * the moment the flows are in, which can be before or after the scan ends.
 * The returned positions carry the full cost figures.
 */
export const loadPortfolioPositions = async (
  account: string,
  // Read by the caller at setup: this runs from a watcher, outside any Nuxt
  // instance, where useRuntimeConfig cannot be called.
  etherscanApiKey = "",
  onBalances?: (positions: PortfolioPosition[], scanDone: boolean) => void,
  onFlows?: (flows: PortfolioFlow[]) => void,
): Promise<{ positions: PortfolioPosition[]; flows: PortfolioFlow[]; scanned: number }> => {
  const fundsStore = useFundsStore();

  // The discover fetch hydrates chainFunds from the localStorage cache
  // synchronously, before it touches the network, then revalidates each chain
  // behind that. The scan only needs addresses and token metadata, which the
  // cache already has — so it runs against the cached list rather than waiting
  // the several seconds the revalidation takes, and only a truly cold cache
  // waits for the network. The page reads quotes from the store rather than
  // from the fund references captured here, so the fresh objects still reach
  // it when the revalidation lands.
  if (!fundsStore.funds.length) {
    const revalidation = fundsStore.fetchFunds().catch((error) => {
      console.error("Failed fetching funds for portfolio", error);
    });
    if (!fundsStore.funds.length) await revalidation;
  }

  const funds: IFund[] = fundsStore.funds;
  // The explorer feed reads the wallet's own transactions, so it has to be told
  // which addresses count as a vault.
  const vaultsByChain = Object.fromEntries(
    Object.entries(fundsStore.chainFunds).map(([chainId, chainFunds]) => [
      chainId,
      chainFunds.map((fund) => fund.address),
    ]),
  );
  const flowsPromise = fetchPortfolioFlows(
    vaultsByChain,
    account,
    etherscanApiKey,
  )
    .catch((error) => {
      console.error("Failed fetching portfolio flows", error);
      return [] as PortfolioFlow[];
    })
    .then((flows) => {
      onFlows?.(flows);
      return flows;
    });

  // Left unsorted: the order is by dollar value, which is not known until the
  // vault metadata lands — the caller sorts once it is.
  const heldVaults: HeldVault[] = [];
  const emitBalances = (scanDone: boolean) =>
    onBalances?.(
      heldVaults.map((held) => assemblePosition(held, [])),
      scanDone,
    );

  await Promise.allSettled(
    funds.map(async (fund) => {
      const held = await scanHeldVault(fund, account);
      if (held) {
        heldVaults.push(held);
        emitBalances(false);
      }
    }),
  );
  // Fired even when nothing was held: "no positions" is an answer too, and it
  // should not wait for the flows.
  emitBalances(true);

  const flows = await flowsPromise;
  return {
    positions: heldVaults.map((held) => assemblePosition(held, flows)),
    flows,
    scanned: funds.length,
  };
};
