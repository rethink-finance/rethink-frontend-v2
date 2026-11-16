# SYC distribution

Works out how many SYC each sniETH depositor is owed and writes the multisig transaction that mints it.

Since 16 Nov 2026 the weekly job itself runs in rethink-backend (`backend/src/syc-distribution`): it recomputes every three
hours, serves `GET /syc-distribution/latest` to the console's Distribution card, and notifies the admin multisig's signers.
This folder is the reference the backend is tested against (`13-backend-export.mjs` writes its fixtures and frozen history),
and `weekly.mjs` remains a way to produce the same mint without the backend.

    node scripts/syc-distribution/weekly.mjs

Run it once a week (any day). It sends nothing and needs no key. Output lands in `out/<date>/`:

- `report.md`: amounts per wallet, checks, anything that needs attention.
- `safe-transaction.json`: load it in the admin multisig under Apps > Transaction Builder. One signer creates the batch, the others confirm.

## How it works
- The amount owed is cumulative from the first deposit. The script subtracts what `mintToMany` has already minted to each
  wallet and mints the difference. The first run is the retroactive mint; a skipped week is included in the next run.
- Incentives (34,000 SNI mints) are split by sniETH balance at each mint.
- Yield is split by who held sniETH while the staking vault generated it, and counts as the SNI it actually bought.
  WETH that has not been swapped yet is not minted until it is.
- The transaction is `Roles.execTransactionWithRole(vault, fundFlowsCall(mintToMany(amounts, recipients)), adminRole)`.

## Settings
Optional `config.json` next to the script: `{ "adminSafe": "0x…", "allowanceKey": "…" }`. With `adminSafe` set the script
dry-runs the exact transaction from the multisig; with `allowanceKey` it checks the weekly cap.

## Before it can be executed
1. The vault must be finalized (an unfinalized vault rejects every mint).
2. The admin multisig must be a member of `adminRole`, and `adminRole` must be allowed to call `mintToMany`.
3. The first mint must happen before anyone can deposit.

## When sniETH is redeployed
`01-snieth.mjs`, `05-mainnet-claims.mjs` and `11-accrual.mjs` read the current sniETH vault, its Safe and its staking vault.
Balances are taken from deposits before the 8 Sep 2026 incident. Add the new vault there, or new deposits and
redemptions will not be seen.

## Files
`01`–`11` fetch and compute (`06-compute.mjs` is the calculation, `07-verify.mjs` an independent re-derivation),
`09-page.mjs` builds the team page, `data/` is the fetched chain data, `out/` the weekly outputs.
