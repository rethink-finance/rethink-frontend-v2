import { ethers } from "ethers";
import type IFund from "~/types/fund";
import type { ChainId } from "~/types/enums/chain_id";
import { useFundsStore } from "~/store/funds/funds.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import {
  fetchAllSubgraphUserFlows,
  type FundFlow,
} from "~/services/subgraph";
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
  priceAt,
  type PricePoint,
  type ShareBalanceHistory,
  type ShareDelta,
  type ValuePoint,
} from "~/composables/portfolioSeries";
import {
  resolveSettledAmounts,
  resolveVaultOperation,
} from "~/composables/vaultOperations";

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
  /** Paid in less taken out, in the base asset — the cost of the position. */
  netInvested?: number;
  /** Gain on that cost, in percent. Absent where nothing was ever paid in. */
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

/**
 * What the wallet paid in, and the share movements behind it.
 *
 * Only settled operations count. A request and the deposit it becomes are two
 * rows for one movement of money, so counting both would book it twice.
 * Deposits are recorded in the base asset and redemptions in shares, so each
 * leg is converted through the price in force when it settled.
 */
const measureFlows = (
  flows: PortfolioFlow[],
  prices: PricePoint[],
  baseDecimals: number,
  shareDecimals: number,
) => {
  const deltas: ShareDelta[] = [];
  let netInvested = 0;
  let canMeasure = true;

  for (const flow of [...flows].sort((a, b) => a.timestamp - b.timestamp)) {
    const operation = resolveVaultOperation(flow.name);
    if (!operation?.isSettled || flow.resolvedAmount == null) continue;

    const price = priceAt(prices, flow.timestamp);

    if (operation.family === "deposit") {
      // A deposit is recorded in the base asset, so what it cost is known
      // whether or not the vault has ever been priced. Only the shares it
      // bought need a price, and a vault with no price history — one that has
      // never settled — still has a cost worth reporting.
      const base = toNumber(flow.resolvedAmount, baseDecimals);
      netInvested += base;
      if (price) deltas.push({ timestamp: flow.timestamp, shares: base / price });
    } else if (operation.family === "withdraw") {
      const shares = toNumber(flow.resolvedAmount, shareDecimals);
      deltas.push({ timestamp: flow.timestamp, shares: -shares });
      // A redemption is recorded in shares, so without a price there is no
      // saying what left. Netting it at nothing would overstate the cost still
      // standing, and with it the return, so no figure is given at all.
      if (!price) canMeasure = false;
      else netInvested -= shares * price;
    }
  }

  return { deltas, netInvested, canMeasure };
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

  const [explorerFlows, subgraphFlows] = await Promise.all([
    settle(
      chainIds.map((chainId) =>
        explorerChainFlows(
          chainId,
          account,
          vaultsByChain[chainId] ?? [],
          etherscanApiKey,
        ),
      ),
    ),
    settle(chainIds.map((chainId) => subgraphChainFlows(chainId, account))),
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

/**
 * Assembles one position: balance from the chain, price history from the
 * backend, cost from the flows.
 */
export const buildPosition = async (
  fund: IFund,
  account: string,
  flows: PortfolioFlow[],
): Promise<PortfolioPosition | undefined> => {
  const held = await fetchPosition(fund, account);
  if (!held) return undefined;

  const baseDecimals = fund.baseToken?.decimals ?? 18;
  const shareDecimals = fund.fundToken?.decimals ?? 18;
  const shares = toNumber(held.shares, shareDecimals);
  const value = toNumber(held.valueRaw, baseDecimals);

  const series = await fetchPriceSeries(fund);
  const prices = calibrateToPosition(series.prices, shares, value);

  const vaultFlows = flows.filter(
    (flow) =>
      flow.chainId === fund.chainId &&
      flow.fundAddress === fund.address.toLowerCase(),
  );
  const { deltas, netInvested, canMeasure } = measureFlows(
    vaultFlows,
    prices,
    baseDecimals,
    shareDecimals,
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
    returnPercent: hasCost ? (value / netInvested - 1) * 100 : undefined,
    prices,
    history: buildShareBalanceHistory(shares, deltas),
    lastSettlement: series.lastSettlement,
  };
};

/**
 * Every vault the wallet has a position in.
 *
 * The scan is one reader call per vault, fanned out with allSettled so a dead
 * RPC only costs its own chain. Vaults the wallet has nothing in drop out
 * before any of the expensive history work is done for them.
 */
export const loadPortfolioPositions = async (
  account: string,
  // Read by the caller at setup: this runs from a watcher, outside any Nuxt
  // instance, where useRuntimeConfig cannot be called.
  etherscanApiKey = "",
): Promise<{ positions: PortfolioPosition[]; flows: PortfolioFlow[]; scanned: number }> => {
  const fundsStore = useFundsStore();

  // The discover fetch hydrates chainFunds from cache instantly and revalidates
  // behind it; reuse it rather than duplicating that logic.
  if (!fundsStore.funds.length) {
    await fundsStore.fetchFunds().catch((error) => {
      console.error("Failed fetching funds for portfolio", error);
    });
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
  const flows = await fetchPortfolioFlows(
    vaultsByChain,
    account,
    etherscanApiKey,
  );

  let scanned = 0;
  const results = await Promise.allSettled(
    funds.map(async (fund) => {
      const position = await buildPosition(fund, account, flows);
      scanned += 1;
      return position;
    }),
  );

  // Left unsorted: the order is by dollar value, which is not known until the
  // vault metadata lands — the caller sorts once it is.
  const positions = results
    .filter(
      (result): result is PromiseFulfilledResult<PortfolioPosition | undefined> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value)
    .filter((position): position is PortfolioPosition => Boolean(position));

  return { positions, flows, scanned };
};
