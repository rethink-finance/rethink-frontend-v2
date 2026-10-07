import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProposalSlug, parseProposalSlug } from "../composables/governance/proposalSlug";
import { fetchOpenVotes } from "../composables/portfolioAttention";
import type IFund from "../types/fund";

const backend = vi.hoisted(() => ({ fetchBackendProposals: vi.fn() }));
const subgraph = vi.hoisted(() => ({ fetchSubgraphGovernorProposals: vi.fn() }));

vi.mock("~/services/backend/governance", () => backend);
vi.mock("~/services/subgraph", () => subgraph);
// Deadlines below are unix seconds, so the block-dating store is never reached.
vi.mock("~/store/web3/blockTime.store", () => ({ useBlockTimeStore: vi.fn() }));
vi.mock("~/store/web3/web3.store", () => ({ useWeb3Store: vi.fn() }));

const WALLET = "0x2023B43B9CfC2377EbB20886dcA2603d9d7c41B0";
const future = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
const past = Math.floor(Date.now() / 1000) - 24 * 3600;

const fund = (chainId: string) =>
  ({
    chainId,
    address: "0x533f164d91e3F8169a7043f7094f44af87Fb7CA4",
    governorAddress: "0x89883158f9d95991232a7520b1763e4b4d08b4EB",
  }) as unknown as IFund;

/** A proposal in the backend snapshot's (subgraph-shaped) form. */
const backendProposal = (
  proposalId: string,
  overrides: Record<string, unknown> = {},
) => ({
  proposalId,
  description: JSON.stringify({ title: `Proposal ${proposalId}` }),
  voteEnd: String(future),
  proposalCreated: [{ transaction: { blockNumber: "51793556" } }],
  proposalCanceled: [],
  proposalExecuted: [],
  proposalQueued: [],
  receipts: [],
  ...overrides,
});

beforeEach(() => {
  backend.fetchBackendProposals.mockReset();
  subgraph.fetchSubgraphGovernorProposals.mockReset();
});

describe("proposal slug", () => {
  it("reads the id from the app's block-prefixed slug", () => {
    expect(parseProposalSlug("51793556-6282311700")).toBe("6282311700");
  });

  it("reads a bare id, as notification links carry it", () => {
    expect(parseProposalSlug("6282311700")).toBe("6282311700");
  });

  it("builds the block-prefixed form when the block is known", () => {
    expect(buildProposalSlug("6282311700", "51793556")).toBe("51793556-6282311700");
    expect(buildProposalSlug("6282311700")).toBe("6282311700");
  });
});

describe("open votes", () => {
  it("lists open proposals from the backend index the wallet has not voted on", async () => {
    backend.fetchBackendProposals.mockResolvedValue({
      proposals: [
        backendProposal("1"),
        backendProposal("2", { receipts: [{ voter: { id: WALLET.toLowerCase() } }] }),
        backendProposal("3", { proposalExecuted: [{}] }),
        backendProposal("4", { proposalCanceled: [{}] }),
        backendProposal("5", { voteEnd: String(past) }),
      ],
    });

    const votes = await fetchOpenVotes(fund("0x2105"), WALLET);

    expect(votes.map((vote) => vote.proposalId)).toEqual(["1"]);
    expect(votes[0]).toMatchObject({
      title: "Proposal 1",
      createdBlockNumber: "51793556",
      endsAt: future * 1000,
    });
    expect(subgraph.fetchSubgraphGovernorProposals).not.toHaveBeenCalled();
  });

  it("falls back to the subgraph when the backend has no snapshot", async () => {
    backend.fetchBackendProposals.mockResolvedValue(null);
    subgraph.fetchSubgraphGovernorProposals.mockResolvedValue([
      {
        proposalId: "7",
        description: "plain text",
        voteEnd: String(future),
        canceled: false,
        executed: false,
        queued: false,
        proposalCreated: [{ transaction: { blockNumber: "100" } }],
        receipts: [],
      },
    ]);

    const votes = await fetchOpenVotes(fund("0x2105"), WALLET);

    expect(votes).toEqual([
      { proposalId: "7", createdBlockNumber: "100", title: "plain text", endsAt: future * 1000 },
    ]);
  });

  it("reads the backend index even for a vault listed without its governor", async () => {
    // The portfolio's vaults come from the Discover list, which leaves
    // governorAddress empty; that used to hide every vote.
    backend.fetchBackendProposals.mockResolvedValue({ proposals: [backendProposal("1")] });

    const votes = await fetchOpenVotes(
      { ...fund("0x2105"), governorAddress: "" } as IFund,
      WALLET,
    );

    expect(votes.map((vote) => vote.proposalId)).toEqual(["1"]);
  });

  it("stays quiet on a chain with neither source", async () => {
    backend.fetchBackendProposals.mockResolvedValue(null);

    expect(await fetchOpenVotes(fund("0x539"), WALLET)).toEqual([]);
    expect(subgraph.fetchSubgraphGovernorProposals).not.toHaveBeenCalled();
  });

  it("asks the HyperEVM subgraph when the backend has nothing", async () => {
    backend.fetchBackendProposals.mockResolvedValue(null);
    subgraph.fetchSubgraphGovernorProposals.mockResolvedValue([
      {
        proposalId: "3",
        description: "plain text",
        voteEnd: String(future),
        proposalCreated: [{ transaction: { blockNumber: "47000000" } }],
        receipts: [],
      },
    ]);

    const votes = await fetchOpenVotes(fund("0x3e7"), WALLET);

    expect(subgraph.fetchSubgraphGovernorProposals).toHaveBeenCalledWith("0x3e7", {
      governorAddress: "0x89883158f9d95991232a7520b1763e4b4d08b4eb",
    });
    expect(votes.map((vote) => vote.proposalId)).toEqual(["3"]);
  });
});
