import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import {
  STORE_NAV_DATA_SELECTOR,
  findNavCopySource,
  innerNavCalldata,
} from "../composables/proposal/navExecutorCopy";

const FUND = "0x533f164d91e3F8169a7043f7094f44af87Fb7CA4";
const UPDATE_NAV = "0x93a1de3f" + "ab".repeat(70);
const OTHER_NAV = "0x93a1de3f" + "cd".repeat(70);
const COLLECT_FEES = "0xe9ae21ea" + "00".repeat(31) + "03";

const storeNavData = (fund: string, data: string) =>
  STORE_NAV_DATA_SELECTOR +
  ethers.AbiCoder.defaultAbiCoder().encode(["address", "bytes"], [fund, data]).slice(2);

describe("NAV executor copy detection", () => {
  it("extracts the updateNav bytes a storeNAVData call carries", () => {
    expect(innerNavCalldata(storeNavData(FUND, UPDATE_NAV))).toBe(UPDATE_NAV.toLowerCase());
  });

  it("answers null for anything that is not storeNAVData", () => {
    expect(innerNavCalldata(UPDATE_NAV)).toBeNull();
    expect(innerNavCalldata(COLLECT_FEES)).toBeNull();
    expect(innerNavCalldata("")).toBeNull();
    expect(innerNavCalldata(STORE_NAV_DATA_SELECTOR + "1234")).toBeNull();
  });

  it("finds the updateNav call whose bytes the copy repeats, wherever it sits", () => {
    const calldatas = [UPDATE_NAV, storeNavData(FUND, UPDATE_NAV), COLLECT_FEES];
    expect(findNavCopySource(calldatas, 1)).toBe(0);
    expect(findNavCopySource([storeNavData(FUND, UPDATE_NAV), COLLECT_FEES, UPDATE_NAV], 0)).toBe(2);
  });

  it("does not pair a copy with a different method list, and ignores non-copies", () => {
    expect(findNavCopySource([OTHER_NAV, storeNavData(FUND, UPDATE_NAV)], 1)).toBe(-1);
    expect(findNavCopySource([storeNavData(FUND, UPDATE_NAV), COLLECT_FEES], 0)).toBe(-1);
    expect(findNavCopySource([UPDATE_NAV, COLLECT_FEES], 0)).toBe(-1);
  });
});
