import { describe, expect, it } from "vitest";
import { buildFundSlug, parseFundSlug } from "~/composables/routing/fundSlug";
import { ChainId } from "~/types/enums/chain_id";

const ADDRESS = "0x3ffDffEf7FC01483e39db170c80a8e1AF5EB8714";

describe("parseFundSlug", () => {
  it("reads a plain <chain>-<symbol>-<address> slug", () => {
    expect(parseFundSlug(`0xa4b1-TFD3-${ADDRESS}`)).toEqual({
      chainId: ChainId.ARBITRUM,
      symbol: "TFD3",
      address: ADDRESS,
    });
  });

  it("keeps a hyphenated symbol whole and still finds the address", () => {
    expect(parseFundSlug(`0x3e7-OAUBTC-T-${ADDRESS}`)).toEqual({
      chainId: ChainId.HYPEREVM,
      symbol: "OAUBTC-T",
      address: ADDRESS,
    });
    expect(parseFundSlug(`0xa4b1-OA-V2-CANARY-B-${ADDRESS}`)).toMatchObject({
      symbol: "OA-V2-CANARY-B",
      address: ADDRESS,
    });
  });

  it("tolerates an empty symbol", () => {
    expect(parseFundSlug(`0x3e7--${ADDRESS}`)).toEqual({
      chainId: ChainId.HYPEREVM,
      symbol: "",
      address: ADDRESS,
    });
  });

  it("reports no address when the last segment is not one", () => {
    expect(parseFundSlug("0x3e7-OAUBTC-T").address).toBe("");
    expect(parseFundSlug("0x3e7-OAUBTC-T-0x1234").address).toBe("");
    expect(parseFundSlug("0x3e7").address).toBe("");
    expect(parseFundSlug("")).toEqual({ chainId: "", symbol: "", address: "" });
    expect(parseFundSlug(undefined)).toEqual({ chainId: "", symbol: "", address: "" });
  });

  it("round-trips whatever buildFundSlug produced", () => {
    for (const symbol of ["TFD3", "OAUBTC-T", "OA-V2-CANARY-B", ""]) {
      const slug = buildFundSlug(ChainId.HYPEREVM, symbol, ADDRESS);
      expect(parseFundSlug(slug)).toEqual({ chainId: ChainId.HYPEREVM, symbol, address: ADDRESS });
    }
  });
});
