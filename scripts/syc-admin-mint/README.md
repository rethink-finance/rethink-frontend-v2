# SYC admin mint permission

The Roles v2 permission that lets the SNI Yield Claim Vault's admin role mint SYC to sniETH depositors, capped by an allowance.
It is what the console's Distribution card and the backend's weekly distribution rely on.

    npx esbuild scripts/syc-admin-mint/gen.ts --bundle --platform=node --format=cjs --alias:~="$PWD" --outfile=node_modules/.cache/syc-admin-mint-gen.cjs && node node_modules/.cache/syc-admin-mint-gen.cjs
    node scripts/syc-admin-mint/sim.mjs

- `gen.ts` writes `admin-mint.json` and `admin-mint-raw.txt` (one call per line, for the app's Raw permissions box):
  1. `scopeTarget(adminRole, vault)`
  2. `scopeFunction(adminRole, vault, fundFlowsCall(bytes))`: the bytes must be a `mintToMany(uint256[],address[])` call, and every
     amount is drawn from the allowance `sycMint`. Recipients are not restricted; the cap is the guard.
  3. `setAllowance(sycMint, 3,400,000 now, +50,000 a week, unused weeks carry over up to 150,000)`
- `sim.mjs` dry-runs the three calls against the live modifier (`eth_simulateV1`, nothing is sent): the mint passes; every other
  vault function through the same entry point, a direct `mintToMany`, token transfers, delegatecall, attached value, non-members
  and Executors are refused; the cap holds across several amounts; refills and skipped weeks behave as above.

Notes
- While the vault is not finalized it refuses every mint, so the cap checks run with the vault's code emptied. The mint call
  itself is checked on a finalized Rethink vault on Polygon.
- The 3,400,000 starting balance covers the retroactive mint (3,246,665 SYC owed on 16 Nov 2026, growing about 40,000 a week).
  A balance above the 150,000 cap is not refilled until it has been spent down below it.
- Once the vault is finalized the factory no longer owns the modifier, so changing the cap is expected to need governance.
