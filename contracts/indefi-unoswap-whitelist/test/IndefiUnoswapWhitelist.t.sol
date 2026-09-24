// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
}

/// Zodiac Roles v1: the owner-only scoping calls the governance proposal will make.
interface IRolesV1 {
    function owner() external view returns (address);
    function scopeParameter(uint16 role, address target, bytes4 sig, uint256 index, uint8 paramType, uint8 comp, bytes calldata compValue) external;
    function scopeParameterAsOneOf(uint16 role, address target, bytes4 sig, uint256 index, uint8 paramType, bytes[] calldata compValues) external;
    function scopeRevokeFunction(uint16 role, address target, bytes4 sig) external;
    function execTransactionWithRole(address to, uint256 value, bytes calldata data, uint8 operation, uint16 role, bool shouldRevert) external returns (bool);
}

interface IUnoswap {
    function unoswapTo(uint256 to, uint256 token, uint256 amount, uint256 minReturn, uint256 dex) external returns (uint256);
    function unoswapTo2(uint256 to, uint256 token, uint256 amount, uint256 minReturn, uint256 dex, uint256 dex2) external returns (uint256);
    function swap(address executor, bytes calldata desc, bytes calldata data) external payable returns (uint256, uint256);
}

/**
 * The INDEFI whitelist change, rehearsed on a Base fork: the governor (owner
 * of the modifier) scopes unoswapTo / unoswapTo2 for role 1 — receiver pinned
 * to the Safe, sold token one-of the vault's assets, pool one-of a fixed list
 * of canonical Uniswap V3 pools — and revokes swap(). Then the manager trades
 * through the new rules, and every forbidden shape is refused.
 *
 *   BASE_RPC=https://gateway.tenderly.co/public/base forge test -vv
 */
contract IndefiUnoswapWhitelistTest is Test {
    address constant SAFE = 0x6B6d690F540788b87FC63BD975e6B398da775159;
    address constant MANAGER = 0xE257160f654A2E3222a343FafC4a71AE45Be5d99;
    address constant ROLES = 0x89de956576ACc0a141Bef842A489C2C391382B81;
    address constant GOVERNOR = 0x89883158f9d95991232a7520b1763e4b4d08b4EB;
    address constant ONE_INCH = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant AERO = 0x940181a94A35A4569E4529A3CDfB74e38FD98631;
    // Uniswap V3 USDC/WETH pools on Base, by fee tier.
    address constant POOL_1BP = 0xb4CB800910B228ED3d0834cF79D697127BBB00e5;
    address constant POOL_5BP = 0xd0b53D9277642d899DF5C87A3966A349A798F224;
    address constant POOL_30BP = 0x6c561B446416E1A00E8E93E221854d6eA4171372;
    // Uniswap V3 AERO pools on Base: the vault's third asset, sold via WETH or USDC.
    address constant POOL_AERO_WETH_30BP = 0x3d5D143381916280ff91407FeBEB52f2b60f33Cf;
    address constant POOL_AERO_USDC_5BP = 0xE5B5f522E98B5a2baAe212d4dA66b865B781DB97;
    // An Aerodrome Slipstream USDC/WETH pool, deliberately NOT on the list.
    address constant AERO_POOL = 0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59;

    uint16 constant ROLE = 1;
    bytes4 constant SWAP = 0x07ed2379;
    bytes4 UNOSWAP_TO = IUnoswap.unoswapTo.selector;
    bytes4 UNOSWAP_TO2 = IUnoswap.unoswapTo2.selector;
    uint8 constant STATIC = 0;
    uint8 constant EQUAL_TO = 0;

    uint256 constant UNISWAP_V3_PROTOCOL = 1 << 253;
    uint256 constant ZERO_FOR_ONE = 1 << 247;

    function dexWord(address pool, address sell, address buy) internal pure returns (uint256) {
        return UNISWAP_V3_PROTOCOL | (uint160(sell) < uint160(buy) ? ZERO_FOR_ONE : 0) | uint256(uint160(pool));
    }

    function word(address a) internal pure returns (bytes memory) {
        return abi.encode(uint256(uint160(a)));
    }

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_RPC", string("https://gateway.tenderly.co/public/base")));
        assertEq(IRolesV1(ROLES).owner(), GOVERNOR, "the governor owns the modifier");
        applyProposal();
    }

    /// The proposal, call for call, as the governor will execute it.
    function applyProposal() internal {
        bytes[] memory tokens = new bytes[](3);
        tokens[0] = word(USDC);
        tokens[1] = word(WETH);
        tokens[2] = word(AERO);

        bytes[] memory dexWords = new bytes[](10);
        address[3] memory usdcWeth = [POOL_1BP, POOL_5BP, POOL_30BP];
        for (uint256 i = 0; i < 3; i++) {
            dexWords[2 * i] = abi.encode(dexWord(usdcWeth[i], USDC, WETH));
            dexWords[2 * i + 1] = abi.encode(dexWord(usdcWeth[i], WETH, USDC));
        }
        dexWords[6] = abi.encode(dexWord(POOL_AERO_WETH_30BP, AERO, WETH));
        dexWords[7] = abi.encode(dexWord(POOL_AERO_WETH_30BP, WETH, AERO));
        dexWords[8] = abi.encode(dexWord(POOL_AERO_USDC_5BP, AERO, USDC));
        dexWords[9] = abi.encode(dexWord(POOL_AERO_USDC_5BP, USDC, AERO));

        vm.startPrank(GOVERNOR);
        IRolesV1 r = IRolesV1(ROLES);
        // unoswapTo(to, token, amount, minReturn, dex)
        r.scopeParameter(ROLE, ONE_INCH, UNOSWAP_TO, 0, STATIC, EQUAL_TO, word(SAFE));
        r.scopeParameterAsOneOf(ROLE, ONE_INCH, UNOSWAP_TO, 1, STATIC, tokens);
        r.scopeParameterAsOneOf(ROLE, ONE_INCH, UNOSWAP_TO, 4, STATIC, dexWords);
        // unoswapTo2(to, token, amount, minReturn, dex, dex2)
        r.scopeParameter(ROLE, ONE_INCH, UNOSWAP_TO2, 0, STATIC, EQUAL_TO, word(SAFE));
        r.scopeParameterAsOneOf(ROLE, ONE_INCH, UNOSWAP_TO2, 1, STATIC, tokens);
        r.scopeParameterAsOneOf(ROLE, ONE_INCH, UNOSWAP_TO2, 4, STATIC, dexWords);
        r.scopeParameterAsOneOf(ROLE, ONE_INCH, UNOSWAP_TO2, 5, STATIC, dexWords);
        // The free-executor entry point goes.
        r.scopeRevokeFunction(ROLE, ONE_INCH, SWAP);
        vm.stopPrank();
    }

    function _unoswap(address to, address sell, uint256 amount, uint256 minReturn, uint256 dex) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(IUnoswap.unoswapTo.selector, uint256(uint160(to)), uint256(uint160(sell)), amount, minReturn, dex);
    }

    function _run(bytes memory data) internal {
        vm.prank(MANAGER);
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, ROLE, true);
    }

    function test_managerBuysWethThroughListedPool() public {
        uint256 amount = 1000e6;
        uint256 usdcBefore = IERC20(USDC).balanceOf(SAFE);
        uint256 wethBefore = IERC20(WETH).balanceOf(SAFE);
        _run(_unoswap(SAFE, USDC, amount, 0.3e18, dexWord(POOL_5BP, USDC, WETH)));
        uint256 got = IERC20(WETH).balanceOf(SAFE) - wethBefore;
        console2.log("unoswapTo via Uniswap V3 0.05%: 1000 USDC ->", got, "wei WETH");
        assertEq(usdcBefore - IERC20(USDC).balanceOf(SAFE), amount);
        assertGt(got, 0.3e18);
    }

    function test_everyListedPoolAndBothDirections() public {
        address[3] memory pools = [POOL_1BP, POOL_5BP, POOL_30BP];
        for (uint256 i = 0; i < 3; i++) {
            uint256 wethBefore = IERC20(WETH).balanceOf(SAFE);
            _run(_unoswap(SAFE, USDC, 500e6, 1, dexWord(pools[i], USDC, WETH)));
            uint256 got = IERC20(WETH).balanceOf(SAFE) - wethBefore;
            assertGt(got, 0.1e18);
            // and back
            _run(_unoswap(SAFE, WETH, got, 1, dexWord(pools[i], WETH, USDC)));
            console2.log("pool", pools[i], "round trip ok, WETH bought:", got);
        }
    }

    function test_twoHopThroughListedPools() public {
        // USDC -> WETH (0.05%) -> USDC (0.01%): a two-pool path stays inside the list.
        uint256 usdcBefore = IERC20(USDC).balanceOf(SAFE);
        bytes memory data = abi.encodeWithSelector(
            IUnoswap.unoswapTo2.selector,
            uint256(uint160(SAFE)), uint256(uint160(USDC)), uint256(1000e6), uint256(990e6),
            dexWord(POOL_5BP, USDC, WETH), dexWord(POOL_1BP, WETH, USDC)
        );
        _run(data);
        assertLt(usdcBefore - IERC20(USDC).balanceOf(SAFE), 10e6, "round trip costs under 1%");
    }

    function test_aeroLegs() public {
        // 100 USDC -> AERO through the listed AERO/USDC pool, then AERO -> WETH.
        uint256 aeroBefore = IERC20(AERO).balanceOf(SAFE);
        _run(_unoswap(SAFE, USDC, 100e6, 1, dexWord(POOL_AERO_USDC_5BP, USDC, AERO)));
        uint256 aero = IERC20(AERO).balanceOf(SAFE) - aeroBefore;
        console2.log("100 USDC ->", aero, "wei AERO");
        assertGt(aero, 100e18, "at least 100 AERO for 100 USDC at ~$0.66");
        uint256 wethBefore = IERC20(WETH).balanceOf(SAFE);
        _run(_unoswap(SAFE, AERO, aero, 1, dexWord(POOL_AERO_WETH_30BP, AERO, WETH)));
        assertGt(IERC20(WETH).balanceOf(SAFE) - wethBefore, 0.02e18);
    }

    function test_refusesPoolOffTheList() public {
        bytes memory data = _unoswap(SAFE, USDC, 1000e6, 1, dexWord(AERO_POOL, USDC, WETH));
        vm.prank(MANAGER);
        vm.expectRevert(); // ParameterNotOneOfAllowed
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, ROLE, true);
    }

    function test_refusesProceedsElsewhere() public {
        bytes memory data = _unoswap(MANAGER, USDC, 1000e6, 1, dexWord(POOL_5BP, USDC, WETH));
        vm.prank(MANAGER);
        vm.expectRevert(); // ParameterNotAllowed
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, ROLE, true);
    }

    function test_refusesUnlistedSoldToken() public {
        address cbBTC = 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf;
        bytes memory data = _unoswap(SAFE, cbBTC, 1e8, 1, dexWord(POOL_5BP, USDC, WETH));
        vm.prank(MANAGER);
        vm.expectRevert();
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, ROLE, true);
    }

    function test_refusesUnwrapFlagOnAListedPool() public {
        // Same pool, but asking the router to unwrap to ETH: a different word, not on the list.
        uint256 withUnwrap = dexWord(POOL_5BP, USDC, WETH) | (1 << 252);
        bytes memory data = _unoswap(SAFE, USDC, 1000e6, 1, withUnwrap);
        vm.prank(MANAGER);
        vm.expectRevert();
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, ROLE, true);
    }

    function test_swapIsGone() public {
        bytes memory data = abi.encodeWithSelector(SWAP, address(0), "", "");
        vm.prank(MANAGER);
        vm.expectRevert(); // FunctionNotAllowed
        IRolesV1(ROLES).execTransactionWithRole(ONE_INCH, 0, data, 0, ROLE, true);
    }
}
