# RethinkSwapExecutor

A stateless executor for 1inch AggregationRouterV6 `swap()`. The vault app
builds the whole trade itself — which DEX router, which pools, how much — and
the 1inch router still enforces `minReturnAmount` and delivers the output to
the vault's Safe. No 1inch API is involved.

Why: a vault's Zodiac Roles whitelist (INDEFI on Base, role 1) scopes the
router for `swap()` only, with the bought token one-of a list and the receiver
pinned to the Safe, and leaves the `executor` free. 1inch's own executors run
a proprietary routing program that only the 1inch API can write.

| | |
|---|---|
| Pinned address | `0x2f732eF6E684f7f850281d5525933A0a1a931dC5` |
| How it is pinned | CREATE2 through the deterministic deployment proxy `0x4e59b44847b379578588920cA78FbF26c0B4956C`, salt `keccak256("rethink.finance/RethinkSwapExecutor/v1")` = `0x51a2d9df4f83e065beabcdfe74e21f5d5c0fe924c3b1a39fb6730df70647c1f2` |
| Compiler | solc 0.8.26, evm cancun, optimizer 200 runs, no metadata hash (`foundry.toml`) |
| Runtime hash | `0x1e35d8cf9ecc741d2baf2e111973407b2895ffd452ae978050427ab2fcdd5261` — the app (`composables/execution/onchainSwap.ts`) routes only when the code at the address hashes to this |

The same init code with the same salt lands on the same address on every
chain the proxy exists on, so DoC on Polygon can use it later without a new
address.

## Build

```bash
cd contracts/swap-executor
forge install foundry-rs/forge-std --no-git   # once
forge build
```

`out/RethinkSwapExecutor.sol/RethinkSwapExecutor.json` then carries the init
code (`bytecode.object`) and the runtime (`deployedBytecode.object`). Check the
runtime hashes to the value above before deploying.

## Deploy

Send one transaction to the deployment proxy from any funded key. The
calldata is the salt followed by the init code, with no ABI encoding:

```bash
cast send 0x4e59b44847b379578588920cA78FbF26c0B4956C \
  "0x51a2d9df4f83e065beabcdfe74e21f5d5c0fe924c3b1a39fb6730df70647c1f2$(jq -r .bytecode.object out/RethinkSwapExecutor.sol/RethinkSwapExecutor.json | cut -c3-)" \
  --rpc-url https://mainnet.base.org --interactive
```

Afterwards the code at the pinned address must hash to the runtime hash:

```bash
cast keccak "$(cast code 0x2f732eF6E684f7f850281d5525933A0a1a931dC5 --rpc-url https://mainnet.base.org)"
```

Verify the source on Blockscout (no key needed):

```bash
forge verify-contract 0x2f732eF6E684f7f850281d5525933A0a1a931dC5 \
  src/RethinkSwapExecutor.sol:RethinkSwapExecutor \
  --verifier blockscout --verifier-url https://base.blockscout.com/api/ --chain 8453
```

## Test

The fork test runs the manager's `execTransactionWithRole(role 1)` on a Base
fork against the real modifier, Safe, router and pools:

```bash
BASE_RPC=https://gateway.tenderly.co/public/base forge test -vv
```
