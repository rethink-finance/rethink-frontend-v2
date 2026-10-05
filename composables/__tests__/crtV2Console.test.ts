import { describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";
import {
  CRT_V2, EXEC_WITH_ROLE_SELECTOR, crtV2AcrossQuote, crtV2AgentName, crtV2Inner, crtV2ParseAgentName, crtV2SafeBatch,
  crtV2ValidUntil, crtV2Wrap, usdc6,
} from "~/composables/execution/crtV2Console";
import { CRT_V2_ADDR, CRT_V2_ROLE_KEYS } from "~/composables/execution/crtV2Vault";
import { unpackMultiSend } from "~/composables/proposal/describeProposalActions";

const rolesIface = new ethers.Interface(["function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,bytes32 roleKey,bool shouldRevert)", "function assignRoles(address module,bytes32[] roleKeys,bool[] memberOf)"]);
const multiSendIface = new ethers.Interface(["function multiSend(bytes transactions)"]);
const writerIface = new ethers.Interface(["function sendRawAction(bytes payload)"]);
const coder = ethers.AbiCoder.defaultAbiCoder();

describe("CRT v2 console builders", () => {
  it("wraps under the bytes32 role key with shouldRevert", () => {
    const wrapped = crtV2Wrap(crtV2Inner.payout("2000"), "admin");
    expect(wrapped.to).toBe(CRT_V2_ADDR.roles);
    expect(wrapped.data.startsWith(EXEC_WITH_ROLE_SELECTOR)).toBe(true);
    const [to, value, data, operation, roleKey, shouldRevert] = rolesIface.decodeFunctionData("execTransactionWithRole", wrapped.data);
    expect(to.toLowerCase()).toBe(CRT_V2_ADDR.usdc.toLowerCase());
    expect(value).toBe(0n);
    expect(data).toBe(wrapped.inner.data);
    expect(operation).toBe(0n);
    expect(roleKey).toBe(CRT_V2_ROLE_KEYS.admin);
    expect(shouldRevert).toBe(true);
    expect(crtV2Wrap(crtV2Inner.usdClassTransfer("1", true), "executor").data).toContain(CRT_V2_ROLE_KEYS.executor.slice(2));
  });

  it("moves any amount spot ↔ perp to the micro-USDC and Core → EVM in 1e8", () => {
    const [payload] = writerIface.decodeFunctionData("sendRawAction", crtV2Inner.usdClassTransfer("12345.678901", false).data);
    expect(payload.slice(0, 10)).toBe("0x01000007");
    const [ntl, toPerp] = coder.decode(["uint64", "bool"], "0x" + payload.slice(10));
    expect(ntl).toBe(12345678901n);
    expect(toPerp).toBe(false);
    const [sa] = writerIface.decodeFunctionData("sendRawAction", crtV2Inner.sendAssetToEvm("250.5").data);
    expect(sa.slice(0, 10)).toBe("0x0100000d");
    const fields = coder.decode(["address", "address", "uint32", "uint32", "uint64", "uint64"], "0x" + sa.slice(10));
    expect(fields[0].toLowerCase()).toBe(CRT_V2_ADDR.coreBridge);
    expect(fields[5]).toBe(25050000000n);
  });

  it("registers an agent for 14–180 days under the carrot name and removes by slot name", () => {
    const now = 1_800_000_000_000;
    expect(crtV2ValidUntil(180, now)).toBe(now + 180 * 86400000);
    expect(() => crtV2ValidUntil(13, now)).toThrow();
    expect(() => crtV2ValidUntil(181, now)).toThrow();
    expect(() => crtV2ValidUntil(30.5, now)).toThrow();
    const inner = crtV2Inner.registerAgent(CRT_V2_ADDR.payout, 90, now);
    const [payload] = writerIface.decodeFunctionData("sendRawAction", inner.data);
    expect(payload.slice(0, 10)).toBe("0x01000009");
    const [agent, name] = coder.decode(["address", "string"], "0x" + payload.slice(10));
    expect(agent).toBe(CRT_V2_ADDR.payout);
    expect(name).toBe(crtV2AgentName(now + 90 * 86400000));
    expect(crtV2ParseAgentName(name)).toEqual({ base: CRT_V2.AGENT.name, validUntil: now + 90 * 86400000 });
    const [rm] = writerIface.decodeFunctionData("sendRawAction", crtV2Inner.removeAgent("carrot").data);
    const [zero, slot] = coder.decode(["address", "string"], "0x" + rm.slice(10));
    expect(zero).toBe(ethers.ZeroAddress);
    expect(slot).toBe("carrot");
  });

  it("changes membership of one role at a time", () => {
    const inner = crtV2Inner.assignRole(CRT_V2_ADDR.executor, "executor", false);
    expect(inner.to).toBe(CRT_V2_ADDR.roles);
    const [module, keys, memberOf] = rolesIface.decodeFunctionData("assignRoles", inner.data);
    expect(module).toBe(CRT_V2_ADDR.executor);
    expect([...keys]).toEqual([CRT_V2_ROLE_KEYS.executor]);
    expect([...memberOf]).toEqual([false]);
  });

  it("batches several role calls as one MultiSendCallOnly delegatecall for the admin Safe", () => {
    const steps = [crtV2Wrap(crtV2Inner.approve(CRT_V2_ADDR.spokePool, "Across SpokePool", "1000"), "admin"), crtV2Wrap(crtV2Inner.acrossDeposit("1000", 999500000n), "admin")];
    const call = crtV2SafeBatch(steps);
    expect(call.to).toBe(CRT_V2_ADDR.multiSendCallOnly);
    expect(call.operation).toBe(1);
    expect(call.value).toBe("0");
    const [transactions] = multiSendIface.decodeFunctionData("multiSend", call.data);
    const back = unpackMultiSend(transactions);
    expect(back).toHaveLength(2);
    expect(back.every((c) => c.operation === 0 && c.to.toLowerCase() === CRT_V2_ADDR.roles.toLowerCase())).toBe(true);
    expect(back.map((c) => c.data)).toEqual(steps.map((s) => s.data));
    const single = crtV2SafeBatch([steps[0]]);
    expect(single).toEqual({ to: steps[0].to, data: steps[0].data, value: "0", operation: 0 });
  });

  it("pins the Across deposit to the new Safe and the payout wallet", () => {
    const spoke = new ethers.Interface(["function depositV3Now(address depositor,address recipient,address inputToken,address outputToken,uint256 inputAmount,uint256 outputAmount,uint256 destinationChainId,address exclusiveRelayer,uint32 fillDeadlineOffset,uint32 exclusivityPeriod,bytes message)"]);
    const d = spoke.decodeFunctionData("depositV3Now", crtV2Inner.acrossDeposit("2000", 1999500000n).data);
    expect(d.depositor).toBe(CRT_V2_ADDR.safe);
    expect(d.recipient).toBe(CRT_V2_ADDR.payout);
    expect(d.inputAmount).toBe(usdc6("2000"));
    expect(d.destinationChainId).toBe(42161n);
    expect(d.message).toBe("0x");
  });

  it("reserves twice the quoted relayer fee, floored at 0.25 USDC, quoting from the new Safe", async () => {
    const fetchMock = vi.fn((url: string) => {
      expect(url).toContain(`depositor=${CRT_V2_ADDR.safe}`);
      expect(url).toContain(`recipient=${CRT_V2_ADDR.payout}`);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ totalRelayFee: { total: "207665" }, limits: { minDeposit: "500061" } }) } as any);
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const q = await crtV2AcrossQuote(usdc6("2000"));
      expect(q.reserve).toBe(415330n);
      expect(q.outputAmount).toBe(2000000000n - 415330n);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
