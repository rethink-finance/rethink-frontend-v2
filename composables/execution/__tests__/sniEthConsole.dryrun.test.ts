import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { PERIPHERIES, SNI, fetchAcrossQuote, sniCalls, validateBridge } from "../sniEthConsole";
import type { IRoleCall } from "~/composables/permissions/useRoleExecution";

/**
 * Rehearsal on current mainnet state, off by default (it needs the network):
 *
 *   SNI_DRY_RUN=1 npx vitest run composables/execution/__tests__/sniEthConsole.dryrun.test.ts
 *
 * Nothing is sent. Each case is one eth_simulateV1 bundle on the latest block:
 * a role-1 member claims the rewards through the real Roles v1 modifier, then
 * bridges the Safe's ETH with a live Across quote — through each of the three
 * scoped peripheries. Also checked: a non-member is refused, and the modifier
 * on its own would accept a hostile spokePool (which is why the console pins it).
 */
const RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org", "https://1rpc.io/eth"];
const rpc = async (method: string, params: unknown[]): Promise<any> => {
  const errors: string[] = [];
  for (const url of RPCS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await response.json();
      if (json.error) {
        errors.push(`${url}: ${JSON.stringify(json.error).slice(0, 300)}`);
        continue;
      }
      return json.result;
    } catch (error: any) {
      errors.push(`${url}: ${error?.message}`);
    }
  }
  throw new Error(errors.join(" | "));
};

const A = SNI.ADDR;
const MEMBER = "0xf0d92E2B30A2c99ef515A02Cd28EfF8d21B42F9F";
const STRANGER = "0x000000000000000000000000000000000000bEEF";
const roles = new ethers.Interface([
  "function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,uint16 role,bool shouldRevert)",
]);
const wrap = (from: string, call: IRoleCall) => ({
  from,
  to: A.roles,
  data: roles.encodeFunctionData("execTransactionWithRole", [call.to, call.value ?? "0", call.data, 0, SNI.ROLE, true]),
  gas: ethers.toQuantity(1_000_000),
});

const simulate = async (calls: ReturnType<typeof wrap>[]) => {
  const result = await rpc("eth_simulateV1", [
    {
      blockStateCalls: [{ calls, stateOverrides: { [MEMBER]: { balance: ethers.toQuantity(10n ** 18n) }, [STRANGER]: { balance: ethers.toQuantity(10n ** 18n) } } }],
      validation: false,
    },
    "latest",
  ]);
  return result[0].calls as { status: string; gasUsed: string; error?: { message: string } }[];
};

const balance = async (address: string) => BigInt(await rpc("eth_getBalance", [address, "latest"]));
const claimable = async () =>
  BigInt(
    await rpc("eth_call", [
      { to: A.stakingVault, data: new ethers.Interface(["function claimableRewards()"]).encodeFunctionData("claimableRewards") },
      "latest",
    ]),
  );

describe.runIf(process.env.SNI_DRY_RUN)("sniETH claim + bridge on live mainnet state", () => {
  it.each(PERIPHERIES)("member claims, then bridges via $address", async (periphery) => {
    const amount = (await balance(A.safe)) + (await claimable());
    expect(amount).toBeGreaterThan(SNI.MIN_CLAIM);
    const quote = await fetchAcrossQuote(amount);
    const bridge = sniCalls.bridge(periphery, quote);
    expect(validateBridge(bridge)).toEqual([]);

    const [claim, deposit] = await simulate([wrap(MEMBER, sniCalls.claim()), wrap(MEMBER, bridge)]);
    console.log(periphery.address, "claim", claim.status, Number(claim.gasUsed), "bridge", deposit.status, Number(deposit.gasUsed), deposit.error?.message ?? "");
    expect(claim.status).toBe("0x1");
    expect(deposit.status).toBe("0x1");
  }, 60_000);

  it("refuses a wallet without role 1", async () => {
    const [claim] = await simulate([wrap(STRANGER, sniCalls.claim())]);
    expect(claim.status).toBe("0x0");
  }, 60_000);

  it("the modifier alone would accept a hostile spokePool — the console must refuse it", async () => {
    const amount = (await balance(A.safe)) + (await claimable());
    const quote = await fetchAcrossQuote(amount);
    const bridge = sniCalls.bridge(PERIPHERIES[0], quote);
    const evil = { ...bridge, data: bridge.data.replace(A.spokePool.slice(2).toLowerCase(), STRANGER.slice(2).toLowerCase()) };
    expect(validateBridge(evil).join(" ")).toMatch(/spokePool/);
    // Logged, not asserted: an EOA spokePool reverts in the periphery, a contract one would take the ETH.
    const [, deposit] = await simulate([wrap(MEMBER, sniCalls.claim()), wrap(MEMBER, evil)]);
    console.log("hostile spokePool through the modifier:", deposit.status, deposit.error?.message ?? "");
  }, 60_000);
});
