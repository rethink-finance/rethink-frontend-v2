import { ethers } from "ethers";
import type IFund from "~/types/fund";
import type { ChainId } from "~/types/enums/chain_id";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";
import { fetchBackendProposals } from "~/services/backend/governance";
import { fetchSubgraphGovernorProposals } from "~/services/subgraph";
import { hasRethinkSubgraph } from "~/types/enums/subgraph";
import {
  FundTransactionType,
  FundTransactionTypeStorageSlotIdxMap,
} from "~/types/enums/fund_transaction_type";
import type { PortfolioPosition } from "~/composables/portfolioPositions";

/**
 * What a vault is waiting on the wallet for: a vote it has not cast, or a
 * deposit or redemption it has asked for and not yet completed.
 *
 * All of it is read per vault from its own address, without selecting the vault
 * first — the vault detail page's store is a singleton, and the portfolio needs
 * the same answers for every vault at once.
 */

export interface PendingRequest {
  kind: "deposit" | "redemption";
  /** In the request's own units: base asset for a deposit, shares for a redemption. */
  amount: bigint;
  timestamp: number;
  /**
   * True once the vault has settled a cycle since the request was made, which
   * is what turns "wait" into "you can finish this now".
   */
  isSettled: boolean;
}

export interface OpenVote {
  proposalId: string;
  /** Block the proposal was created in; the app's proposal links carry it. */
  createdBlockNumber?: string;
  title: string;
  /** Ms, or undefined where the deadline is a block we could not date. */
  endsAt?: number;
}

export interface PositionAttention {
  requests: PendingRequest[];
  votes: OpenVote[];
}

// ---- Pending deposit / redemption requests ---------------------------------

/**
 * The wallet's outstanding request of one kind, read straight out of the
 * vault's storage — GovernableFundStorage keeps them in a mapping the reader
 * contract does not expose.
 */
const fetchRequest = async (
  chainId: ChainId,
  fundAddress: string,
  account: string,
  type: FundTransactionType,
): Promise<bigint[] | undefined> => {
  const web3Store = useWeb3Store();
  const provider = web3Store.chainProviders[chainId];
  if (!provider) return undefined;

  const slotId = FundTransactionTypeStorageSlotIdxMap[type];
  const amountKey = getAddressMappingStorageKeyAtIndex(account, slotId);
  const timestampKey = incrementStorageKey(amountKey);

  const read = async (key: string) => {
    const raw = await web3Store.callWithRetry(chainId, () =>
      provider.eth.getStorageAt(fundAddress, key),
    );
    const stripped = ethers.stripZerosLeft(raw);
    return stripped === "0x" ? 0n : BigInt(stripped);
  };

  try {
    return await Promise.all([read(amountKey), read(timestampKey)]);
  } catch (error) {
    console.error(
      `Failed reading ${type} request for ${chainId} ${fundAddress}`,
      error,
    );
    return undefined;
  }
};

export const fetchPendingRequests = async (
  fund: IFund,
  account: string,
  lastSettlement: number,
): Promise<PendingRequest[]> => {
  const [deposit, redemption] = await Promise.all([
    fetchRequest(fund.chainId, fund.address, account, FundTransactionType.Deposit),
    fetchRequest(
      fund.chainId,
      fund.address,
      account,
      FundTransactionType.Redemption,
    ),
  ]);

  const requests: PendingRequest[] = [];
  const add = (kind: PendingRequest["kind"], read?: bigint[]) => {
    if (!read) return;
    const [amount, timestampSeconds] = read;
    if (amount <= 0n) return;

    const timestamp = Number(timestampSeconds) * 1000;
    requests.push({
      kind,
      amount,
      timestamp,
      // A request made after the last settlement has not been through a cycle
      // yet. A vault that has never settled cannot make anyone wait.
      isSettled: !lastSettlement || timestamp < lastSettlement,
    });
  };

  add("deposit", deposit);
  add("redemption", redemption);
  return requests;
};

// ---- Open governance votes -------------------------------------------------

/**
 * Block numbers on every chain the app supports are far below this; unix
 * seconds have been above it since 2001. A governor's clock is configured as
 * one or the other, and the vault's own clockMode is only loaded when a vault
 * is opened — so the deadline is read from its own magnitude instead.
 */
const TIMESTAMP_FLOOR = 1_000_000_000;

const parseProposalTitle = (description: string): string => {
  try {
    const parsed = JSON.parse(description);
    return parsed.title || description;
  } catch {
    return description;
  }
};

/**
 * When voting closes, in ms. A timestamp-clocked governor states it outright; a
 * block-clocked one names a block, which is dated from the chain's recent block
 * rate rather than by fetching a block that has not been mined.
 */
const resolveDeadline = async (
  chainId: ChainId,
  voteEnd: number,
): Promise<number | undefined> => {
  if (voteEnd >= TIMESTAMP_FLOOR) return voteEnd * 1000;

  try {
    const blockTimeStore = useBlockTimeStore();
    const context = await blockTimeStore.initializeBlockTimeContext(chainId);
    const seconds = await blockTimeStore.getTimestampForBlock(voteEnd, context);
    return seconds ? seconds * 1000 : undefined;
  } catch (error) {
    console.warn("Could not date a proposal deadline", chainId, voteEnd, error);
    return undefined;
  }
};

/** A proposal as both the backend index and the subgraph describe it. */
interface GovernorProposal {
  proposalId: string;
  description: string;
  voteEnd: string;
  createdBlockNumber?: string;
  isClosed: boolean;
  voters: string[];
}

const blockNumberOf = (value: unknown): string | undefined =>
  value == null ? undefined : String(value);

/**
 * The vault's proposals, from the backend's on-chain index where it has them —
 * it covers every chain — and from the subgraph otherwise. The subgraph alone
 * missed most vaults: Arbitrum's and Polygon's deployments stopped indexing and
 * HyperEVM has none, so those wallets were never told about a vote.
 */
const fetchGovernorProposals = async (fund: IFund): Promise<GovernorProposal[]> => {
  const snapshot = await fetchBackendProposals(fund.chainId, fund.address);
  if (snapshot?.proposals) {
    return snapshot.proposals.map((proposal: any) => ({
      proposalId: String(proposal.proposalId),
      description: String(proposal.description ?? ""),
      voteEnd: String(proposal.voteEnd ?? "0"),
      createdBlockNumber: blockNumberOf(proposal.proposalCreated?.[0]?.transaction?.blockNumber),
      isClosed: Boolean(
        proposal.proposalCanceled?.length ||
          proposal.proposalExecuted?.length ||
          proposal.proposalQueued?.length,
      ),
      voters: (proposal.receipts ?? []).map((receipt: any) =>
        String(receipt.voter?.id ?? "").toLowerCase(),
      ),
    }));
  }
  // The subgraph is keyed by governor, which the portfolio's vault list (the
  // Discover one) does not carry; the backend index needs only the vault.
  if (!fund.governorAddress || !hasRethinkSubgraph(fund.chainId)) return [];

  const proposals = await fetchSubgraphGovernorProposals(fund.chainId, {
    governorAddress: fund.governorAddress.toLowerCase(),
  });
  return proposals.map((proposal) => ({
    proposalId: String(proposal.proposalId),
    description: proposal.description,
    voteEnd: String(proposal.voteEnd),
    createdBlockNumber: blockNumberOf(proposal.proposalCreated?.[0]?.transaction?.blockNumber),
    isClosed: Boolean(proposal.canceled || proposal.executed || proposal.queued),
    voters: (proposal.receipts ?? []).map((receipt) =>
      String(receipt.voter?.id ?? "").toLowerCase(),
    ),
  }));
};

/**
 * Proposals still open that this wallet has not voted on.
 *
 * Whether someone *can* vote depends on delegated voting power at the
 * proposal's snapshot, which is a contract call per proposal per vault. This
 * takes holding a position as the stake instead: the wallet is in the vault, so
 * the vote is its business. The worst case is a row inviting a vote that
 * carries no weight, which is a far better failure than staying silent about a
 * vote someone could have cast.
 */
export const fetchOpenVotes = async (
  fund: IFund,
  account: string,
): Promise<OpenVote[]> => {
  const wallet = account.toLowerCase();
  const open = (await fetchGovernorProposals(fund)).filter(
    (proposal) => !proposal.isClosed && !proposal.voters.includes(wallet),
  );

  const dated = await Promise.all(
    open.map(async (proposal) => ({
      proposalId: proposal.proposalId,
      createdBlockNumber: proposal.createdBlockNumber,
      title: parseProposalTitle(proposal.description),
      endsAt: await resolveDeadline(fund.chainId, Number(proposal.voteEnd)),
    })),
  );

  // Undated proposals are kept: a deadline we cannot resolve is no reason to
  // hide a vote. Anything already closed is dropped.
  const now = Date.now();
  return dated
    .filter((vote) => vote.endsAt === undefined || vote.endsAt > now)
    .sort((a, b) => (a.endsAt ?? Infinity) - (b.endsAt ?? Infinity));
};

// ---- Both, per position ----------------------------------------------------

/**
 * Loaded after the positions themselves, and separately: a vault row is worth
 * showing the moment its balance is known, and neither the subgraph nor the
 * storage reads should hold that up.
 */
export const loadPositionAttention = async (
  positions: PortfolioPosition[],
  account: string,
): Promise<Record<string, PositionAttention>> => {
  const entries = await Promise.allSettled(
    positions.map(async (position) => {
      const [requests, votes] = await Promise.all([
        fetchPendingRequests(position.fund, account, position.lastSettlement),
        fetchOpenVotes(position.fund, account).catch((error) => {
          // A vault the backend has not indexed on a chain without a working
          // subgraph has no proposal source; that is ordinary, not exceptional.
          console.warn("Open votes unavailable", position.fund.chainId, error);
          return [] as OpenVote[];
        }),
      ]);
      return [position.key, { requests, votes }] as const;
    }),
  );

  return Object.fromEntries(
    entries
      .filter(
        (entry): entry is PromiseFulfilledResult<readonly [string, PositionAttention]> =>
          entry.status === "fulfilled",
      )
      .map((entry) => entry.value),
  );
};
