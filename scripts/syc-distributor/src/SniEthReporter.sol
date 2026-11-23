// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20Balances {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/// @notice Polygon's FxPortal on Ethereum: delivers a message to a contract on Polygon.
interface IFxRoot {
    function sendMessageToChild(address receiver, bytes calldata data) external;
}

/**
 * @title SniEthReporter
 * @notice Tells the SYC distributor on Polygon who holds how much sniETH on Ethereum. Anyone may call
 *         report(); nobody can make it lie.
 *
 *         An ERC-20 cannot list its holders, so the caller supplies the list and the contract checks it is
 *         complete: the balances it reads must add up to sniETH's whole supply, less than `minBalance` short.
 *         Leaving out a holder that would be sent, or naming one twice, makes the call revert. The small
 *         allowance is there so that a wei of sniETH moved to a fresh address just before a report cannot make
 *         it fail: everything it lets a caller leave out is below `minBalance`, and so would not be sent anyway.
 *
 *         Every holder is paid at its own address on Polygon. That is only right for ordinary wallets, which
 *         are the same person on every chain. Two kinds of holder are therefore counted in the sum but not sent:
 *           - balances below `minBalance`, so sprinkling dust over many addresses cannot fill the list;
 *           - contracts (a multisig, a pool, an escrow). The same address on Polygon is nobody's, or somebody
 *             else's, so a contract is never paid. sniETH is meant to be held by ordinary wallets.
 *         Their shares go to the other holders pro rata.
 *
 *         The message goes through Polygon's own Ethereum-to-Polygon bridge (FxRoot → state sync → FxChild),
 *         so it adds no trust beyond Polygon itself. It arrives some minutes later.
 */
contract SniEthReporter {
    /// @dev Matches the distributor's cap on recipients.
    uint256 public constant MAX_RECIPIENTS = 100;

    IERC20Balances public immutable sniEth;
    IFxRoot public immutable fxRoot;
    /// @notice The SycDistributor on Polygon.
    address public immutable distributor;
    /// @notice Holders with less sniETH than this are not sent.
    uint256 public immutable minBalance;

    event Reported(uint256 indexed reportBlock, address[] recipients, uint256[] weights);

    error ZeroAddress();
    error NoHolders();
    error TooManyRecipients();
    error NotAscending();
    error IncompleteHolders(uint256 summed, uint256 totalSupply);

    constructor(IERC20Balances sniEth_, IFxRoot fxRoot_, address distributor_, uint256 minBalance_) {
        if (address(sniEth_) == address(0) || address(fxRoot_) == address(0) || distributor_ == address(0)) {
            revert ZeroAddress();
        }
        sniEth = sniEth_;
        fxRoot = fxRoot_;
        distributor = distributor_;
        minBalance = minBalance_;
    }

    /// @notice What report() would send for this list, without sending it. Reverts exactly as report() would.
    function preview(address[] calldata holders) public view returns (address[] memory to, uint256[] memory amounts) {
        uint256 n = holders.length;
        if (n == 0) revert NoHolders();
        to = new address[](n);
        amounts = new uint256[](n);
        uint256 kept;
        uint256 summed;
        address previous;
        for (uint256 i; i < n; ++i) {
            address holder = holders[i];
            // Strictly ascending: no address twice, and never the zero address.
            if (holder <= previous) revert NotAscending();
            previous = holder;
            uint256 balance = sniEth.balanceOf(holder);
            summed += balance;
            if (balance == 0 || balance < minBalance || _isContract(holder)) continue;
            to[kept] = holder;
            amounts[kept] = balance;
            ++kept;
        }
        uint256 supply = sniEth.totalSupply();
        // Complete, or short by less than one sendable balance (dust the caller did not list).
        if (summed > supply || kept == 0) revert IncompleteHolders(summed, supply);
        if (summed != supply && supply - summed >= minBalance) revert IncompleteHolders(summed, supply);
        if (kept > MAX_RECIPIENTS) revert TooManyRecipients();

        // Trim the arrays to the holders that were kept.
        assembly {
            mstore(to, kept)
            mstore(amounts, kept)
        }
    }

    /**
     * @notice Read every holder's sniETH balance and send the list to Polygon.
     * @param holders Every address with a sniETH balance, in ascending order.
     */
    function report(address[] calldata holders) external {
        (address[] memory to, uint256[] memory amounts) = preview(holders);
        fxRoot.sendMessageToChild(distributor, abi.encode(block.number, to, amounts));
        emit Reported(block.number, to, amounts);
    }

    /// @dev Code that is not just an EIP-7702 delegation: a wallet that delegated is still its owner's on every chain.
    function _isContract(address account) private view returns (bool) {
        uint256 size = account.code.length;
        if (size == 0) return false;
        if (size != 23) return true;
        bytes3 prefix;
        assembly {
            let ptr := mload(0x40)
            extcodecopy(account, ptr, 0, 3)
            prefix := mload(ptr)
        }
        return prefix != 0xef0100;
    }
}
