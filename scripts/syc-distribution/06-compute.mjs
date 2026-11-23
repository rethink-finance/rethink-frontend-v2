// Retroactive SYC allocation. All amounts in wei (BigInt); nothing is rounded until display.
import { ethers, load, save, call, iso, getLogs, blockNumber, pad } from "./lib.mjs";
const E = 10n ** 18n, fmt = (x, d = 4) => Number(ethers.formatEther(x)).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const ts = (s) => Math.floor(Date.parse(s) / 1000);

// ---------- 1. sniETH holders from deposit events (attacker mint + rescue mint excluded)
const sni = load("snieth-transfers");
const EXCLUDE_FROM_BLOCK = 25_930_583; // 2026-09-08 attacker mint, then the 830M rescue mint
const deposits = sni.rows.filter((r) => r.from === ethers.ZeroAddress && r.block < EXCLUDE_FROM_BLOCK).map((r) => ({ t: ts(r.time), block: r.block, time: r.time, holder: r.to, amount: BigInt(r.amount), tx: r.tx }));
const excluded = sni.rows.filter((r) => r.block >= EXCLUDE_FROM_BLOCK);
const holders = [...new Set(deposits.map((d) => d.holder))];
const balAt = (t) => Object.fromEntries(holders.map((h) => [h, deposits.filter((d) => d.holder === h && d.t <= t).reduce((s, d) => s + d.amount, 0n)]));
// balance x seconds over (t0, t1]
const weightOver = (t0, t1) => {
  const cuts = [t0, ...deposits.map((d) => d.t).filter((t) => t > t0 && t < t1), t1];
  const w = Object.fromEntries(holders.map((h) => [h, 0n]));
  for (let i = 0; i < cuts.length - 1; i++) { const b = balAt(cuts[i]); for (const h of holders) w[h] += b[h] * BigInt(cuts[i + 1] - cuts[i]); }
  return w;
};
const split = (amount, w) => { // floor pro-rata, remainder to the largest weight
  const W = holders.reduce((s, h) => s + w[h], 0n); const out = {}; let used = 0n;
  for (const h of holders) { out[h] = (amount * w[h]) / W; used += out[h]; }
  const top = holders.reduce((a, b) => (w[b] > w[a] ? b : a)); out[top] += amount - used; return out;
};

// ---------- 2. Polygon flows: both Safes are one book
const { rows, safes } = load("polygon-transfers");
const claimsMain = load("mainnet-claims").rows;
const SAFES = new Set(Object.values(safes).map((x) => x.toLowerCase()));
const byTx = {};
for (const r of rows) {
  if (SAFES.has((r.dir === "in" ? r.from : r.to).toLowerCase())) continue; // a move between the two Safes is not a flow
  const g = (byTx[r.tx] ??= { tx: r.tx, ts: r.ts, time: r.time, block: r.block, idx: r.logIndex, wethOut: 0n, sniIn: 0n, sniOut: 0n, wethInRows: [] });
  const a = BigInt(r.amount), mint = r.from === ethers.ZeroAddress;
  if (r.token === "WETH" && r.dir === "in") g.wethInRows.push(r);
  else if (r.token === "WETH") g.wethOut += a;
  else if (r.token === "SNI" && r.dir === "in" && !mint) g.sniIn += a;
  else if (r.token === "SNI" && r.dir === "out") g.sniOut += a;
}
const txs = Object.values(byTx).sort((x, y) => x.block - y.block || x.idx - y.idx);
// queue: every WETH arrival in order. A bridged claim is a yield lot; WETH received for SNI the Safe sold is not yield.
const queue = [], warnings = [], nonSwapOut = [], sniNoWeth = [], usedClaims = new Set(); let carry = 0n, recycledSni = 0n;
const newLot = (o) => ({ sni: 0n, swapped: 0n, unswapped: 0n, swaps: 0, dust: 0n, ...o, left: o.weth });
const lastYield = () => queue.filter((l) => l.yield).at(-1);
for (const g of txs) {
  if (g.wethInRows.length && g.wethOut === 0n) {
    for (const r of g.wethInRows) {
      const a = BigInt(r.amount);
      if (g.sniOut > 0n) { queue.push(newLot({ yield: false, arrived: r.time, tArr: r.ts, weth: a, polygonTx: r.tx })); continue; }
      const m = claimsMain.find((c) => c.outputAmount === r.amount && !usedClaims.has(c.tx));
      if (m) { usedClaims.add(m.tx); queue.push(newLot({ yield: true, arrived: r.time, tArr: r.ts, claimTime: m.time, tClaim: m.ts, blockClaim: m.block, claimedEth: BigInt(m.inputAmount), weth: a + carry, dust: carry, polygonTx: r.tx, mainnetTx: m.tx })); carry = 0n; continue; }
      // WETH that is not a bridged claim: a real amount (yield returned to the vault, a claim from a new sniETH Safe) is a lot of its own,
      // split by the balances on the day it arrives; test dust joins the most recent lot.
      if (a >= E / 100n) { queue.push(newLot({ yield: true, arrived: r.time, tArr: r.ts, weth: a + carry, dust: carry, polygonTx: r.tx })); carry = 0n;
        warnings.push(`${fmt(a, 6)} WETH arrived on ${r.time.slice(0, 10)} without a matching bridge deposit; split by the balances on that day (${r.tx})`); continue; }
      const l = lastYield();
      if (!l) { carry += a; continue; }
      l.weth += a; l.left += a; l.dust += a;
    }
  }
  if (g.sniIn > 0n && g.wethOut === 0n) sniNoWeth.push({ time: g.time, tx: g.tx, amount: g.sniIn.toString() });
  if (g.wethOut === 0n) continue;
  if (g.sniIn === 0n) nonSwapOut.push(g);
  let need = g.wethOut;
  while (need > 0n) {
    let l = queue.find((x) => x.left > 0n), take;
    if (l) take = need < l.left ? need : l.left;
    else { l = queue.at(-1); if (!l) throw new Error("WETH left before any arrived " + g.tx); take = need; l.left += take; warnings.push(`${fmt(take, 6)} more WETH left the Safe than had arrived by ${g.time.slice(0, 10)} (${g.tx})`); }
    const part = (g.sniIn * take) / g.wethOut;
    if (l.yield) l.sni += part; else recycledSni += part;
    l.swaps++; if (g.sniIn > 0n) l.swapped += take; else l.unswapped += take;
    l.left -= take; need -= take;
  }
}
const lots = queue.filter((l) => l.yield);
const boughtTotal = lots.reduce((s, l) => s + l.sni, 0n);
console.log("yield lots:", lots.length, "| WETH not yet swapped:", fmt(lots.reduce((s, l) => s + l.left, 0n), 6), "| SNI bought back with sale proceeds (not distributed):", fmt(recycledSni, 6));
console.log("WETH that left without buying SNI:"); for (const g of nonSwapOut) console.log("  ", g.time, fmt(g.wethOut, 6), g.tx);
console.log("SNI in without WETH out:"); for (const g of sniNoWeth) console.log("  ", g.time, fmt(BigInt(g.amount), 6), g.tx);
for (const x of warnings) console.log("WARNING", x);

// ---------- 3. yield lots -> holders
const T0 = deposits[0].t;
const yieldTW = Object.fromEntries(holders.map((h) => [h, 0n])), yieldCP = { ...yieldTW }, yieldM = { ...yieldTW }, yieldStk = { ...yieldTW };
// measured accrual: rewards the staking vault had generated (claimed + claimable) at each deposit block
const acc = load("accrual");
const G = (blk) => { const p = acc.points.find((x) => x.block === blk); if (!p?.generated) throw new Error("no accrual read at " + blk); return BigInt(p.generated); };
const rc = acc.events.filter((e) => e.name === "RewardsClaimed"), stk = acc.events.filter((e) => e.name === "Deposited");
if (rc.length < lots.length) throw new Error("fewer claims on the staking vault than bridged lots");
// effBlock: the block from which a deposit counts (its own block, or for the alternative the block its ETH was staked)
const measured = (b0, b1, effBlock) => {
  const eff = deposits.map((d) => ({ ...d, eb: effBlock(d) }));
  const cuts = [b0, ...eff.map((d) => d.eb).filter((b) => b > b0 && b < b1).sort((a, b) => a - b), b1];
  const w = Object.fromEntries(holders.map((h) => [h, 0n])); const segs = [];
  for (let i = 0; i < cuts.length - 1; i++) { const dG = G(cuts[i + 1]) - G(cuts[i]);
    const b = Object.fromEntries(holders.map((h) => [h, eff.filter((d) => d.holder === h && d.eb <= cuts[i]).reduce((s, d) => s + d.amount, 0n)]));
    const tot = holders.reduce((s, h) => s + b[h], 0n); for (const h of holders) w[h] += (dG * b[h] * E) / tot;
    segs.push({ from: cuts[i], to: cuts[i + 1], generated: dG.toString(), bal: Object.fromEntries(holders.map((h) => [h, b[h].toString()])) }); }
  return { w, segs };
};
const stakedBlock = (d) => (d.block === deposits.at(-1).block ? stk.at(-1).block : d.block); // only the 992 ETH waited (5 days) before staking
let prev = T0, prevBlock = deposits[0].block, prevRc = T0, claimNo = 0;
for (const l of lots) {
  if (!l.blockClaim) { // no bridge deposit behind it: balances on the day it arrived
    l.weights = balAt(l.tArr); l.allocM = split(l.sni, l.weights); l.allocStk = l.allocTW = l.allocCP = l.allocM; l.segs = [];
    for (const h of holders) { yieldM[h] += l.allocM[h]; yieldStk[h] += l.allocM[h]; yieldTW[h] += l.allocM[h]; yieldCP[h] += l.allocM[h]; }
    continue;
  }
  const m1 = measured(prevBlock, l.blockClaim, (d) => d.block), m2 = measured(prevBlock, l.blockClaim, stakedBlock);
  // one segment = no deposit inside the claim period: the split is simply by balance (what the backend does without reading Ethereum)
  l.measured = m1.segs.length > 1; l.weights = l.measured ? m1.w : balAt(l.tArr);
  l.allocM = split(l.sni, l.weights); l.allocStk = split(l.sni, m2.segs.length > 1 ? m2.w : balAt(l.tArr)); l.segs = m1.segs;
  for (const h of holders) { yieldM[h] += l.allocM[h]; yieldStk[h] += l.allocStk[h]; }
  const r = rc[claimNo++]; l.rcTime = r.time; l.rcAmount = r.amount; l.rcFrom = iso(prevRc); l.rcDays = (r.ts - prevRc) / 86400;
  const wr = weightOver(prevRc, r.ts), Wr = holders.reduce((s, h) => s + wr[h], 0n); l.rcApr = Number(BigInt(r.amount)) / (Number(Wr) / (365 * 86400));
  prevBlock = l.blockClaim; prevRc = r.ts;
  const w = weightOver(prev, l.tClaim); const W = holders.reduce((s, h) => s + w[h], 0n);
  l.windowFrom = iso(prev); l.days = (l.tClaim - prev) / 86400;
  l.avgEth = W / BigInt(l.tClaim - prev);
  l.apr = Number(l.claimedEth) / (Number(W) / (365 * 86400));
  l.shareTW = Object.fromEntries(holders.map((h) => [h, Number((w[h] * 10n ** 12n) / W) / 1e12]));
  l.allocTW = split(l.sni, w); l.allocCP = split(l.sni, balAt(l.tClaim));
  for (const h of holders) { yieldTW[h] += l.allocTW[h]; yieldCP[h] += l.allocCP[h]; }
  prev = l.tClaim;
}
// ---------- 4. incentive mints -> holders (balance at the mint)
const mints = rows.filter((r) => r.token === "SNI" && r.dir === "in" && r.from === ethers.ZeroAddress && BigInt(r.amount) === 34_000n * E);
const remint = rows.filter((r) => r.token === "SNI" && r.dir === "in" && r.from === ethers.ZeroAddress && BigInt(r.amount) !== 34_000n * E);
const incent = Object.fromEntries(holders.map((h) => [h, 0n]));
const mintRows = mints.map((m) => { const a = split(BigInt(m.amount), balAt(m.ts)); for (const h of holders) incent[h] += a[h]; return { time: m.time, safe: m.safe, tx: m.tx, alloc: a }; });
const incentTotal = mints.reduce((s, m) => s + BigInt(m.amount), 0n);

// ---------- 5. on-chain state now
const erc = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);
const SNI = "0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57";
const bal = async (a) => BigInt(await call(137, SNI, erc.encodeFunctionData("balanceOf", [a]), "latest"));
const newSafeSni = await bal("0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF"), oldSafeSni = await bal("0x979AeA92BbfC33BE4F3d4Cf328133d695B88952B");
const H = new ethers.Interface(["function feedRatioTimesTwap(address,address,uint256,address,address,uint128,uint32) view returns (uint256)"]);
// Display only (the page's weekly estimate). A stale Chainlink feed must not stop the computation.
let sniPerWeth = 0n;
try { sniPerWeth = BigInt(await call(137, "0x306565A88FF89de6D2711CFd923eC640b7428D6d", H.encodeFunctionData("feedRatioTimesTwap", ["0xF9680D99D6C9589e2a93a78A04A279e509205945", "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7", 3600, "0x9Ecb733A74B48eE31586c98986F0AA1eD5057c6A", "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", 1_000_000, 1800]), "latest")); }
catch (e) { console.log("WARNING SNI/WETH price read failed (display only):", String(e.message).slice(0, 120)); }

// ---------- 6. report
const total = Object.fromEntries(holders.map((h) => [h, incent[h] + yieldM[h]]));
const totalEven = Object.fromEntries(holders.map((h) => [h, incent[h] + yieldTW[h]])), totalStk = Object.fromEntries(holders.map((h) => [h, incent[h] + yieldStk[h]]));
const totalCP = Object.fromEntries(holders.map((h) => [h, incent[h] + yieldCP[h]]));
const grand = holders.reduce((s, h) => s + total[h], 0n);
console.log("\nholders (deposit-based):"); for (const d of deposits) console.log("  ", d.time, d.holder, fmt(d.amount, 6));
console.log("\nclaim lots:");
for (const l of lots) console.log("  ", l.claimTime.slice(0, 10), "claimed", fmt(l.claimedEth), "arrived", fmt(l.weth), "swapped", fmt(l.swapped), "unswapped", fmt(l.unswapped), "SNI", fmt(l.sni, 2), "SNI/WETH", l.swapped ? (Number(l.sni) / Number(l.swapped)).toFixed(0) : "-", "days", l.days.toFixed(1), "avgETH", fmt(l.avgEth, 2), "APR", (l.apr * 100).toFixed(2) + "%", "swaps", l.swaps);
console.log("\nincentive mints:", mints.length, "total", fmt(incentTotal, 0), "| remint rows:", remint.map((r) => fmt(BigInt(r.amount)) + " " + r.time).join("; "));
console.log("SNI bought with yield:", fmt(boughtTotal));
console.log("retroactive total:", fmt(grand), " = incentives + bought:", fmt(incentTotal + boughtTotal));
console.log("new Safe SNI", fmt(newSafeSni), "old Safe SNI", fmt(oldSafeSni), "sum", fmt(newSafeSni + oldSafeSni), "minus retro total", fmt(newSafeSni + oldSafeSni - grand));
console.log("SNI per WETH now (30-min TWAP x Chainlink):", fmt(sniPerWeth, 2));
console.log("\nper holder:");
for (const h of holders) console.log("  ", h, "incentives", fmt(incent[h]), "yield(measured)", fmt(yieldM[h]), "TOTAL", fmt(total[h]), "| vs even-accrual", fmt(totalEven[h] - total[h]), "| vs claim-day balance", fmt(totalCP[h] - total[h]), "| vs counted-from-staking", fmt(totalStk[h] - total[h]));
console.log("\nvault claims:"); for (const l of lots) console.log("  ", l.rcTime.slice(0, 10), "bridged", l.claimTime.slice(0, 10), "claimed", fmt(BigInt(l.rcAmount)), "days", l.rcDays.toFixed(1), "rate", (l.rcApr * 100).toFixed(2) + "%", "segments", l.segs.length);
for (const l of lots.slice(0, 2)) for (const sg of l.segs) console.log("   seg", sg.from, "->", sg.to, "generated", fmt(BigInt(sg.generated)));
const s = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.toString()]));
save("result", { generated: new Date().toISOString(), holders, deposits: deposits.map((d) => ({ ...d, amount: d.amount.toString() })), excluded,
  lots: lots.map((l) => ({ ...l, weth: l.weth.toString(), dust: l.dust.toString(), sni: l.sni.toString(), swapped: l.swapped.toString(), unswapped: l.unswapped.toString(), left: l.left.toString(), allocTW: s(l.allocTW), allocCP: s(l.allocCP), allocM: s(l.allocM), allocStk: s(l.allocStk), weights: s(l.weights), claimedEth: (l.claimedEth ?? 0n).toString(), avgEth: (l.avgEth ?? 0n).toString() })),
  mints: mintRows.map((m) => ({ ...m, alloc: s(m.alloc) })), incentTotal: incentTotal.toString(), boughtTotal: boughtTotal.toString(),
  incent: s(incent), yieldTW: s(yieldTW), yieldCP: s(yieldCP), yieldM: s(yieldM), yieldStk: s(yieldStk), total: s(total), totalCP: s(totalCP), totalEven: s(totalEven), totalStk: s(totalStk), stakingEvents: stk, grand: grand.toString(),
  newSafeSni: newSafeSni.toString(), oldSafeSni: oldSafeSni.toString(), sniPerWeth: sniPerWeth.toString(), nonSwapOut: nonSwapOut.map((g) => ({ time: g.time, tx: g.tx, weth: g.wethOut.toString() })), sniNoWeth, warnings, recycledSni: recycledSni.toString() });
