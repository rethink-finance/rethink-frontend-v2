import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import { CRT, crtAgentName, crtFormatDate, crtInner, crtParseAgentName, crtPickValidUntil, crtWrap } from "~/composables/execution/crtConsole";

const writer = new ethers.Interface(["function sendRawAction(bytes payload)"]);
const roles = new ethers.Interface(["function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,uint16 role,bool shouldRevert)"]);
const payloadOf = (data: string) => writer.decodeFunctionData("sendRawAction", data)[0] as string;
const decodeAddApiWallet = (payload: string) => {
  expect(payload.slice(0, 10)).toBe("0x01000009");
  const [agent, name] = ethers.AbiCoder.defaultAbiCoder().decode(["address", "string"], "0x" + payload.slice(10));
  return { agent: agent as string, name: name as string };
};
const utc = (iso: string) => Date.parse(iso);

describe("CRT agent registrations", () => {
  it("whitelists the 1st of each month, Mar 2027 to Apr 2028, at 00:00 UTC", () => {
    expect(CRT.AGENT_DATES).toHaveLength(14);
    expect(CRT.AGENT_DATES[0]).toBe(utc("2027-03-01T00:00:00Z"));
    expect(CRT.AGENT_DATES.at(-1)).toBe(utc("2028-04-01T00:00:00Z"));
    CRT.AGENT_DATES.forEach((d) => expect(new Date(d).getUTCDate()).toBe(1));
  });

  it("picks the latest whitelisted date no more than 180 days out", () => {
    expect(crtPickValidUntil(utc("2026-10-04T12:00:00Z"))).toBe(utc("2027-04-01T00:00:00Z"));
    expect(crtPickValidUntil(utc("2026-09-28T12:00:00Z"))).toBe(utc("2027-03-01T00:00:00Z"));
    expect(crtPickValidUntil(utc("2027-06-15T00:00:00Z"))).toBe(utc("2027-12-01T00:00:00Z"));
    expect(crtPickValidUntil(utc("2028-04-01T00:00:00Z"))).toBeNull();
    // never more than 180 days, never already expired
    for (let t = utc("2026-10-01T00:00:00Z"); t < utc("2027-10-01T00:00:00Z"); t += 86400000) {
      const d = crtPickValidUntil(t)!;
      expect(d - t).toBeLessThanOrEqual(CRT.AGENT_MAX_VALIDITY_MS);
      expect(d - t).toBeGreaterThanOrEqual(149 * 86400000);
    }
  });

  it("builds the name the way Hyperliquid's app does and reads it back", () => {
    expect(crtAgentName(1806537600000)).toBe("carrot valid_until 1806537600000");
    expect(crtParseAgentName("carrot valid_until 1806537600000")).toEqual({ base: "carrot", validUntil: 1806537600000 });
    expect(crtParseAgentName("")).toEqual({ base: "", validUntil: null });
    expect(crtFormatDate(1806537600000)).toBe("1 Apr 2027");
  });

  it("registers an agent named with a date, or unnamed for 14 days", () => {
    const [primary, backup] = CRT.AGENTS;
    const long = decodeAddApiWallet(payloadOf(crtInner.registerAgent(primary.addr, 1806537600000).data));
    expect(long).toEqual({ agent: primary.addr, name: "carrot valid_until 1806537600000" });
    const short = decodeAddApiWallet(payloadOf(crtInner.registerAgent(backup.addr, null).data));
    expect(short).toEqual({ agent: backup.addr, name: "" });
    expect(crtInner.registerAgent(primary.addr, 1806537600000).to).toBe(CRT.ADDR.coreWriter);
  });

  it("removes a slot by approving the zero address in it", () => {
    expect(decodeAddApiWallet(payloadOf(crtInner.removeAgent(true).data))).toEqual({ agent: ethers.ZeroAddress, name: "carrot" });
    expect(decodeAddApiWallet(payloadOf(crtInner.removeAgent(false).data))).toEqual({ agent: ethers.ZeroAddress, name: "" });
  });

  it("sends registrations through role 1", () => {
    const [to, value, data, operation, role, shouldRevert] = roles.decodeFunctionData("execTransactionWithRole", crtWrap(crtInner.removeAgent(true), 1).data);
    expect([to.toLowerCase(), value, operation, role, shouldRevert]).toEqual([CRT.ADDR.coreWriter, 0n, 0n, 1n, true]);
    expect(decodeAddApiWallet(payloadOf(data)).name).toBe("carrot");
  });
});
