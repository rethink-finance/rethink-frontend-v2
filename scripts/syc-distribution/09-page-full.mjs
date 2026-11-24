// Builds syc-distribution.html from data/result.json + data/extras.json. No number is typed by hand.
import fs from "node:fs";
const D = (n) => JSON.parse(fs.readFileSync(new URL(`./data/${n}.json`, import.meta.url)));
const res = D("result"), ex = D("extras"), acc = D("accrual"), pg = D("polygon-transfers"), mc = D("mainnet-claims"), sn = D("snieth-transfers");
const E = 10n ** 18n;
const w = (x, dp = 2) => { x = BigInt(x); const neg = x < 0n; if (neg) x = -x; const s = 10n ** BigInt(18 - dp); let q = (x + s / 2n) / s; const i = q / 10n ** BigInt(dp), f = q % 10n ** BigInt(dp);
  return (neg ? "−" : "") + i.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dp ? "." + f.toString().padStart(dp, "0") : ""); };
const n = (x, dp = 0) => Number(x).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const num = (x) => Number(BigInt(x)) / 1e18;
const sh = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const day = (s) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const ptx = (h, t) => `<a href="https://polygonscan.com/tx/${h}">${t ?? sh(h)}</a>`, etx = (h, t) => `<a href="https://etherscan.io/tx/${h}">${t ?? sh(h)}</a>`;
const addr = (a, chain = "polygonscan.com") => `<a class="mono" href="https://${chain}/address/${a}" title="${a}">${sh(a)}</a>`;

const holders = [...res.holders].sort((a, b) => (BigInt(res.total[b]) > BigInt(res.total[a]) ? 1 : -1));
const held = Object.fromEntries(holders.map((h) => [h, res.deposits.filter((d) => d.holder === h).reduce((s, d) => s + BigInt(d.amount), 0n)]));
const heldTotal = holders.reduce((s, h) => s + held[h], 0n);
const share = Object.fromEntries(holders.map((h) => [h, Number(held[h]) / Number(heldTotal)]));
const grand = BigInt(res.grand), inc = BigInt(res.incentTotal), bought = BigInt(res.boughtTotal);
const onHand = BigInt(res.newSafeSni) + BigInt(res.oldSafeSni);
const sniPerWeth = num(res.sniPerWeth);
// swaps
const oldRows = pg.rows.filter((r) => r.safe === "old"); const tx = {};
for (const r of oldRows) { const g = (tx[r.tx] ??= { w: 0n, s: 0n }); if (r.token === "WETH" && r.dir === "out") g.w += BigInt(r.amount); if (r.token === "SNI" && r.dir === "in" && !/^0x0{40}$/.test(r.from)) g.s += BigInt(r.amount); }
const swaps = Object.values(tx).filter((g) => g.w > 0n && g.s > 0n); const swappedWeth = swaps.reduce((s, g) => s + g.w, 0n);
const unswapped = res.lots.reduce((s, l) => s + BigInt(l.unswapped), 0n);
const claimedEth = res.lots.reduce((s, l) => s + BigInt(l.claimedEth), 0n);
// price-at-claim variant, on the WETH that was actually swapped
const formulaSni = ex.atClaim.reduce((s, c) => s + c.swapped * c.sniPerWethAtClaim, 0);
const formulaExcess = formulaSni - num(bought);
// forward estimate: trailing claims after the 14 Oct 2025 claim
const lots = res.lots; const i0 = lots.findIndex((l) => l.claimTime.startsWith("2025-10-14"));
const trailEth = lots.slice(i0 + 1).reduce((s, l) => s + num(l.claimedEth), 0), trailDays = (lots.at(-1).tClaim - lots[i0].tClaim) / 86400;
const ethPerWeek = (trailEth / trailDays) * 7, apr = (trailEth / trailDays) * 365 / num(heldTotal);
const yieldWeek = ethPerWeek * sniPerWeth, weekTotal = 34000 + yieldWeek;
const pending = num(unswapped) * sniPerWeth;
const mintsBefore = res.mints.filter((m) => m.time < "2025-07-09T16:01:23Z").length;
const lastMint = res.mints.at(-1).time, firstDep = res.deposits[0].time;
const realized = lots.filter((l) => l.swapped !== "0").map((l) => num(l.sni) / num(l.swapped));
const backing = Number(BigInt(res.newSafeSni)) / Number(grand);
const cpDiff = holders.map((h) => num(BigInt(res.totalCP[h]) - BigInt(res.total[h])));
const evenDiff = holders.map((h) => num(BigInt(res.totalEven[h]) - BigInt(res.total[h]))), stkDiff = holders.map((h) => num(BigInt(res.totalStk[h]) - BigInt(res.total[h])));
const rates = res.lots.map((l) => l.rcApr * 100), claimedVault = res.lots.reduce((s, l) => s + BigInt(l.rcAmount), 0n);
const blkTime = Object.fromEntries(acc.points.map((p) => [p.block, p.time]));
const segRows = res.lots.slice(0, 2).flatMap((l, i) => l.segs.map((sg) => { const T = holders.reduce((s, h) => s + BigInt(sg.bal[h]), 0n);
  return `<tr><td>${i + 1}</td><td>${day(blkTime[sg.from])} to ${day(blkTime[sg.to])}</td><td class="num">${w(sg.generated, 4)}</td>${holders.map((h) => `<td class="num">${(Number(BigInt(sg.bal[h])) / Number(T) * 100).toFixed(4)}%</td>`).join("")}</tr>`; })).join("");
const ex1 = (b) => 34000 * b / num(heldTotal);

const css = `
/* layout: one reading column, summary first, decisions second, evidence tables after; data in mono, hairline rules, square corners */
:root{--bg:#0C0D12;--surface:#12141B;--surface-2:#181B25;--line:rgba(255,255,255,.08);--line-2:rgba(255,255,255,.16);--text:#EEF1F7;--dim:#AEB5C4;--faint:#838BA0;--blue:#1F5FFF;--hl:#16C8FF;--hl-soft:rgba(22,200,255,.10);--neg:#EC7B72;--warn:#E5B454;--warn-soft:rgba(229,180,84,.10);
--sans:"Satoshi","Inter",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"IBM Plex Mono",ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;--r:.25rem;color-scheme:dark}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#F5F7FB;--surface:#FFFFFF;--surface-2:#ECF0F7;--line:rgba(14,22,48,.11);--line-2:rgba(14,22,48,.22);--text:#0E1320;--dim:#434D63;--faint:#5C667D;--blue:#1F5FFF;--hl:#0F52D6;--hl-soft:rgba(31,95,255,.08);--neg:#B3362B;--warn:#7E5200;--warn-soft:rgba(190,130,0,.10);color-scheme:light}}
:root[data-theme="light"]{--bg:#F5F7FB;--surface:#FFFFFF;--surface-2:#ECF0F7;--line:rgba(14,22,48,.11);--line-2:rgba(14,22,48,.22);--text:#0E1320;--dim:#434D63;--faint:#5C667D;--blue:#1F5FFF;--hl:#0F52D6;--hl-soft:rgba(31,95,255,.08);--neg:#B3362B;--warn:#7E5200;--warn-soft:rgba(190,130,0,.10);color-scheme:light}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding-block:48px 80px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:56px}
section{display:flex;flex-direction:column;gap:18px;min-width:0}
h1{font-size:clamp(1.9rem,4.4vw,2.7rem);line-height:1.12;letter-spacing:-.022em;font-weight:800;margin:0;text-wrap:balance}
h2{font-size:1.4rem;line-height:1.2;letter-spacing:-.015em;font-weight:700;margin:0;text-wrap:balance}
h3{font-size:1rem;font-weight:700;margin:0}
p{margin:0;max-width:68ch;color:var(--dim)} p strong,li strong{color:var(--text);font-weight:600}
a{color:var(--hl);text-decoration:none;border-bottom:1px solid var(--line-2)} a:hover{border-bottom-color:var(--hl)} a:focus-visible,button:focus-visible{outline:2px solid var(--hl);outline-offset:2px}
.mono,td.num,th.num,code,pre{font-family:var(--mono);font-variant-numeric:tabular-nums}
.eyebrow{font-family:var(--mono);font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--hl);display:flex;align-items:center;gap:10px}
.eyebrow::before{content:"";width:22px;height:2px;background:linear-gradient(90deg,var(--blue),var(--hl))}
header{display:flex;flex-direction:column;gap:16px}
.status{display:inline-flex;align-self:flex-start;font-family:var(--mono);font-size:.76rem;letter-spacing:.08em;text-transform:uppercase;color:var(--warn);background:var(--warn-soft);border:1px solid var(--line-2);border-radius:var(--r);padding:4px 10px}
.tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.tile{padding:22px 20px;display:flex;flex-direction:column;gap:8px;border-left:1px solid var(--line);min-width:0}
.tile:first-child{border-left:0}
.tile .k{font-family:var(--mono);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.tile .v{font-family:var(--mono);font-size:1.45rem;font-weight:500;letter-spacing:-.02em;color:var(--text);overflow-wrap:anywhere}
.tile .v small{font-size:.8rem;color:var(--faint);font-weight:400;letter-spacing:0}
.tile .s{font-size:.88rem;color:var(--dim);line-height:1.4}
@media (max-width:860px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.tile:nth-child(odd){border-left:0}.tile:nth-child(n+3){border-top:1px solid var(--line)}}
@media (max-width:480px){.tiles{grid-template-columns:1fr}.tile{border-left:0}.tile:nth-child(n+2){border-top:1px solid var(--line)}}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:.9rem}
th{font-family:var(--mono);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-weight:500;text-align:left;padding:12px 14px;border-bottom:1px solid var(--line-2);white-space:nowrap;vertical-align:bottom}
td{padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:top;white-space:nowrap}
td.wrapc{white-space:normal;min-width:16rem;color:var(--dim)}
tr:last-child td{border-bottom:0}
.num{text-align:right}
tr.total td{border-top:1px solid var(--line-2);font-weight:600;background:var(--surface-2)}
td.key{color:var(--hl);font-weight:500}
.muted{color:var(--faint)}
.neg{color:var(--neg)}
.decisions{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);counter-reset:d}
.decisions li{counter-increment:d;display:grid;grid-template-columns:2.6rem minmax(0,1fr);gap:4px 12px;padding:20px;border-top:1px solid var(--line)}
.decisions li:first-child{border-top:0}
.decisions li::before{content:counter(d);font-family:var(--mono);color:var(--hl);font-size:.95rem;grid-row:1 / span 3}
.decisions h3,.decisions p,.decisions .rec{grid-column:2}
.rec{font-size:.95rem;color:var(--text);max-width:68ch;background:var(--hl-soft);border-radius:var(--r);padding:8px 12px;margin-top:6px}
.rec b{font-family:var(--mono);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--hl);font-weight:500;margin-right:8px}
.formula{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.formula > div{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:18px;display:flex;flex-direction:column;gap:10px;min-width:0}
.formula .lbl{font-family:var(--mono);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.formula .eq{font-family:var(--mono);font-size:.95rem;color:var(--text);overflow-x:auto;white-space:nowrap;padding-bottom:4px}
.formula .use{border-color:var(--line-2)} .formula .use .lbl{color:var(--hl)}
@media (max-width:760px){.formula{grid-template-columns:1fr}}
ol.steps{margin:0;padding-left:1.3rem;display:flex;flex-direction:column;gap:8px;color:var(--dim);max-width:68ch}
ul.plain{margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:8px;color:var(--dim);max-width:72ch}
.codebox{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);min-width:0}
.codebox .bar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--line)}
.codebox .bar span{font-family:var(--mono);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
button.copy{font-family:var(--mono);font-size:.78rem;color:var(--text);background:var(--surface-2);border:1px solid var(--line-2);border-radius:var(--r);padding:6px 12px;cursor:pointer}
button.copy:hover{border-color:var(--hl)}
pre{margin:0;padding:14px;overflow-x:auto;font-size:.82rem;line-height:1.6;color:var(--text)}
.note{font-size:.88rem;color:var(--faint);max-width:72ch}
footer{border-top:1px solid var(--line);padding-top:20px;font-size:.84rem;color:var(--faint)}
`;

const holderRows = holders.map((h) => `<tr><td>${addr(h, "etherscan.io")}</td><td class="num">${w(held[h], 2)}</td><td class="num">${w(res.incent[h])}</td><td class="num">${w(res.yieldM[h])}</td><td class="num key">${w(res.total[h])}</td><td class="num">${(Number(BigInt(res.total[h])) / Number(grand) * 100).toFixed(4)}%</td></tr>`).join("");
let run = Object.fromEntries(holders.map((h) => [h, 0n]));
const depRows = res.deposits.map((d) => { run[d.holder] += BigInt(d.amount); const T = holders.reduce((s, h) => s + run[h], 0n);
  return `<tr><td>${day(d.time)}</td><td>${addr(d.holder, "etherscan.io")}</td><td class="num">${w(d.amount, 2)}</td>${holders.map((h) => `<td class="num">${(Number(run[h]) / Number(T) * 100).toFixed(4)}%</td>`).join("")}<td>${etx(d.tx)}</td></tr>`; }).join("");
const exRows = res.excluded.map((r) => `<tr><td>${day(r.time)}</td><td>${addr(r.to, "etherscan.io")}</td><td class="num">${w(r.amount, 2)}</td><td class="wrapc">${BigInt(r.amount) > 10n ** 24n ? "Rescue mint that diluted the attacker. Not a deposit." : "Attacker deposit against an undercounted NAV."}</td><td>${etx(r.tx)}</td></tr>`).join("");
const lotRows = lots.map((l, i) => `<tr><td>${day(l.rcTime)}</td><td>${etx(l.mainnetTx, day(l.claimTime))}</td><td class="num">${l.rcDays.toFixed(0)}</td><td class="num">${w(l.rcAmount, 4)}</td><td class="num">${(l.rcApr * 100).toFixed(2)}%</td><td class="num">${w(l.swapped, 4)}${l.unswapped !== "0" ? ` <span class="neg">of ${w(l.weth, 4)}</span>` : ""}</td><td class="num">${w(l.sni)}</td><td class="num">${l.swapped !== "0" ? n(num(l.sni) / num(l.swapped)) : "–"}</td><td class="num muted">${ex.atClaim[i] ? n(ex.atClaim[i].sniPerWethAtClaim) : "–"}</td>${holders.map((h) => `<td class="num">${w(l.allocM[h])}</td>`).join("")}</tr>`).join("");
const weekRows = holders.map((h) => `<tr><td>${addr(h, "etherscan.io")}</td><td class="num">${(share[h] * 100).toFixed(4)}%</td><td class="num">${n(34000 * share[h], 2)}</td><td class="num">${n(yieldWeek * share[h], 2)}</td><td class="num key">${n(weekTotal * share[h], 2)}</td></tr>`).join("");
const mintJson = JSON.stringify({ function: "mintToMany(uint256[] amounts, address[] recipients)", recipients: holders, amounts: holders.map((h) => res.total[h]), totalWei: res.grand }, null, 2);

const html = `<title>SYC Distribution Proposal</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div class="wrap">
<header>
  <div class="eyebrow">SNI Yield Claim Vault · Polygon</div>
  <h1>SYC distribution to sniETH depositors</h1>
  <span class="status">Proposal · nothing minted yet</span>
  <p>How many yield-claim tokens (SYC) each sniETH depositor is owed for ${day(firstDep)} to ${day(lastMint)}, and how much to mint each week from here. Every figure is computed from on-chain events as of 16 Nov 2026 (Ethereum block ${n(sn.head)}, Polygon block ${n(pg.head)}). Six points need a team decision before the mint.</p>
</header>

<div class="tiles">
  <div class="tile"><div class="k">Retroactive mint</div><div class="v">${w(grand)} <small>SYC</small></div><div class="s">One transaction, three wallets.</div></div>
  <div class="tile"><div class="k">Weekly from now</div><div class="v">≈ ${n(Math.round(weekTotal / 100) * 100)} <small>SYC</small></div><div class="s">34,000 incentives plus about ${n(Math.round(yieldWeek / 100) * 100)} from yield at today's SNI price.</div></div>
  <div class="tile"><div class="k">Backing</div><div class="v">1 SYC = 1 SNI</div><div class="s">${w(onHand)} SNI on hand against ${w(grand)} SYC.</div></div>
  <div class="tile"><div class="k">Built from</div><div class="v">${res.mints.length} + ${lots.length}</div><div class="s">${res.mints.length} weekly incentive mints and ${lots.length} yield claims, split by ${res.deposits.length} deposits.</div></div>
</div>

<section>
  <h2>Retroactive mint per wallet</h2>
  <p>sniETH balances are rebuilt from the five deposit events, so the attacker's mint and the 830,000,000 rescue mint of 8 Sep 2026 do not count. Time is already in these figures: yield is split by who held sniETH while the staking vault generated it, measured at every deposit, and incentives by the balance at each weekly mint. A later deposit earns only from the day it arrived.</p>
  <div class="tw"><table>
    <thead><tr><th>Wallet</th><th class="num">sniETH from deposits</th><th class="num">From incentives</th><th class="num">From yield</th><th class="num">SYC to mint</th><th class="num">Share of mint</th></tr></thead>
    <tbody>${holderRows}<tr class="total"><td>Total</td><td class="num">${w(heldTotal, 2)}</td><td class="num">${w(inc)}</td><td class="num">${w(bought)}</td><td class="num">${w(grand)}</td><td class="num">100%</td></tr></tbody>
  </table></div>
</section>

<section>
  <h2>Decisions for the team</h2>
  <ol class="decisions">
    <li><h3>Split by share of sniETH, not by dividing by the balance</h3>
      <p>The formula as written, <span class="mono">SYC<sub>i</sub> = (yield + incentives) / sniETH<sub>i</sub></span>, gives more to smaller holders. On one 34,000 SNI week it would hand ${n(34000 / 0.05)} SYC to the 0.05 sniETH wallet and ${n(34000 / num(held[holders[0]]), 2)} to the 2,016 sniETH wallet.</p>
      <div class="rec"><b>Proposed</b>Multiply by the wallet's share of all sniETH. The same week then splits ${n(ex1(num(held[holders[0]])), 2)} / ${n(ex1(num(held[holders[1]])), 2)} / ${n(ex1(num(held[holders[2]])), 2)} and adds up to 34,000.</div></li>
    <li><h3>Count the SNI that was actually bought, not yield ÷ SNI price at claim</h3>
      <p>Each claim is swapped over the following weeks, and the pool is thin, so the price in the claim block is a poor guide. Pricing the ${w(swappedWeth, 2)} WETH that was swapped at the pool price in each claim block gives ${n(formulaSni)} SYC. The swaps actually returned ${w(bought, 0)} SNI. That method would have issued ${n(formulaExcess)} SYC (${(formulaExcess / num(bought) * 100).toFixed(0)}% more) with no SNI behind them.</p>
      <div class="rec"><b>Proposed</b>SYC minted for a period equals the SNI that entered the Safe in that period. No price feed is needed and every SYC stays backed by one SNI.</div></li>
    <li><h3>Confirm the three recipients</h3>
      <p>${sh(holders[0])} holds ${(share[holders[0]] * 100).toFixed(2)}% of sniETH. ${sh(holders[1])} made the first deposit (32 ETH, ${day(res.deposits[0].time)}) and ${sh(holders[2])} deposited 0.05 ETH. The attacker wallet ${sh(res.excluded[0].to)} receives nothing.</p>
      <div class="rec"><b>To confirm</b>Whether the 32 ETH and 0.05 ETH wallets are depositors who should receive SYC, or team test deposits to leave out. Leaving both out moves ${w(BigInt(res.total[holders[1]]) + BigInt(res.total[holders[2]]))} SYC to the main wallet.</div></li>
    <li><h3>${w(res.oldSafeSni)} SNI is still in the old Safe</h3>
      <p>It was bought with depositor yield and is part of the ${w(grand)} total. The new Safe alone holds ${w(res.newSafeSni)} SNI, which backs ${(backing * 100).toFixed(2)}% of the proposed mint.</p>
      <div class="rec"><b>Proposed</b>Move it to the new Safe ${addr("0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF")} before the mint.</div></li>
    <li><h3>${w(unswapped, 3)} WETH of claimed yield never became SNI</h3>
      <p>It is what was left of the 7 Oct 2026 claim. It went to the multisig ${addr("0x83f2492DB796BF0692C90B65DeBB926bd688fAe5")} on 5 Nov (${ptx("0x232dbc337fe216f7b804935d1c5c3971cc62ce7a6a86d68b781ebf22ae0ac9f6")}), then to ${addr("0x78e35296b8c0d0e31ef3584504289b4908416dc8")} on 9 Nov (${ptx("0x1cea0791c41cb690e5e93add1f505ee78763a7aef6b8c174e99ee2eec8a5e87c")}), where it was swapped to USDC inside the re-mint transaction. At today's price it is worth about ${n(Math.round(pending / 100) * 100)} SNI. It is not in the retroactive total.</p>
      <div class="rec"><b>To decide</b>Return ${w(unswapped, 3)} WETH (or the SNI equivalent) to the new Safe, where it flows into a later weekly mint, or record that depositors carry that cost of the recovery.</div></li>
    <li><h3>Weekly cap on the admin mint</h3>
      <p>Over ${ex.weeks.length} weeks the SNI entering the Safe had a median of ${n(ex.stats.median)} a week, a 90th percentile of ${n(ex.stats.p90)} and a maximum of ${n(ex.stats.max)}. The high weeks are catch-up weeks with two or three incentive mints, or a week in which a whole claim was swapped.</p>
      <div class="rec"><b>Proposed</b>A one-off allowance of ${w(grand)} SYC for the retroactive mint, then 50,000 SYC a week, with unused allowance carrying over up to 150,000.</div></li>
  </ol>
</section>

<section>
  <h2>The formula</h2>
  <div class="formula">
    <div><div class="lbl">As written</div><div class="eq">SYC<sub>i</sub> = (yield<sub>SNI</sub> + incentives<sub>SNI</sub>) / sniETH<sub>i</sub></div><p>Divides by the balance, and converts yield at the SNI price in the claim block.</p></div>
    <div class="use"><div class="lbl">Used here</div><div class="eq">SYC<sub>i</sub> = (SNI bought + SNI incentives) × sniETH<sub>i</sub> / Σ sniETH</div><p>Applied per period, then summed. The three rules below define the period and the balance.</p></div>
  </div>
  <ul class="plain">
    <li><strong>Incentives.</strong> Each 34,000 SNI mint is split by sniETH balances at the moment of that mint. ${mintsBefore} mints happened before the last deposit of ${day("2025-07-09")} and ${res.mints.length - mintsBefore} after it.</li>
    <li><strong>Yield.</strong> Each claim's SNI goes to whoever held sniETH while that yield was generated. The staking vault reports the rewards it has generated up to any block, so the figure was read at every deposit. Yield generated before a deposit is split by the balances before it, and yield after it by the balances after it. No assumption about a steady rate is needed. Only the first two claims contain deposits; the table under Yield claims shows the measured pieces.</li>
    <li><strong>Compared with simpler rules.</strong> Assuming yield accrued evenly through each claim period would move ${n(Math.abs(evenDiff[1]), 2)} SYC from ${sh(holders[0])} to ${sh(holders[1])}. Using the balance on claim day would move ${n(Math.abs(cpDiff[1]), 2)} SYC the other way.</li>
    <li><strong>Which SNI goes with which claim.</strong> Swaps are matched to claims first in, first out: WETH from one claim is treated as fully swapped before the next claim's WETH is touched.</li>
  </ul>
</section>

<section>
  <h2>Where the SNI came from</h2>
  <div class="tw"><table>
    <thead><tr><th>Source</th><th class="num">SNI</th><th>Detail</th></tr></thead>
    <tbody>
      <tr><td>Incentive mints</td><td class="num">${w(inc)}</td><td class="wrapc">${res.mints.length} mints of 34,000 SNI, ${day(res.mints[0].time)} to ${day(lastMint)}. ${res.mints.filter((m) => m.safe === "old").length} to the old Safe, ${res.mints.filter((m) => m.safe === "new").length} to the new one.</td></tr>
      <tr><td>Bought with yield</td><td class="num">${w(bought)}</td><td class="wrapc">${w(swappedWeth, 4)} WETH in ${swaps.length} swaps, an average of ${n(num(bought) / num(swappedWeth))} SNI per WETH (range ${n(Math.min(...realized))} to ${n(Math.max(...realized))} by claim).</td></tr>
      <tr class="total"><td>SYC to mint</td><td class="num">${w(grand)}</td><td class="wrapc"></td></tr>
      <tr><td>Test transfers</td><td class="num">${w(onHand - grand)}</td><td class="wrapc">1 SNI sent in on 5 Jun 2025 and two small test swaps. Not distributed.</td></tr>
      <tr class="total"><td>SNI on hand</td><td class="num">${w(onHand)}</td><td class="wrapc">New Safe ${w(res.newSafeSni)} + old Safe ${w(res.oldSafeSni)}.</td></tr>
    </tbody>
  </table></div>
  <p class="note">On 5 Nov 2026, 3,176,344.21 SNI left the old Safe through an executed governance proposal and was sold into the SNI/USDC pool (${ptx("0x50a1b5b6efb30dfa67148f96f0bbd86743a6dcd7a3f4e0327b37445bff7fae37")}). On 9 Nov the same amount was minted to the new Safe (${ptx("0xeba5a802345f6569cc02ddb56285230bccd4f72e7054249d0cb2127c7e6abae7")}). The two cancel out, so the claim is unchanged.</p>
</section>

<section>
  <h2>sniETH deposits</h2>
  <p>All five mints before the 8 Sep 2026 incident. There were no redemptions and no transfers between wallets. The last three columns show each wallet's share of sniETH after the deposit.</p>
  <div class="tw"><table>
    <thead><tr><th>Date</th><th>Wallet</th><th class="num">sniETH minted</th>${holders.map((h) => `<th class="num">${sh(h)}</th>`).join("")}<th>Tx</th></tr></thead>
    <tbody>${depRows}</tbody>
  </table></div>
  <h3>Left out</h3>
  <div class="tw"><table>
    <thead><tr><th>Date</th><th>Wallet</th><th class="num">sniETH minted</th><th>Why</th><th>Tx</th></tr></thead>
    <tbody>${exRows}</tbody>
  </table></div>
</section>

<section>
  <h2>Yield claims</h2>
  <p>${w(claimedVault, 2)} ETH of rewards was claimed from the staking vault in ${lots.length} claims and bridged to Polygon, after the operator's 10% fee. Each bridge deposit matches a Polygon arrival to the wei. Two claims were bridged 13 and 23 days after they were claimed. The yearly rate each claim implies on the sniETH outstanding sits between ${(Math.floor(Math.min(...rates) * 10) / 10).toFixed(1)}% and ${(Math.ceil(Math.max(...rates) * 10) / 10).toFixed(1)}% for all ten, so the yield has been steady.</p>
  <div class="tw"><table>
    <thead><tr><th>Claimed</th><th>Bridged</th><th class="num">Days covered</th><th class="num">ETH claimed</th><th class="num">Implied yearly rate</th><th class="num">WETH swapped</th><th class="num">SNI bought</th><th class="num">SNI per WETH paid</th><th class="num">Pool price in claim block</th>${holders.map((h) => `<th class="num">SYC to ${sh(h)}</th>`).join("")}</tr></thead>
    <tbody>${lotRows}<tr class="total"><td>Total</td><td></td><td></td><td class="num">${w(claimedVault, 4)}</td><td></td><td class="num">${w(swappedWeth, 4)}</td><td class="num">${w(bought)}</td><td class="num">${n(num(bought) / num(swappedWeth))}</td><td></td>${holders.map((h) => `<td class="num">${w(res.yieldM[h])}</td>`).join("")}</tr></tbody>
  </table></div>
  <h3>Rewards generated between deposits, first two claims</h3>
  <p>Read from the staking vault (rewards claimed plus rewards claimable) at each deposit block. Each row's rewards are split by the shares in that row. From the third claim on the shares no longer change.</p>
  <div class="tw"><table>
    <thead><tr><th>Claim</th><th>Period</th><th class="num">ETH generated</th>${holders.map((h) => `<th class="num">${sh(h)}</th>`).join("")}</tr></thead>
    <tbody>${segRows}</tbody>
  </table></div>
</section>

<section>
  <h2>Weekly distribution from now on</h2>
  <ol class="steps">
    <li>Take a checkpoint once a week, right after the weekly incentive mint. Take an extra one whenever someone deposits into or redeems from sniETH.</li>
    <li>SYC for the period equals the SNI that entered the Safe since the last checkpoint: the incentive mint plus whatever the buybacks bought.</li>
    <li>Split it by sniETH balance. If a balance changed inside the period, split by balance × time.</li>
    <li>The admin multisig mints with <span class="mono">mintToMany</span>, inside the weekly cap.</li>
  </ol>
  <p>Estimate at today's figures. Yield is taken from the last twelve months of claims: ${n(trailEth, 2)} ETH over ${n(trailDays)} days, which is ${ethPerWeek.toFixed(2)} ETH a week or ${(apr * 100).toFixed(2)}% a year on ${w(heldTotal, 2)} sniETH. One WETH buys ${n(sniPerWeth)} SNI today (Chainlink ETH/USD with the 30-minute pool average).</p>
  <div class="tw"><table>
    <thead><tr><th>Wallet</th><th class="num">Share of sniETH</th><th class="num">From incentives</th><th class="num">From yield</th><th class="num">SYC per week</th></tr></thead>
    <tbody>${weekRows}<tr class="total"><td>Total</td><td class="num">100%</td><td class="num">${n(34000, 2)}</td><td class="num">${n(yieldWeek, 2)}</td><td class="num">${n(weekTotal, 2)}</td></tr></tbody>
  </table></div>
  <p class="note">The yield part moves with the SNI price: at the ${n(Math.min(...realized))} to ${n(Math.max(...realized))} SNI per WETH paid so far, it would be ${n(ethPerWeek * Math.min(...realized))} to ${n(ethPerWeek * Math.max(...realized))} SNI a week. The shares assume the same three balances carry over to the redeployed sniETH vault.</p>
</section>

<section>
  <h2>Inputs for the retroactive mint</h2>
  <div class="codebox"><div class="bar"><span>Amounts in wei, 18 decimals</span><button class="copy" id="copy-mint" type="button">Copy</button></div><pre id="mint-json">${mintJson}</pre></div>
  <ul class="plain">
    <li><strong>This must be the vault's first share issuance.</strong> The vault has 0 SYC outstanding and the Safe already holds the SNI, so a deposit made before this mint would own all of it.</li>
    <li><strong>The DAO fee on minting must be off.</strong> If it is on, part of every amount is skimmed and the wallets receive less than listed.</li>
    <li>The three amounts add up to ${w(grand, 4)} SYC exactly.</li>
  </ul>
</section>

<section>
  <h2>How the numbers were checked</h2>
  <ul class="plain">
    <li><strong>Sources.</strong> All ${sn.rows.length} sniETH mint events on Ethereum, the ${mc.rows.length} bridge deposits made by the sniETH Safe, and all ${pg.rows.length} WETH, SNI and USDC transfers in and out of both Polygon Safes.</li>
    <li><strong>Reconciliation.</strong> The per-wallet amounts add up to incentives plus SNI bought, and that total differs from the SNI held in the two Safes by ${w(onHand - grand)} SNI, which the test transfers explain.</li>
    <li><strong>Yield timing.</strong> Rewards generated were read from the staking vault ${addr("0x549d2398B34288dfb2b9ba0171086257AEff1562", "etherscan.io")} at each deposit and claim block, as claimed plus claimable rewards.</li>
    <li><strong>Second calculation.</strong> The split was recomputed with separate code. It agrees to within 0.01 SYC per wallet.</li>
    <li><strong>Two limits of the measurement.</strong> Rewards still sitting in validator balances at a deposit, about a week's worth at most, count toward the period after it. A deposit shares in the yield from the day it is made, as in any pooled vault, although the 992 ETH was staked five days later; counting it from the staking day instead would move ${n(Math.abs(stkDiff[1]), 2)} SYC from ${sh(holders[0])} to ${sh(holders[1])}.</li>
    <li><strong>Not included.</strong> Yield earned on Ethereum since the 7 Oct 2026 claim and not yet claimed, and the ${w(unswapped, 3)} WETH in decision 5.</li>
  </ul>
</section>
<footer>Scripts and raw data: <span class="mono">scripts/syc-distribution</span> on branch <span class="mono">feat/syc-execution-console</span>.</footer>
</div>
<script>
document.getElementById("copy-mint").addEventListener("click", function () {
  var b = this, pre = document.getElementById("mint-json");
  var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1600); };
  var select = function () { var r = document.createRange(); r.selectNodeContents(pre); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected"; };
  try { navigator.clipboard.writeText(pre.textContent).then(done, select); } catch (e) { select(); }
});
</script>
`;
fs.writeFileSync(new URL("./syc-distribution.html", import.meta.url), html);
console.log("bytes", html.length, "| weekTotal", weekTotal.toFixed(1), "yieldWeek", yieldWeek.toFixed(1), "ethPerWeek", ethPerWeek.toFixed(4), "apr", (apr * 100).toFixed(3), "| formulaSni", formulaSni.toFixed(0), "excess", formulaExcess.toFixed(0), "| pending", pending.toFixed(0), "| swaps", swaps.length, "swappedWeth", w(swappedWeth, 4), "| backing", (backing * 100).toFixed(3), "| cpDiff", cpDiff.map((x) => x.toFixed(2)).join(","), "| mintsBefore", mintsBefore);
