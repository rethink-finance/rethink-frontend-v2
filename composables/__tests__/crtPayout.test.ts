import { describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";
import { CRT, crtAcrossQuote, crtInner, crtPackMultiSend, crtWrapBatch, usdc6 } from "~/composables/execution/crtConsole";
import { unpackMultiSend } from "~/composables/proposal/describeProposalActions";

const rolesIface = new ethers.Interface(["function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,uint16 role,bool shouldRevert)"]);
const multiSendIface = new ethers.Interface(["function multiSend(bytes transactions)"]);
const spokeIface = new ethers.Interface(["function depositV3Now(address depositor,address recipient,address inputToken,address outputToken,uint256 inputAmount,uint256 outputAmount,uint256 destinationChainId,address exclusiveRelayer,uint32 fillDeadlineOffset,uint32 exclusivityPeriod,bytes message)"]);
const erc20Iface = new ethers.Interface(["function approve(address spender,uint256 amount)", "function transfer(address to,uint256 amount)"]);

describe("CRT payout builders", () => {
  it("pays the new payout wallet on HyperEVM", () => {
    const inner = crtInner.payout("2000");
    const [to, amount] = erc20Iface.decodeFunctionData("transfer", inner.data);
    expect(to).toBe(CRT.ADDR.payout);
    expect(amount).toBe(2000000000n);
    expect(inner.to).toBe(CRT.ADDR.usdc);
  });

  it("packs a MultiSend batch that the app's unpacker reads back", () => {
    const calls = [crtInner.approve(CRT.ADDR.spokePool, "Across SpokePool", "1000"), crtInner.acrossDeposit("1000", 999500000n)];
    const packed = crtPackMultiSend(calls.map((c) => ({ to: c.to, data: c.data })));
    const back = unpackMultiSend(packed);
    expect(back).toHaveLength(2);
    expect(back.map((c) => c.operation)).toEqual([0, 0]);
    expect(back.map((c) => c.to.toLowerCase())).toEqual(calls.map((c) => c.to.toLowerCase()));
    expect(back.map((c) => c.data)).toEqual(calls.map((c) => c.data));
    expect(back.map((c) => c.value)).toEqual(["0", "0"]);
  });

  it("wraps the batch as a role-2 delegatecall to the modifier's MultiSend", () => {
    const calls = [crtInner.approve(CRT.ADDR.spokePool, "Across SpokePool", "1000"), crtInner.acrossDeposit("1000", 999500000n)];
    const wrapped = crtWrapBatch(calls, 2);
    expect(wrapped.to).toBe(CRT.ADDR.roles);
    expect(wrapped.data.startsWith("0x6928e74b")).toBe(true);
    const [to, value, data, operation, role, shouldRevert] = rolesIface.decodeFunctionData("execTransactionWithRole", wrapped.data);
    expect(to.toLowerCase()).toBe(CRT.ADDR.multisend.toLowerCase());
    expect(value).toBe(0n);
    expect(operation).toBe(1n);
    expect(role).toBe(2n);
    expect(shouldRevert).toBe(true);
    const [transactions] = multiSendIface.decodeFunctionData("multiSend", data);
    expect(unpackMultiSend(transactions)).toHaveLength(2);
    expect(wrapped.batch).toHaveLength(2);
    expect(wrapped.inner.params.map((p) => p.k)[0]).toBe("1 · spender");
  });

  it("pins every whitelisted depositV3Now argument and leaves only amounts and the fill window open", () => {
    const inner = crtInner.acrossDeposit("2000", 1999500000n);
    const d = spokeIface.decodeFunctionData("depositV3Now", inner.data);
    expect(d.depositor.toLowerCase()).toBe(CRT.ADDR.safe.toLowerCase());
    expect(d.recipient).toBe(CRT.ADDR.payout);
    expect(d.inputToken.toLowerCase()).toBe(CRT.ADDR.usdc.toLowerCase());
    expect(d.outputToken).toBe(CRT.ADDR.arbUsdc);
    expect(d.inputAmount).toBe(2000000000n);
    expect(d.outputAmount).toBe(1999500000n);
    expect(d.destinationChainId).toBe(42161n);
    expect(d.exclusiveRelayer).toBe(ethers.ZeroAddress);
    expect(d.fillDeadlineOffset).toBe(BigInt(CRT.ACROSS.FILL_DEADLINE_OFFSET));
    expect(d.exclusivityPeriod).toBe(0n);
    expect(d.message).toBe("0x");
    expect(inner.params.filter((p) => p.pinned).map((p) => p.k)).toEqual(["depositor (refunds)", "recipient", "inputToken", "outputToken", "destinationChainId", "message"]);
  });

  it("reserves twice the quoted relayer fee, floored at 0.25 USDC", async () => {
    const reply = (ok: boolean, body: any) => Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as any);
    const fetchMock = vi.fn((url: string) => {
      expect(url).toContain("originChainId=999");
      expect(url).toContain("destinationChainId=42161");
      expect(url).toContain(`recipient=${CRT.ADDR.payout}`);
      return reply(true, { totalRelayFee: { total: "207665" }, limits: { minDeposit: "500061", maxDeposit: "502580796257" }, estimatedFillTimeSec: 3, timestamp: "1790379059" });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const big = await crtAcrossQuote(usdc6("2000"));
      expect(big.fee).toBe(207665n);
      expect(big.reserve).toBe(415330n);
      expect(big.outputAmount).toBe(2000000000n - 415330n);
      expect(big.minDeposit).toBe(500061n);
      fetchMock.mockImplementationOnce(() => reply(true, { totalRelayFee: { total: "9000" }, limits: {} }));
      const small = await crtAcrossQuote(usdc6("100"));
      expect(small.reserve).toBe(250000n);
      expect(small.outputAmount).toBe(100000000n - 250000n);
      fetchMock.mockImplementationOnce(() => reply(false, { message: "Sent amount is too low" }));
      await expect(crtAcrossQuote(1n)).rejects.toThrow("Sent amount is too low");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
