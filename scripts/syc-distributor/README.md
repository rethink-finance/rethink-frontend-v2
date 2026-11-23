# SYC distributor

The mint roles for SYC, and two small contracts that can later mint it with no key, no backend and no weekly signing.

## Stages
1. **Now: the admin multisig mints.** It is the first member of the role `SYC-Distributor`, which allows one call (the Safe
   calling `mintToMany` on the vault) and has no amount limit. `scripts/syc-distribution/weekly.mjs` works out the amounts
   and writes the multisig's transaction; the first run is the one-off mint.
2. **After an outside review: the contracts below** take the role. Deploy them with no one-off mint (`deploy.mjs` does),
   since the multisig has made it.

The admin role may add and remove the role's members, and nothing more: what the role allows is the modifier owner's
call. Member changes go through the Safe, so they work once governance has handed the Roles modifier to the Safe; until
then the member is the one stored with the role. Whoever is added gets the same unlimited mint.

    npx esbuild scripts/syc-distributor/role/gen.ts --bundle --platform=node --format=cjs --alias:~="$PWD" --outfile=node_modules/.cache/syc-distributor-role.cjs && node node_modules/.cache/syc-distributor-role.cjs

writes `role/role-calls.json` and `role/role-calls-raw.txt`: four calls for the Raw permissions box (scope the vault,
scope the mint, the admin role's members permission, the multisig as first member).

## The contracts (stage 2)

| Contract | Chain | What it does |
|---|---|---|
| `SycDistributor` | Polygon | Anyone calls `distribute()`. It mints the SNI that sits in the vault's Safe without SYC issued against it, split by each depositor's sniETH. |
| `SniEthReporter` | Ethereum | Anyone calls `report(holders)`. It reads every holder's sniETH balance and sends the list to the distributor through Polygon's own bridge (FxPortal). |

## The one rule
After any mint, **SYC supply ≤ SNI in the Safe**. There is no fixed cap: when SNI is cheap and a little yield buys a lot of
it, all of it can be distributed; and SYC that nothing backs can never be minted.

## How the distributor works
- **`seed()`**, once, by anyone: the first issuance, fixed at deployment (everything owed since the first sniETH deposit).
  The SNI has to be in the Safe. SYC someone paid for earlier does not block it; SYC handed out for nothing does.
- **`distribute()`**, by anyone: SNI in the Safe minus SYC supply, split by the stored weights. Rounding leaves a few wei
  for next time, and a total below `minDistribution` (100 SYC) is skipped so the mint log cannot be flooded with dust.
- **Batches**: more than 25 recipients take several calls, each within a keeper's gas limit (about 1.1M gas per batch
  against the stand-in vault). Every wallet gets its share of the same amount, and the weights cannot change until the
  last batch is out.
- **Freshness**: once a reporter is named, weights that no report has set or confirmed for 8 days stop distributions.
  A report that repeats the balances is enough to confirm them. So the reporter has to be called at least weekly.
- **Keepers**: `checkUpkeep` / `performUpkeep` (Chainlink Automation's interface) do the same thing, so a keeper network
  can run it with nobody involved. The upkeep's check data may hold a minimum amount (a `uint256` in wei) below which
  the keeper waits.
- **Mint log**: every mint is recorded in the contract (`mintCount()`, `mints(from, count)`: time, block, total). The
  console's Distribution card lists them with the wallets each one paid.
- **Weights**: fixed at deployment, and afterwards changed only by the Ethereum reporter. Nobody can set them by hand,
  the owner included, and the reporter is named once and never replaced, so no person decides who receives SYC. A report
  that repeats the weights in force is dropped. A changed one with up to 32 recipients is stored and applied by the next
  distribution; a larger one only commits its hash and waits for anyone to call `applyReport` with the data from the
  reporter's `Reported` event. Either way, the SNI that was waiting when the report arrived is first distributed by the
  old weights. No wallet may appear twice.
- The contract is the only member of the role `SYC-Distributor`, and that role may make the Safe do one thing:
  `fundFlowsCall(mintToMany)`. The contract holds no funds and makes no other outward call.

## Who can mint, and who can stop it
- The contract mints through `SYC-Distributor`, once the admin multisig has made it a member (and taken itself out).
- It has no pause. Removing it from the role is the stop: one multisig transaction after the handover, a governance
  vote before it.
- The owner (the admin multisig) names the reporter, once. It cannot set weights, mint through the contract, or replace
  the reporter.

## How the reporter stays honest
An ERC-20 cannot list its holders, so the caller supplies them (ascending) and the contract checks the list is complete:
the balances must add up to sniETH's whole supply, less than `minBalance` short, so a wei moved to a fresh address in
front of a report cannot make it fail and dust addresses need not be listed at all. Every holder is paid at its own address on Polygon, which is only right for ordinary wallets. Counted in the sum but
not sent: balances below `minBalance` (0.01 sniETH), and contracts, multisigs included, because the same address on
Polygon is nobody's or somebody else's. Their shares go to the other holders, so sniETH should be held by ordinary
wallets. `preview(holders)` shows what a report would send.

## Order of operations
1. Store `role/role-calls-raw.txt` on the vault's Roles modifier (through the factory, before finalizing).
   Do not save anything from the app's Permissions page afterwards: a save there re-submits the page's whole permission
   set and overwrites calls stored by hand. On 2026-11-23 a member change made that way rolled the admin multisig's
   `assignRoles` scope back to a version without SYC-Distributor; `role/restore-admin-assignroles-scope.txt` is the
   factory call that puts it back (deployer to factory, before finalizing). After any app save, re-read the modifier's
   ScopeFunction events before going on.
2. Move the SNI left in the old Safe to the new one.
3. Finalize from the app's create flow. Its Finalize step sends finalizeCreateFund and the vault's first NAV update as
   one atomic wallet batch (EIP-5792, `composables/onboarding/finalizeCalls.ts`); the preflight on that step must say
   the NAV update runs in the same transaction. Fork-tested: at zero supply a deposit takes the whole Safe, and a deposit
   request made between finalize and the first NAV update is paid out by that update; once a NAV update exists, deposits
   only go through at the next one, so nothing can be claimed before the mint. Do not finalize from a wallet the step
   reports as unable to batch, and do not use the "finalize without the NAV update" fallback. The deposit whitelist is no
   alternative: the vault takes settings only from the governor.
4. `node scripts/syc-distribution/weekly.mjs`, load `out/<date>/safe-transaction.json` in the admin multisig, sign and
   execute the one-off mint. Do not run another NAV update before it is in.
5. Every week: the same script, the same steps. It mints what is owed in total minus what has been minted, so a skipped
   week is picked up by the next run.
6. Governance (SYC holders, about 8 days) hands the Roles modifier to the Safe. From then on the admin multisig can
   change members.
7. Later: the reviewed contracts take the role (`node scripts/syc-distributor/deploy.mjs distributor`, then the
   reporter once the new sniETH vault is live).

## Tests
    forge install foundry-rs/forge-std --no-git      # once
    forge test                                       # scenarios, 5 rules under random use, 6 against the live chains (needs network)
    node test/mutate.mjs                             # removes each safety check in turn; the tests must fail every time
    npx esbuild scripts/syc-distributor/role/gen.ts --bundle --platform=node --format=cjs --alias:~="$PWD" --outfile=node_modules/.cache/syc-distributor-role.cjs && node node_modules/.cache/syc-distributor-role.cjs

The fork tests use the vault's live Roles modifier, Safe, SNI, FxChild, sniETH, FxRoot and state sender, and apply the exact
calls in `role/role-calls.json`.

## Limits
- A report with more than 32 recipients is not applied by the keeper: someone makes one permissionless `applyReport`
  call with its data.
- Inside the 8-day window weights are as fresh as the last report: a holder who leaves keeps earning until someone
  reports, and a holder can pick the moment of a report (or inflate it with borrowed sniETH, should sniETH ever be
  lendable or pooled). Run a bot that reports on every sniETH transfer, and revisit this before sniETH trades in pools.
- If SNI leaves the Safe between two batches, the rest of that distribution is dropped: wallets later in the list miss
  that one. Nothing unbacked is minted.
- More than 100 real holders does not fit; that needs a different design (claims instead of pushes).
- `test/Exploits.t.sol` holds the attack attempts from the self-audit: what was tried, what held, what is known.
- `test/Invariants.t.sol` runs random sequences of everything that can happen around the distributor and checks five rules after each step.
- `foundry.toml` turns `dynamic_test_linking` off: with it on, a test that expects a deployment to revert stops at that line and is reported as passing.
- Not reviewed by anyone else. Both contracts are immutable; a fix means deploying a new one and moving the role.
- The vault itself is a stand-in in the fork tests: it is not finalized and refuses every mint. The real mint call was
  checked separately on finalized Rethink vaults on Polygon.
- A depositor who joins shares in SNI that reaches the Safe after their weight is applied, including yield that was earned
  before they joined but claimed and swapped later. Claim and swap before a large deposit to avoid it.
- A mint fee on the vault makes every mint revert rather than short-change anyone.
- If the vault ever has more SYC than SNI (fees minted as SYC, SNI moved out of the Safe), distributions pause until the
  SNI catches up.
- There is no manual override. Until the reporter is live the split stays as deployed, and a faulty reporter cannot be
  replaced: the remedy for either is to take the role away and deploy a new distributor, both of which need governance
  until the modifier is with the Safe.
