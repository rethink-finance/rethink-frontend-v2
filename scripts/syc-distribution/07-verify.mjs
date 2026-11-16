// Independent re-derivation in plain floats, no shared helpers: measured accrual for yield, balance-at-mint for incentives.
import fs from "node:fs";
const D = (n) => JSON.parse(fs.readFileSync(new URL(`./data/${n}.json`, import.meta.url)));
const sn = D("snieth-transfers").rows, pg = D("polygon-transfers").rows, cl = D("mainnet-claims").rows, res = D("result"), acc = D("accrual");
const T = (s) => Date.parse(s) / 1000, f = (x) => Number(x) / 1e18, zero = (a) => /^0x0{40}$/.test(a);
const dep = sn.filter((r) => zero(r.from) && r.block < 25930583).map((r) => ({ t: T(r.time), b: r.block, h: r.to, a: f(r.amount) }));
const hs = [...new Set(dep.map((d) => d.h))];
const balB = (blk) => hs.map((h) => dep.filter((d) => d.h === h && d.b <= blk).reduce((s, d) => s + d.a, 0));
const balT = (t) => hs.map((h) => dep.filter((d) => d.h === h && d.t <= t).reduce((s, d) => s + d.a, 0));
const G = Object.fromEntries(acc.points.map((p) => [p.block, f(p.generated)]));
// SNI per claim, FIFO on a running WETH total
const old = pg.filter((r) => r.safe === "old").sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
const cum = []; let a = 0; for (const r of old.filter((r) => r.token === "WETH" && r.dir === "in")) { a += f(r.amount); if (f(r.amount) > 0.01) cum.push(a); }
const txs = {}; for (const r of old) { const g = (txs[r.tx] ??= { ts: r.ts, w: 0, s: 0 }); if (r.token === "WETH" && r.dir === "out") g.w += f(r.amount); if (r.token === "SNI" && r.dir === "in" && !zero(r.from)) g.s += f(r.amount); }
const lot = cum.map(() => 0); let spent = 0;
for (const g of Object.values(txs).sort((x, y) => x.ts - y.ts)) { if (!g.w) continue; let need = g.w; while (need > 1e-15) { const i = cum.findIndex((c) => c - spent > 1e-12); const take = Math.min(need, cum[i] - spent); lot[i] += g.s * take / g.w; spent += take; need -= take; } }
// yield by measured segments
const y = hs.map(() => 0); let pb = dep[0].b;
cl.forEach((c, i) => { const cuts = [pb, ...dep.map((d) => d.b).filter((b) => b > pb && b < c.block), c.block]; const share = hs.map(() => 0);
  for (let k = 0; k < cuts.length - 1; k++) { const dG = G[cuts[k + 1]] - G[cuts[k]], b = balB(cuts[k]), B = b.reduce((p, q) => p + q, 0); b.forEach((x, j) => (share[j] += dG * x / B)); }
  const S = share.reduce((p, q) => p + q, 0); share.forEach((x, j) => (y[j] += lot[i] * x / S)); pb = c.block; });
const inc = hs.map(() => 0); let n = 0;
for (const r of pg) if (r.token === "SNI" && r.dir === "in" && zero(r.from) && f(r.amount) === 34000) { n++; const b = balT(r.ts), B = b.reduce((p, q) => p + q, 0); b.forEach((x, j) => (inc[j] += 34000 * x / B)); }
let worst = 0;
hs.forEach((h, j) => { const d = inc[j] + y[j] - f(res.total[h]); worst = Math.max(worst, Math.abs(d)); console.log(h, "verify", (inc[j] + y[j]).toFixed(4), "main", f(res.total[h]).toFixed(4), "diff", d.toFixed(6)); });
console.log("mints", n, "sum", (inc.reduce((p, q) => p + q, 0) + y.reduce((p, q) => p + q, 0)).toFixed(4), "main", f(res.grand).toFixed(4));
console.log(worst < 0.01 ? "VERIFY OK, worst diff " + worst.toExponential(2) : "VERIFY MISMATCH");
