// Every sniETH (soonami Venture Staking I, Ethereum) share movement since the vault was created.
import { ethers, getLogs, blockNumber, blockTime, save, iso, rpc } from "./lib.mjs";
const FUND = "0xaC3D76E29f866702E17f571cccb15937E5A17303";
const TRANSFER = ethers.id("Transfer(address,address,uint256)");
const head = await blockNumber(1);
// find the creation block by bisecting on code
let lo = 19_000_000, hi = head;
while (lo < hi) { const mid = Math.floor((lo + hi) / 2); const code = await rpc(1, "eth_getCode", [FUND, "0x" + mid.toString(16)]); if (code && code !== "0x") hi = mid; else lo = mid + 1; }
console.log("fund created at block", lo, iso(await blockTime(1, lo)));
const logs = await getLogs(1, { address: FUND }, lo, head);
console.log("fund logs:", logs.length);
const topics = {}; for (const l of logs) topics[l.topics[0]] = (topics[l.topics[0]] ?? 0) + 1;
console.log("topics:", topics);
const rows = [];
for (const l of logs.filter((x) => x.topics[0] === TRANSFER && x.topics.length === 3)) {
  rows.push({ block: Number(l.blockNumber), time: iso(await blockTime(1, Number(l.blockNumber))), tx: l.transactionHash, from: ethers.getAddress("0x" + l.topics[1].slice(26)), to: ethers.getAddress("0x" + l.topics[2].slice(26)), amount: BigInt(l.data).toString() });
}
save("snieth-transfers", { fund: FUND, createdBlock: lo, head, rows });
for (const r of rows) console.log(r.time, r.block, r.from.slice(0, 10), "->", r.to.slice(0, 10), ethers.formatEther(r.amount), r.tx.slice(0, 12));
