import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import { findActivationProposals } from "../permissions/pendingActivationProposal";
import { UPDATE_SETTINGS_SELECTOR } from "../permissions/rolesV2Permissions";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { ProposalState } from "~/types/enums/governance_proposal";
import type IGovernanceProposal from "~/types/governance_proposal";

// sciETH (Ethereum): the activation proposal created 2026-10-13.
const FUND = "0x2741408077cd7C7D3943D0142bafAE28c97EAA35";
const MODIFIER = "0x02b3bd4bd280ecf97e9ff60f9390b47b750cc8c6";
const SAFE = ethers.getAddress("0xfbf17bff29d7798626e1188272afda107152f070");
const TRANSFER_TO_SAFE =
  "0xf2fde38b000000000000000000000000fbf17bff29d7798626e1188272afda107152f070";
const OTHER = "0x7777777777777777777777777777777777777777";

const fund = new ethers.Interface(GovernableFund.abi as any);
const settingsCall = (governor: string) => {
  const tuple = fund.getFunction("updateSettings")!.inputs[0];
  const zero = (type: string): any => {
    const fixed = type.match(/^(.*)\[(\d+)\]$/);
    if (fixed) return Array.from({ length: Number(fixed[2]) }, () => zero(fixed[1]));
    if (type.endsWith("[]")) return [];
    if (type === "address") return ethers.ZeroAddress;
    if (type === "bool") return false;
    if (type === "string") return "";
    return 0n;
  };
  const settings = Object.fromEntries(
    tuple.components!.map((c) => [c.name, zero(c.type)]),
  );
  settings.governor = governor;
  settings.safe = SAFE;
  return fund.encodeFunctionData("updateSettings", [settings, "{}", 0, 0]);
};

const proposal = (
  state: ProposalState,
  calls: [string, string][],
  createdBlockNumber = 26183936n,
): IGovernanceProposal =>
  ({
    proposalId: String(createdBlockNumber),
    state,
    targets: calls.map(([target]) => target),
    calldatas: calls.map(([, data]) => data),
    createdBlockNumber,
  }) as unknown as IGovernanceProposal;

const vault = { fundAddress: FUND, rolesModifier: MODIFIER, safe: SAFE };

describe("findActivationProposals", () => {
  it("finds sciETH's pending transferOwnership(safe) proposal", () => {
    const pending = proposal(ProposalState.Pending, [[MODIFIER, TRANSFER_TO_SAFE]]);
    expect(findActivationProposals([pending], vault)).toEqual({ ownership: pending });
  });

  it("counts every live state and ignores finished ones", () => {
    for (const state of [ProposalState.Active, ProposalState.Succeeded, ProposalState.Queued]) {
      const live = proposal(state, [[MODIFIER, TRANSFER_TO_SAFE]]);
      expect(findActivationProposals([live], vault).ownership).toBe(live);
    }
    for (const state of [
      ProposalState.Defeated,
      ProposalState.Canceled,
      ProposalState.Expired,
      ProposalState.Executed,
    ]) {
      const done = proposal(state, [[MODIFIER, TRANSFER_TO_SAFE]]);
      expect(findActivationProposals([done], vault)).toEqual({});
    }
  });

  it("needs the right target and the Safe as new owner", () => {
    const wrongTarget = proposal(ProposalState.Active, [[OTHER, TRANSFER_TO_SAFE]]);
    const wrongOwner = proposal(ProposalState.Active, [
      [MODIFIER, "0xf2fde38b" + OTHER.slice(2).padStart(64, "0")],
    ]);
    expect(findActivationProposals([wrongTarget, wrongOwner], vault)).toEqual({});
  });

  it("finds the governor migration, not any updateSettings", () => {
    expect(settingsCall(SAFE).slice(0, 10)).toBe(UPDATE_SETTINGS_SELECTOR);
    const migration = proposal(ProposalState.Active, [
      [FUND, settingsCall(SAFE)],
      [MODIFIER, TRANSFER_TO_SAFE],
    ]);
    const settingsOnly = proposal(ProposalState.Active, [[FUND, settingsCall(OTHER)]]);
    expect(findActivationProposals([settingsOnly], vault)).toEqual({});
    expect(findActivationProposals([migration], vault)).toEqual({
      ownership: migration,
      settings: migration,
    });
  });

  it("links the newest of several live proposals", () => {
    const older = proposal(ProposalState.Active, [[MODIFIER, TRANSFER_TO_SAFE]], 100n);
    const newer = proposal(ProposalState.Pending, [[MODIFIER, TRANSFER_TO_SAFE]], 200n);
    expect(findActivationProposals([older, newer], vault).ownership).toBe(newer);
  });
});
