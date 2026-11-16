// Across deposits made by the sniETH Safe on Ethereum = yield claims bridged to Polygon.
import { ethers, getLogs, blockNumber, blockTime, save, iso, pad, rpc } from "./lib.mjs";
const SAFE = "0xb05Eeac3701B0Ba9Cf18e54f076BbD72359EE9EF", SPOKE = "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5";
const head = await blockNumber(1);
const logs = await getLogs(1, { address: SPOKE, topics: [null, null, null, pad(SAFE)] }, 21_822_822, head);
console.log("across deposits by safe:", logs.length);
const rows = [];
for (const l of logs) {
  const w = (i) => BigInt("0x" + l.data.slice(2 + 64 * i, 2 + 64 * (i + 1)));
  const ts = await blockTime(1, Number(l.blockNumber));
  const r = { block: Number(l.blockNumber), ts, time: iso(ts), tx: l.transactionHash, topic0: l.topics[0].slice(0, 10), destChain: Number(BigInt(l.topics[1])), inputAmount: w(2).toString(), outputAmount: w(3).toString() };
  rows.push(r);
  console.log(r.time, r.topic0, "dest", r.destChain, "in", ethers.formatEther(w(2)), "out", ethers.formatEther(w(3)), r.tx);
}
save("mainnet-claims", { head, rows });
const b = await rpc(1, "eth_getBalance", [SAFE, "latest"]);
console.log("safe ETH now", ethers.formatEther(BigInt(b)));
