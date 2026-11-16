// Every WETH / SNI / USDC transfer into or out of the two SYC Safes on Polygon.
import { ethers, getLogs, blockNumber, blockTime, save, iso, pad } from "./lib.mjs";
const SAFES = { old: "0x979AeA92BbfC33BE4F3d4Cf328133d695B88952B", new: "0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF" };
const TOKENS = { WETH: ["0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", 18], SNI: ["0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57", 18], USDC: ["0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", 6] };
const TRANSFER = ethers.id("Transfer(address,address,uint256)");
const START = 72_000_000; // before the old Safe existed (2025-06-04)
const head = await blockNumber(137);
const rows = [];
for (const [safeName, safe] of Object.entries(SAFES)) {
  for (const [sym, [token, dec]] of Object.entries(TOKENS)) {
    for (const dir of ["in", "out"]) {
      const topics = dir === "in" ? [TRANSFER, null, pad(safe)] : [TRANSFER, pad(safe)];
      const logs = await getLogs(137, { address: token, topics }, START, head);
      for (const l of logs) {
        if (l.topics.length !== 3) continue;
        rows.push({ safe: safeName, token: sym, dir, block: Number(l.blockNumber), logIndex: Number(l.logIndex), tx: l.transactionHash, from: ethers.getAddress("0x" + l.topics[1].slice(26)), to: ethers.getAddress("0x" + l.topics[2].slice(26)), amount: BigInt(l.data).toString(), decimals: dec });
      }
      console.log(safeName, sym, dir, logs.length);
    }
  }
}
rows.sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
const blocks = [...new Set(rows.map((r) => r.block))];
console.log("distinct blocks to timestamp:", blocks.length);
let i = 0;
for (const b of blocks) { await blockTime(137, b); if (++i % 200 === 0) console.log("  timestamps", i); }
for (const r of rows) { r.ts = await blockTime(137, r.block); r.time = iso(r.ts); }
save("polygon-transfers", { safes: SAFES, head, rows });
console.log("saved", rows.length, "rows");
