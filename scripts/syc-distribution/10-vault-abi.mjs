import { rpc, save } from "./lib.mjs";
const V = "0x549d2398B34288dfb2b9ba0171086257AEff1562";
const slot = await rpc(1, "eth_getStorageAt", [V, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", "latest"]);
const impl = "0x" + slot.slice(26); console.log("impl", impl);
for (const a of [impl, V]) {
  for (const url of [`https://sourcify.dev/server/v2/contract/1/${a}?fields=abi`, `https://repo.sourcify.dev/contracts/full_match/1/${a}/metadata.json`]) {
    try { const r = await fetch(url); console.log(url.slice(0, 60), r.status); if (!r.ok) continue; const j = await r.json(); const abi = j.abi ?? j.output?.abi; if (abi) { save("vault-abi", abi);
      for (const f of abi) if (f.type === "function" || f.type === "event") console.log(f.type, f.name + "(" + f.inputs.map((i) => i.type + (i.indexed ? " indexed" : "") + " " + i.name).join(",") + ")", f.stateMutability ?? "", f.outputs ? "-> " + f.outputs.map((o) => o.type + " " + o.name).join(",") : "");
      process.exit(0); } } catch (e) { console.log("fail", e.message); }
  }
}
