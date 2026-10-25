/**
 * Rehearsal of the DoC whitelist proposal against the LIVE Polygon state, in
 * one simulated block (eth_simulateV1): the governor — owner of the Roles v1
 * modifier — applies the proposal's eight calls, then the manager (role 1)
 * trades through the router's direct-pool entry points exactly as the console
 * builds them, and every shape the whitelist is meant to refuse is tried too.
 *
 * Nothing is sent. The calls are the ones composables/execution/docProposal.ts
 * and docConsole.ts produce, so what passes here is what the vote will grant.
 *
 * Run with:  npm run test:doc-unoswap-rehearsal
 * (override the RPC with DOC_REHEARSAL_RPC; it must support eth_simulateV1)
 */
import { ethers } from "ethers";
import {
  DOC,
  DOC_POOLS,
  DOC_TOKENS,
  DOC_UNOSWAP_RULES,
  HOP_TOKENS,
  DOC_MULTISEND,
  dexWord,
  encodeDocBatch,
  encodeUnoswap,
  routeCandidates,
} from "~/composables/execution/docWhitelist";
import { buildDocUnoswapProposal } from "~/composables/execution/docProposal";
import { WETH_UNWRAP_FLAG, unoswapInterface } from "~/composables/execution/onchainSwap";

const RPC = process.env.DOC_REHEARSAL_RPC ?? "https://polygon-bor-rpc.publicnode.com";
const A = DOC.ADDR;
const GOVERNOR = "0x9cBB432172Cf8d909204D3b550d077C34952236B";
const MANAGER = "0xa6Eb7432fB5B75e5f60A88Ca7558e90d225aCca9";
const STRANGER = "0x000000000000000000000000000000000000bEEF";

const roles = new ethers.Interface([
  "function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,uint16 role,bool shouldRevert) returns (bool)",
  "function owner() view returns (address)",
  "function multisend() view returns (address)",
  "error TargetAddressNotAllowed()",
  "error FunctionNotAllowed()",
  "error ParameterNotAllowed()",
  "error ParameterNotOneOfAllowed()",
  "error SendNotAllowed()",
  "error ModuleTransactionFailed()",
  // Roles v1 reports a caller without the role as a plain string revert.
  "error Error(string)",
]);
const router = new ethers.Interface([
  "function swap(address executor,(address srcToken,address dstToken,address srcReceiver,address dstReceiver,uint256 amount,uint256 minReturnAmount,uint256 flags) desc,bytes data) payable returns (uint256 returnAmount,uint256 spentAmount)",
]);
const pool = new ethers.Interface([
  "function supply(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)",
  "function withdraw(address asset,uint256 amount,address to) returns (uint256)",
]);

const token = (symbol: string) => DOC_TOKENS.find((t) => t.symbol === symbol)!;
const addressOf = (symbol: string) => token(symbol)?.address ?? HOP_TOKENS[symbol];
const poolBetween = (a: string, b: string) =>
  DOC_POOLS.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))!;
const word = (sell: string, buy: string) =>
  dexWord(poolBetween(sell, buy).address, addressOf(sell), addressOf(buy));

const asManager = (to: string, data: string, from = MANAGER) => ({
  from,
  to: A.roles,
  gas: "0x2dc6c0",
  data: roles.encodeFunctionData("execTransactionWithRole", [to, 0n, data, 0, Number(DOC.ROLE), true]),
});

/** A whole plan as the console sends it: one delegatecall into MultiSend, wrapped for role 1. */
const asBatch = (calls: { to: string; data: string }[], from = MANAGER) => {
  const batch = encodeDocBatch(calls);
  return {
    from,
    to: A.roles,
    gas: "0x5f5e100",
    data: roles.encodeFunctionData("execTransactionWithRole", [batch.to, 0n, batch.data, batch.operation, Number(DOC.ROLE), true]),
  };
};

interface Step {
  label: string;
  call: { from: string; to: string; gas: string; data: string };
  /** Expected: "ok", or the name of the Roles error. */
  expect: string;
}

const rpc = async (method: string, params: unknown[]) => {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json: any = await response.json();
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`);
  return json.result;
};

const main = async () => {
  const owner = roles.decodeFunctionResult(
    "owner",
    await rpc("eth_call", [{ to: A.roles, data: roles.encodeFunctionData("owner", []) }, "latest"]),
  )[0] as string;
  if (owner.toLowerCase() !== GOVERNOR.toLowerCase()) {
    throw new Error(`The modifier's owner is ${owner}, not the governor the proposal is written for.`);
  }
  const multisend = roles.decodeFunctionResult(
    "multisend",
    await rpc("eth_call", [{ to: A.roles, data: roles.encodeFunctionData("multisend", []) }, "latest"]),
  )[0] as string;
  if (multisend.toLowerCase() !== DOC_MULTISEND.toLowerCase()) {
    throw new Error(`The modifier batches through ${multisend}, not DOC_MULTISEND ${DOC_MULTISEND}.`);
  }

  const amount = (symbol: string, units: string) => ethers.parseUnits(units, token(symbol).decimals);
  const best = (sell: string, buy: string, hops: 1 | 2) =>
    routeCandidates(sell, buy).find((r) => r.hops.length === hops)!;
  const built = (sell: string, buy: string, hops: 1 | 2, units: string) =>
    encodeUnoswap(best(sell, buy, hops), token(sell), amount(sell, units), 1n);

  const rebalance = [
    { to: A.aavePool, data: pool.encodeFunctionData("withdraw", [addressOf("DAI"), amount("DAI", "50"), A.safe]) },
    { to: A.oneInch, data: built("DAI", "WETH", 1, "100") },
    { to: A.oneInch, data: built("PAXG", "WBTC", 2, "0.05") },
    { to: A.oneInch, data: built("WETH", "DAI", 2, "0.01") },
    { to: A.aavePool, data: pool.encodeFunctionData("supply", [addressOf("DAI"), amount("DAI", "40"), A.safe, 0]) },
  ];
  const poisoned = [
    ...rebalance,
    {
      to: A.oneInch,
      data: unoswapInterface.encodeFunctionData("unoswapTo", [
        BigInt(STRANGER), BigInt(addressOf("DAI")), amount("DAI", "1"), 1n, word("DAI", "WETH"),
      ]),
    },
  ];

  const steps: Step[] = [
    {
      label: "before the vote: the one-transaction rebalance is refused",
      call: asBatch(rebalance),
      expect: "FunctionNotAllowed",
    },
    {
      label: "before the vote: unoswapTo is refused",
      call: asManager(A.oneInch, built("DAI", "WETH", 1, "100")),
      expect: "FunctionNotAllowed",
    },
    ...buildDocUnoswapProposal().map((c, i) => ({
      label: `governor applies call ${i + 1}: ${c.summary.split(":")[0]}`,
      call: { from: GOVERNOR, to: c.target, gas: "0x2dc6c0", data: c.data },
      expect: "ok",
    })),
    { label: "DAI → WETH direct", call: asManager(A.oneInch, built("DAI", "WETH", 1, "100")), expect: "ok" },
    { label: "DAI → USDC.e/USDC → WETH two hops", call: asManager(A.oneInch, built("DAI", "WETH", 2, "100")), expect: "ok" },
    { label: "PAXG → hop → WBTC two hops", call: asManager(A.oneInch, built("PAXG", "WBTC", 2, "0.05")), expect: "ok" },
    { label: "WETH → hop → PAXG two hops", call: asManager(A.oneInch, built("WETH", "PAXG", 2, "0.01")), expect: "ok" },
    { label: "WBTC → WETH direct", call: asManager(A.oneInch, built("WBTC", "WETH", 1, "0.001")), expect: "ok" },
    { label: "WBTC → hop → DAI two hops", call: asManager(A.oneInch, built("WBTC", "DAI", 2, "0.001")), expect: "ok" },
    {
      label: "proceeds to a stranger",
      call: asManager(
        A.oneInch,
        unoswapInterface.encodeFunctionData("unoswapTo", [
          BigInt(STRANGER), BigInt(addressOf("DAI")), amount("DAI", "100"), 1n, word("DAI", "WETH"),
        ]),
      ),
      expect: "ParameterNotAllowed",
    },
    {
      label: "selling a hop token (USDC.e)",
      call: asManager(
        A.oneInch,
        unoswapInterface.encodeFunctionData("unoswapTo", [
          BigInt(A.safe), BigInt(addressOf("USDC.e")), 1000000n, 1n, word("USDC.e", "WETH"),
        ]),
      ),
      expect: "ParameterNotOneOfAllowed",
    },
    {
      label: "a direct swap that ends in a hop token",
      call: asManager(
        A.oneInch,
        unoswapInterface.encodeFunctionData("unoswapTo", [
          BigInt(A.safe), BigInt(addressOf("DAI")), amount("DAI", "100"), 1n, word("DAI", "USDC.e"),
        ]),
      ),
      expect: "ParameterNotOneOfAllowed",
    },
    {
      label: "a second hop that stays in a hop token",
      call: asManager(
        A.oneInch,
        unoswapInterface.encodeFunctionData("unoswapTo2", [
          BigInt(A.safe), BigInt(addressOf("DAI")), amount("DAI", "100"), 1n, word("DAI", "USDC.e"), word("USDC.e", "USDC"),
        ]),
      ),
      expect: "ParameterNotOneOfAllowed",
    },
    {
      label: "a direct-pool word in the second-hop slot",
      call: asManager(
        A.oneInch,
        unoswapInterface.encodeFunctionData("unoswapTo2", [
          BigInt(A.safe), BigInt(addressOf("DAI")), amount("DAI", "100"), 1n, word("DAI", "USDC.e"), word("WETH", "WBTC"),
        ]),
      ),
      expect: "ParameterNotOneOfAllowed",
    },
    {
      label: "an unlisted pool",
      call: asManager(
        A.oneInch,
        unoswapInterface.encodeFunctionData("unoswapTo", [
          BigInt(A.safe), BigInt(addressOf("DAI")), amount("DAI", "100"), 1n,
          dexWord("0x1111111111111111111111111111111111111111", addressOf("DAI"), addressOf("WETH")),
        ]),
      ),
      expect: "ParameterNotOneOfAllowed",
    },
    {
      label: "a listed pool with the unwrap flag set",
      call: asManager(
        A.oneInch,
        unoswapInterface.encodeFunctionData("unoswapTo", [
          BigInt(A.safe), BigInt(addressOf("DAI")), amount("DAI", "100"), 1n, word("DAI", "WETH") | WETH_UNWRAP_FLAG,
        ]),
      ),
      expect: "ParameterNotOneOfAllowed",
    },
    {
      label: "the aggregator entry point swap() after the revoke",
      call: asManager(
        A.oneInch,
        router.encodeFunctionData("swap", [
          STRANGER,
          [addressOf("DAI"), addressOf("WETH"), STRANGER, A.safe, amount("DAI", "100"), 1n, 0n],
          "0x",
        ]),
      ),
      expect: "FunctionNotAllowed",
    },
    {
      label: "a stranger holding no role",
      call: asManager(A.oneInch, built("DAI", "WETH", 1, "100"), STRANGER),
      expect: "Error(Module not authorized)",
    },
    {
      label: "ONE transaction: Aave withdraw + 3 swaps + Aave deposit",
      call: asBatch(rebalance),
      expect: "ok",
    },
    {
      label: "one transaction with a leg paying a stranger fails as a whole",
      call: asBatch(poisoned),
      expect: "ParameterNotAllowed",
    },
    {
      label: "the batch from a wallet without the role",
      call: asBatch(rebalance, STRANGER),
      expect: "Error(Module not authorized)",
    },
    {
      label: "Aave supply still works",
      call: asManager(A.aavePool, pool.encodeFunctionData("supply", [addressOf("DAI"), amount("DAI", "1"), A.safe, 0])),
      expect: "ok",
    },
  ];

  const result = await rpc("eth_simulateV1", [
    { blockStateCalls: [{ calls: steps.map((s) => s.call) }], validation: false, traceTransfers: false },
    "latest",
  ]);
  const outcomes: any[] = result[0].calls;

  let failed = 0;
  steps.forEach((step, i) => {
    const out = outcomes[i];
    let got = "ok";
    if (out.status !== "0x1") {
      const data: string = out.error?.data ?? out.returnData ?? "0x";
      const parsed = (() => {
        try {
          const error = roles.parseError(data);
          if (!error) return null;
          return error.name === "Error" ? `Error(${error.args[0]})` : error.name;
        } catch {
          return null;
        }
      })();
      got = parsed ?? `revert ${data.slice(0, 10)} ${out.error?.message ?? ""}`.trim();
    }
    const ok = got === step.expect;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${step.label}  →  ${got}`);
  });

  console.log(
    `\n${steps.length - failed}/${steps.length} as expected · ` +
    `${DOC_UNOSWAP_RULES.directWords.length} direct, ${DOC_UNOSWAP_RULES.firstHopWords.length} first-hop, ` +
    `${DOC_UNOSWAP_RULES.secondHopWords.length} second-hop pool words · RPC ${RPC}`,
  );
  if (failed) process.exit(1);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
