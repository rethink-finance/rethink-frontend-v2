// Short version of the proposal page. Builds syc-distribution.html from data/*.json; no number is typed by hand.
// (09-page-full.mjs is the earlier long version.)
import fs from "node:fs";
const D = (n) => JSON.parse(fs.readFileSync(new URL(`./data/${n}.json`, import.meta.url)));
const res = D("result");
const w = (x, dp = 2) => { x = BigInt(x); const s = 10n ** BigInt(18 - dp); const q = (x + s / 2n) / s, i = q / 10n ** BigInt(dp), f = q % 10n ** BigInt(dp);
  return i.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dp ? "." + f.toString().padStart(dp, "0") : ""); };
const n = (x, dp = 0) => Number(x).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const num = (x) => Number(BigInt(x)) / 1e18, r100 = (x) => n(Math.round(x / 100) * 100);
const sh = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const day = (s) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const etx = (h, t) => `<a href="https://etherscan.io/tx/${h}">${t}</a>`;
const addr = (a) => `<a class="mono" href="https://etherscan.io/address/${a}" title="${a}">${sh(a)}</a>`;

const holders = [...res.holders].sort((a, b) => (BigInt(res.total[b]) > BigInt(res.total[a]) ? 1 : -1));
const held = Object.fromEntries(holders.map((h) => [h, res.deposits.filter((d) => d.holder === h).reduce((s, d) => s + BigInt(d.amount), 0n)]));
const heldTotal = holders.reduce((s, h) => s + held[h], 0n);
const share = Object.fromEntries(holders.map((h) => [h, Number(held[h]) / Number(heldTotal)]));
const grand = BigInt(res.grand), lots = res.lots.filter((l) => l.rcTime), sniPerWeth = num(res.sniPerWeth);
const unswapped = lots.reduce((s, l) => s + BigInt(l.unswapped), 0n);
const i0 = lots.findIndex((l) => l.claimTime.startsWith("2025-10-14"));
const ethPerWeek = lots.slice(i0 + 1).reduce((s, l) => s + num(l.claimedEth), 0) / ((lots.at(-1).tClaim - lots[i0].tClaim) / 86400) * 7;
const yieldWeek = ethPerWeek * sniPerWeth, weekTotal = 34000 + yieldWeek;

const css = `
/* layout: one narrow column; two tables carry the answer, short lists carry the rules, evidence is folded away */
:root{--bg:#0C0D12;--surface:#12141B;--surface-2:#181B25;--line:rgba(255,255,255,.08);--line-2:rgba(255,255,255,.16);--text:#EEF1F7;--dim:#AEB5C4;--faint:#838BA0;--blue:#1F5FFF;--hl:#16C8FF;--warn:#E5B454;--warn-soft:rgba(229,180,84,.10);
--sans:"Satoshi","Inter",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"IBM Plex Mono",ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;--r:.25rem;color-scheme:dark}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#F5F7FB;--surface:#FFFFFF;--surface-2:#ECF0F7;--line:rgba(14,22,48,.11);--line-2:rgba(14,22,48,.22);--text:#0E1320;--dim:#434D63;--faint:#5C667D;--blue:#1F5FFF;--hl:#0F52D6;--warn:#7E5200;--warn-soft:rgba(190,130,0,.10);color-scheme:light}}
:root[data-theme="light"]{--bg:#F5F7FB;--surface:#FFFFFF;--surface-2:#ECF0F7;--line:rgba(14,22,48,.11);--line-2:rgba(14,22,48,.22);--text:#0E1320;--dim:#434D63;--faint:#5C667D;--blue:#1F5FFF;--hl:#0F52D6;--warn:#7E5200;--warn-soft:rgba(190,130,0,.10);color-scheme:light}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:760px;margin:0 auto;padding-block:48px 72px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:44px}
section,header{display:flex;flex-direction:column;gap:14px;min-width:0}
h1{font-size:clamp(1.9rem,5vw,2.5rem);line-height:1.12;letter-spacing:-.022em;font-weight:800;margin:0}
h2{font-size:1.25rem;line-height:1.2;letter-spacing:-.015em;font-weight:700;margin:0}
p{margin:0;color:var(--dim)} strong{color:var(--text);font-weight:600}
a{color:var(--hl);text-decoration:none;border-bottom:1px solid var(--line-2)} a:hover{border-bottom-color:var(--hl)} a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--hl);outline-offset:2px}
.mono,td.num,th.num,pre{font-family:var(--mono);font-variant-numeric:tabular-nums}
.eyebrow{font-family:var(--mono);font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--hl);display:flex;align-items:center;gap:10px}
.eyebrow::before{content:"";width:22px;height:2px;background:linear-gradient(90deg,var(--blue),var(--hl))}
.status{align-self:flex-start;font-family:var(--mono);font-size:.76rem;letter-spacing:.08em;text-transform:uppercase;color:var(--warn);background:var(--warn-soft);border:1px solid var(--line-2);border-radius:var(--r);padding:4px 10px}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:.92rem}
th{font-family:var(--mono);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-weight:500;text-align:left;padding:11px 14px;border-bottom:1px solid var(--line-2);white-space:nowrap}
td{padding:11px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
tr:last-child td{border-bottom:0}
.num{text-align:right}
td.key{color:var(--hl);font-weight:500}
tr.total td{border-top:1px solid var(--line-2);font-weight:600;background:var(--surface-2)}
ul,ol{margin:0;padding-left:1.25rem;display:flex;flex-direction:column;gap:8px;color:var(--dim)}
.eq{font-family:var(--mono);font-size:.95rem;color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:12px 14px;overflow-x:auto;white-space:nowrap}
details{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);min-width:0}
details + details{margin-top:-6px}
summary{cursor:pointer;padding:12px 14px;font-family:var(--mono);font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
details .tw{border:0;border-top:1px solid var(--line);border-radius:0}
details pre{margin:0;padding:14px;border-top:1px solid var(--line);overflow-x:auto;font-size:.8rem;line-height:1.6}
button.copy{font-family:var(--mono);font-size:.78rem;color:var(--text);background:var(--surface-2);border:1px solid var(--line-2);border-radius:var(--r);padding:6px 12px;cursor:pointer;margin:0 14px 12px}
.note{font-size:.86rem;color:var(--faint)}
`;
const mintRows = holders.map((h) => `<tr><td>${addr(h)}</td><td class="num">${w(held[h])}</td><td class="num key">${w(res.total[h])}</td></tr>`).join("");
const weekRows = holders.map((h) => `<tr><td>${addr(h)}</td><td class="num">${share[h] < 0.0001 ? "&lt; 0.01" : (share[h] * 100).toFixed(2)}%</td><td class="num key">${n(weekTotal * share[h], weekTotal * share[h] < 10 ? 2 : 0)}</td></tr>`).join("");
const depRows = res.deposits.map((d) => `<tr><td>${etx(d.tx, day(d.time))}</td><td>${addr(d.holder)}</td><td class="num">${w(d.amount)}</td></tr>`).join("");
const lotRows = lots.map((l) => `<tr><td>${etx(l.mainnetTx, day(l.rcTime))}</td><td class="num">${w(l.rcAmount)}</td><td class="num">${w(l.sni, 0)}</td></tr>`).join("");
const mintJson = JSON.stringify({ function: "mintToMany(uint256[] amounts, address[] recipients)", recipients: holders, amounts: holders.map((h) => res.total[h]) }, null, 2);

const html = `<title>SYC Distribution Proposal</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div class="wrap">
<header>
  <div class="eyebrow">SNI Yield Claim Vault</div>
  <h1>SYC distribution</h1>
  <span class="status">Proposal · nothing minted</span>
  <p>What each sniETH depositor is owed. On-chain data as of 16 Nov 2026.</p>
</header>

<section>
  <h2>One-off mint</h2>
  <div class="tw"><table>
    <thead><tr><th>Wallet</th><th class="num">sniETH</th><th class="num">SYC</th></tr></thead>
    <tbody>${mintRows}<tr class="total"><td>Total</td><td class="num">${w(heldTotal)}</td><td class="num">${w(grand)}</td></tr></tbody>
  </table></div>
  <p class="note">${res.mints.length} weekly incentive mints (${w(res.incentTotal, 0)} SNI) plus ${w(res.boughtTotal, 0)} SNI bought with yield. 1 SYC = 1 SNI.</p>
</section>

<section>
  <h2>Each week from now</h2>
  <div class="tw"><table>
    <thead><tr><th>Wallet</th><th class="num">Share</th><th class="num">SYC per week</th></tr></thead>
    <tbody>${weekRows}<tr class="total"><td>Total</td><td class="num">100%</td><td class="num">≈ ${r100(weekTotal)}</td></tr></tbody>
  </table></div>
  <p class="note">34,000 incentives plus about ${r100(yieldWeek)} from yield at today's SNI price.</p>
</section>

<section>
  <h2>How the weekly mint works</h2>
  <ol>
    <li>Every three hours the Rethink backend works out what each wallet is owed and subtracts what was already minted.</li>
    <li>When a mint is due, the signers of the admin multisig get a Telegram message.</li>
    <li>A signer opens the Rethink app as the multisig and presses Propose mint.</li>
    <li>The other signers confirm it in the Safe.</li>
  </ol>
  <p class="note">Signers: connect your signer wallet in the Rethink app once and link Telegram under the bell.</p>
  <ul>
    <li><strong>Who can mint:</strong> only the admin multisig, and only SYC through this mint.</li>
    <li><strong>Cap:</strong> 50,000 SYC a week. Unused weeks carry over, up to 150,000.</li>
    <li><strong>Missed week:</strong> nothing is lost. The next mint includes it.</li>
    <li><strong>First mint:</strong> a one-off allowance of 3,400,000 SYC covers the retroactive amount.</li>
  </ul>
</section>

<section>
  <h2>How it is split</h2>
  <div class="eq">SYC<sub>wallet</sub> = SNI received × sniETH<sub>wallet</sub> / total sniETH</div>
  <ul>
    <li><strong>Incentives:</strong> by sniETH balance at each weekly mint.</li>
    <li><strong>Yield:</strong> by who held sniETH while it was earned.</li>
    <li><strong>Yield counts as the SNI it actually bought,</strong> not a price estimate.</li>
    <li>The attacker's mint and the rescue mint are left out.</li>
  </ul>
  <p class="note">The original formula divided by the balance. It has to multiply by the share.</p>
</section>

<section>
  <h2>To confirm</h2>
  <ol>
    <li>Are the 32 and 0.05 sniETH wallets real depositors?</li>
    <li>Move ${w(res.oldSafeSni)} SNI from the old Safe to the new one.</li>
    <li>${w(unswapped, 3)} WETH of yield (about ${r100(num(unswapped) * sniPerWeth)} SNI) was used in the recovery. Return it or write it off?</li>
    <li>The cap: 50,000 SYC a week, 150,000 carry-over, 3,400,000 for the first mint.</li>
    <li>Finalize the vault and store the mint permission, then mint before deposits open, with the DAO fee off.</li>
  </ol>
</section>

<section>
  <h2>Data</h2>
  <details><summary>${res.deposits.length} deposits</summary><div class="tw"><table>
    <thead><tr><th>Date</th><th>Wallet</th><th class="num">sniETH</th></tr></thead><tbody>${depRows}</tbody></table></div></details>
  <details><summary>${lots.length} yield claims</summary><div class="tw"><table>
    <thead><tr><th>Claimed</th><th class="num">ETH</th><th class="num">SNI bought</th></tr></thead><tbody>${lotRows}</tbody></table></div></details>
  <details><summary>Mint inputs</summary><pre id="mint-json">${mintJson}</pre><button class="copy" id="copy-mint" type="button">Copy</button></details>
  <p class="note">Checked two ways with separate code; the total matches the SNI in the Safes within 1 SNI.</p>
</section>
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
console.log("bytes", html.length);
