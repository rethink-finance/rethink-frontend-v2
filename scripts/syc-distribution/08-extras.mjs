import { ethers, load, save, call, getLogs, blockNumber, pad, iso, blockTime } from "./lib.mjs";
const { rows } = load("polygon-transfers"); const res = load("result");
const f = (x) => Number(ethers.formatEther(x));
// (a) weekly SNI inflow history (old Safe): 7-day buckets anchored on Fridays 00:00 UTC
const inflow = rows.filter((r) => r.token === "SNI" && r.dir === "in" && f(r.amount) < 1e6 && f(r.amount) !== 1);
const wk = {}; for (const r of inflow) { const k = Math.floor((r.ts - 86400) / 604800); (wk[k] ??= { start: iso((k * 604800) + 86400), mint: 0, buy: 0 }); if (r.from === ethers.ZeroAddress) wk[k].mint += f(r.amount); else wk[k].buy += f(r.amount); }
const weeks = Object.values(wk).sort((a, b) => a.start.localeCompare(b.start)); const tot = weeks.map((w) => w.mint + w.buy).sort((a, b) => a - b);
const q = (p) => tot[Math.min(tot.length - 1, Math.floor(p * tot.length))];
console.log("weeks", weeks.length, "median", q(0.5).toFixed(0), "p90", q(0.9).toFixed(0), "p95", q(0.95).toFixed(0), "max", tot.at(-1).toFixed(0), "mean", (tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(0));
const buys = weeks.map((w) => w.buy).sort((a, b) => a - b); console.log("weekly buys: median", buys[Math.floor(buys.length / 2)].toFixed(0), "max", buys.at(-1).toFixed(0));
console.log("top weeks:", weeks.filter((w) => w.mint + w.buy > q(0.9)).map((w) => `${w.start.slice(0, 10)} mint ${w.mint} buy ${w.buy.toFixed(0)}`).join(" | "));
// (b) SNI per WETH at each claim's arrival block (spot pool price x Chainlink), archive calls
const POOL = "0x9Ecb733A74B48eE31586c98986F0AA1eD5057c6A", ETHUSD = "0xF9680D99D6C9589e2a93a78A04A279e509205945";
const pi = new ethers.Interface(["function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)"]), ci = new ethers.Interface(["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"]);
const atClaim = [];
for (const l of res.lots) {
  const r = rows.find((x) => x.tx === l.polygonTx); const blk = "0x" + r.block.toString(16);
  try {
    const [sq] = pi.decodeFunctionResult("slot0", await call(137, POOL, pi.encodeFunctionData("slot0"), blk));
    const [, ans] = ci.decodeFunctionResult("latestRoundData", await call(137, ETHUSD, ci.encodeFunctionData("latestRoundData"), blk));
    const sniPerUsdc = (Number(sq) / 2 ** 96) ** 2 * 1e6 / 1e18, ethUsd = Number(ans) / 1e8, sniPerWeth = sniPerUsdc * ethUsd;
    const realized = l.swapped !== "0" ? f(l.sni) / f(l.swapped) : null;
    atClaim.push({ claim: l.claimTime.slice(0, 10), ethUsd, sniUsd: 1 / sniPerUsdc, sniPerWethAtClaim: sniPerWeth, realized, formulaSni: f(l.weth) * sniPerWeth, actualSni: f(l.sni), swapped: f(l.swapped), weth: f(l.weth) });
    console.log(l.claimTime.slice(0, 10), "ETH/USD", ethUsd.toFixed(0), "SNI/USD", (1 / sniPerUsdc).toFixed(4), "SNI per WETH at claim", sniPerWeth.toFixed(0), "realized", realized?.toFixed(0), "formula SNI", (f(l.weth) * sniPerWeth).toFixed(0), "actual", f(l.sni).toFixed(0));
  } catch (e) { console.log(l.claimTime.slice(0, 10), "archive read failed:", String(e.message).slice(0, 120)); }
}
// (c) the 9.411 WETH path
const WETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", MS = "0x83f2492DB796BF0692C90B65DeBB926bd688fAe5";
const head = await blockNumber(137);
const outs = await getLogs(137, { address: WETH, topics: [ethers.id("Transfer(address,address,uint256)"), pad(MS)] }, 78_000_000, head);
for (const l of outs) console.log("multisig WETH out:", iso(await blockTime(137, Number(l.blockNumber))), "to 0x" + l.topics[2].slice(26), f(BigInt(l.data)), l.transactionHash);
save("extras", { weeks, stats: { median: q(0.5), p90: q(0.9), p95: q(0.95), max: tot.at(-1) }, atClaim, multisigOut: outs.map((l) => ({ to: "0x" + l.topics[2].slice(26), amount: BigInt(l.data).toString(), tx: l.transactionHash })) });
