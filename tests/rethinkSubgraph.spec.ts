import { describe, expect, it } from "vitest";
import {
  MAX_SUBGRAPH_LAG_SECONDS,
  isIndexedBlockFresh,
} from "../services/subgraph/freshness";
import {
  RethinkSubgraphEndpoints,
  RethinkSubgraphSlugs,
  SUBGRAPH_FLOW_COVERAGE,
  hasRethinkSubgraph,
} from "../types/enums/subgraph";

const HYPEREVM = "0x3e7";

describe("Rethink subgraph per chain", () => {
  it("HyperEVM has one, on Goldsky under the prod tag", () => {
    expect(hasRethinkSubgraph(HYPEREVM)).toBe(true);
    expect(RethinkSubgraphSlugs[HYPEREVM]).toBeUndefined();
    expect(RethinkSubgraphEndpoints[HYPEREVM]).toMatch(
      /^https:\/\/api\.goldsky\.com\/.+\/subgraphs\/rethinkfinance-hyperevm\/prod\/gn$/,
    );
  });

  it("the Studio chains still resolve by slug", () => {
    for (const chainId of ["0x1", "0xa4b1", "0x89", "0x2105"]) {
      expect(hasRethinkSubgraph(chainId)).toBe(true);
      expect(RethinkSubgraphEndpoints[chainId]).toBeUndefined();
    }
  });

  it("a chain with neither has none", () => {
    expect(hasRethinkSubgraph("0x539")).toBe(false);
  });

  it("HyperEVM flows still need the explorer: its index cannot see requests", () => {
    expect(SUBGRAPH_FLOW_COVERAGE.has(HYPEREVM)).toBe(false);
  });
});

describe("isIndexedBlockFresh", () => {
  const now = 1_800_000_000;

  it("accepts an index at or within the allowed lag", () => {
    expect(isIndexedBlockFresh(now - 12, now)).toBe(true);
    expect(isIndexedBlockFresh(now - MAX_SUBGRAPH_LAG_SECONDS, now)).toBe(true);
  });

  it("rejects an index further behind than that", () => {
    expect(isIndexedBlockFresh(now - MAX_SUBGRAPH_LAG_SECONDS - 1, now)).toBe(false);
    // A syncing deployment years behind the chain.
    expect(isIndexedBlockFresh(1_702_528_876, now)).toBe(false);
  });

  it("reads an unknown time as stale, never as fresh", () => {
    expect(isIndexedBlockFresh(null, now)).toBe(false);
    expect(isIndexedBlockFresh(undefined, now)).toBe(false);
    expect(isIndexedBlockFresh(0, now)).toBe(false);
  });
});
