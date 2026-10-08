# INDEFI whitelist rehearsal

Nothing is deployed from here. This folder holds a Foundry fork test that
rehearses the governance proposal built by
`composables/execution/indefiProposal.ts`: the vault's governor (owner of the
Roles v1 modifier `0x89de…2B81`) scopes the 1inch router's `unoswapTo` and
`unoswapTo2` for role 1 and revokes `swap()`, and then the manager trades
through the new rules while every forbidden shape is refused.

What the rules pin, and why a compromised manager key gains nothing:

| Parameter | Rule | Effect |
|---|---|---|
| `to` | equal to the Safe | proceeds can only land in the vault |
| `token` | one-of USDC, WETH, AERO | only the vault's own assets can be sold |
| `dex`, `dex2` | one-of the listed pools, both directions, no flags | no attacker-made pool, no ETH unwrap, the bought token is always the other side of a listed pair |
| `swap()` | revoked | the entry point with a free executor slot is gone |

What they cannot pin: `minReturn`. Roles v1 has no condition that relates one
parameter to another, so the floor stays the caller's. The console fills it
from a live quote and the operator's tolerance; the listed pools are the
deepest on Base, which makes a deliberately bad fill expensive rather than
impossible.

The pools (Uniswap V3 on Base; the router's `unoswap` path verifies a pool's
callback against Uniswap's factory, so Aerodrome pools cannot be listed):

| Pair | Fee | Pool |
|---|---|---|
| USDC/WETH | 0.01% | `0xb4CB800910B228ED3d0834cF79D697127BBB00e5` |
| USDC/WETH | 0.05% | `0xd0b53D9277642d899DF5C87A3966A349A798F224` |
| USDC/WETH | 0.30% | `0x6c561B446416E1A00E8E93E221854d6eA4171372` |
| AERO/WETH | 0.30% | `0x3d5D143381916280ff91407FeBEB52f2b60f33Cf` |
| AERO/USDC | 0.05% | `0xE5B5f522E98B5a2baAe212d4dA66b865B781DB97` |

The same list is the single source of truth for the console's routing
(`INDEFI_POOLS` in `composables/execution/indefiConsole.ts`) and for the
proposal's compValues, and `indefiProposal.test.ts` asserts they agree.

## Run

```bash
cd contracts/indefi-unoswap-whitelist
forge install foundry-rs/forge-std --no-git   # once
BASE_RPC=https://gateway.tenderly.co/public/base forge test -vv
```

The public Base RPCs mostly cannot serve a fork (range caps, missing archive
state); the Tenderly gateway can.

## Submitting the proposal

The console shows a "Submit the whitelist proposal" action on the INDEFI
Execution App while the grant is missing. It calls the governor's `propose`
with the eight calls and a description listing every pool and every call.
INDEFI's proposal threshold is zero, the vote runs 287,994 blocks (about a
week) at 75% quorum, and the proposal executes through the governor, which
owns the modifier.
