import { ethers, rpc, call, load, iso, blockTime } from "./lib.mjs";
const { rows } = load("polygon-transfers");
const SNI = "0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57", WETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const erc = new ethers.Interface(["function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)"]);
const bal = async (t, a) => Number(ethers.formatEther(BigInt(await call(137, t, erc.encodeFunctionData("balanceOf", [a]), "latest"))));
const A = { oldSafe: "0x979AeA92BbfC33BE4F3d4Cf328133d695B88952B", newSafe: "0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF", sniDest: "0x29D1eb36BBE5E49ab0fbaE559313e6ee9aa079aa", wethDest: "0x83f2492DB796BF0692C90B65DeBB926bd688fAe5" };
for (const [n, a] of Object.entries(A)) {
  const code = await rpc(137, "eth_getCode", [a, "latest"]);
  console.log(n, a, "code bytes:", (code.length - 2) / 2, "SNI:", await bal(SNI, a), "WETH:", await bal(WETH, a));
}
console.log("SNI totalSupply", Number(ethers.formatEther(BigInt(await call(137, SNI, erc.encodeFunctionData("totalSupply"), "latest")))));
// the two exit txs
for (const h of ["0x50a1b5b6efb30dfa67148f96f0bbd86743a6dcd7a3f4e0327b37445bff7fae37", rows.find((r) => r.token === "WETH" && r.dir === "out" && r.to === A.wethDest).tx, "0xeba5a802345f6569cc02ddb56285230bccd4f72e7054249d0cb2127c7e6abae7"]) {
  const tx = await rpc(137, "eth_getTransactionByHash", [h]); const rc = await rpc(137, "eth_getTransactionReceipt", [h]);
  console.log("\ntx", h, "\n from", tx.from, "to", tx.to, "selector", tx.input.slice(0, 10), "logs", rc.logs.length);
  for (const l of rc.logs) console.log("   ", l.address, l.topics[0].slice(0, 10), l.topics.slice(1).map((t) => "0x" + t.slice(26)).join(" "), l.data.length > 66 ? l.data.slice(0, 66) + "…" : l.data);
}
// SNI inflow tally by day-of-week for mints
const mints = rows.filter((r) => r.token === "SNI" && r.dir === "in" && r.from === ethers.ZeroAddress);
console.log("\nmints:", mints.length);
for (const m of mints) console.log(m.time, m.safe, Number(ethers.formatEther(m.amount)), m.tx.slice(0, 12));
