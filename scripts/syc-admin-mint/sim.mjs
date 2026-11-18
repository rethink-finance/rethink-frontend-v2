// Dry run of the admin mint permission against the live Roles modifier (eth_simulateV1, nothing is sent).
import fs from "node:fs";
import { ethers, rpc } from "../syc-distribution/lib.mjs";
const here = new URL(".", import.meta.url);
const calls = JSON.parse(fs.readFileSync(new URL("admin-mint.json", here)));
const R = new ethers.Interface(JSON.parse(fs.readFileSync(new URL("../../assets/contracts/zodiac/RolesFullV2.json", here))).abi);
const A = { roles: "0x8A984794a920BBd367B3e54362014dE973200aB0", fund: "0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007", safe: "0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF", factory: "0xD45e5D73bcD8625f8B5C4b1b6DD7Ca48Dd47F4F6",
  deployer: "0xB5d01172e73559B07ef3CD53dE84459c6BA3a054", admin: "0x78E35296B8C0d0e31EF3584504289B4908416dc8", executor: "0x8C2eb5359041d2d1Eb12866eC2111eC15eD81e8d", stranger: "0x000000000000000000000000000000000000dEaD", sni: "0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57" };
const W = ["0x1271836313a2B692858F96D88118176E72d9eD74", "0xC419021546FDfEa5e097Bd48951cF1c8ACF9769B", "0xecE11276F7297389151dDA0B3Ab5bCfA3FAC2f59"];
const fac = new ethers.Interface(["function submitPermissions(bytes[] calldatas)"]);
const F = new ethers.Interface(["function fundFlowsCall(bytes)", "function mintToMany(uint256[],address[])", "function mintPerformanceFee(uint256)", "function sweepTokens()", "function collectFees(uint8)", "function deposit()", "function requestDeposit(uint256)", "function withdraw()", "function requestWithdraw(uint256)", "function mintPoolPerformanceFeeHWM(address)", "function transfer(address,uint256)", "function balanceOf(address) view returns (uint256)"]);
const e = (n) => ethers.parseEther(String(n));
const ADMIN = ethers.encodeBytes32String("adminRole"), EXEC = ethers.encodeBytes32String("defaultManagerRole"), KEY = ethers.encodeBytes32String("sycMint");
const viaFlows = (inner) => F.encodeFunctionData("fundFlowsCall", [inner]);
const mint = (amounts, to = W.slice(0, amounts.length)) => viaFlows(F.encodeFunctionData("mintToMany", [amounts, to]));
const exec = (from, to, data, { value = 0n, op = 0, key = ADMIN } = {}) => ({ from, to: A.roles, data: R.encodeFunctionData("execTransactionWithRole", [to, value, data, op, key, true]) });
const STATUS = { 1: "DelegateCallNotAllowed", 2: "TargetAddressNotAllowed", 3: "FunctionNotAllowed", 4: "SendNotAllowed", 5: "OrViolation", 7: "ParameterNotAllowed", 11: "NotEveryArrayElementPasses", 15: "BitmaskNotAllowed", 17: "AllowanceExceeded" };
const OVER = "ConditionViolation(NotEveryArrayElementPasses)"; // how the modifier reports an amount the allowance cannot cover
const why = (c) => { if (c.status === "0x1") return "ok"; const d = c.error?.data; try { const p = R.parseError(d); return p.name === "ConditionViolation" ? `ConditionViolation(${STATUS[Number(p.args[0])] ?? p.args[0]})` : p.name; } catch { return c.error?.message ?? "reverted"; } };

const latest = await rpc(137, "eth_getBlockByNumber", ["latest", false]); const t0 = Number(latest.timestamp) + 10, DAY = 86400;
const T = []; // [label, expectation, call]
const blocks = [];
const block = (time, list) => blocks.push({ blockOverrides: { time: "0x" + time.toString(16) }, calls: list.map(([label, want, call]) => { T.push([label, want]); return { ...call, gas: "0x1c9c380" }; }) });
const setup = ["submit the 3 calls through the factory, as the deployer", "ok", { from: A.deployer, to: A.factory, data: fac.encodeFunctionData("submitPermissions", [calls]) }];
const allowance = (label) => [label, "view", { from: A.stranger, to: A.roles, data: R.encodeFunctionData("allowances", [KEY]) }];

block(t0, [
  setup,
  ["mint 1,000 + 2,000 + 3 SYC to the three wallets", "ok", exec(A.admin, A.fund, mint([e(1000), e(2000), e(3)]))],
  ["fundFlowsCall carrying mintPerformanceFee", "rejected", exec(A.admin, A.fund, viaFlows(F.encodeFunctionData("mintPerformanceFee", [e(1)])))],
  ["fundFlowsCall carrying sweepTokens", "rejected", exec(A.admin, A.fund, viaFlows(F.encodeFunctionData("sweepTokens")))],
  ["fundFlowsCall carrying collectFees", "rejected", exec(A.admin, A.fund, viaFlows(F.encodeFunctionData("collectFees", [0])))],
  ["fundFlowsCall carrying deposit", "rejected", exec(A.admin, A.fund, viaFlows(F.encodeFunctionData("deposit")))],
  ["fundFlowsCall carrying requestDeposit", "rejected", exec(A.admin, A.fund, viaFlows(F.encodeFunctionData("requestDeposit", [e(1)])))],
  ["fundFlowsCall carrying requestWithdraw", "rejected", exec(A.admin, A.fund, viaFlows(F.encodeFunctionData("requestWithdraw", [e(1)])))],
  ["fundFlowsCall carrying mintPoolPerformanceFeeHWM", "rejected", exec(A.admin, A.fund, viaFlows(F.encodeFunctionData("mintPoolPerformanceFeeHWM", [A.admin])))],
  ["mintToMany arguments under another function's selector", "ConditionViolation(BitmaskNotAllowed)", exec(A.admin, A.fund, viaFlows("0x" + F.getFunction("mintPerformanceFee").selector.slice(2) + F.encodeFunctionData("mintToMany", [[e(1)], [W[0]]]).slice(10)))],
  ["fundFlowsCall with empty bytes", "rejected", exec(A.admin, A.fund, viaFlows("0x"))],
  ["mintToMany called on the vault directly", "ConditionViolation(FunctionNotAllowed)", exec(A.admin, A.fund, F.encodeFunctionData("mintToMany", [[e(1)], [W[0]]]))],
  ["transfer of SYC by the Safe", "ConditionViolation(FunctionNotAllowed)", exec(A.admin, A.fund, F.encodeFunctionData("transfer", [A.admin, e(1)]))],
  ["transfer of SNI out of the Safe", "ConditionViolation(TargetAddressNotAllowed)", exec(A.admin, A.sni, F.encodeFunctionData("transfer", [A.admin, e(1)]))],
  ["the mint as a delegatecall", "ConditionViolation(DelegateCallNotAllowed)", exec(A.admin, A.fund, mint([e(1)]), { op: 1 })],
  ["the mint with value attached", "ConditionViolation(SendNotAllowed)", exec(A.admin, A.fund, mint([e(1)]), { value: 1n })],
  ["the mint from a wallet with no role", "NotAuthorized", exec(A.stranger, A.fund, mint([e(1)]))],
  ["the mint from an Executor, claiming the admin role", "NoMembership", exec(A.executor, A.fund, mint([e(1)]))],
  ["the mint from an Executor, under the Executor role", "ConditionViolation(ParameterNotAllowed)", exec(A.executor, A.fund, mint([e(1)]), { key: EXEC })],
  ["one amount 1 SYC above what is left (3,396,998)", OVER, exec(A.admin, A.fund, mint([e(3396998)]))],
  ["two amounts that together are 1 SYC above what is left", OVER, exec(A.admin, A.fund, mint([e(3000000), e(396998)]))],
  ["two amounts that leave exactly 10,000", "ok", exec(A.admin, A.fund, mint([e(3000000), e(386997)]))],
  ["10,001 with 10,000 left", OVER, exec(A.admin, A.fund, mint([e(10001)]))],
  allowance("allowance after the retroactive mint"),
]);
block(t0 + 7 * DAY + 60, [
  ["one week later: 60,001 (10,000 left + 50,000 refill)", OVER, exec(A.admin, A.fund, mint([e(60001)]))],
  ["one week later: 60,000", "ok", exec(A.admin, A.fund, mint([e(60000)]))],
  ["then 1 wei more", OVER, exec(A.admin, A.fund, mint([1n]))],
]);
block(t0 + 21 * DAY + 60, [
  ["two weeks skipped: 100,001 (2 refills)", OVER, exec(A.admin, A.fund, mint([e(100001)]))],
  ["two weeks skipped: 100,000", "ok", exec(A.admin, A.fund, mint([e(100000)]))],
]);
block(t0 + 91 * DAY + 60, [
  ["ten weeks skipped: 150,001 (cap is 150,000)", OVER, exec(A.admin, A.fund, mint([e(150001)]))],
  ["ten weeks skipped: 150,000", "ok", exec(A.admin, A.fund, mint([e(150000)]))],
  allowance("allowance after that"),
]);
// mock: the vault is not finalized and rejects every mint, so its code is emptied here; the call then succeeds and the allowance is really consumed
blocks[0].stateOverrides = { [A.fund]: { code: "0x" } };
const out = (await rpc(137, "eth_simulateV1", [{ blockStateCalls: blocks, validation: false }, "latest"])).flatMap((b) => b.calls);
let bad = 0;
T.forEach(([label, want], i) => { const got = why(out[i]);
  if (want === "view") { const a = R.decodeFunctionResult("allowances", out[i].returnData); console.log(`      ${label}: balance ${ethers.formatEther(a.balance)}, refill ${ethers.formatEther(a.refill)}, cap ${ethers.formatEther(a.maxRefill)}, period ${a.period}s`); return; }
  const pass = want === "rejected" ? got !== "ok" : got === want; if (!pass) bad++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${got}`); });

// against the real, unfinalized vault: the role lets it through and the vault itself refuses
const real = (await rpc(137, "eth_simulateV1", [{ blockStateCalls: [{ calls: [setup[2], exec(A.admin, A.fund, mint([e(1000), e(2000), e(3)]))].map((c) => ({ ...c, gas: "0x1c9c380" })) }], validation: false }, "latest"]))[0].calls;
const r = why(real[1]); console.log(`${r === "ModuleTransactionFailed" ? "PASS" : "FAIL"}  real vault (not finalized): role passes, vault refuses  ->  ${r}`); if (r !== "ModuleTransactionFailed") bad++;
// the inner call on a finalized Rethink vault on Polygon ("1 Inch Test"), called by its own Safe: do the wallets get exactly what is listed?
const OLD = { fund: "0x3588cF6F90ac879e4ABE7CA3F3A17abeC107b328" };
const S = new ethers.Interface(["function getFundSettings() view returns (tuple(uint256 depositFee,uint256 withdrawFee,uint256 performanceFee,uint256 managementFee,uint256 performaceHurdleRateBps,address baseToken,address safe,bool isExternalGovTokenInUse,bool isWhitelistedDeposits,address[] allowedDepositAddrs,address[] allowedManagers,address governanceToken,address fundAddress,address governor,string fundName,string fundSymbol,address[4] feeCollectors))"]);
OLD.safe = S.decodeFunctionResult("getFundSettings", await rpc(137, "eth_call", [{ to: OLD.fund, data: S.encodeFunctionData("getFundSettings") }, "latest"]))[0].safe;
const q = (a) => ({ from: A.stranger, to: OLD.fund, data: F.encodeFunctionData("balanceOf", [a]) });
const old = (await rpc(137, "eth_simulateV1", [{ blockStateCalls: [{ calls: [q(W[0]), q(W[1]), { from: OLD.safe, to: OLD.fund, data: mint([e(5), e(7)]) }, q(W[0]), q(W[1])].map((c) => ({ ...c, gas: "0x1c9c380" })) }], validation: false }, "latest"]))[0].calls;
const exact = old[2].status === "0x1" && BigInt(old[3].returnData) - BigInt(old[0].returnData) === e(5) && BigInt(old[4].returnData) - BigInt(old[1].returnData) === e(7);
console.log(`${exact ? "PASS" : "FAIL"}  finalized vault: fundFlowsCall(mintToMany) from its Safe mints exactly 5 and 7  ->  ${old[2].status === "0x1" ? "ok" : why(old[2])}`); if (!exact) bad++;
console.log(bad ? `\n${bad} FAILED` : "\nall checks passed");
