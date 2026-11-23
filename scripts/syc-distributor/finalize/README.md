# Finalize the SYC vault: two steps, from the terminal

Finalize and the first NAV update go out in ONE transaction from the deployer, so no deposit request can be paid out at
zero supply (see ../README.md, order of operations). The deployer wallet delegates to `FinalizeAndMint`
(`../src/tools/FinalizeAndMint.sol`) with an EIP-7702 transaction; MetaMask cannot do that, `cast` can. Every command
asks for the private key on the terminal (`--interactive`); nothing is stored.

Before: the mint role is stored, the old Safe's SNI has been moved, and no more SNI leaves the Safe until the mint is in.

## 1. Deploy FinalizeAndMint (any funded wallet)

    ~/.foundry/bin/cast send --rpc-url https://polygon-rpc.com --interactive --create $(cat scripts/syc-distributor/finalize/finalize-and-mint-creation.txt)

Note the `contractAddress` in the output, then check it is the compiled code:

    ~/.foundry/bin/cast keccak $(~/.foundry/bin/cast code --rpc-url https://polygon-rpc.com <contractAddress>)
    # must print 0xde20beda6635677e7b6ba8f6f90a26deacbcbca8bb8c5b9af95588a7792f3b51

## 2. Finalize + first NAV update (the deployer 0xB5d01172e73559B07ef3CD53dE84459c6BA3a054)

    ~/.foundry/bin/cast send --rpc-url https://polygon-rpc.com --interactive --auth <contractAddress> --gas-limit 4500000 0xB5d01172e73559B07ef3CD53dE84459c6BA3a054 $(cat scripts/syc-distributor/finalize/finalize-and-nav-run.txt)

`--auth <contractAddress>` is the EIP-7702 delegation, signed with the same key; the transaction is sent to the
deployer's own address and runs `run([factory.finalizeCreateFund(), roles.execTransactionWithRole(vault,
executeNAVUpdate(0x540f…2bbd), defaultManagerRole)])`. The gas limit is fixed because an estimate made before the
delegation exists would fail; the fork used 3,224,059. If cast asks `Continue anyway? [y/N]`, answer `y`.

Check:

    ~/.foundry/bin/cast call --rpc-url https://polygon-rpc.com 0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007 '_navUpdateLatestIndex()(uint256)'   # 1
    ~/.foundry/bin/cast call --rpc-url https://polygon-rpc.com 0x8A984794a920BBd367B3e54362014dE973200aB0 'owner()(address)'                 # the governor 0x930D…7F35
    ~/.foundry/bin/cast code --rpc-url https://polygon-rpc.com 0xB5d01172e73559B07ef3CD53dE84459c6BA3a054                                   # 0xef0100 + contractAddress

## 3. The one-off mint

    node scripts/syc-distribution/weekly.mjs

Load `out/<date>/safe-transaction.json` in the admin multisig, sign, execute. **No NAV update until this is in.**

## Afterwards (optional)

The delegation stays on the deployer address. It only accepts calls from itself, so it is harmless; to remove it:

    ~/.foundry/bin/cast send --rpc-url https://polygon-rpc.com --interactive --auth 0x0000000000000000000000000000000000000000 --gas-limit 100000 0xB5d01172e73559B07ef3CD53dE84459c6BA3a054 0x
