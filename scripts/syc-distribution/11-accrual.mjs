// Rewards generated on the W3 StakingVault up to a block = claimedRewards + claimableRewards (both net of the 10% fee).
import { ethers, rpc, call, getLogs, blockNumber, blockTime, load, save, iso } from "./lib.mjs";
const V = "0x549d2398B34288dfb2b9ba0171086257AEff1562";
const I = new ethers.Interface(load("vault-abi"));
const rd = async (fn, blk) => { try { return BigInt(await call(1, V, I.encodeFunctionData(fn), "0x" + blk.toString(16))); } catch { return null; } };
const sn = load("snieth-transfers").rows, cl = load("mainnet-claims").rows;
const head = await blockNumber(1);
// vault events
const logs = await getLogs(1, { address: V }, 21_800_000, head);
const ev = [];
for (const l of logs) { let p; try { p = I.parseLog(l); } catch { continue; } if (!["Deposited", "RewardsClaimed", "FeesClaimed", "PrincipalWithdrawn"].includes(p.name)) continue;
  const ts = await blockTime(1, Number(l.blockNumber)); ev.push({ name: p.name, block: Number(l.blockNumber), time: iso(ts), ts, amount: p.args[0].toString(), tx: l.transactionHash });
  console.log(iso(ts), p.name.padEnd(18), ethers.formatEther(p.args[0])); }
// G at deposit blocks, claim blocks
const points = [...sn.filter((r) => r.block < 25_930_583).map((r) => ({ kind: "deposit", block: r.block, time: r.time })), ...cl.map((c) => ({ kind: "claim", block: c.block, time: c.time })), ...ev.filter((e) => e.name === "Deposited").map((e) => ({ kind: "staked", block: e.block, time: e.time }))].sort((a, b) => a.block - b.block);
console.log("\nkind     time                  claimed   claimable   generated  staked");
for (const p of points) {
  const [claimed, claimable, staked, fees, cfees] = await Promise.all([rd("claimedRewards", p.block), rd("claimableRewards", p.block), rd("stakedBalance", p.block), rd("claimedFees", p.block), rd("claimableFees", p.block)]);
  Object.assign(p, { claimed: claimed?.toString() ?? null, claimable: claimable?.toString() ?? null, staked: staked?.toString() ?? null, fees: fees?.toString() ?? null, claimableFees: cfees?.toString() ?? null, generated: claimed !== null && claimable !== null ? (claimed + claimable).toString() : null });
  const f = (x) => (x === null ? "n/a" : Number(ethers.formatEther(x)).toFixed(4));
  console.log(p.kind.padEnd(8), p.time, f(claimed).padStart(9), f(claimable).padStart(10), (p.generated ? f(BigInt(p.generated)) : "n/a").padStart(10), f(staked).padStart(8));
}
save("accrual", { head, events: ev, points });
