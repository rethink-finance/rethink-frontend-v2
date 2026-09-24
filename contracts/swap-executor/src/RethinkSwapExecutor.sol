// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title RethinkSwapExecutor
 * @notice A stateless executor for 1inch AggregationRouterV6.swap(): runs one
 * exact-input trade on a DEX router named in the calldata, delivers the
 * output to the 1inch router and reports how much arrived, which the 1inch
 * router then checks against `minReturnAmount` and forwards to
 * `dstReceiver`.
 *
 * Why it exists. A vault's Zodiac Roles whitelist scopes the 1inch router for
 * `swap()` only — the bought token one-of a short list, the receiver pinned
 * to the vault's Safe — and leaves the executor free. 1inch's own executors
 * run a proprietary routing program that only the 1inch API can write; this
 * one runs a route the vault's app builds itself, so the whole trade is
 * readable on chain: which router, which pools, how much.
 *
 * Trust model. No owner, no settings, no balance between transactions, and
 * only the 1inch router may call it. Inside a `swap()` the 1inch router
 * first transfers the sold amount here (`desc.srcReceiver`), then calls
 * `execute`. This contract approves exactly what it holds to `target`, calls
 * `target` with the app's calldata — an exact-input swap whose recipient is
 * the 1inch router — resets the allowance, returns any unspent input to the
 * Safe, and reports the output as the growth of the 1inch router's balance
 * of `tokenOut`, which no `target` can fake without delivering the tokens.
 * If too little arrives, the 1inch router reverts the whole transaction on
 * its own `minReturnAmount` check, so a bad route costs gas and nothing else.
 */
contract RethinkSwapExecutor {
    /// @dev AggregationRouterV6 — the same address on every chain 1inch deploys to.
    address public constant ROUTER = 0x111111125421cA6dc452d289314280a0f8842A65;

    error NotRouter();
    error CallFailed(bytes reason);
    error ApproveFailed(address token);
    error TransferFailed(address token);

    /**
     * @dev Selector 0x4b64e492, what AggregationRouterV6 calls; its return
     * value is what the router treats as the swap's output. The router
     * appends the swap's `data` after this argument (and the input amount
     * after that), so the route is read straight from calldata:
     * abi.encode(address tokenIn, address tokenOut, address target, bytes targetCalldata).
     * `srcTokenOwner` is the router's caller — the Safe — and is where any
     * unspent input goes back to.
     */
    function execute(address srcTokenOwner) external payable returns (uint256 amountOut) {
        if (msg.sender != ROUTER) revert NotRouter();

        (address tokenIn, address tokenOut, address target, bytes memory targetCalldata) =
            abi.decode(msg.data[36:], (address, address, address, bytes));

        uint256 amountIn = _balance(tokenIn, address(this));
        uint256 outBefore = _balance(tokenOut, ROUTER);

        _approve(tokenIn, target, amountIn);
        (bool ok, bytes memory reason) = target.call(targetCalldata);
        if (!ok) revert CallFailed(reason);
        _approve(tokenIn, target, 0);

        uint256 unspent = _balance(tokenIn, address(this));
        if (unspent != 0) _transfer(tokenIn, srcTokenOwner, unspent);

        amountOut = _balance(tokenOut, ROUTER) - outBefore;
    }

    function _balance(address token, address holder) private view returns (uint256) {
        (bool ok, bytes memory ret) =
            token.staticcall(abi.encodeWithSelector(0x70a08231, holder));
        if (!ok || ret.length < 32) revert CallFailed(ret);
        return abi.decode(ret, (uint256));
    }

    /// @dev Tolerates tokens whose approve/transfer return nothing (USDT-style).
    function _approve(address token, address spender, uint256 amount) private {
        (bool ok, bytes memory ret) =
            token.call(abi.encodeWithSelector(0x095ea7b3, spender, amount));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert ApproveFailed(token);
    }

    function _transfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory ret) =
            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed(token);
    }
}
