// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Delegate target for the deployer under EIP-7702: in one transaction, finalize the vault through the factory
///         and execute the admin multisig's already-signed mint. Nothing can land between the two, so no deposit can
///         claim the Safe's SNI at zero supply. Only the delegating account itself may call `run`.
contract FinalizeAndMint {
    struct Call {
        address to;
        bytes data;
    }

    error NotSelf();
    error CallFailed(uint256 index, bytes reason);

    function run(Call[] calldata calls) external {
        if (msg.sender != address(this)) revert NotSelf();
        for (uint256 i; i < calls.length; ++i) {
            (bool ok, bytes memory ret) = calls[i].to.call(calls[i].data);
            if (!ok) revert CallFailed(i, ret);
        }
    }
}
