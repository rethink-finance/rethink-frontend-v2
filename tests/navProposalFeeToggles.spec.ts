import { describe, expect, it } from "vitest";
import {
  SAFE_IFACE,
  wrapProposalThroughSafe,
} from "../composables/governance/safeExecution";
import { getNavMethodsProposalData } from "../composables/nav/navProposal";

// The NAV proposal page's three fee switches feed getNavMethodsProposalData
// (deposit, management, performance). On a Roles v1 vault the calls go to the
// vault as they are; on an activated Roles v2 vault (settings.governor == the
// Safe) every call is wrapped through Safe.execTransaction. The switches must
// give the same set of calls in both shapes.
const FUND = "0x533f164d91e3F8169a7043f7094f44af87Fb7CA4";
const EXECUTOR = "0x5FA5a70A3A143E3F7B8906cbc08CAd606E4622b3";
const SAFE = "0x30Fe6826a683B154703BbcAD1BCCAa1D32B0F674";
const GOVERNOR = "0xC44711C4C4DA6B94e9079f8a24203b1904303826";
const UPDATE_NAV = "0x93a1de3f" + "ab".repeat(96);

const COLLECT_FEES = "0xe9ae21ea";
const feeCall = (feeType: number) => COLLECT_FEES + feeType.toString(16).padStart(64, "0");

const selectors = (calldatas: string[]) => calldatas.map((c) => c.slice(0, 10));

describe("NAV proposal fee switches", () => {
  it("the defaults (deposit on, management off, performance on) give the calls every proposal used to carry", () => {
    const data = getNavMethodsProposalData(UPDATE_NAV, FUND, true, false, true, EXECUTOR);
    expect(data.targets).toEqual([FUND, EXECUTOR, FUND, FUND]);
    expect(data.calldatas[0]).toBe(UPDATE_NAV);
    expect(data.calldatas[1].startsWith("0xc8361853")).toBe(true);
    expect(data.calldatas.slice(2)).toEqual([feeCall(0), feeCall(3)]);
  });

  it("all three off leaves only the methods update and the executor copy", () => {
    const data = getNavMethodsProposalData(UPDATE_NAV, FUND, false, false, false, EXECUTOR);
    expect(data.targets).toEqual([FUND, EXECUTOR]);
    expect(selectors(data.calldatas)).toEqual(["0x93a1de3f", "0xc8361853"]);
  });

  it("all three on collects deposit, management and performance fees in that order", () => {
    const data = getNavMethodsProposalData(UPDATE_NAV, FUND, true, true, true, EXECUTOR);
    expect(data.targets).toEqual([FUND, EXECUTOR, FUND, FUND, FUND]);
    expect(data.calldatas.slice(2)).toEqual([feeCall(0), feeCall(2), feeCall(3)]);
  });

  it("each switch adds exactly its own call", () => {
    const only = (deposit: boolean, management: boolean, performance: boolean) =>
      getNavMethodsProposalData(UPDATE_NAV, FUND, deposit, management, performance, EXECUTOR)
        .calldatas.slice(2);
    expect(only(true, false, false)).toEqual([feeCall(0)]);
    expect(only(false, true, false)).toEqual([feeCall(2)]);
    expect(only(false, false, true)).toEqual([feeCall(3)]);
  });

  it("Roles v2 (activated): the same calls, each wrapped through the Safe with its target and data intact", () => {
    const direct = getNavMethodsProposalData(UPDATE_NAV, FUND, true, false, true, EXECUTOR);
    const wrapped = wrapProposalThroughSafe(direct, SAFE, GOVERNOR);

    expect(wrapped.targets).toEqual(direct.targets.map(() => SAFE));
    expect(wrapped.calldatas).toHaveLength(direct.calldatas.length);
    wrapped.calldatas.forEach((calldata, i) => {
      const inner = SAFE_IFACE.parseTransaction({ data: calldata })!;
      expect(inner.name).toBe("execTransaction");
      expect(String(inner.args[0]).toLowerCase()).toBe(direct.targets[i].toLowerCase());
      expect(String(inner.args[2]).toLowerCase()).toBe(direct.calldatas[i].toLowerCase());
    });
    // the two fee collections survive the wrapping as collectFees(0) and collectFees(3)
    const innerFees = wrapped.calldatas
      .slice(2)
      .map((c) => String(SAFE_IFACE.parseTransaction({ data: c })!.args[2]));
    expect(innerFees).toEqual([feeCall(0), feeCall(3)]);
  });

  it("Roles v2 (activated): switching every fee off wraps only the two NAV calls", () => {
    const wrapped = wrapProposalThroughSafe(
      getNavMethodsProposalData(UPDATE_NAV, FUND, false, false, false, EXECUTOR),
      SAFE,
      GOVERNOR,
    );
    expect(wrapped.calldatas).toHaveLength(2);
    const innerSelectors = wrapped.calldatas.map((c) =>
      String(SAFE_IFACE.parseTransaction({ data: c })!.args[2]).slice(0, 10),
    );
    expect(innerSelectors).toEqual(["0x93a1de3f", "0xc8361853"]);
  });
});
