// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {RethinkSwapExecutor} from "../src/RethinkSwapExecutor.sol";

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
}

interface IRolesV1 {
    function execTransactionWithRole(
        address to, uint256 value, bytes calldata data, uint8 operation, uint16 role, bool shouldRevert
    ) external returns (bool);
}

interface IUniswapSwapRouter02 {
    struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

interface ISlipstreamRouter {
    struct ExactInputParams { bytes path; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

/// The 1inch v6 GenericRouter.swap signature, for the calldata builder.
interface IAggregationRouterV6 {
    struct SwapDescription {
        address srcToken; address dstToken; address payable srcReceiver; address payable dstReceiver;
        uint256 amount; uint256 minReturnAmount; uint256 flags;
    }
    function swap(address executor, SwapDescription calldata desc, bytes calldata data)
        external payable returns (uint256 returnAmount, uint256 spentAmount);
}

/**
 * Runs on a Base fork against the real INDEFI modifier, Safe, 1inch router
 * and pools: the manager EOA sends execTransactionWithRole(role 1) exactly as
 * the app will, and the Safe's balances move.
 *
 *   BASE_RPC=https://gateway.tenderly.co/public/base forge test -vv
 */
contract RethinkSwapExecutorTest is Test {
    address constant SAFE = 0x6B6d690F540788b87FC63BD975e6B398da775159;
    address constant MANAGER = 0xE257160f654A2E3222a343FafC4a71AE45Be5d99;
    address constant ROLES = 0x89de956576ACc0a141Bef842A489C2C391382B81;
    address constant ONE_INCH = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant UNI_ROUTER02 = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address constant AERO_CL_ROUTER = 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5;

    RethinkSwapExecutor exec;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_RPC", string("https://gateway.tenderly.co/public/base")));
        exec = new RethinkSwapExecutor();
    }

    function _swap(address tokenIn, address tokenOut, uint256 amount, uint256 minReturn, address target, bytes memory targetCalldata, address receiver)
        internal view returns (bytes memory)
    {
        IAggregationRouterV6.SwapDescription memory d = IAggregationRouterV6.SwapDescription({
            srcToken: tokenIn, dstToken: tokenOut, srcReceiver: payable(address(exec)), dstReceiver: payable(receiver),
            amount: amount, minReturnAmount: minReturn, flags: 0
        });
        return abi.encodeWithSelector(
            IAggregationRouterV6.swap.selector, address(exec), d, abi.encode(tokenIn, tokenOut, target, targetCalldata)
        );
    }

    function _uniCall(bytes memory path, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(
            IUniswapSwapRouter02.exactInput.selector,
            IUniswapSwapRouter02.ExactInputParams({path: path, recipient: ONE_INCH, amountIn: amount, amountOutMinimum: 0})
        );
    }

    function _aeroCall(bytes memory path, uint256 amount) internal view returns (bytes memory) {
        return abi.encodeWithSelector(
            ISlipstreamRouter.exactInput.selector,
            ISlipstreamRouter.ExactInputParams({path: path, recipient: ONE_INCH, deadline: block.timestamp, amountIn: amount, amountOutMinimum: 0})
        );
    }

    function _run(bytes memory data) internal {
        vm.prank(MANAGER);
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, 1, true);
    }

    function test_usdcToWeth_uniswapV3_throughRole1() public {
        uint256 amount = 1000e6;
        uint256 usdcBefore = IERC20(USDC).balanceOf(SAFE);
        uint256 wethBefore = IERC20(WETH).balanceOf(SAFE);
        uint256 routerWethBefore = IERC20(WETH).balanceOf(ONE_INCH);
        bytes memory data = _swap(USDC, WETH, amount, 0.3e18, UNI_ROUTER02, _uniCall(abi.encodePacked(USDC, uint24(500), WETH), amount), SAFE);
        _run(data);
        uint256 got = IERC20(WETH).balanceOf(SAFE) - wethBefore;
        console2.log("uniswap v3 0.05%: 1000 USDC ->", got, "wei WETH");
        assertEq(usdcBefore - IERC20(USDC).balanceOf(SAFE), amount, "spent exactly the amount");
        assertGt(got, 0.3e18, "got at least the floor");
        assertEq(IERC20(WETH).balanceOf(ONE_INCH), routerWethBefore, "nothing left on the 1inch router");
        assertEq(IERC20(USDC).balanceOf(address(exec)), 0, "executor keeps nothing");
        assertEq(IERC20(WETH).balanceOf(address(exec)), 0, "executor keeps nothing");
    }

    function test_usdcToWeth_aerodromeSlipstream_throughRole1() public {
        uint256 amount = 1000e6;
        uint256 wethBefore = IERC20(WETH).balanceOf(SAFE);
        bytes memory data = _swap(USDC, WETH, amount, 0.3e18, AERO_CL_ROUTER, _aeroCall(abi.encodePacked(USDC, int24(100), WETH), amount), SAFE);
        _run(data);
        uint256 got = IERC20(WETH).balanceOf(SAFE) - wethBefore;
        console2.log("aerodrome CL ts100: 1000 USDC ->", got, "wei WETH");
        assertGt(got, 0.3e18);
    }

    function test_twoHopPath_uniswap() public {
        // USDC -> WETH -> USDC through two 0.05% pools: a multi-hop path the
        // executor runs as one exactInput, ending in a whitelisted token.
        uint256 amount = 1000e6;
        uint256 usdcBefore = IERC20(USDC).balanceOf(SAFE);
        bytes memory path = abi.encodePacked(USDC, uint24(500), WETH, uint24(500), USDC);
        bytes memory data = _swap(USDC, USDC, amount, 990e6, UNI_ROUTER02, _uniCall(path, amount), SAFE);
        _run(data);
        uint256 after_ = IERC20(USDC).balanceOf(SAFE);
        console2.log("uniswap 2-hop round trip: 1000 USDC ->", usdcBefore - after_, "USDC units lost to fees");
        assertLt(usdcBefore - after_, 10e6, "round trip costs less than 1%");
    }

    function test_reportsExactlyWhatArrived() public {
        uint256 amount = 250e6;
        uint256 wethBefore = IERC20(WETH).balanceOf(SAFE);
        bytes memory data = _swap(USDC, WETH, amount, 1, UNI_ROUTER02, _uniCall(abi.encodePacked(USDC, uint24(500), WETH), amount), SAFE);
        vm.prank(MANAGER);
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, 1, true);
        // The router forwards the executor's report; the Safe's growth is the
        // pool's output to the router, no more and no less.
        assertGt(IERC20(WETH).balanceOf(SAFE) - wethBefore, 0.09e18);
    }

    function test_routerEnforcesMinReturn() public {
        uint256 amount = 1000e6;
        bytes memory data = _swap(USDC, WETH, amount, 100e18, UNI_ROUTER02, _uniCall(abi.encodePacked(USDC, uint24(500), WETH), amount), SAFE);
        vm.prank(MANAGER);
        vm.expectRevert();
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, 1, true);
    }

    function test_modifierRefusesProceedsElsewhere() public {
        uint256 amount = 1000e6;
        bytes memory data = _swap(USDC, WETH, amount, 1, UNI_ROUTER02, _uniCall(abi.encodePacked(USDC, uint24(500), WETH), amount), MANAGER);
        vm.prank(MANAGER);
        vm.expectRevert();
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, 1, true);
    }

    function test_modifierRefusesUnlistedToken() public {
        // cbBTC is not one of the whitelisted dstTokens.
        address cbBTC = 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf;
        uint256 amount = 1000e6;
        bytes memory data = _swap(USDC, cbBTC, amount, 1, UNI_ROUTER02, _uniCall(abi.encodePacked(USDC, uint24(500), WETH), amount), SAFE);
        vm.prank(MANAGER);
        vm.expectRevert();
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, 1, true);
    }

    function test_badTargetCannotKeepFunds() public {
        // A target that swallows the call: nothing reaches the router, the
        // executor reports zero, the router reverts, the Safe keeps its USDC.
        uint256 amount = 1000e6;
        uint256 usdcBefore = IERC20(USDC).balanceOf(SAFE);
        bytes memory data = _swap(USDC, WETH, amount, 1, address(this), abi.encodeWithSignature("swallow()"), SAFE);
        vm.prank(MANAGER);
        vm.expectRevert();
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, 1, true);
        assertEq(IERC20(USDC).balanceOf(SAFE), usdcBefore);
    }

    function test_onlyTheRouterMayCall() public {
        vm.expectRevert(RethinkSwapExecutor.NotRouter.selector);
        exec.execute(address(this));
    }

    function swallow() external {}
}
