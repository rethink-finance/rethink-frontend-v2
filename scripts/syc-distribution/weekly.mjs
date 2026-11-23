// Weekly SYC distribution: what each wallet is owed in total, minus what has been minted, as a multisig transaction.
//
//   node scripts/syc-distribution/weekly.mjs            refresh chain data, compute, write out/<date>/
//   node scripts/syc-distribution/weekly.mjs --cached   skip the Ethereum reads (sniETH deposits, bridge claims, staking
//                                                        accrual); Polygon is always re-read and the amounts recomputed
//
// It sends nothing and needs no key. The amounts are cumulative (everything owed since the first deposit, minus
// everything minted through the mint role), so a skipped week is picked up by the next run, and a run between two
// incentive mints simply owes less. Exit code 1 when something needs attention, so a cron job can tell.
//
// Env: SYC_RPC_137 / SYC_RPC_1 pin a chain to one RPC (a fork, for a rehearsal); SYC_OUT changes the output folder.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ethers, rpc, call, getLogs, blockNumber, blockTime, load, iso, pad } from "./lib.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CFG = {
  fund: "0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007", // SYC vault token
  safe: "0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF", // vault Safe: holds the SNI, and is the caller of the mint
  roles: "0x8A984794a920BBd367B3e54362014dE973200aB0", // Roles modifier on that Safe
  sni: "0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57",
  roleKey: "SYC-Distributor", // the mint role (scripts/syc-distributor/role/gen.ts); the admin multisig is its first member
  adminSafe: "0x78E35296B8C0d0e31EF3584504289B4908416dc8", // the admin multisig that proposes and signs
  allowanceKey: null, // that role has no allowance
  fundFromBlock: 96_000_000,
  // SNI minted to the Safe before this block is part of the retroactive computation (06-compute.mjs decides what
  // counts there); only later odd-sized mints are flagged. Set to the block of the one-off mint.
  ignoreSniMintsBefore: 97_819_000,
  ...(fs.existsSync(HERE + "config.json") ? JSON.parse(fs.readFileSync(HERE + "config.json")) : {}),
};
const E = 10n ** 18n, f = (x, d = 4) => Number(ethers.formatEther(x)).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const erc = new ethers.Interface(["function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)", "event Transfer(address indexed from, address indexed to, uint256 value)"]);
const flows = new ethers.Interface(["function mintToMany(uint256[] amounts, address[] recipients)"]);
const fund = new ethers.Interface(["function fundFlowsCall(bytes flowCall)"]);
const roles = new ethers.Interface(["function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool)", "function allowances(bytes32 key) view returns (uint128 refill, uint128 maxRefill, uint64 period, uint128 balance, uint64 timestamp)"]);
const read = async (to, iface, fn, args = []) => iface.decodeFunctionResult(fn, await call(137, to, iface.encodeFunctionData(fn, args), "latest"));

// ---------- 1. refresh
{
  const ethereum = ["01-snieth.mjs", "05-mainnet-claims.mjs", "11-accrual.mjs"], polygon = ["02-polygon.mjs", "06-compute.mjs"];
  for (const s of [...(process.argv.includes("--cached") ? [] : ethereum), ...polygon]) {
    process.stdout.write(`refreshing ${s} … `);
    const r = spawnSync(process.execPath, [HERE + s], { encoding: "utf8", maxBuffer: 1 << 26 });
    if (r.status !== 0) { console.log("failed\n" + r.stdout.slice(-2000) + r.stderr.slice(-2000)); process.exit(1); }
    console.log("ok");
  }
}
const res = load("result"), pg = load("polygon-transfers");
const holders = [...res.holders].sort((a, b) => (BigInt(res.total[b]) > BigInt(res.total[a]) ? 1 : -1));

// ---------- 2. what has been minted so far
const head = await blockNumber(137);
const SEL = flows.getFunction("mintToMany").selector.slice(2);
const mintLogs = await getLogs(137, { address: CFG.fund, topics: [erc.getEvent("Transfer").topicHash, pad(ethers.ZeroAddress)] }, CFG.fundFromBlock, head);
// A distribution is a mintToMany sent through the Roles modifier (the multisig's transaction carries the modifier
// call, which carries the vault call). Mints from anywhere else (deposits, fees, a mint made some other way) are
// listed, never counted as paid.
const minted = Object.fromEntries(holders.map((h) => [h, 0n])); const distributions = {}, otherMints = [], strayMints = [];
const txCache = new Map();
const txOf = async (hash) => { if (!txCache.has(hash)) txCache.set(hash, await rpc(137, "eth_getTransactionByHash", [hash])); return txCache.get(hash); };
const ROLE_SEL = roles.getFunction("execTransactionWithRole").selector.slice(2);
for (const l of mintLogs) {
  const to = ethers.getAddress("0x" + l.topics[2].slice(26)), amount = BigInt(l.data);
  const input = (await txOf(l.transactionHash)).input.toLowerCase();
  const viaRole = input.includes(SEL) && input.includes(ROLE_SEL);
  if (viaRole && to in minted) { minted[to] += amount; (distributions[l.transactionHash] ??= { tx: l.transactionHash, block: Number(l.blockNumber), total: 0n }).total += amount; }
  else if (viaRole) strayMints.push({ to, amount, tx: l.transactionHash });
  else otherMints.push({ to, amount, tx: l.transactionHash });
}
const dist = Object.values(distributions).sort((a, b) => a.block - b.block);
const lastTs = dist.length ? await blockTime(137, dist.at(-1).block) : 0;

// ---------- 3. what is due
const due = holders.map((h) => ({ wallet: h, owed: BigInt(res.total[h]), minted: minted[h], due: BigInt(res.total[h]) - minted[h] }));
const pay = due.filter((d) => d.due > 0n), totalDue = pay.reduce((s, d) => s + d.due, 0n);
const flags = [...(res.warnings ?? [])];
for (const d of due) if (d.due < 0n) flags.push(`${d.wallet} has received ${f(-d.due)} SYC more than it is owed; nothing is minted to it`);
if (otherMints.length) flags.push(`${otherMints.length} SYC mint(s) that are not distributions (deposits or fees), ${f(otherMints.reduce((s, m) => s + m.amount, 0n))} SYC in total. They are not counted as paid to anyone.`);
if (strayMints.length) flags.push(`${strayMints.length} mint(s) through the mint role went to wallets that are not depositors: ${strayMints.map((m) => `${f(m.amount)} SYC to ${m.to} (${m.tx})`).join("; ")}. Check who sent them.`);
// what is new since the last distribution: incentive mints of exactly 34,000 count; SNI minted to the Safe in any
// other amount is not distributed by 06-compute.mjs and has to be looked at
const sniMintsIn = pg.rows.filter((r) => r.token === "SNI" && r.dir === "in" && r.safe === "new" && r.ts > lastTs && r.from === ethers.ZeroAddress);
const fresh = sniMintsIn.filter((r) => BigInt(r.amount) === 34_000n * E);
const oddMints = sniMintsIn.filter((r) => BigInt(r.amount) !== 34_000n * E && r.block > (CFG.ignoreSniMintsBefore ?? 0));
if (oddMints.length) flags.push(`${oddMints.length} SNI mint(s) into the Safe that are not the 34,000 incentive and are NOT distributed: ${oddMints.map((r) => `${f(BigInt(r.amount))} SNI on ${r.time.slice(0, 10)} (${r.tx})`).join("; ")}. If they are incentives, 06-compute.mjs needs to know.`);
const sniMoves = pg.rows.filter((r) => r.token === "SNI" && r.dir === "out" && r.safe === "new" && r.ts > lastTs && r.block > (CFG.ignoreSniMintsBefore ?? 0));
if (sniMoves.length) flags.push(`${sniMoves.length} SNI transfer(s) out of the Safe since the last distribution (${f(sniMoves.reduce((s, r) => s + BigInt(r.amount), 0n))} SNI). Depositors are still owed the full amount; make sure the Safe can back it.`);
const [[supply], [safeSni]] = await Promise.all([read(CFG.fund, erc, "totalSupply"), read(CFG.sni, erc, "balanceOf", [CFG.safe])]);
const spare = safeSni - supply - totalDue;
if (spare < 0n) flags.push(`After this mint there would be ${f(-spare)} more SYC than SNI in the Safe.`);
const unswapped = res.lots.reduce((s, l) => s + BigInt(l.left ?? 0), 0n);

// ---------- 4. the transaction
const amounts = pay.map((d) => d.due), recipients = pay.map((d) => d.wallet);
const inner = fund.encodeFunctionData("fundFlowsCall", [flows.encodeFunctionData("mintToMany", [amounts, recipients])]);
const outer = roles.encodeFunctionData("execTransactionWithRole", [CFG.fund, 0, inner, 0, ethers.encodeBytes32String(CFG.roleKey), true]);

// ---------- 5. dry runs (nothing is sent)
// an unfinalized vault has no Safe or governor recorded, and rejects every mint with "only gov"
const settings = new ethers.Interface(["function getFundSettings() view returns (tuple(uint256 depositFee,uint256 withdrawFee,uint256 performanceFee,uint256 managementFee,uint256 performaceHurdleRateBps,address baseToken,address safe,bool isExternalGovTokenInUse,bool isWhitelistedDeposits,address[] allowedDepositAddrs,address[] allowedManagers,address governanceToken,address fundAddress,address governor,string fundName,string fundSymbol,address[4] feeCollectors))"]);
let finalized = true; try { finalized = (await read(CFG.fund, settings, "getFundSettings"))[0].safe !== ethers.ZeroAddress; } catch { /* unknown layout: let the dry run speak */ }
const sim = async (calls) => (await rpc(137, "eth_simulateV1", [{ blockStateCalls: [{ calls: calls.map((c) => ({ ...c, gas: "0x1c9c380" })) }], validation: false }, "latest"]))[0].calls;
let mintCheck = "not run", roleCheck = "not run";
if (totalDue > 0n) {
  try {
    const before = await Promise.all(recipients.map(async (r) => (await read(CFG.fund, erc, "balanceOf", [r]))[0]));
    const out = await sim([{ from: CFG.safe, to: CFG.fund, data: inner }, ...recipients.map((r) => ({ from: CFG.safe, to: CFG.fund, data: erc.encodeFunctionData("balanceOf", [r]) }))]);
    if (out[0].status !== "0x1") { const why = out[0].error?.message ?? "no reason given"; mintCheck = `REVERTS when the Safe calls it (${why})`; flags.push(finalized ? `The mint itself reverts in a dry run: ${why}.` : "The vault is not finalized yet, so nothing can be minted. Finalize it, then mint before anyone can deposit."); }
    else { const short = recipients.filter((r, i) => BigInt(out[i + 1].returnData) - before[i] !== amounts[i]);
      mintCheck = short.length ? "wallets receive LESS than listed (is the DAO fee on?)" : "every wallet receives exactly the listed amount"; if (short.length) flags.push("Dry run: wallets receive less than listed. Check the DAO fee."); }
  } catch (e) { mintCheck = "could not simulate: " + String(e.message).slice(0, 120); }
  if (CFG.adminSafe) {
    try { const out = await sim([{ from: CFG.adminSafe, to: CFG.roles, data: outer }]);
      const mintItselfFails = mintCheck.startsWith("REVERTS");
      roleCheck = out[0].status === "0x1" ? "passes from the admin multisig"
        : mintItselfFails ? "cannot be judged while the mint itself reverts (the modifier only reports the inner failure)"
        : "REVERTS from the admin multisig: the role is not stored or the multisig is not its member";
      if (out[0].status !== "0x1" && !mintItselfFails) flags.push("The admin multisig cannot execute this: the Roles modifier rejects it. Check that the mint role is stored and that the multisig is its member."); } catch (e) { roleCheck = "could not simulate: " + String(e.message).slice(0, 120); }
  } else { roleCheck = "admin multisig not set in config.json"; flags.push("Admin multisig address not configured, so the permission check was skipped."); }
}
let allowance = "none: this role has no limit";
if (CFG.allowanceKey) { const a = await read(CFG.roles, roles, "allowances", [ethers.encodeBytes32String(CFG.allowanceKey)]); const now = BigInt(Math.floor(Date.now() / 1000));
  const periods = a.period > 0n ? (now - a.timestamp) / a.period : 0n, avail = a.balance < a.maxRefill ? (a.balance + a.refill * periods < a.maxRefill ? a.balance + a.refill * periods : a.maxRefill) : a.balance;
  if (a.period === 0n && a.balance === 0n) { allowance = "not stored on the modifier yet"; flags.push("The mint allowance is not stored yet: submit scripts/syc-distributor/role/role-calls-raw.txt first."); }
  else allowance = `${f(avail, 2)} SYC available (refill ${f(a.refill, 0)} per period, carries over up to ${f(a.maxRefill, 0)})`;
  if (a.period !== 0n && avail < totalDue) flags.push(`The allowance (${f(avail, 2)}) is smaller than the amount due (${f(totalDue, 2)}). Mint what fits and the rest next week.`); }

// ---------- 6. output
const date = new Date().toISOString().slice(0, 10), dir = `${process.env.SYC_OUT ? process.env.SYC_OUT.replace(/\/?$/, "/") : HERE + "out/"}${date}/`; fs.mkdirSync(dir, { recursive: true });
const batch = { version: "1.0", chainId: "137", createdAt: Date.now(), meta: { name: `SYC distribution ${date}`, description: `mintToMany for ${pay.length} wallets, ${f(totalDue, 4)} SYC in total`, txBuilderVersion: "1.16.5", createdFromSafeAddress: CFG.adminSafe ?? "", createdFromOwnerAddress: "" },
  transactions: totalDue > 0n ? [{ to: CFG.roles, value: "0", data: outer, contractMethod: null, contractInputsValues: null }] : [] };
fs.writeFileSync(dir + "safe-transaction.json", JSON.stringify(batch, null, 2));
const md = `# SYC distribution ${date}

Computed at Polygon block ${head}, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.
${dist.length ? `Distribution number ${dist.length + 1}. Last one: ${iso(lastTs).slice(0, 10)} (${dist.at(-1).tx}).` : "First distribution (the retroactive mint)."}
New since then: ${fresh.length} incentive mint(s) of 34,000 SNI.
${totalDue === 0n ? "\n**Nothing to mint.** Everything owed has been minted.\n" : ""}

| Wallet | Owed in total | Already minted | Mint now |
|---|---:|---:|---:|
${due.map((d) => `| ${d.wallet} | ${f(d.owed)} | ${f(d.minted)} | ${f(d.due > 0n ? d.due : 0n)} |`).join("\n")}
| **Total** | ${f(BigInt(res.grand))} | ${f(due.reduce((s, d) => s + d.minted, 0n))} | **${f(totalDue)}** |

## Checks
- SNI in the Safe: ${f(safeSni)}. SYC after this mint: ${f(supply + totalDue)}. ${spare >= 0n ? `${f(spare)} SNI spare.` : `**${f(-spare)} SNI short.**`}
- Vault finalized: ${finalized ? "yes" : "**no**"}.
- Mint dry run: ${mintCheck}.
- Permission dry run: ${roleCheck}.
- Allowance: ${allowance}.
- Yield waiting in the Safe as WETH (minted once it is swapped to SNI): ${f(unswapped, 4)} WETH.
${flags.length ? "\n## Needs attention\n" + flags.map((x) => `- ${x}`).join("\n") + "\n" : ""}
## To propose
In the admin multisig open Apps > Transaction Builder, load \`safe-transaction.json\`, and create the transaction. The other signers then confirm it in the Safe.

- To: ${CFG.roles} (Roles modifier), value 0
- Inside: the vault Safe calls \`mintToMany\` on ${CFG.fund}
- Amounts (wei): ${amounts.join(", ") || "none"}
- Recipients: ${recipients.join(", ") || "none"}
`;
fs.writeFileSync(dir + "report.md", md);
console.log("\n" + md + `\nwritten: ${dir}report.md\n         ${dir}safe-transaction.json`);
if (totalDue === 0n) fs.rmSync(dir + "safe-transaction.json", { force: true });
if (flags.length) process.exitCode = 1;
