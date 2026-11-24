import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { POLY, polyCalls } from "../sniEthConsole";
import type { IRoleCall } from "~/composables/permissions/useRoleExecution";

/**
 * The landing side on live Polygon state, off by default:
 *
 *   SNI_DRY_RUN=1 npx vitest run composables/execution/__tests__/sniEthConsole.polygon.dryrun.test.ts
 *
 * Nothing is sent. Each case is one eth_simulateV1 bundle on the latest block.
 * "Bridged WETH arrives" is a transfer from a large WETH holder to the old
 * Safe. The attacker's move is the one the memory of 2026-11-23 describes:
 * top the Safe up to what the passed "sni-yield-sweep" proposal sends
 * (9.41 WETH + 2,322 SNI), then call the public execute().
 */
const RPCS = ["https://polygon-bor-rpc.publicnode.com", "https://polygon.drpc.org"];
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

const P = POLY.ADDR;
const SNI_TOKEN = "0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57";
const WETH_WHALE = "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8"; // Aave v3 aPolWETH
const SNI_WHALE = "0x9ecb733a74b48ee31586c98986f0aa1ed5057c6a"; // SNI/WETH pool
const ATTACKER = "0x00aa588BBB6F48005198b6d4A699107542566970";
const MEMBER = POLY.MEMBERS[1];
const ARRIVES = ethers.parseEther("6.5");
const SWEEP_WETH = 9411045019757892119n;
const SWEEP_SNI = 2322197152840503466996n;

const erc20 = new ethers.Interface([
  "function transfer(address,uint256)",
  "function balanceOf(address) view returns (uint256)",
]);
const roles = new ethers.Interface([
  "function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,uint16 role,bool shouldRevert)",
]);
const governor = new ethers.Interface([
  "function execute(address[] targets,uint256[] values,bytes[] calldatas,bytes32 descriptionHash) payable returns (uint256)",
]);
const safe = new ethers.Interface(["function getOwners() view returns (address[])"]);

/** The passed proposal, as stored (ProposalCreated, 2026-11-05). */
const sweepProposal = async () => {
  const topic = ethers.id("ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)");
  const latest = Number(await rpc("eth_blockNumber", []));
  const event = new ethers.Interface([
    "event ProposalCreated(uint256 proposalId,address proposer,address[] targets,uint256[] values,string[] signatures,bytes[] calldatas,uint256 voteStart,uint256 voteEnd,string description)",
  ]);
  // Created around block 96.4M; search a window around it in 10k-block pages.
  for (let from = 96_000_000; from < latest; from += 10_000) {
    const logs = await rpc("eth_getLogs", [{
      address: P.oldGovernor,
      topics: [topic],
      fromBlock: ethers.toQuantity(from),
      toBlock: ethers.toQuantity(Math.min(from + 9_999, latest)),
    }]);
    for (const log of logs) {
      const a = event.parseLog(log)!.args;
      if (a.description === "sni-yield-sweep") {
        return { targets: [...a.targets], values: [...a[3]], calldatas: [...a.calldatas], descriptionHash: ethers.id(a.description) };
      }
    }
  }
  throw new Error("sweep proposal not found");
};

const tx = (from: string, to: string, data: string) => ({ from, to, data, gas: ethers.toQuantity(3_000_000) });
const asMember = (call: IRoleCall) =>
  tx(MEMBER, P.oldRoles, roles.encodeFunctionData("execTransactionWithRole", [call.to, call.value ?? "0", call.data, 0, POLY.ROLE, true]));
const read = (to: string, data: string) => tx(MEMBER, to, data);

const simulate = async (calls: ReturnType<typeof tx>[]) => {
  const funded = Object.fromEntries(
    [MEMBER, P.deployer, ATTACKER, WETH_WHALE, SNI_WHALE].map((a) => [a, { balance: ethers.toQuantity(ethers.parseEther("100")) }]),
  );
  const result = await rpc("eth_simulateV1", [
    { blockStateCalls: [{ calls, stateOverrides: funded }], validation: false },
    "latest",
  ]);
  return result[0].calls as { status: string; returnData: string; error?: { message: string } }[];
};

describe.runIf(process.env.SNI_DRY_RUN)("old SNI Safe on live Polygon state", () => {
  // Before 2026-11-24 14:51 UTC the governor owned the Safe and this sweep went
  // through; since the defuse (tx 0x71d5a2db) it must revert. Read which applies.
  it("the passed proposal sweeps bridged WETH only while the governor owns the Safe", async () => {
    const p = await sweepProposal();
    const calls = await simulate([
      tx(WETH_WHALE, P.weth, erc20.encodeFunctionData("transfer", [P.oldSafe, ARRIVES])),
      // The attacker's top-up, in the same block as the sweep.
      tx(WETH_WHALE, P.weth, erc20.encodeFunctionData("transfer", [P.oldSafe, SWEEP_WETH - ARRIVES])),
      tx(SNI_WHALE, SNI_TOKEN, erc20.encodeFunctionData("transfer", [P.oldSafe, SWEEP_SNI])),
      tx(ATTACKER, P.oldGovernor, governor.encodeFunctionData("execute", [p.targets, p.values, p.calldatas, p.descriptionHash])),
      read(P.weth, erc20.encodeFunctionData("balanceOf", [P.oldSafe])),
    ]);
    const owners = safe.decodeFunctionResult("getOwners", await rpc("eth_call", [read(P.oldSafe, safe.encodeFunctionData("getOwners")), "latest"]))[0];
    const governorOwns = owners.some((o: string) => o.toLowerCase() === P.oldGovernor.toLowerCase());
    console.log("governor owns:", governorOwns, "sweep:", calls.map((c) => c.status).join(" "), calls[3].error?.message ?? "");
    if (governorOwns) {
      expect(calls[3].status).toBe("0x1");
      expect(BigInt(calls[4].returnData)).toBe(0n);
    } else {
      expect(calls[3].status).toBe("0x0");
      expect(BigInt(calls[4].returnData)).toBeGreaterThanOrEqual(SWEEP_WETH);
    }
  }, 120_000);

  it("after the defuse: the sweep reverts and role 1 moves the WETH to the new Safe", async () => {
    const p = await sweepProposal();
    const before = BigInt(await rpc("eth_call", [read(P.weth, erc20.encodeFunctionData("balanceOf", [P.newSafe])), "latest"]));
    const permission = polyCalls.defusePermission();
    const calls = await simulate([
      tx(P.deployer, permission.to, permission.data),
      asMember(polyCalls.swapOwner()),
      read(P.oldSafe, safe.encodeFunctionData("getOwners")),
      tx(WETH_WHALE, P.weth, erc20.encodeFunctionData("transfer", [P.oldSafe, ARRIVES])),
      tx(WETH_WHALE, P.weth, erc20.encodeFunctionData("transfer", [P.oldSafe, SWEEP_WETH - ARRIVES])),
      tx(SNI_WHALE, SNI_TOKEN, erc20.encodeFunctionData("transfer", [P.oldSafe, SWEEP_SNI])),
      tx(ATTACKER, P.oldGovernor, governor.encodeFunctionData("execute", [p.targets, p.values, p.calldatas, p.descriptionHash])),
      asMember(polyCalls.moveWeth(SWEEP_WETH)),
      read(P.weth, erc20.encodeFunctionData("balanceOf", [P.newSafe])),
    ]);
    const owners = safe.decodeFunctionResult("getOwners", calls[2].returnData)[0];
    console.log("defuse:", calls.map((c) => c.status).join(" "), "owners", owners, calls[6].error?.message ?? "");
    expect(calls[0].status).toBe("0x1"); // factory stored the permission
    expect(calls[1].status).toBe("0x1"); // swapOwner through role 1
    expect(owners.map((o: string) => o.toLowerCase())).toEqual([P.newOwner.toLowerCase()]);
    expect(calls[6].status).toBe("0x0"); // the sweep no longer executes
    expect(calls[7].status).toBe("0x1"); // move
    expect(BigInt(calls[8].returnData) - before).toBe(SWEEP_WETH);
  }, 120_000);

  it("only the four-word swapOwner is opened: another new owner is refused", async () => {
    const permission = polyCalls.defusePermission();
    const other = {
      to: P.oldSafe,
      data: new ethers.Interface(["function swapOwner(address,address,address)"]).encodeFunctionData("swapOwner", [
        POLY.SENTINEL, P.oldGovernor, ATTACKER,
      ]),
    };
    const calls = await simulate([tx(P.deployer, permission.to, permission.data), asMember(other)]);
    expect(calls[0].status).toBe("0x1");
    expect(calls[1].status).toBe("0x0");
  }, 120_000);
});
