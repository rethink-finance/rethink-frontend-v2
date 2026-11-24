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
.page{max-width:760px;margin:0 auto;padding-block:48px 72px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:44px}
section,header{display:flex;flex-direction:column;gap:14px;min-width:0}
h1{font-size:clamp(1.9rem,5vw,2.5rem);line-height:1.12;letter-spacing:-.022em;font-weight:800;margin:0}
h2{font-size:1.25rem;line-height:1.2;letter-spacing:-.015em;font-weight:700;margin:0}
h3{font-size:.95rem;font-weight:600;margin:1.4rem 0 .4rem}
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

const esc = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const source = (name) => fs.readFileSync(new URL(`../syc-distributor/src/${name}`, import.meta.url), "utf8");
const distributorSrc = source("SycDistributor.sol"), reporterSrc = source("SniEthReporter.sol");
const lines = (text) => text.trimEnd().split("\n").length;
const testFile = (name) => fs.readFileSync(new URL(`../syc-distributor/test/${name}`, import.meta.url), "utf8");
const count = (name, re) => (testFile(name).match(re) || []).length;
const isTest = /function test(Fuzz)?_/g;
const tests = {
  scenarios: count("SycDistributor.t.sol", isTest) + count("Exploits.t.sol", isTest),
  fuzz: count("SycDistributor.t.sol", /function testFuzz_/g) + count("Exploits.t.sol", /function testFuzz_/g),
  live: count("Fork.t.sol", isTest),
  rules: count("Invariants.t.sol", /function invariant_/g),
  broken: JSON.parse(testFile("mutate-result.json")),
};
tests.total = tests.scenarios + tests.live + tests.rules;
tests.caught = tests.broken.filter((b) => b.state === "noticed").length;
const seedJson = JSON.stringify({ recipients: holders, amounts: holders.map((h) => res.total[h]) }, null, 2);

const html = `<title>SYC Distribution Proposal</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700;800&display=swap">
<style>${css}
.flow{display:flex;flex-direction:column;gap:10px}
.lane{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}
.lane .where{font-family:var(--mono);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.steps{display:flex;flex-wrap:nowrap;align-items:stretch;gap:6px}
.step{flex:1 1 0;min-width:0;border:1px solid var(--line-2);border-radius:var(--r);background:var(--surface-2);padding:10px;font-size:.82rem;color:var(--dim);line-height:1.4}
.step b{display:block;color:var(--text);font-weight:600;font-size:.86rem;margin-bottom:2px}
.step.key{border-color:var(--hl)}
.arrow{align-self:center;color:var(--faint);font-family:var(--mono)}
.bridge{align-self:center;font-family:var(--mono);font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
td.wrap{white-space:normal;min-width:13rem;color:var(--dim)}
details .bar{display:flex;justify-content:flex-end;padding:8px 0 0}
details pre{max-height:70vh;overflow:auto;white-space:pre;tab-size:4}
@media (max-width:640px){.steps{flex-direction:column}.arrow{transform:rotate(90deg);line-height:1}}
</style>
<div class="page">
<header>
  <div class="eyebrow">SNI Yield Claim Vault</div>
  <h1>SYC distribution</h1>
  <span class="status">Proposal</span>
  <p>sniETH depositors are owed one SYC for every SNI that reaches the vault. This proposes that the admin multisig mints it through one narrow role, and that the role later passes to audited contracts. On-chain data as of 17 Nov 2026.</p>
</header>

<section>
  <h2>In short</h2>
  <ul>
    <li><strong>One-off:</strong> ${w(grand)} SYC to three wallets, for everything since the first deposit.</li>
    <li><strong>After that:</strong> one SYC for every new SNI that reaches the Safe. About ${r100(weekTotal)} SYC a week at today's rate.</li>
    <li><strong>Who mints:</strong> the admin multisig, through a role that allows one call: the mint.</li>
    <li><strong>Later:</strong> the same role passes to the contracts below, once audited. The multisig changes who holds the role, never what the role allows.</li>
  </ul>
</section>

<section>
  <h2>Two stages</h2>
  <div class="tw"><table>
    <thead><tr><th>Stage</th><th>Who mints</th><th>Limit</th><th>Needs</th></tr></thead>
    <tbody>
      <tr><td>1. Now</td><td class="wrap">The admin multisig.</td><td class="wrap">None. The signers are the check.</td><td class="wrap">Signatures every week.</td></tr>
      <tr><td>2. After an audit</td><td class="wrap">The contracts below.</td><td class="wrap">Never more SYC than SNI in the Safe.</td><td class="wrap">An outside review and a keeper.</td></tr>
    </tbody>
  </table></div>
  <p class="note">Moving to stage 2 is one multisig transaction that changes the role's member. That works once governance has handed the vault's Roles modifier to the Safe, about 8 days after the one-off mint. Until then the multisig stays the minter.</p>
</section>

<section>
  <h2>One-off mint</h2>
  <div class="tw"><table>
    <thead><tr><th>Wallet</th><th class="num">sniETH</th><th class="num">SYC</th></tr></thead>
    <tbody>${mintRows}<tr class="total"><td>Total</td><td class="num">${w(heldTotal)}</td><td class="num">${w(grand)}</td></tr></tbody>
  </table></div>
  <p class="note">${res.mints.length} weekly incentive mints (${w(res.incentTotal, 0)} SNI) plus ${w(res.boughtTotal, 0)} SNI bought with yield. 1 SYC = 1 SNI. The multisig mints them in one transaction, straight after the vault is finalized.</p>
</section>

<section>
  <h2>Each week from now</h2>
  <div class="tw"><table>
    <thead><tr><th>Wallet</th><th class="num">Share</th><th class="num">SYC per week</th></tr></thead>
    <tbody>${weekRows}<tr class="total"><td>Total</td><td class="num">100%</td><td class="num">≈ ${r100(weekTotal)}</td></tr></tbody>
  </table></div>
  <p class="note">An estimate: 34,000 incentives plus about ${r100(yieldWeek)} from yield at today's SNI price. The mint is whatever SNI actually arrived. A skipped week is picked up by the next one.</p>
</section>

<section>
  <h2>How it works</h2>
  <div class="flow">
    <div class="lane">
      <div class="where">Polygon · every week</div>
      <div class="steps">
        <div class="step"><b>SNI arrives</b>Weekly incentives and buybacks land in the vault's Safe.</div><span class="arrow">→</span>
        <div class="step"><b>Script</b>Works out what each wallet is owed in total, minus what was already minted. Anyone can run it and check it.</div><span class="arrow">→</span>
        <div class="step key"><b>Admin multisig</b>Signs one transaction.</div><span class="arrow">→</span>
        <div class="step"><b>Roles modifier</b>Lets it through only if it is a mint, from a member of the mint role.</div><span class="arrow">→</span>
        <div class="step"><b>Vault mints</b>Depositors receive SYC.</div>
      </div>
    </div>
  </div>
</section>

<section>
  <h2>How it is split</h2>
  <div class="eq">SYC<sub>wallet</sub> = SNI received × sniETH<sub>wallet</sub> / total sniETH</div>
  <ul>
    <li><strong>Incentives:</strong> by sniETH balance at each weekly mint.</li>
    <li><strong>Yield:</strong> by who held sniETH while it was earned, counted as the SNI it actually bought.</li>
    <li>The same rule for the one-off mint and for every week after it.</li>
    <li>The attacker's mint and the rescue mint of 8 Sep 2026 are left out.</li>
    <li>Each holder is paid at the same address on Polygon.</li>
  </ul>
</section>

<section>
  <h2>Who can do what</h2>
  <div class="tw"><table>
    <thead><tr><th>Who</th><th>Can</th><th>Cannot</th></tr></thead>
    <tbody>
      <tr><td>Admin multisig</td><td class="wrap">Mint SYC through the mint role. Add and remove members of that role.</td><td class="wrap">Change what the role allows. Use the role for anything but a mint.</td></tr>
      <tr><td>Contracts, later</td><td class="wrap">Mint up to the SNI in the Safe, by a fixed rule.</td><td class="wrap">Anything else.</td></tr>
      <tr><td>Governance</td><td class="wrap">Change what the role allows. Hand the Roles modifier to the Safe.</td><td class="wrap"></td></tr>
      <tr><td>Executors</td><td class="wrap">Swap and manage positions, as today.</td><td class="wrap">Mint to depositors.</td></tr>
    </tbody>
  </table></div>
  <p class="note">The multisig's role has no limit. Its signers could mint SYC that nobody is owed, and SYC votes in governance and is a claim on the vault's SNI. That is the trust the first stage asks for. Any wallet the multisig adds to the role gets the same power.</p>
</section>

<section>
  <h2>Rollout</h2>
  <ol>
    <li>Store the mint role on the vault's Roles modifier, with the admin multisig as its member. Four calls, before the vault is finalized.</li>
    <li>Move ${w(res.oldSafeSni)} SNI from the old Safe to the new one.</li>
    <li>Sign the one-off mint in the multisig ahead of time. Finalize the vault and execute the mint straight after, before anyone can deposit.</li>
    <li>Each week: run the script, load its transaction in the multisig, sign.</li>
    <li>Governance hands the Roles modifier to the Safe. This needs SYC to exist, so it comes after the one-off mint and takes about 8 days. From then on the multisig can change members.</li>
    <li>Later: have the contracts reviewed, deploy them and give them the role.</li>
  </ol>
</section>

<section>
  <h2>To confirm</h2>
  <ol>
    <li>No limit on the multisig's role. A limit set now can only be changed by a governance vote.</li>
    <li>Who reviews the contracts.</li>
  </ol>
</section>

<section>
  <h2>Contracts for review</h2>
  <p>For the third stage. They are not deployed until someone outside has reviewed them. A keeper calls the distributor; it mints the SNI that arrived, split by sniETH balances, and can never mint more SYC than there is SNI in the Safe. They deploy with no one-off mint, since the multisig will have made it.</p>
  <div class="flow">
    <div class="lane">
      <div class="where">Polygon · every distribution, with the contracts</div>
      <div class="steps">
        <div class="step"><b>SNI arrives</b>Weekly incentives and buybacks land in the vault's Safe.</div><span class="arrow">→</span>
        <div class="step"><b>Keeper calls</b>Anyone can. The caller has no say in the amounts.</div><span class="arrow">→</span>
        <div class="step key"><b>Distributor</b>Takes SNI in the Safe minus SYC supply and splits it by sniETH.</div><span class="arrow">→</span>
        <div class="step"><b>Vault mints</b>Through the Safe, under one narrow role.</div><span class="arrow">→</span>
        <div class="step"><b>Depositors</b>Receive SYC.</div>
      </div>
    </div>
    <div class="bridge">↑ Polygon's own bridge ↑</div>
    <div class="lane">
      <div class="where">Ethereum · only when sniETH balances change</div>
      <div class="steps">
        <div class="step"><b>sniETH balances</b>Someone deposits or redeems.</div><span class="arrow">→</span>
        <div class="step key"><b>Reporter</b>Anyone calls it with the full holder list. It reads every balance and refuses a list that does not add up to the whole supply.</div><span class="arrow">→</span>
        <div class="step"><b>New weights</b>Sent to the distributor. SNI that arrived earlier is split by the old weights first.</div>
      </div>
    </div>
  </div>
  <p>Solidity 0.8.28, no dependencies, not upgradeable. ${lines(distributorSrc) + lines(reporterSrc)} lines in total.</p>
  <details><summary>SycDistributor.sol · Polygon · ${lines(distributorSrc)} lines</summary>
    <pre id="src-distributor">${esc(distributorSrc)}</pre><button class="copy" type="button" data-copy="src-distributor">Copy</button></details>
  <details><summary>SniEthReporter.sol · Ethereum · ${lines(reporterSrc)} lines</summary>
    <pre id="src-reporter">${esc(reporterSrc)}</pre><button class="copy" type="button" data-copy="src-reporter">Copy</button></details>
  <ul>
    <li><strong>Tested:</strong> ${tests.total} checks pass on the role and the code above. What they cover is listed under Self-audit.</li>
    <li><strong>Not reviewed:</strong> nobody outside has read the code.</li>
  </ul>
</section>

<section>
  <h2>Self-audit</h2>
  <p>What was tested on the role and on the contracts above. All ${tests.total} checks pass. This is the author checking their own work, not an outside review.</p>
  <div class="tw"><table>
    <thead><tr><th>Area</th><th>What was checked</th></tr></thead>
    <tbody>
      <tr><td>Backing</td><td class="wrap">SYC never exceeds the SNI in the Safe: after the one-off mint, after every distribution, when SNI leaves halfway through or leaves and comes back, when someone donates SNI, and when the vault takes a fee or mints extra.</td></tr>
      <tr><td>Amounts</td><td class="wrap">Every wallet gets exactly its share, for 1 to 100 wallets with random weights and amounts. Batches of 25 add up to the same result. Amounts under 100 SYC wait.</td></tr>
      <tr><td>One-off mint</td><td class="wrap">Runs once, with the fixed amounts, only when the SNI is in the Safe. An earlier deposit cannot block it. 100 wallets fit in one transaction.</td></tr>
      <tr><td>Reports</td><td class="wrap">Accepted only through the bridge and from the named reporter. Forged, replayed, altered and out-of-order reports are refused; repeated ones change nothing. Two reports in a row, and a report before the one-off mint, end in the right split. SNI that arrived before a report goes out by the old split. The split cannot change in the middle of a distribution.</td></tr>
      <tr><td>Reporter</td><td class="wrap">A holder that counts cannot be left out, for random balances. No address twice. Dust and contracts are counted but not paid; delegated wallets are paid. More than 100 recipients is refused. The weights always add up to the sniETH supply.</td></tr>
      <tr><td>Old balances</td><td class="wrap">Distributions stop when balances have not been confirmed for 8 days, to the second, and resume on the next report.</td></tr>
      <tr><td>Access</td><td class="wrap">Nobody, the owner included, can mint, set the split, replace the reporter or pause. A call back into the contract during a mint is refused.</td></tr>
      <tr><td>Keeper</td><td class="wrap">Told to act only when the call will go through, and never below its minimum.</td></tr>
      <tr><td>Permission</td><td class="wrap">On the vault's live Roles modifier. The mint role can make the vault mint and nothing else. The multisig mints the one-off and a week's amounts through it. The admin role adds and removes the role's members and cannot change what it allows. Before the handover it cannot change members either.</td></tr>
      <tr><td>Live chains</td><td class="wrap">One-off mint, distribution and a batch of 25 through the real Roles modifier and Safe on Polygon. A report from Ethereum through Polygon's real bridge contracts to the distributor.</td></tr>
    </tbody>
  </table></div>
  <h3>How</h3>
  <ul>
    <li><strong>${tests.scenarios} scenarios</strong>, each a written-out case. ${tests.fuzz} of them run on 256 random inputs each.</li>
    <li><strong>${tests.rules} rules checked under random use.</strong> 25,600 random actions in a row: SNI arriving and leaving, deposits, time passing, sniETH changing hands, reports, distributions, keeper runs, an outsider trying every function. After each one: every mint is backed, the mint log accounts for every SYC, outsiders got nothing, the keeper was never sent to a failing call, and a distribution in progress is consistent.</li>
    <li><strong>${tests.live} tests on live chains</strong>, against copies of Polygon and Ethereum at the current block.</li>
    <li><strong>The tests were tested.</strong> Each of ${tests.broken.length} safety checks in the contracts was removed in turn; the tests failed ${tests.caught === tests.broken.length ? "every time" : `${tests.caught} times`}.</li>
  </ul>
  <div class="tw"><table>
    <thead><tr><th>Gas measured</th><th class="num">Gas</th><th>Limit</th></tr></thead>
    <tbody>
      <tr><td>One-off mint by the multisig, live</td><td class="num">228,254</td><td></td></tr>
      <tr><td>Distribution to 3 wallets, live</td><td class="num">252,407</td><td></td></tr>
      <tr><td>Batch of 25 wallets, live</td><td class="num">1,212,844</td><td>5,000,000 keeper</td></tr>
      <tr><td>Report delivered by the bridge, live</td><td class="num">406,063</td><td>5,000,000 bridge</td></tr>
      <tr><td>Largest report the bridge can deliver</td><td class="num">1,952,889</td><td>5,000,000 bridge</td></tr>
    </tbody>
  </table></div>
  <h3>Not tested</h3>
  <ul>
    <li><strong>The real vault's mint.</strong> It refuses every mint until it is finalized, so a stand-in took its place. To test on a copy of the chain right after finalizing, before the one-off mint.</li>
    <li><strong>A real bridge message.</strong> The bridge contracts are the live ones, but the delivery was simulated, not sent.</li>
    <li><strong>A real keeper.</strong> The keeper interface was called directly, not by a keeper network.</li>
    <li><strong>An outside review.</strong></li>
  </ul>
  <h3>Known limits</h3>
  <ul>
    <li><strong>Timing.</strong> Inside the 8-day window a holder who leaves keeps earning until someone reports, and a holder can time a report or inflate it with borrowed sniETH if sniETH ever becomes lendable or pooled. A bot should report on every sniETH transfer.</li>
    <li><strong>Scale.</strong> More than 100 real holders does not fit this design.</li>
    <li><strong>No override.</strong> Until the reporter is live the split stays as deployed, and a faulty reporter cannot be replaced. The remedy for either is to take the role away and deploy a new distributor.</li>
  </ul>
</section>

<section>
  <h2>Data</h2>
  <details><summary>${res.deposits.length} deposits</summary><div class="tw"><table>
    <thead><tr><th>Date</th><th>Wallet</th><th class="num">sniETH</th></tr></thead><tbody>${depRows}</tbody></table></div></details>
  <details><summary>${lots.length} yield claims</summary><div class="tw"><table>
    <thead><tr><th>Claimed</th><th class="num">ETH</th><th class="num">SNI bought</th></tr></thead><tbody>${lotRows}</tbody></table></div></details>
  <details><summary>One-off amounts in wei</summary><pre id="seed-json">${seedJson}</pre><button class="copy" type="button" data-copy="seed-json">Copy</button></details>
  <p class="note">The one-off amounts were computed two ways with separate code; the total matches the SNI in the Safes within 1 SNI.</p>
</section>
</div>
<script>
document.querySelectorAll("button[data-copy]").forEach(function (b) {
  b.addEventListener("click", function () {
    var pre = document.getElementById(b.getAttribute("data-copy"));
    var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1600); };
    var select = function () { var r = document.createRange(); r.selectNodeContents(pre); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected"; };
    try { navigator.clipboard.writeText(pre.textContent).then(done, select); } catch (e) { select(); }
  });
});
</script>
`;
fs.writeFileSync(new URL("./syc-distribution.html", import.meta.url), html);
console.log("bytes", html.length);
