// Shared helpers: RPC access with fallbacks and chunked log reads. Read-only.
import { ethers } from "ethers";
import fs from "node:fs";

export const RPCS = {
  1: ["https://mainnet.gateway.tenderly.co", "https://ethereum-rpc.publicnode.com", "https://eth.drpc.org"],
  137: ["https://polygon.gateway.tenderly.co", "https://polygon-bor-rpc.publicnode.com", "https://polygon.drpc.org"],
};
// SYC_RPC_137=http://127.0.0.1:8545 points a chain at one RPC only (a local fork, for a rehearsal).
for (const chain of Object.keys(RPCS)) if (process.env[`SYC_RPC_${chain}`]) RPCS[chain] = [process.env[`SYC_RPC_${chain}`]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rpc = async (chain, method, params) => {
  let last;
  for (let round = 0; round < 4; round++) {
    for (const url of RPCS[chain]) {
      try {
        const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
        const j = await res.json();
        if (j.error) { last = new Error(`${url}: ${JSON.stringify(j.error).slice(0, 200)}`); continue; }
        return j.result;
      } catch (e) { last = e; }
    }
    await sleep(800 * (round + 1));
  }
  throw last;
};
export const hex = (n) => "0x" + BigInt(n).toString(16);
export const blockNumber = async (chain) => Number(await rpc(chain, "eth_blockNumber", []));
const tsCache = new Map();
export const blockTime = async (chain, n) => {
  const k = `${chain}:${n}`;
  if (!tsCache.has(k)) tsCache.set(k, Number((await rpc(chain, "eth_getBlockByNumber", [hex(n), false])).timestamp));
  return tsCache.get(k);
};
/** eth_getLogs over [from, to], halving the range whenever a node refuses it. */
export const getLogs = async (chain, filter, from, to) => {
  const out = [];
  const walk = async (a, b) => {
    try {
      out.push(...(await rpc(chain, "eth_getLogs", [{ ...filter, fromBlock: hex(a), toBlock: hex(b) }])));
    } catch (e) {
      if (a >= b) throw e;
      const mid = Math.floor((a + b) / 2);
      await walk(a, mid); await walk(mid + 1, b);
    }
  };
  await walk(from, to);
  return out.sort((x, y) => Number(x.blockNumber) - Number(y.blockNumber) || Number(x.logIndex) - Number(y.logIndex));
};
export const call = async (chain, to, data, block = "latest") => rpc(chain, "eth_call", [{ to, data }, typeof block === "number" ? hex(block) : block]);
export const save = (name, value) => fs.writeFileSync(new URL(`./data/${name}.json`, import.meta.url), JSON.stringify(value, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n");
export const load = (name) => JSON.parse(fs.readFileSync(new URL(`./data/${name}.json`, import.meta.url), "utf8"));
export const iso = (ts) => new Date(ts * 1000).toISOString().replace(".000Z", "Z");
export const pad = (a) => ethers.zeroPadValue(a, 32);
export { ethers };
