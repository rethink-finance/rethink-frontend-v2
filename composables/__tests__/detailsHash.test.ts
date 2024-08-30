import { it, expect, describe } from "vitest"
import { ethers } from "ethers";
import {
  formattedCleanedNavMethodDetailsJson,
} from "~/composables/__tests__/mock_data/mockNavData";


describe("detailsHash", () => {
  it("should handle actual NAV method details", () => {
    const detailsHash = ethers.keccak256(ethers.toUtf8Bytes(formattedCleanedNavMethodDetailsJson))
    expect(detailsHash).toEqual("0x18d74cdfe5c85776c280403b928e4e3c99957d8ca9356ac46592c35b499ca49e");
    expect(1).toEqual(1);
  });
});
