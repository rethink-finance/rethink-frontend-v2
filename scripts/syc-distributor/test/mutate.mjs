// Break one safety check at a time and run the tests. A check whose removal no test notices is a check nobody
// is really testing. Run from scripts/syc-distributor:  node test/mutate.mjs
// The live-chain tests are left out (too slow to repeat); everything else runs for every change.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const D = "src/SycDistributor.sol";
const R = "src/SniEthReporter.sol";
const drop = (file, what, line) => ({ file, what, from: line, to: "" });

const changes = [
  drop(D, "anyone can act as the owner", "if (msg.sender != owner) revert NotOwner();"),
  drop(D, "a mint can be re-entered", "if (_entered != 1) revert Reentered();"),
  drop(D, "the first issuance can run twice", "if (seeded) revert AlreadySeeded();"),
  drop(D, "dust amounts are distributed", "if (whole < minDistribution) return 0;"),
  drop(D, "distributions start before the first issuance", "if (!seeded) revert NotSeeded();"),
  drop(D, "old weights are used for ever", "if (!weightsFresh()) revert WeightsStale();"),
  drop(D, "the supply is not checked after a mint", "if (supplyAfter != supplyBefore + total) revert MintMismatch();"),
  drop(D, "each wallet's receipt is not checked", "if (IERC20Like(fund).balanceOf(to[i]) < before[i] + amounts[i]) revert MintMismatch();"),
  drop(D, "the backing is not checked after a mint", "if (supplyAfter > sni.balanceOf(safe)) revert NotBacked();"),
  drop(D, "anyone can deliver a report", "if (msg.sender != fxChild) revert NotFxChild();"),
  drop(D, "a report from any Ethereum sender is taken", "if (rootMessageSender != reporter || reporter == address(0)) revert NotReporter();"),
  drop(D, "an old report can be replayed", "if (reportBlock <= lastReportBlock) revert StaleReport();"),
  drop(D, "an unchanged report does not confirm the weights", "if (unchanged) weightsFreshAt = block.timestamp;"),
  { file: D, what: "an unchanged report is treated as a change", from: "if (unchanged || !_validList(r, w)) {", to: "if (!_validList(r, w)) {" },
  { file: D, what: "SNI waiting before a report goes by the new weights", from: "flushAmount = seeded && weightsFresh() && waiting > inRound ? waiting - inRound : 0;", to: "flushAmount = 0;" },
  { file: D, what: "any data is accepted as the pending report", from: "if (pendingReport == bytes32(0) || keccak256(abi.encode(reportBlock, recipients_, weights_)) != pendingReport) {", to: "if (pendingReport == bytes32(0)) {" },
  drop(D, "weights can change in the middle of a distribution", "if (roundAmount != 0 || flushAmount != 0) revert RoundInProgress();"),
  drop(D, "a wallet can be listed twice", "if (who[j] == who[i]) return false;"),
  { file: D, what: "a zero weight is accepted", from: "if (who[i] == address(0) || amounts[i] == 0 || amounts[i] > type(uint128).max) return false;", to: "if (who[i] == address(0) || amounts[i] > type(uint128).max) return false;" },
  { file: D, what: "the zero address is accepted", from: "if (who[i] == address(0) || amounts[i] == 0 || amounts[i] > type(uint128).max) return false;", to: "if (amounts[i] == 0 || amounts[i] > type(uint128).max) return false;" },
  { file: D, what: "oversized weights are accepted", from: "if (who[i] == address(0) || amounts[i] == 0 || amounts[i] > type(uint128).max) return false;", to: "if (who[i] == address(0) || amounts[i] == 0) return false;" },
  { file: D, what: "more than 100 recipients are accepted", from: "if (n == 0 || n != amounts.length || n > MAX_RECIPIENTS) return false;", to: "if (n == 0 || n != amounts.length) return false;" },
  drop(D, "the reporter can be replaced", "if (reporter != address(0)) revert ReporterAlreadySet();"),
  { file: D, what: "a distribution carries on after its SNI left", from: "if (from != 0 && IERC20Like(fund).totalSupply() + total > sni.balanceOf(safe)) {", to: "if (false) {" },
  { file: D, what: "more is owed by the old weights than is there", from: "total = _startRound(owed < waiting ? owed : waiting);", to: "total = _startRound(owed);" },
  { file: D, what: "everything is minted in one call, no batches", from: "uint256 to = from + BATCH;", to: "uint256 to = n;" },
  drop(D, "the keeper is called when a call would revert", "if (!seeded || !weightsFresh()) return (false, performData);"),
  { file: D, what: "the keeper is called for a report nobody stored", from: "return (flushAmount != 0 || _pendingData.length != 0, performData);", to: "return (true, performData);" },
  drop(R, "a holder can be listed twice in a report", "if (holder <= previous) revert NotAscending();"),
  { file: R, what: "contracts are paid", from: "if (balance == 0 || balance < minBalance || _isContract(holder)) continue;", to: "if (balance == 0 || balance < minBalance) continue;" },
  { file: R, what: "dust balances are sent", from: "if (balance == 0 || balance < minBalance || _isContract(holder)) continue;", to: "if (balance == 0 || _isContract(holder)) continue;" },
  drop(R, "a report can leave holders out", "if (summed != supply && supply - summed >= minBalance) revert IncompleteHolders(summed, supply);"),
  drop(R, "a report can carry more than 100 recipients", "if (kept > MAX_RECIPIENTS) revert TooManyRecipients();"),
  { file: R, what: "a delegated wallet is treated as a contract", from: "return prefix != 0xef0100;", to: "return true;" },
];

const forge = `${homedir()}/.foundry/bin/forge`;
const original = { [D]: readFileSync(D, "utf8"), [R]: readFileSync(R, "utf8") };
const env = { ...process.env, FOUNDRY_INVARIANT_RUNS: "48", FOUNDRY_INVARIANT_DEPTH: "80" };
const results = [];
try {
  for (const c of changes) {
    const src = original[c.file];
    if (src.split(c.from).length !== 2) throw new Error(`not found exactly once: ${c.from}`);
    writeFileSync(c.file, src.replace(c.from, c.to));
    const run = spawnSync(forge, ["test", "--no-match-path", "test/Fork.t.sol"], { env, encoding: "utf8" });
    const out = run.stdout + run.stderr;
    const state = /Compiler run failed|Error \(\d+\)/.test(out) ? "did not compile" : run.status === 0 ? "NOT NOTICED" : "noticed";
    const failing = [...new Set([...out.matchAll(/^\[FAIL.*\] (\w+)\(/gm)].map((m) => m[1]))];
    results.push({ ...c, state, failing });
    console.log(`${state.padEnd(15)} ${c.what}${failing.length ? `  (${failing.length} failing, e.g. ${failing[0]})` : ""}`);
    writeFileSync(c.file, src);
  }
} finally {
  writeFileSync(D, original[D]);
  writeFileSync(R, original[R]);
}
const noticed = results.filter((r) => r.state === "noticed").length;
console.log(`\n${noticed} of ${results.length} noticed`);
writeFileSync("test/mutate-result.json", JSON.stringify(results.map(({ what, state, failing }) => ({ what, state, failing })), null, 2));
process.exit(noticed === results.length ? 0 : 1);
