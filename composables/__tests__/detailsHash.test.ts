import { it, expect, describe } from "vitest"
import { ethers } from "ethers";
import {
  formattedCleanedNavMethodDetailsJson,
} from "~/composables/__tests__/mock_data/mockNavData";


describe("detailsHash", () => {
  it("should handle actual NAV method details", () => {
    const detailsHash = ethers.keccak256(ethers.toUtf8Bytes(formattedCleanedNavMethodDetailsJson))
    expect(detailsHash).toEqual("0x32199c62c2169aa36ae0150d34aa517946aca4f2412cd37e24eda51632f80cee");
    expect(1).toEqual(1);
  });
});
