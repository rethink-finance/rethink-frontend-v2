# Design system icons

Network and token marks from the Rethink design system ("Design system Vue
alignment"). **These are the source for every chain and token icon in the app.**

Do not add chain or token marks from an icon set (Iconify, `cryptocurrency-color`,
`token-branded`) alongside these. Those remain wired up only as a fallback for
marks the design system does not ship, so a token without one shows something
rather than nothing:

| Not covered | Falls back to |
| --- | --- |
| DAI | `cryptocurrency-color:dai` |
| Local test node | `ph:circle-fill` |

When the design system adds one of those, drop the file in here and add it to
`composables/designSystemIcons.ts` — the fallback then stops being reached on its
own.

## Files

Naming is `chain-<short>.png` and `token-<symbol>.png`.

- `chain-arb`, `chain-base`, `chain-eth`, `chain-hype`, `chain-pol`
- `token-usdc`, `token-usdt`, `token-wbtc`, `token-weth`

All of them but Base are a disc drawn to the edge of a transparent square, so
nothing is painted behind them — a field or border would only show through the
corners as a rim around the logo. Base's is a full-bleed square, and rounding
the frame is enough to give it the same silhouette, so a new file can be either
shape.

Chain and token marks render at one shared diameter, `ICON_SIZE_PX` in
`composables/designSystemIcons.ts`, so the two never disagree where they sit
side by side.

## Using them

Never import a file from here directly in a component. Go through
`composables/designSystemIcons.ts` (`getDesignChainIcon`, `getDesignTokenIcon`),
which both icon components already do:

- `components/global/icon/Chain.vue` — networks
- `components/global/icon/BaseAsset.vue` — tokens
