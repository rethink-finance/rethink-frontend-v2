// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, Vm, console2} from "forge-std/Test.sol";
import {SycDistributor, IRolesModifier, IERC20Like} from "../src/SycDistributor.sol";
import {SniEthReporter, IERC20Balances, IFxRoot} from "../src/SniEthReporter.sol";
import {MockFund} from "./Mocks.sol";

interface IRolesLive {
    function owner() external view returns (address);
    function execTransactionWithRole(address to, uint256 value, bytes calldata data, uint8 operation, bytes32 roleKey, bool shouldRevert)
        external
        returns (bool);
}

interface IFxChildLive {
    function onStateReceive(uint256 stateId, bytes calldata data) external;
}

interface ISni {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

/**
 * Against the live chains (needs network):  forge test --match-contract ForkTest -vv
 *
 * Real on Polygon: the vault's Roles v2 modifier, its Safe, the SNI token, FxChild, and the exact role calls in
 * role/role-calls.json, applied by the modifier's current owner. Real on Ethereum: the sniETH token, FxRoot and
 * the state sender.
 *
 * Not real: the vault contract. It is not finalized and refuses every mint ("only gov"), so its code is replaced
 * with a stand-in that mints the same way (fundFlowsCall → mintToMany, only from the Safe).
 */
contract ForkTest is Test {
    string constant POLYGON = "https://polygon.gateway.tenderly.co";
    string constant ETHEREUM = "https://mainnet.gateway.tenderly.co";

    address constant ROLES = 0x8A984794a920BBd367B3e54362014dE973200aB0;
    address constant FUND = 0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007;
    address constant SAFE = 0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF;
    address constant OLD_SAFE = 0x979AeA92BbfC33BE4F3d4Cf328133d695B88952B;
    address constant SNI = 0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57;
    address constant FX_CHILD = 0x8397259c983751DAf40400790063935a11afa28a;
    address constant ADMIN_SAFE = 0x78E35296B8C0d0e31EF3584504289B4908416dc8;
    address constant EXECUTOR = 0x8C2eb5359041d2d1Eb12866eC2111eC15eD81e8d;
    address constant BOR_SYSTEM = 0x0000000000000000000000000000000000001001;

    address constant SNIETH = 0xaC3D76E29f866702E17f571cccb15937E5A17303;
    address constant FX_ROOT = 0xfe5e5D361b2ad62c541bAb87C45a0B9B018389a2;
    address constant STATE_SENDER = 0x28e4F3a7f651294B9564800b2D01f35189A5bFbE;

    address constant A = 0x1271836313a2B692858F96D88118176E72d9eD74;
    address constant B = 0xC419021546FDfEa5e097Bd48951cF1c8ACF9769B;
    address constant C = 0xecE11276F7297389151dDA0B3Ab5bCfA3FAC2f59;
    address constant FOURTH = 0x41EaCfF5e206f3BA8AfCc2596a6FbE686A652040;

    bytes32 constant ROLE = "SYC-Distributor";
    bytes32 constant ADMIN_ROLE = "adminRole";
    address constant KEY = address(0xB07); // a backend wallet
    uint256 constant WA = 2015999990726584449636;
    uint256 constant WB = 32000000000000000000;
    uint256 constant WC = 49999743137846477;
    uint256 constant SA = 3191921904094374187003036;
    uint256 constant SB = 54661176782748357223958;
    uint256 constant SC = 82348920710355600109;

    uint256 polygon;
    SycDistributor dist;

    function _polygon() internal {
        polygon = vm.createSelectFork(POLYGON);
        // the stand-in vault, at the vault's own address
        MockFund standIn = new MockFund(SAFE);
        vm.etch(FUND, address(standIn).code);
        vm.store(FUND, bytes32(uint256(1)), bytes32(0)); // totalSupply
        vm.store(FUND, bytes32(uint256(2)), bytes32(0)); // no mint fee
        assertEq(IERC20Like(FUND).totalSupply(), 0);

        address[] memory r = new address[](3);
        uint256[] memory w = new uint256[](3);
        uint256[] memory s = new uint256[](3);
        (r[0], r[1], r[2]) = (A, B, C);
        (w[0], w[1], w[2]) = (WA, WB, WC);
        (s[0], s[1], s[2]) = (SA, SB, SC);
        dist = new SycDistributor(SycDistributor.Config(IRolesModifier(ROLES), ROLE, FUND, SAFE, IERC20Like(SNI), FX_CHILD, ADMIN_SAFE, 100 ether, 8 days), r, w, r, s);

        // the exact calls from role/role-calls.json, as the modifier's owner (today the factory). They make the admin
        // multisig the first member; the distributor is added after them, as it would be once it takes over.
        bytes[] memory calls = vm.parseJsonBytesArray(vm.readFile("role/role-calls.json"), "$");
        assertEq(calls.length, 4); // scope the vault, scope the mint, the admin role's members permission, the member
        address modOwner = IRolesLive(ROLES).owner();
        bytes32[] memory keys = new bytes32[](1);
        bool[] memory on = new bool[](1);
        (keys[0], on[0]) = (ROLE, true);
        vm.startPrank(modOwner);
        for (uint256 i; i < calls.length; ++i) {
            (bool ok,) = ROLES.call(calls[i]);
            assertTrue(ok, "role call refused");
        }
        (bool assigned,) = ROLES.call(abi.encodeWithSignature("assignRoles(address,bytes32[],bool[])", address(dist), keys, on));
        assertTrue(assigned);
        vm.stopPrank();
    }

    function _moveOldSafeSni() internal {
        uint256 left = ISni(SNI).balanceOf(OLD_SAFE);
        vm.prank(OLD_SAFE);
        ISni(SNI).transfer(SAFE, left);
    }

    function _incentive(uint256 amount) internal {
        deal(SNI, SAFE, ISni(SNI).balanceOf(SAFE) + amount);
    }

    function test_polygon_seedThenDistribute_throughTheLiveModifierAndSafe() public {
        _polygon();
        uint256 held = ISni(SNI).balanceOf(SAFE);
        console2.log("SNI in the Safe today      ", held / 1e18);
        console2.log("retroactive total          ", (SA + SB + SC) / 1e18);

        // today the Safe is 2,321 SNI short of the retroactive total: the backing rule refuses the seed
        vm.expectRevert(SycDistributor.NotBacked.selector);
        dist.seed();

        _moveOldSafeSni();
        uint256 g = gasleft();
        dist.seed();
        console2.log("gas: seed, 3 wallets       ", g - gasleft());
        assertEq(IERC20Like(FUND).balanceOf(A), SA);
        assertEq(IERC20Like(FUND).balanceOf(B), SB);
        assertEq(IERC20Like(FUND).balanceOf(C), SC);
        assertLe(IERC20Like(FUND).totalSupply(), ISni(SNI).balanceOf(SAFE));

        // the leftover (the 1 SNI test transfer of 2025) is below the smallest distribution: it waits
        vm.expectRevert(SycDistributor.NothingToDistribute.selector);
        dist.distribute();

        // a week's incentive mint, then a week in which SNI is cheap and yield buys 400,000
        _incentive(34_000 ether);
        uint256 beforeB = IERC20Like(FUND).balanceOf(B);
        uint256 waiting = dist.undistributed(); // the 34,000 plus the leftover
        g = gasleft();
        vm.prank(address(0xBEEF)); // anyone
        dist.distribute();
        console2.log("gas: distribute, 3 wallets ", g - gasleft());
        assertApproxEqAbs(IERC20Like(FUND).balanceOf(B) - beforeB, waiting * WB / (WA + WB + WC), 1);
        _incentive(434_000 ether);
        dist.distribute();
        assertLe(IERC20Like(FUND).totalSupply(), ISni(SNI).balanceOf(SAFE));
        assertLt(ISni(SNI).balanceOf(SAFE) - IERC20Like(FUND).totalSupply(), 3);
    }

    function test_polygon_theRoleDoesNothingElse() public {
        _polygon();
        uint256[] memory amounts = new uint256[](1);
        address[] memory to = new address[](1);
        (amounts[0], to[0]) = (1 ether, address(0xBEEF));
        bytes memory mint = abi.encodeWithSignature("fundFlowsCall(bytes)", abi.encodeWithSignature("mintToMany(uint256[],address[])", amounts, to));

        // a stranger and an Executor cannot use the role
        address[2] memory others = [address(0xBEEF), EXECUTOR];
        for (uint256 i; i < others.length; ++i) {
            vm.prank(others[i]);
            vm.expectRevert();
            IRolesLive(ROLES).execTransactionWithRole(FUND, 0, mint, 0, ROLE, true);
        }
        // even the distributor's own address is refused anything but the mint
        bytes[5] memory refused = [
            abi.encodeWithSignature("fundFlowsCall(bytes)", abi.encodeWithSignature("sweepTokens()")),
            abi.encodeWithSignature("fundFlowsCall(bytes)", abi.encodeWithSignature("mintPerformanceFee(uint256)", 1 ether)),
            abi.encodeWithSignature("fundFlowsCall(bytes)", abi.encodeWithSignature("collectFees(uint8)", 0)),
            abi.encodeWithSignature("mintToMany(uint256[],address[])", amounts, to),
            abi.encodeWithSignature("transfer(address,uint256)", address(0xBEEF), 1 ether)
        ];
        for (uint256 i; i < refused.length; ++i) {
            vm.prank(address(dist));
            vm.expectRevert();
            IRolesLive(ROLES).execTransactionWithRole(FUND, 0, refused[i], 0, ROLE, true);
        }
        vm.prank(address(dist));
        vm.expectRevert();
        IRolesLive(ROLES).execTransactionWithRole(SNI, 0, abi.encodeWithSignature("transfer(address,uint256)", address(0xBEEF), 1 ether), 0, ROLE, true);
        vm.prank(address(dist));
        vm.expectRevert(); // delegatecall
        IRolesLive(ROLES).execTransactionWithRole(FUND, 0, mint, 1, ROLE, true);
        // and the mint itself is allowed to it (1 SYC against the SNI already there)
        vm.prank(address(dist));
        assertTrue(IRolesLive(ROLES).execTransactionWithRole(FUND, 0, mint, 0, ROLE, true));
    }

    function _mintCall(uint256[] memory amounts, address[] memory to) internal pure returns (bytes memory) {
        return abi.encodeWithSignature("fundFlowsCall(bytes)", abi.encodeWithSignature("mintToMany(uint256[],address[])", amounts, to));
    }

    function _one(uint256 amount, address to) internal pure returns (bytes memory) {
        uint256[] memory amounts = new uint256[](1);
        address[] memory tos = new address[](1);
        (amounts[0], tos[0]) = (amount, to);
        return _mintCall(amounts, tos);
    }

    function _assign(address member, bytes32 role, bool on) internal pure returns (bytes memory) {
        bytes32[] memory keys = new bytes32[](1);
        bool[] memory flags = new bool[](1);
        (keys[0], flags[0]) = (role, on);
        return abi.encodeWithSignature("assignRoles(address,bytes32[],bool[])", member, keys, flags);
    }

    function _refused(address from, address to, bytes memory data, bytes32 role) internal {
        vm.prank(from);
        vm.expectRevert();
        IRolesLive(ROLES).execTransactionWithRole(to, 0, data, 0, role, true);
    }

    function _allowed(address from, address to, bytes memory data, bytes32 role) internal {
        vm.prank(from);
        assertTrue(IRolesLive(ROLES).execTransactionWithRole(to, 0, data, 0, role, true));
    }

    // Now: the admin multisig is the role's member. The one-off mint, then a week's, through the live modifier.
    function test_polygon_theMultisigMintsThroughTheRole() public {
        _polygon();
        _moveOldSafeSni();
        address[] memory to = new address[](3);
        uint256[] memory amounts = new uint256[](3);
        (to[0], to[1], to[2]) = (A, B, C);
        (amounts[0], amounts[1], amounts[2]) = (SA, SB, SC);
        uint256 g = gasleft();
        _allowed(ADMIN_SAFE, FUND, _mintCall(amounts, to), ROLE);
        console2.log("gas: one-off mint by the multisig", g - gasleft());
        assertEq(IERC20Like(FUND).balanceOf(A), SA);
        assertEq(IERC20Like(FUND).balanceOf(B), SB);
        assertEq(IERC20Like(FUND).balanceOf(C), SC);
        assertEq(IERC20Like(FUND).totalSupply(), SA + SB + SC);
        assertLe(IERC20Like(FUND).totalSupply(), ISni(SNI).balanceOf(SAFE));

        _incentive(34_000 ether);
        uint256 all = WA + WB + WC;
        (amounts[0], amounts[1], amounts[2]) = (34_000 ether * WA / all, 34_000 ether * WB / all, 34_000 ether * WC / all);
        _allowed(ADMIN_SAFE, FUND, _mintCall(amounts, to), ROLE);
        assertLe(IERC20Like(FUND).totalSupply(), ISni(SNI).balanceOf(SAFE));

        // only through this role: the multisig's other role cannot mint, and neither can an Executor's
        _refused(ADMIN_SAFE, FUND, _one(1 ether, A), ADMIN_ROLE);
        _refused(EXECUTOR, FUND, _one(1 ether, A), bytes32("defaultManagerRole"));
        // and through this role the multisig can do nothing but mint
        _refused(ADMIN_SAFE, FUND, abi.encodeWithSignature("fundFlowsCall(bytes)", abi.encodeWithSignature("sweepTokens()")), ROLE);
        _refused(ADMIN_SAFE, FUND, abi.encodeWithSignature("fundFlowsCall(bytes)", abi.encodeWithSignature("collectFees(uint8)", 0)), ROLE);
        _refused(ADMIN_SAFE, FUND, abi.encodeWithSignature("mintToMany(uint256[],address[])", amounts, to), ROLE);
        _refused(ADMIN_SAFE, SNI, abi.encodeWithSignature("transfer(address,uint256)", ADMIN_SAFE, 1 ether), ROLE);
        vm.prank(ADMIN_SAFE);
        vm.expectRevert(); // delegatecall
        IRolesLive(ROLES).execTransactionWithRole(FUND, 0, _one(1 ether, A), 1, ROLE, true);
    }

    // Known, by design: this role has no amount limit and no backing check. Whoever holds it can mint any amount
    // to anyone. Its member is the multisig; a single key given this role would have the same power.
    function test_known_theUnlimitedRoleReallyIsUnlimited() public {
        _polygon();
        _allowed(ADMIN_SAFE, FUND, _one(1_000_000_000 ether, ADMIN_SAFE), ROLE);
        assertGt(IERC20Like(FUND).totalSupply(), ISni(SNI).balanceOf(SAFE));
    }

    // After the handover the admin role swaps members, and that is all it can do to the role.
    function test_adminRole_swapsMembers_andCannotChangeWhatTheRoleAllows() public {
        _polygon();
        // The admin role acts through the Safe, and assignRoles is the modifier owner's call: this is the state
        // after a governance vote has handed the modifier to the Safe.
        vm.prank(IRolesLive(ROLES).owner());
        (bool moved,) = ROLES.call(abi.encodeWithSignature("transferOwnership(address)", SAFE));
        assertTrue(moved);

        // another wallet in (a backend key, say)
        _allowed(ADMIN_SAFE, ROLES, _assign(KEY, ROLE, true), ADMIN_ROLE);
        _allowed(KEY, FUND, _one(1_000 ether, A), ROLE);
        // the multisig out
        _allowed(ADMIN_SAFE, ROLES, _assign(ADMIN_SAFE, ROLE, false), ADMIN_ROLE);
        _refused(ADMIN_SAFE, FUND, _one(1 ether, A), ROLE);
        // the contracts in, the key out
        _allowed(ADMIN_SAFE, ROLES, _assign(address(dist), ROLE, true), ADMIN_ROLE);
        _allowed(ADMIN_SAFE, ROLES, _assign(KEY, ROLE, false), ADMIN_ROLE);
        _refused(KEY, FUND, _one(1 ether, A), ROLE);
        // and the multisig back in
        _allowed(ADMIN_SAFE, ROLES, _assign(ADMIN_SAFE, ROLE, true), ADMIN_ROLE);
        _allowed(ADMIN_SAFE, FUND, _one(1 ether, A), ROLE);

        // nobody else can use the admin role
        _refused(EXECUTOR, ROLES, _assign(EXECUTOR, ROLE, true), ADMIN_ROLE);
        _refused(KEY, ROLES, _assign(KEY, ROLE, true), ADMIN_ROLE);
        // a role it does not manage, or two roles in one call
        _refused(ADMIN_SAFE, ROLES, _assign(ADMIN_SAFE, bytes32("SomeOtherRole"), true), ADMIN_ROLE);
        bytes32[] memory two = new bytes32[](2);
        bool[] memory both = new bool[](2);
        (two[0], two[1]) = (ROLE, bytes32("SomeOtherRole"));
        (both[0], both[1]) = (true, true);
        _refused(ADMIN_SAFE, ROLES, abi.encodeWithSignature("assignRoles(address,bytes32[],bool[])", ADMIN_SAFE, two, both), ADMIN_ROLE);

        // what the role allows is out of its reach: no scoping, no allowance, no new owner, no module
        bytes[7] memory permissionCalls = [
            abi.encodeWithSignature("allowTarget(bytes32,address,uint8)", ROLE, FUND, 0),
            abi.encodeWithSignature("scopeTarget(bytes32,address)", ROLE, SNI),
            abi.encodeWithSignature("allowFunction(bytes32,address,bytes4,uint8)", ROLE, FUND, bytes4(0x12345678), 0),
            abi.encodeWithSignature("revokeTarget(bytes32,address)", ROLE, FUND),
            abi.encodeWithSignature("setAllowance(bytes32,uint128,uint128,uint128,uint64,uint64)", bytes32("anyAllowance"), type(uint128).max, 0, 0, 0, 0),
            abi.encodeWithSignature("transferOwnership(address)", ADMIN_SAFE),
            abi.encodeWithSignature("enableModule(address)", ADMIN_SAFE)
        ];
        for (uint256 i; i < permissionCalls.length; ++i) {
            _refused(ADMIN_SAFE, ROLES, permissionCalls[i], ADMIN_ROLE);
        }

        // what the admin role could do before still works: add an Executor
        _allowed(ADMIN_SAFE, ROLES, _assign(address(0xE0E0), bytes32("defaultManagerRole"), true), ADMIN_ROLE);
    }

    function test_untilTheHandover_theAdminMultisigCannotSwapMembers() public {
        _polygon();
        // Finalizing hands the modifier to the governor. Until a governance vote passes it on to the Safe, the
        // admin role's assignRoles permission (the Safe calling the modifier) fails for every role: members stay
        // as they were stored, and only a vote changes them.
        address modOwner = IRolesLive(ROLES).owner();
        vm.prank(modOwner);
        (bool moved,) = ROLES.call(abi.encodeWithSignature("transferOwnership(address)", address(0x60F)));
        assertTrue(moved);
        bytes32[] memory keys = new bytes32[](1);
        bool[] memory off = new bool[](1);
        keys[0] = ROLE;
        vm.prank(ADMIN_SAFE);
        vm.expectRevert();
        IRolesLive(ROLES).execTransactionWithRole(
            ROLES, 0, abi.encodeWithSignature("assignRoles(address,bytes32[],bool[])", address(dist), keys, off), 0, bytes32("adminRole"), true
        );
        _refused(ADMIN_SAFE, ROLES, _assign(KEY, ROLE, true), ADMIN_ROLE);
        _allowed(ADMIN_SAFE, FUND, _one(1 ether, A), ROLE); // the multisig, a member from the start, still mints
        vm.store(FUND, bytes32(uint256(1)), bytes32(0)); // (undo that mint for what follows)
        vm.store(FUND, keccak256(abi.encode(A, uint256(0))), bytes32(0));
        // and a contract that was given the role keeps working
        _moveOldSafeSni();
        dist.seed();
        _incentive(34_000 ether);
        dist.distribute();
        // the modifier's owner (the governor, by a vote) can take the role away
        vm.prank(address(0x60F));
        (bool removed,) = ROLES.call(abi.encodeWithSignature("assignRoles(address,bytes32[],bool[])", address(dist), keys, off));
        assertTrue(removed);
        _incentive(34_000 ether);
        vm.expectRevert();
        dist.distribute();
    }

    function test_polygon_aBatchOfTwentyFiveThroughTheLiveModifierAndSafe() public {
        polygon = vm.createSelectFork(POLYGON);
        MockFund standIn = new MockFund(SAFE);
        vm.etch(FUND, address(standIn).code);
        vm.store(FUND, bytes32(uint256(1)), bytes32(0));
        vm.store(FUND, bytes32(uint256(2)), bytes32(0));
        address[] memory r = new address[](30);
        uint256[] memory w = new uint256[](30);
        for (uint256 i; i < 30; ++i) {
            r[i] = address(uint160(0xA000 + i));
            w[i] = 1 ether;
        }
        SycDistributor d = new SycDistributor(
            SycDistributor.Config(IRolesModifier(ROLES), ROLE, FUND, SAFE, IERC20Like(SNI), FX_CHILD, ADMIN_SAFE, 100 ether, 8 days),
            r,
            w,
            new address[](0),
            new uint256[](0)
        );
        bytes[] memory calls = vm.parseJsonBytesArray(vm.readFile("role/role-calls.json"), "$");
        bytes32[] memory keys = new bytes32[](1);
        bool[] memory on = new bool[](1);
        (keys[0], on[0]) = (ROLE, true);
        vm.startPrank(IRolesLive(ROLES).owner());
        for (uint256 i; i < calls.length; ++i) {
            (bool ok,) = ROLES.call(calls[i]);
            assertTrue(ok);
        }
        (bool assigned,) = ROLES.call(abi.encodeWithSignature("assignRoles(address,bytes32[],bool[])", address(d), keys, on));
        assertTrue(assigned);
        vm.stopPrank();

        uint256 g = gasleft();
        d.distribute(); // SNI already in the Safe, no SYC yet: everything is waiting
        uint256 used = g - gasleft();
        console2.log("gas: batch of 25, live path", used);
        assertEq(d.roundNext(), 25);
        assertLt(used, 2_500_000); // half of a keeper's 5M budget, against the stand-in vault
        d.distribute();
        assertEq(d.roundAmount(), 0);
        assertEq(IERC20Like(FUND).balanceOf(r[29]), IERC20Like(FUND).balanceOf(r[0]));
        assertLe(IERC20Like(FUND).totalSupply(), ISni(SNI).balanceOf(SAFE));
    }

    function test_bothChains_reportFromEthereumReachesTheDistributor() public {
        _polygon();
        _moveOldSafeSni();
        dist.seed();

        // ---- Ethereum: the reporter reads the live sniETH token and sends through the live FxRoot
        vm.createSelectFork(ETHEREUM);
        SniEthReporter reporter = new SniEthReporter(IERC20Balances(SNIETH), IFxRoot(FX_ROOT), address(dist), 0.01 ether);
        address[] memory holders = new address[](4);
        (holders[0], holders[1], holders[2], holders[3]) = (A, FOURTH, B, C);

        address[] memory three = new address[](3);
        (three[0], three[1], three[2]) = (A, B, C);
        vm.expectRevert(); // one holder left out: the balances do not add up to the supply
        reporter.report(three);

        // The fourth holder is a contract on Ethereum. It is counted in the sum, and not paid on Polygon.
        (address[] memory previewTo,) = reporter.preview(holders);
        assertEq(previewTo.length, 3, "a contract holder was sent to Polygon");

        vm.recordLogs();
        uint256 g = gasleft();
        reporter.report(holders);
        console2.log("gas: report, 4 holders     ", g - gasleft());
        bytes memory synced = _stateSyncedData();
        assertGt(synced.length, 0, "no state sync was sent");
        (address rootSender, address receiver, bytes memory message) = abi.decode(synced, (address, address, bytes));
        assertEq(rootSender, address(reporter));
        assertEq(receiver, address(dist));
        (uint256 reportBlock, address[] memory to, uint256[] memory amounts) = abi.decode(message, (uint256, address[], uint256[]));
        assertEq(to.length, 3);
        assertEq(to[0], A);
        assertEq(amounts[0], IERC20Balances(SNIETH).balanceOf(A)); // today's balance on Ethereum, far above the deployed weight

        // ---- Polygon: delivered by the live FxChild exactly as a state sync is
        vm.selectFork(polygon);
        vm.prank(ADMIN_SAFE);
        dist.setReporter(address(reporter));
        _incentive(34_000 ether); // arrived before the report
        vm.prank(BOR_SYSTEM);
        g = gasleft();
        IFxChildLive(FX_CHILD).onStateReceive(999_999_999, synced);
        console2.log("gas: bridge delivery       ", g - gasleft());
        assertEq(dist.lastReportBlock(), reportBlock);
        assertTrue(dist.pendingReport() != bytes32(0));

        // the next run applies it, with nobody handing the data over: what had arrived goes out by the old weights
        uint256 bBefore = IERC20Like(FUND).balanceOf(B);
        uint256 waiting = dist.undistributed();
        (bool needed,) = dist.checkUpkeep("");
        assertTrue(needed);
        g = gasleft();
        dist.performUpkeep("");
        console2.log("gas: apply + distribute    ", g - gasleft());
        assertEq(dist.pendingReport(), bytes32(0));
        assertApproxEqAbs(IERC20Like(FUND).balanceOf(B) - bBefore, waiting * WB / (WA + WB + WC), 1);
        assertEq(dist.totalWeight(), amounts[0] + amounts[1] + amounts[2]);

        // what arrives afterwards goes by the reported balances
        bBefore = IERC20Like(FUND).balanceOf(B);
        _incentive(10_000 ether);
        waiting = dist.undistributed();
        dist.distribute();
        assertApproxEqAbs(IERC20Like(FUND).balanceOf(B) - bBefore, waiting * amounts[1] / dist.totalWeight(), 1);
        assertLe(IERC20Like(FUND).totalSupply(), ISni(SNI).balanceOf(SAFE));

        // resending the same report from Ethereum changes nothing here
        vm.prank(BOR_SYSTEM);
        IFxChildLive(FX_CHILD).onStateReceive(1_000_000_000, abi.encode(rootSender, receiver, abi.encode(reportBlock + 1, to, amounts)));
        assertEq(dist.pendingReport(), bytes32(0));
    }

    function _stateSyncedData() internal returns (bytes memory synced) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == STATE_SENDER && logs[i].topics[0] == keccak256("StateSynced(uint256,address,bytes)")) {
                assertEq(address(uint160(uint256(logs[i].topics[2]))), FX_CHILD);
                synced = abi.decode(logs[i].data, (bytes));
            }
        }
    }
}
