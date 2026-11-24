// Builds the deployment transactions. Sends nothing and needs no key.
//
//   node scripts/syc-distributor/deploy.mjs distributor
//       → deploy/distributor-creation.txt  (Polygon)  from the latest scripts/syc-distribution result
//   node scripts/syc-distributor/deploy.mjs reporter <sniETH token on Ethereum> <distributor on Polygon>
//       → deploy/reporter-creation.txt     (Ethereum)
import fs from "node:fs";
import { ethers, rpc } from "../syc-distribution/lib.mjs";

const here = new URL(".", import.meta.url);
const artifact = (name) => JSON.parse(fs.readFileSync(new URL(`out/${name}.sol/${name}.json`, here)));
const coder = ethers.AbiCoder.defaultAbiCoder();
fs.mkdirSync(new URL("deploy/", here), { recursive: true });
const POLYGON = {
  roles: "0x8A984794a920BBd367B3e54362014dE973200aB0",
  roleKey: ethers.encodeBytes32String("SYC-Distributor"),
  fund: "0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007",
  safe: "0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF",
  sni: "0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57",
  fxChild: "0x8397259c983751DAf40400790063935a11afa28a",
  owner: "0x78E35296B8C0d0e31EF3584504289B4908416dc8", // the admin multisig: weights, reporter, pause
  minDistribution: ethers.parseEther("100"), // smaller distributions are skipped, so the mint log cannot be flooded with dust
  maxWeightAge: 8 * 86400, // once a reporter is named: distributions wait when no report has confirmed the balances for 8 days
};
/** sniETH below this is counted but not sent to Polygon, so dust addresses cannot fill the list. */
const MIN_BALANCE = ethers.parseEther("0.01");
const FX_ROOT = "0xfe5e5D361b2ad62c541bAb87C45a0B9B018389a2";
const fmt = (wei) => Number(ethers.formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: 4 });
const estimate = async (chain, data) => { try { return Number(BigInt(await rpc(chain, "eth_estimateGas", [{ from: "0x000000000000000000000000000000000000dEaD", data }]))); } catch (e) { return "FAILED: " + e.message.slice(0, 160); } };

const [what, ...args] = process.argv.slice(2);
if (what === "distributor") {
  const res = JSON.parse(fs.readFileSync(new URL("../syc-distribution/data/result.json", here)));
  const holders = [...res.holders].sort((a, b) => (BigInt(res.total[b]) > BigInt(res.total[a]) ? 1 : -1));
  // weights: each wallet's sniETH (from deposits). No one-off mint: the admin multisig has made it by the time this
  // contract takes over, so the plan is empty and the contract starts ready to distribute.
  const weights = holders.map((h) => res.deposits.filter((d) => d.holder === h).reduce((s, d) => s + BigInt(d.amount), 0n));
  const ctor = coder.encode(
    ["tuple(address,bytes32,address,address,address,address,address,uint256,uint256)", "address[]", "uint256[]", "address[]", "uint256[]"],
    [[POLYGON.roles, POLYGON.roleKey, POLYGON.fund, POLYGON.safe, POLYGON.sni, POLYGON.fxChild, POLYGON.owner, POLYGON.minDistribution, POLYGON.maxWeightAge], holders, weights, [], []],
  );
  const data = artifact("SycDistributor").bytecode.object + ctor.slice(2);
  fs.writeFileSync(new URL("deploy/distributor-creation.txt", here), data + "\n");
  fs.writeFileSync(new URL("deploy/distributor-args.json", here), JSON.stringify({ computed: res.generated, ...POLYGON, minDistribution: POLYGON.minDistribution.toString(), role: "SYC-Distributor", recipients: holders, weights: weights.map(String), seedAmounts: [] }, null, 2));
  console.log(`SycDistributor for Polygon, from the distribution computed ${res.generated}`);
  holders.forEach((h, i) => console.log(`  ${h}  sniETH ${fmt(weights[i]).padStart(12)}`));
  console.log(`  no one-off mint in the contract; owner ${POLYGON.owner}`);
  console.log(`  deployment gas estimate: ${await estimate(137, data)}`);
  console.log(`\nwritten: scripts/syc-distributor/deploy/distributor-creation.txt\nDeploy:\n  ~/.foundry/bin/cast send --rpc-url https://polygon.gateway.tenderly.co --interactive --create $(cat scripts/syc-distributor/deploy/distributor-creation.txt)`);
} else if (what === "reporter") {
  const [sniEth, distributor] = args.map((a) => ethers.getAddress(a));
  const data = artifact("SniEthReporter").bytecode.object + coder.encode(["address", "address", "address", "uint256"], [sniEth, FX_ROOT, distributor, MIN_BALANCE]).slice(2);
  fs.writeFileSync(new URL("deploy/reporter-creation.txt", here), data + "\n");
  console.log(`SniEthReporter for Ethereum: sniETH ${sniEth}, FxRoot ${FX_ROOT}, distributor ${distributor}`);
  console.log(`  deployment gas estimate: ${await estimate(1, data)}`);
  console.log(`\nwritten: scripts/syc-distributor/deploy/reporter-creation.txt\nDeploy:\n  ~/.foundry/bin/cast send --rpc-url https://mainnet.gateway.tenderly.co --interactive --create $(cat scripts/syc-distributor/deploy/reporter-creation.txt)`);
} else {
  console.log("usage: deploy.mjs distributor | deploy.mjs reporter <sniETH token> <distributor>");
  process.exit(1);
}
