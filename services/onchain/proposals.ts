import { ethers } from "ethers";
import {
  ExplorerLogsUnavailableError,
  fetchExplorerLogs,
  type ExplorerLog,
} from "./explorerLogs";
import { RethinkFundGovernor } from "~/assets/contracts/RethinkFundGovernor";
import { ERC20Votes } from "~/assets/contracts/ERC20Votes";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";
import type ISubgraphGovernanceProposal from "~/types/subgraph_governance_proposal";

/**
 * Governance proposals read straight off the governor's event log.
 *
 * The third and last tier behind the backend index and the subgraph, and the
 * only one that answers on a chain the subgraph was never deployed to —
 * HyperEVM has no Rethink subgraph at all, so before this existed every vault
 * there sat permanently behind a "proposals could not be refreshed" note, with
 * no way to tell a vault that has never been proposed against from one whose
 * history simply could not be loaded.
 *
 * Returns the same shape the subgraph query does, so the existing mapper
 * formats all three sources identically. Mirrors the fold the backend indexer
 * performs in rebuildProposalsSnapshot — keep the two in step.
 */

const governorInterface = new ethers.Interface(RethinkFundGovernor.abi as any);

export { ExplorerLogsUnavailableError as ProposalsUnavailableError };

/** Per-proposal quorum inputs, immutable once the vote snapshot has passed. */
export interface IOnChainProposalPoints {
  quorumNumerator: string;
  totalSupply: string;
}

const eventRef = (log: ExplorerLog) => ({
  timestamp: String(log.timestamp),
  transaction: { id: log.transactionHash, blockNumber: log.blockNumber },
});

/**
 * Every proposal the governor has ever emitted, oldest first.
 *
 * @param chainId - The chain the governor lives on
 * @param governorAddress - The RethinkFundGovernor to read
 * @param governanceTokenAddress - Token the quorum snapshots are taken against
 * @throws ProposalsUnavailableError when the log history could not be read
 */
export const fetchOnChainProposals = async (
  chainId: ChainId,
  governorAddress: string,
  governanceTokenAddress: string,
): Promise<{
  proposals: ISubgraphGovernanceProposal[];
  quorumDenominator: string;
  points: Record<string, IOnChainProposalPoints>;
}> => {
  const web3Store = useWeb3Store();
  const logs = await fetchExplorerLogs(chainId, governorAddress);

  const proposals = new Map<string, any>();
  // Deduped by voter: a vote emits exactly one of VoteCast/VoteCastWithParams,
  // but nothing in the log guarantees that, and a double-counted voter would
  // inflate the tally the participation bar is drawn from.
  const receiptsByProposal = new Map<string, Map<string, any>>();

  for (const log of logs) {
    let eventName: string;
    let args: Record<string, any>;
    try {
      const parsed = governorInterface.parseLog({
        topics: log.topics,
        data: log.data,
      });
      if (!parsed) continue;
      eventName = parsed.name;
      // Read the whole struct out rather than off parsed.args: an ethers
      // Result is an Array subclass, so ProposalCreated's `values` field
      // resolves to Array.prototype.values — a function, silently, with every
      // call's ETH value lost behind it. toObject() has no such collision.
      args = parsed.args.toObject();
    } catch {
      // An event this ABI does not carry — a proxy's own, or one added after
      // this build. Not ours to fold in.
      continue;
    }

    const proposalId =
      args?.proposalId != null ? String(args.proposalId) : undefined;
    const ref = eventRef(log);

    switch (eventName) {
      case "ProposalCreated": {
        if (!proposalId) break;
        const targets: string[] = [...(args.targets ?? [])];
        const values: any[] = [...(args.values ?? [])];
        const signatures: string[] = [...(args.signatures ?? [])];
        const calldatas: string[] = [...(args.calldatas ?? [])];
        proposals.set(proposalId, {
          id: proposalId,
          proposalId,
          proposer: { id: String(args.proposer ?? "").toLowerCase() },
          voteStart: String(args.voteStart ?? "0"),
          voteEnd: String(args.voteEnd ?? "0"),
          description: String(args.description ?? ""),
          canceled: false,
          queued: false,
          executed: false,
          calls: targets.map((target, index) => ({
            calldata: calldatas[index] ?? "0x",
            value: String(values[index] ?? "0"),
            signature: signatures[index] ?? "",
            target: { id: String(target).toLowerCase() },
            index,
          })),
          proposalCreated: [ref],
          proposalCanceled: [],
          proposalExecuted: [],
          proposalQueued: [],
          receipts: [],
        });
        break;
      }
      case "ProposalCanceled": {
        const proposal = proposalId ? proposals.get(proposalId) : undefined;
        if (!proposal) break;
        proposal.canceled = true;
        proposal.proposalCanceled.push(ref);
        break;
      }
      case "ProposalExecuted": {
        const proposal = proposalId ? proposals.get(proposalId) : undefined;
        if (!proposal) break;
        proposal.executed = true;
        proposal.proposalExecuted.push(ref);
        break;
      }
      case "ProposalQueued": {
        const proposal = proposalId ? proposals.get(proposalId) : undefined;
        if (!proposal) break;
        proposal.queued = true;
        proposal.proposalQueued.push(ref);
        break;
      }
      case "ProposalExtended": {
        // Late-quorum extension moves the deadline; state derivation keys off
        // voteEnd, so fold it in rather than keeping it beside.
        const proposal = proposalId ? proposals.get(proposalId) : undefined;
        if (proposal && args?.extendedDeadline != null) {
          const extended = String(args.extendedDeadline);
          if (BigInt(extended) > BigInt(proposal.voteEnd)) {
            proposal.voteEnd = extended;
          }
        }
        break;
      }
      case "VoteCast":
      case "VoteCastWithParams": {
        if (!proposalId || !args?.voter) break;
        const voter = String(args.voter).toLowerCase();
        if (!receiptsByProposal.has(proposalId)) {
          receiptsByProposal.set(proposalId, new Map());
        }
        const receipts = receiptsByProposal.get(proposalId)!;
        if (receipts.has(voter)) break;
        receipts.set(voter, {
          id: `${proposalId}-${voter}`,
          voter: { id: voter },
          support: { support: Number(args.support ?? 0) },
          weight: String(args.weight ?? "0"),
          voteCasts: [
            {
              transaction: {
                id: log.transactionHash,
                timestamp: String(log.timestamp),
                blockNumber: log.blockNumber,
              },
            },
          ],
        });
        break;
      }
    }
  }

  const governorContract = web3Store.getCustomContract(
    chainId,
    RethinkFundGovernor.abi as any,
    governorAddress,
  );
  const tokenContract = web3Store.getCustomContract(
    chainId,
    ERC20Votes.abi as any,
    governanceTokenAddress,
  );

  let quorumDenominator = "100";
  try {
    quorumDenominator = String(
      await web3Store.callWithRetry(chainId, () =>
        governorContract.methods.quorumDenominator().call(),
      ),
    );
  } catch (error) {
    console.warn(
      `quorumDenominator failed for governor ${governorAddress}`,
      error,
    );
  }

  // Only proposals need the per-timepoint reads, so a vault with none — the
  // common case on a chain that reaches this tier — costs nothing beyond the
  // one log request and the denominator above.
  const points: Record<string, IOnChainProposalPoints> = {};
  const proposalList = [...proposals.values()];
  for (const proposal of proposalList) {
    proposal.receipts = [
      ...(receiptsByProposal.get(proposal.proposalId)?.values() ?? []),
    ];

    try {
      // proposalSnapshot returns the timepoint in the governor's own clock
      // units, so this is correct in both block-number and timestamp modes.
      const snapshot = await web3Store.callWithRetry(chainId, () =>
        governorContract.methods.proposalSnapshot(proposal.proposalId).call(),
      );
      const quorumNumerator = String(
        await web3Store.callWithRetry(chainId, () =>
          governorContract.methods.quorumNumerator(snapshot).call(),
        ),
      );
      let totalSupply: string;
      try {
        totalSupply = String(
          await web3Store.callWithRetry(chainId, () =>
            tokenContract.methods.getPastTotalSupply(snapshot).call(),
          ),
        );
      } catch {
        // Snapshot still in the future, or a token without checkpoints — the
        // live supply is the closest honest answer.
        totalSupply = String(
          await web3Store.callWithRetry(chainId, () =>
            tokenContract.methods.totalSupply().call(),
          ),
        );
      }
      points[proposal.proposalId] = { quorumNumerator, totalSupply };
    } catch (error) {
      console.warn(
        `Quorum points lookup failed for proposal ${proposal.proposalId}`,
        error,
      );
      points[proposal.proposalId] = { quorumNumerator: "0", totalSupply: "0" };
    }
  }

  return {
    proposals: proposalList as ISubgraphGovernanceProposal[],
    quorumDenominator,
    points,
  };
};
