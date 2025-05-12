# Zodiac Roles Modifier V1

Code for generating typings can be found in:
[zodiac-modifier-roles-v1](https://github.com/gnosisguild/zodiac-modifier-roles-v1).

- React code was converted to Vue code.
- Ethers V5 code was converted to Ethers V6.

## Build contract typings Ethers V6

Go to their repo and update Ethers V5 to V6.
**IMPORTANT** gnosis have patched the typechain for ethers-v6 because the Roles.sol contract has a variable called
**target** that is clashing with the BaseContract target. Make sure to use:
```sh
"@gnosis-guild/typechain-ethers-v6": "^0.5.4",
# instead of
"@typechain/ethers-v6": "^0.5.1",
```
```json
{
  "dependencies": {
    "ethers": "^6.10.0"
  },
    "devDependencies": {
    "typechain": "^8.3.2",
    "@gnosis-guild/typechain-ethers-v6": "^0.5.4"
  }
}
```
And go to evm directory and add this to the `hardhat.config.ts` and then run `hardhat clean & hardhat compile`.
```ts
typechain: {
  target: require.resolve("@gnosis-guild/typechain-ethers-v6")
}
```

Ideally we would have a monorepo with all these contracts in one and we could have the same
flow, like they do in the zodiac-roles-modifier-v1, generating ABIs automatically when compiling contracts.
But for now I have just commited all typings as the Roles.ts and Permissions.ts contracts won't change.
