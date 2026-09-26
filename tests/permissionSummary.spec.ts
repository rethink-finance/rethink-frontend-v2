import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  decodeCoreAction,
  summarizePermission,
  type SummaryContext,
} from "../composables/proposal/permissionSummary";
import type { IPermissionDescription } from "../composables/proposal/describeProposalActions";

const coder = ethers.AbiCoder.defaultAbiCoder();
const word = (type: string, value: unknown) => coder.encode([type], [value]);

const USDC = "0xb88339CB7199b77E23DB6E890353E22632Ba630f";
const PAYOUT = "0x4aAbFCc667Caf17275624044CA0D96fAD11e2571";
const SAFE = "0xB3dca456864678b906854B3d118369C021b0df66";
const SPOKE_POOL = "0x35E63eA3eb0fb7A3bc543C71FB66412e1F6B0E04";
const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const CORE_WRITER = "0x3333333333333333333333333333333333333333";

const inputsOf = (signature: string) => [...ethers.FunctionFragment.from(signature).inputs];

const ctx = (overrides: Partial<SummaryContext> = {}): SummaryContext => ({
  roleName: (role) => (role === "#1" ? "The manager" : `Role ${role?.slice(1)}`),
  label: (address) =>
    ({
      [USDC.toLowerCase()]: "USDC (denomination asset)",
      [SAFE.toLowerCase()]: "Vault Safe",
    })[address.toLowerCase()],
  ...overrides,
});

const scoped = (
  target: string,
  v1Params: IPermissionDescription["v1Params"],
  action: IPermissionDescription["action"] = "scope-function",
): IPermissionDescription => ({
  action,
  tone: "restrict",
  functionName: "scopeFunction",
  role: "#2",
  target,
  selector: "0x00000000",
  executionOption: "plain calls only, no ETH, no delegatecall",
  v1Params,
});

describe("permission summary", () => {
  it("says a pinned transfer in words", () => {
    const summary = summarizePermission(
      scoped(USDC, [{ index: 0, comparison: "must equal", values: [word("address", PAYOUT)] }]),
      ctx({ functionName: "transfer", inputs: inputsOf("transfer(address to, uint256 amount)") }),
    );
    expect(summary?.headline).toBe("Role 2 can send the vault's USDC to one fixed address");
    expect(summary?.lines).toEqual([["Recipient: ", { address: PAYOUT }]]);
    expect(summary?.caution).toBeUndefined();
  });

  it("names the spender of a pinned approval", () => {
    const summary = summarizePermission(
      scoped(USDC, [{ index: 0, comparison: "must equal", values: [word("address", SPOKE_POOL)] }]),
      ctx({ functionName: "approve", inputs: inputsOf("approve(address spender, uint256 amount)") }),
    );
    expect(summary?.headline).toBe("Role 2 can let Across bridge spend the vault's USDC");
  });

  it("reads an Across deposit as a bridge to a named chain", () => {
    const summary = summarizePermission(
      scoped(SPOKE_POOL, [
        { index: 0, comparison: "must equal", values: [word("address", SAFE)] },
        { index: 1, comparison: "must equal", values: [word("address", PAYOUT)] },
        { index: 2, comparison: "must equal", values: [word("address", USDC)] },
        { index: 3, comparison: "must equal", values: [word("address", ARB_USDC)] },
        { index: 6, comparison: "must equal", values: [word("uint256", 42161)] },
        { index: 10, comparison: "must equal", values: ["0x"] },
      ]),
      ctx({
        functionName: "depositV3Now",
        inputs: inputsOf(
          "depositV3Now(address depositor, address recipient, address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 destinationChainId, address exclusiveRelayer, uint32 fillDeadlineOffset, uint32 exclusivityDeadline, bytes message)",
        ),
      }),
    );
    expect(summary?.headline).toBe("Role 2 can bridge USDC with Across to Arbitrum One");
    expect(summary?.lines).toEqual([
      ["Sent from ", { address: SAFE }],
      ["Received by ", { address: PAYOUT }, " on Arbitrum One"],
      ["Arrives as ", { address: ARB_USDC }],
      ["No instructions attached to the transfer"],
    ]);
  });

  it("decodes HyperCore actions and says the list replaces the old one", () => {
    const toPerp = "0x01000007" + coder.encode(["uint64", "bool"], [100n * 10n ** 6n, true]).slice(2);
    const toSpot = "0x01000007" + coder.encode(["uint64", "bool"], [1n * 10n ** 6n, false]).slice(2);
    const agent =
      "0x01000009" + coder.encode(["address", "string"], [PAYOUT, ""]).slice(2);
    const summary = summarizePermission(
      {
        ...scoped(CORE_WRITER, [
          { index: 0, comparison: "must be one of", values: [toPerp, toSpot, agent] },
        ], "scope-parameter"),
        role: "#1",
      },
      ctx({ functionName: "sendRawAction", inputs: inputsOf("sendRawAction(bytes data)") }),
    );
    expect(summary?.headline).toBe(
      "New limits: the manager can send HyperCore instructions, limited to 3 fixed ones",
    );
    expect(summary?.lines).toEqual([
      ["Move USDC from spot to perp, in fixed amounts: 100 USDC"],
      ["Move USDC from perp to spot, in fixed amounts: 1 USDC"],
      ["Register ", { address: PAYOUT }, " as the vault's trading agent"],
      ["Replaces the previous list: anything not listed here is no longer allowed"],
    ]);
  });

  it("decodes a HyperCore send back to HyperEVM", () => {
    const blob =
      "0x0100000d" +
      coder
        .encode(
          ["address", "address", "uint32", "uint32", "uint64", "uint64"],
          ["0x2000000000000000000000000000000000000000", ethers.ZeroAddress, 0xffffffff, 0xffffffff, 0, 500n * 10n ** 8n],
        )
        .slice(2);
    expect(decodeCoreAction(blob)).toMatchObject({ kind: "sendAsset", amount: "500" });
  });

  it("flags a permission that allows delegatecall", () => {
    const summary = summarizePermission(
      {
        ...scoped(USDC, []),
        action: "allow-function",
        executionOption: "may delegatecall",
      },
      ctx({ functionName: "transfer" }),
    );
    expect(summary?.headline).toBe("Role 2 can call transfer on USDC with any arguments");
    expect(summary?.caution).toMatch(/delegatecall/);
  });

  it("falls back to naming each restricted argument", () => {
    const summary = summarizePermission(
      scoped(SAFE, [{ index: 1, comparison: "must be less than", values: [word("uint256", 5000)] }]),
      ctx({ functionName: "withdraw", inputs: inputsOf("withdraw(address to, uint256 amount)") }),
    );
    expect(summary?.headline).toBe("Role 2 can call withdraw on Vault Safe, with limits");
    expect(summary?.lines).toEqual([["Amount: below ", "5000"]]);
  });
});
