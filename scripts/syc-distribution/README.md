# SYC distribution

Rebuilds, from chain events alone, how many SYC each sniETH depositor is owed. This is where the first issuance
that `scripts/syc-distributor` bakes into the distributor contract comes from; after that the contract mints by itself.

    node scripts/syc-distribution/01-snieth.mjs && node scripts/syc-distribution/02-polygon.mjs && node scripts/syc-distribution/05-mainnet-claims.mjs && node scripts/syc-distribution/11-accrual.mjs && node scripts/syc-distribution/06-compute.mjs
    node scripts/syc-distribution/07-verify.mjs        # the same result, derived a second way
    node scripts/syc-distributor/deploy.mjs distributor # the deployment with these amounts

## How it works
- The amount owed is cumulative from the first deposit.
- Incentives (34,000 SNI mints) are split by sniETH balance at each mint.
- Yield is split by who held sniETH while the staking vault generated it, and counts as the SNI it actually bought.
  WETH that has not been swapped yet is not counted until it is.

## When sniETH is redeployed
`01-snieth.mjs`, `05-mainnet-claims.mjs` and `11-accrual.mjs` read the current sniETH vault, its Safe and its staking vault.
Balances are taken from deposits before the 8 Sep 2026 incident. Add the new vault there, or new deposits and
redemptions will not be seen.

## Files
`01`–`11` fetch and compute (`06-compute.mjs` is the calculation, `07-verify.mjs` an independent re-derivation),
`09-page.mjs` builds the team page, `data/` is the fetched chain data.

## The weekly mint

    node scripts/syc-distribution/weekly.mjs             # full refresh (Ethereum + Polygon), about 5 minutes
    node scripts/syc-distribution/weekly.mjs --cached    # Polygon only; use when nothing changed on Ethereum (no new sniETH deposits)

It works out what each depositor is owed in total since the first deposit, subtracts what has been minted through the
mint role, dry-runs the mint and the permission, and writes `out/<date>/report.md` and `out/<date>/safe-transaction.json`
(for the admin multisig's Transaction Builder). It sends nothing and needs no key. The exit code is 1 when the report has a
"Needs attention" section, so a cron job can tell.

The SYC vault's Execution App tab (Distribution card) does the same in the browser and files the mint with the admin
Safe under one owner's signature, or downloads the same Transaction Builder file. It starts from this folder's result at
Polygon block 97,866,642 (`SYC_MINT.BASE` in `composables/execution/sycMultisigMint.ts`) and reads only Polygon after
it, since every sniETH weight is fixed after the 8 Sep 2026 incident. If `06-compute.mjs` ever changes what is owed
before that block (an odd SNI mint counted as an incentive, a new sniETH vault), update `SYC_MINT.BASE` from a fresh run.

Each week:
1. Run it. Read `report.md`: the table, the checks, anything under "Needs attention".
2. In the admin multisig open Apps > Transaction Builder, load `safe-transaction.json`, create the transaction, collect
   the signatures, execute.
3. Run it again: it should say "Nothing to mint".

Notes:
- Run it right before signing. The amount grows with each 34,000 SNI incentive mint, so an old file mints less than
  is owed; that is not wrong, just late, and the next run picks up the rest.
- A skipped week is picked up by the next run: everything is cumulative.
- The first run after finalizing is the one-off mint. Finalize and execute it back to back: at zero supply the first
  deposit would otherwise claim all the SNI in the Safe.
- Only mints sent through the Roles modifier count as distributions. Deposits, fees and any other mint are listed under
  "Needs attention" and never counted as paid.
- SNI minted to the Safe in any amount other than 34,000 is not distributed (06-compute.mjs decides what counts); the
  report flags it so it can be added there if it is an incentive.
- Yield: WETH that reaches the Safe is counted once it has been swapped to SNI. WETH from a new sniETH Safe (no matching
  bridge deposit) is split by the balances on the day it arrives, with a warning.
- When sniETH moves to a new vault, add it to `01-snieth.mjs`, `05-mainnet-claims.mjs` and `11-accrual.mjs` first.

Rehearsal on a fork (nothing sent): set `SYC_RPC_137=http://127.0.0.1:8545` to point Polygon at an anvil fork and
`SYC_OUT=/some/folder` to keep the output apart. The vault refuses every mint until it is finalized, so on a fork its
code has to be replaced with the stand-in from `scripts/syc-distributor/test/Mocks.sol`.
