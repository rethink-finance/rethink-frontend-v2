import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import {
  decodeBitmask,
  describeBitmask,
  describeCorePattern,
  describeCoreWriterRule,
  patternsOf,
} from "~/composables/permissions/coreWriterPatterns";
import { RolesV2Operator, RolesV2ParameterType } from "~/composables/permissions/rolesV2Permissions";
import type { IConditionNode } from "~/composables/proposal/describeProposalActions";

const node = (operator: RolesV2Operator, compValue = "0x", children: IConditionNode[] = [], paramType = RolesV2ParameterType.Dynamic): IConditionNode =>
  ({ index: 0, parent: 0, paramType, operator, compValue, children });
const fromDecimal = (decimal: string) => "0x" + BigInt(decimal).toString(16).padStart(64, "0");
const bitmask = (decimal: string) => node(RolesV2Operator.Bitmask, fromDecimal(decimal));

// The executor role's rule on CoreWriter.sendRawAction, as stored on the
// HyperEVM vault being set up by 0xB5d0…a054 on 2026-10-07 (read off the
// create flow's "Saved on the vault" list).
const OPTION_1 = "1766847064367008190252995990204176220193338569654864888091157212858155008";
const OPTION_2 = [
  "1766847064778384329583297500742918514503448201972543040523815530763649024",
  "28269553036454149273332760011886696251911163391332304310495458472442724352",
  "54772259008129914217082222523030473989322772807359271828865985179790868480",
  "81274964979805679160831685034174251726735031260493556200690078199180165120",
  "107777670951481444104581147545318029464147289713627840572514171218569461760",
  "134280376923157209048330610056461807201559548166762124944338264237958758400",
  "160783082894832973992080072567605584938971806619896414038528839027481640960",
  "187285788866508738935829535078749362676384065073030693687986450276737351680",
  "213788494838184503879578997589893140413796323526164978059882600890147799040",
  "240291200809860268823328460101036918151208581979299262431634636315515944960",
  "266793906781536033767077922612180695549667701507279999212987928963417374720",
];
const liveRule = node(RolesV2Operator.Matches, "0x", [
  node(RolesV2Operator.Or, "0x", [
    bitmask(OPTION_1),
    node(RolesV2Operator.And, "0x", OPTION_2.map(bitmask)),
  ]),
], RolesV2ParameterType.Calldata);

describe("CoreWriter byte rules", () => {
  it("reads a bitmask as byte offsets, not as a number", () => {
    expect(decodeBitmask(fromDecimal(OPTION_1))).toMatchObject({ shift: 0 });
    expect(describeBitmask(fromDecimal(OPTION_1))).toBe("bytes 0–3 must be 0x01000007");
    expect(describeBitmask(fromDecimal(OPTION_2[1]))).toBe("bytes 15–29 must be 0x002000000000000000000000000000");
    expect(describeBitmask(fromDecimal(OPTION_2[10]))).toBe("bytes 150–163 must be 0x0000000000000000000000000000");
  });

  it("turns the live rule back into the two instructions it allows", () => {
    expect(describeCoreWriterRule(liveRule)).toEqual([
      ["Move USDC between spot and perp, any amount"],
      ["Move USDC from HyperCore back to the vault on HyperEVM, any amount"],
    ]);
  });

  it("names fixed amounts, directions and destinations", () => {
    const exact = (hex: string) => patternsOf(node(RolesV2Operator.EqualTo, hex))![0];
    const classTransfer = "0x01000007" + ethers.AbiCoder.defaultAbiCoder().encode(["uint64", "bool"], [100_000_000n, true]).slice(2);
    expect(describeCorePattern(exact(classTransfer))).toEqual(["Move USDC from spot to perp, exactly 100 USDC"]);
    const agent = "0x4aAbFCc667Caf17275624044CA0D96fAD11e2571";
    const register = "0x01000009" + ethers.AbiCoder.defaultAbiCoder().encode(["address", "string"], [agent, ""]).slice(2);
    expect(describeCorePattern(exact(register))).toEqual(["Register ", { address: agent }, " as the vault's trading agent, with further limits (see the exact rule)"]);
  });

  it("says when a send can go anywhere", () => {
    const actionOnly = patternsOf(bitmask(OPTION_2[0]))![0]; // sendAsset id, destination left open
    expect(describeCorePattern(actionOnly)).toEqual(["Send any token to any address on HyperCore, any amount"]);
  });

  it("gives up rather than guess", () => {
    expect(describeCorePattern(new Map())).toBeUndefined();
    expect(patternsOf(node(RolesV2Operator.GreaterThan, "0x01"))).toBeUndefined();
    expect(describeCoreWriterRule(node(RolesV2Operator.Matches, "0x", [node(RolesV2Operator.GreaterThan, "0x01")], RolesV2ParameterType.Calldata))).toBeUndefined();
  });
});
