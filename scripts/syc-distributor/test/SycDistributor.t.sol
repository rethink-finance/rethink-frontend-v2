// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SycDistributor, IRolesModifier, IERC20Like} from "../src/SycDistributor.sol";
import {SniEthReporter, IERC20Balances, IFxRoot} from "../src/SniEthReporter.sol";
import {MockToken, MockFund, MockSafe, MockRoles, MockFx} from "./Mocks.sol";

contract SycDistributorTest is Test {
    bytes32 constant ROLE = "SYC-Distributor";
    address constant A = address(0x1271);
    address constant B = address(0xC419);
    address constant C = address(0xECE1);
    address constant OWNER = address(0x78E3);
    address constant STRANGER = address(0xBAD);
    /// @dev Smallest distribution the contract makes.
    uint256 constant MIN = 100 ether;

    MockToken sni;
    MockToken sniEth;
    MockSafe safe;
    MockRoles roles;
    MockFund fund;
    MockFx fx;
    SycDistributor dist;
    SniEthReporter reporter;

    // sniETH balances as they stand (wei), and the retroactive amounts of 16 Nov 2026.
    uint256 constant WA = 2015999990726584449636;
    uint256 constant WB = 32000000000000000000;
    uint256 constant WC = 49999743137846477;
    uint256 constant SA = 3191921904094374187003036;
    uint256 constant SB = 54661176782748357223958;
    uint256 constant SC = 82348920710355600109;
    uint256 constant SEED_TOTAL = SA + SB + SC;

    function setUp() public {
        sni = new MockToken();
        sniEth = new MockToken();
        safe = new MockSafe();
        roles = new MockRoles(safe);
        safe.setRoles(address(roles));
        fund = new MockFund(address(safe));
        fx = new MockFx();
        dist = _deploy(_arr(A, B, C), _arr(WA, WB, WC), _arr(A, B, C), _arr(SA, SB, SC));
        roles.assign(address(dist), ROLE, true);
        reporter = new SniEthReporter(IERC20Balances(address(sniEth)), IFxRoot(address(fx)), address(dist), 0);
        sniEth.mint(A, WA);
        sniEth.mint(B, WB);
        sniEth.mint(C, WC);
    }

    function _deploy(address[] memory r, uint256[] memory w, address[] memory sr, uint256[] memory sa)
        internal
        returns (SycDistributor)
    {
        return new SycDistributor(
            SycDistributor.Config(IRolesModifier(address(roles)), ROLE, address(fund), address(safe), IERC20Like(address(sni)), address(fx), OWNER, MIN, 8 days),
            r,
            w,
            sr,
            sa
        );
    }

    function _arr(address a, address b, address c) internal pure returns (address[] memory r) {
        r = new address[](3);
        (r[0], r[1], r[2]) = (a, b, c);
    }

    function _arr(uint256 a, uint256 b, uint256 c) internal pure returns (uint256[] memory r) {
        r = new uint256[](3);
        (r[0], r[1], r[2]) = (a, b, c);
    }

    function _seeded() internal {
        sni.mint(address(safe), SEED_TOTAL);
        dist.seed();
    }

    // ------------------------------------------------------------------ seed

    function test_seed_mintsTheFixedAmountsOnce() public {
        sni.mint(address(safe), SEED_TOTAL);
        vm.prank(STRANGER); // anyone
        dist.seed();
        assertEq(fund.balanceOf(A), SA);
        assertEq(fund.balanceOf(B), SB);
        assertEq(fund.balanceOf(C), SC);
        assertEq(fund.totalSupply(), SEED_TOTAL);
        assertEq(dist.undistributed(), 0);
        vm.expectRevert(SycDistributor.AlreadySeeded.selector);
        dist.seed();
    }

    function test_seed_needsTheSniToBeInTheSafe() public {
        sni.mint(address(safe), SEED_TOTAL - 1);
        vm.expectRevert(SycDistributor.NotBacked.selector);
        dist.seed();
        sni.mint(address(safe), 1);
        dist.seed();
        assertEq(fund.totalSupply(), sni.balanceOf(address(safe)));
    }

    function test_distribute_waitsForTheSeed() public {
        sni.mint(address(safe), SEED_TOTAL);
        vm.expectRevert(SycDistributor.NotSeeded.selector);
        dist.distribute();
    }

    function test_noSeedPlan_startsSeeded() public {
        SycDistributor d = _deploy(_arr(A, B, C), _arr(WA, WB, WC), new address[](0), new uint256[](0));
        roles.assign(address(d), ROLE, true);
        assertTrue(d.seeded());
        sni.mint(address(safe), 1000 ether);
        d.distribute();
        assertApproxEqAbs(fund.totalSupply(), 1000 ether, 3);
    }

    // ------------------------------------------------------------ distribute

    function test_distribute_splitsNewSniByWeight() public {
        _seeded();
        sni.mint(address(safe), 34_000 ether);
        (address[] memory to, uint256[] memory amounts) = dist.preview();
        assertEq(to.length, 3);
        vm.prank(STRANGER);
        uint256 total = dist.distribute();
        uint256 w = WA + WB + WC;
        assertEq(fund.balanceOf(A) - SA, 34_000 ether * WA / w);
        assertEq(fund.balanceOf(B) - SB, 34_000 ether * WB / w);
        assertEq(fund.balanceOf(C) - SC, 34_000 ether * WC / w);
        assertEq(amounts[0], fund.balanceOf(A) - SA);
        assertEq(total, fund.totalSupply() - SEED_TOTAL);
        // rounding leaves at most a wei per recipient, never the other way
        assertLe(fund.totalSupply(), sni.balanceOf(address(safe)));
        assertLt(sni.balanceOf(address(safe)) - fund.totalSupply(), 3);
    }

    function test_distribute_nothingNew() public {
        _seeded();
        vm.expectRevert(SycDistributor.NothingToDistribute.selector);
        dist.distribute();
    }

    function test_distribute_neverBlocksOnSize() public {
        _seeded();
        // SNI collapses and a little yield buys fifty times the usual amount
        sni.mint(address(safe), 2_000_000 ether);
        dist.distribute();
        assertLt(sni.balanceOf(address(safe)) - fund.totalSupply(), 3);
    }

    function testFuzz_distribute_isAlwaysBackedAndComplete(uint256 inflow, uint256 again) public {
        _seeded();
        inflow = bound(inflow, 2 * MIN, 1e30);
        again = bound(again, 2 * MIN, 1e30);
        sni.mint(address(safe), inflow);
        dist.distribute();
        assertLe(fund.totalSupply(), sni.balanceOf(address(safe)));
        assertLt(sni.balanceOf(address(safe)) - fund.totalSupply(), 3);
        sni.mint(address(safe), again);
        dist.distribute();
        assertLe(fund.totalSupply(), sni.balanceOf(address(safe)));
        assertLt(sni.balanceOf(address(safe)) - fund.totalSupply(), 3);
    }

    function test_distribute_afterSniLeftTheSafe_onlyTheExcessIsMinted() public {
        _seeded();
        sni.burn(address(safe), 10_000 ether); // an executor swapped SNI away
        assertEq(dist.undistributed(), 0);
        sni.mint(address(safe), 4_000 ether);
        vm.expectRevert(SycDistributor.NothingToDistribute.selector);
        dist.distribute();
        sni.mint(address(safe), 7_000 ether); // now 1,000 above supply
        dist.distribute();
        assertApproxEqAbs(fund.totalSupply(), SEED_TOTAL + 1_000 ether, 3);
    }

    function test_distribute_ignoresDepositsThatBringTheirOwnSni() public {
        _seeded();
        // an outside depositor: SNI in, SYC out, one for one
        sni.mint(address(safe), 500 ether);
        fund.mint(STRANGER, 500 ether);
        assertEq(dist.undistributed(), 0);
    }

    function test_distribute_refusesAMintFee() public {
        _seeded();
        fund.setFee(100);
        sni.mint(address(safe), 34_000 ether);
        vm.expectRevert(SycDistributor.MintMismatch.selector);
        dist.distribute();
    }

    // A vault that mints extra on top (to a fee wallet, say): every depositor gets its full amount and there is
    // SNI to spare, so only the count of what was minted gives it away.
    function test_distribute_refusesAVaultThatMintsMoreThanAsked() public {
        _seeded();
        fund.setExtra(100);
        sni.mint(address(safe), 34_000 ether);
        vm.expectRevert(SycDistributor.MintMismatch.selector);
        dist.distribute();
        fund.setExtra(0);
        dist.distribute();
    }

    function test_thereIsNoPause_theOwnerHasNoWayToStopOrSteerMints() public {
        _seeded();
        vm.prank(OWNER);
        (bool ok,) = address(dist).call(abi.encodeWithSignature("setPaused(bool)", true));
        assertFalse(ok);
        sni.mint(address(safe), 34_000 ether);
        dist.distribute(); // still runs
    }

    function test_removingTheRoleStopsEverything() public {
        _seeded();
        roles.assign(address(dist), ROLE, false);
        sni.mint(address(safe), 34_000 ether);
        vm.expectRevert(MockRoles.NoMembership.selector);
        dist.distribute();
    }

    // ------------------------------------------------------- keeper and log

    function test_keeper_actsOnlyWhenThereIsSomethingAboveItsMinimum() public {
        (bool needed,) = dist.checkUpkeep("");
        assertFalse(needed); // not seeded
        _seeded();
        (needed,) = dist.checkUpkeep("");
        assertFalse(needed); // nothing new

        sni.mint(address(safe), 500 ether);
        (needed,) = dist.checkUpkeep("");
        assertTrue(needed);
        (needed,) = dist.checkUpkeep(abi.encode(uint256(1_000 ether)));
        assertFalse(needed); // below the keeper's minimum
        (needed,) = dist.checkUpkeep(abi.encode(uint256(400 ether)));
        assertTrue(needed);

        vm.prank(STRANGER); // the keeper is nobody special
        dist.performUpkeep("");
        assertApproxEqAbs(fund.totalSupply(), SEED_TOTAL + 500 ether, 3);
        (needed,) = dist.checkUpkeep("");
        assertFalse(needed);
        vm.expectRevert(SycDistributor.NothingToDistribute.selector);
        dist.performUpkeep("");
    }

    function test_keeper_waitsForAReportTooLargeToStore_thenAnyoneAppliesIt() public {
        _seeded();
        vm.prank(OWNER);
        dist.setReporter(address(reporter));
        // 40 more holders: over AUTO_APPLY_MAX, so only the hash is kept
        address[] memory h = new address[](43);
        for (uint256 i; i < 40; ++i) {
            h[i] = address(uint160(0x100 + i));
            sniEth.mint(h[i], 1 ether);
        }
        (h[40], h[41], h[42]) = (A, B, C);
        sni.mint(address(safe), 500 ether);
        vm.roll(10);
        reporter.report(h);
        fx.deliver();
        assertTrue(dist.pendingReport() != bytes32(0));
        (uint256 blk, address[] memory to, uint256[] memory amounts) = abi.decode(fx.lastData(), (uint256, address[], uint256[]));

        // the 500 that was waiting when the report arrived is owed by the old weights: the keeper sends it first
        (bool needed,) = dist.checkUpkeep("");
        assertTrue(needed);
        vm.expectRevert(SycDistributor.RoundInProgress.selector);
        dist.applyReport(blk, to, amounts);
        dist.performUpkeep("");
        assertApproxEqAbs(fund.totalSupply(), SEED_TOTAL + 500 ether, 3);

        // then it waits: the report itself needs its data
        (needed,) = dist.checkUpkeep("");
        assertFalse(needed);
        vm.expectRevert(SycDistributor.ReportPending.selector);
        dist.performUpkeep("");
        vm.prank(STRANGER);
        dist.applyReport(blk, to, amounts);
        assertEq(dist.pendingReport(), bytes32(0));
        assertEq(fund.balanceOf(h[0]), 0); // the 500 went out by the old weights
        assertEq(dist.recipients().length, 43);
    }

    function test_mintLog_recordsEveryMintInOrder() public {
        assertEq(dist.mintCount(), 0);
        vm.warp(1_000_000);
        vm.roll(50);
        _seeded();
        vm.warp(1_600_000);
        vm.roll(60);
        sni.mint(address(safe), 34_000 ether);
        dist.distribute();
        vm.warp(2_200_000);
        vm.roll(70);
        sni.mint(address(safe), 40_000 ether);
        dist.performUpkeep("");

        assertEq(dist.mintCount(), 3);
        SycDistributor.MintRecord[] memory all = dist.mints(0, 10);
        assertEq(all.length, 3);
        assertEq(all[0].total, SEED_TOTAL);
        assertEq(all[0].time, 1_000_000);
        assertEq(all[0].blockNumber, 50);
        assertApproxEqAbs(all[1].total, 34_000 ether, 3);
        assertEq(all[1].blockNumber, 60);
        assertEq(all[2].time, 2_200_000);
        // paging
        assertEq(dist.mints(1, 1).length, 1);
        assertEq(dist.mints(1, 1)[0].blockNumber, 60);
        assertEq(dist.mints(3, 5).length, 0);
        // the log adds up to the supply
        assertEq(uint256(all[0].total) + all[1].total + all[2].total, fund.totalSupply());
    }

    // --------------------------------------------------------------- weights

    function test_weights_cannotBeSetByHand() public {
        // there is no such function: not for the owner, not for anyone
        vm.prank(OWNER);
        (bool ok,) = address(dist).call(abi.encodeWithSignature("setWeights(address[],uint256[])", _arr(STRANGER, B, C), _arr(1, 1, 1)));
        assertFalse(ok);
        assertEq(dist.recipients()[0], A);
    }

    function test_weights_badListsAreRefusedAtDeployment() public {
        address[] memory none = new address[](0);
        uint256[] memory noAmounts = new uint256[](0);
        address[] memory r = new address[](2);
        uint256[] memory w = new uint256[](2);
        (r[0], r[1]) = (A, address(0));
        (w[0], w[1]) = (1, 1);
        vm.expectRevert(SycDistributor.BadWeights.selector);
        _deploy(r, w, none, noAmounts);
        (r[1], w[1]) = (B, 0);
        vm.expectRevert(SycDistributor.BadWeights.selector);
        _deploy(r, w, none, noAmounts);
        vm.expectRevert(SycDistributor.BadWeights.selector);
        _deploy(none, noAmounts, none, noAmounts);
        // one more than the limit, every entry otherwise fine; exactly the limit is accepted
        address[] memory many = new address[](101);
        uint256[] memory manyW = new uint256[](101);
        for (uint256 i; i < 101; ++i) {
            (many[i], manyW[i]) = (address(uint160(0x7000 + i)), 1);
        }
        vm.expectRevert(SycDistributor.BadWeights.selector);
        _deploy(many, manyW, none, noAmounts);
        assembly {
            mstore(many, 100)
            mstore(manyW, 100)
        }
        assertEq(_deploy(many, manyW, none, noAmounts).recipients().length, 100);
        // a wallet twice
        (r[0], r[1]) = (A, A);
        (w[0], w[1]) = (1, 1);
        vm.expectRevert(SycDistributor.BadWeights.selector);
        _deploy(r, w, none, noAmounts);
        // a weight too large to multiply safely
        (r[0], r[1]) = (A, B);
        (w[0], w[1]) = (uint256(type(uint128).max) + 1, 1);
        vm.expectRevert(SycDistributor.BadWeights.selector);
        _deploy(r, w, none, noAmounts);
        // the same rules for the first issuance
        (w[0], w[1]) = (1, 1);
        address[] memory twice = new address[](2);
        (twice[0], twice[1]) = (A, A);
        vm.expectRevert(SycDistributor.BadWeights.selector);
        _deploy(r, w, twice, w);
    }

    // ---------------------------------------------------- report from Ethereum

    function _holders() internal pure returns (address[] memory h) {
        h = new address[](3);
        (h[0], h[1], h[2]) = (A, B, C); // ascending: 0x1271 < 0xC419 < 0xECE1
    }

    function test_report_endToEnd_newDepositorSharesOnlyInWhatArrivesAfter() public {
        _seeded();
        vm.prank(OWNER);
        dist.setReporter(address(reporter));

        // a new depositor joins on Ethereum with as much as everyone else together
        address D = address(0xD00D);
        sniEth.mint(D, WA + WB + WC);
        sni.mint(address(safe), 34_000 ether); // arrived before the report is applied

        address[] memory h = new address[](4);
        (h[0], h[1], h[2], h[3]) = (A, B, D, C); // 0x1271 < 0xC419 < 0xD00D < 0xECE1
        vm.roll(1000);
        reporter.report(h);
        fx.deliver();
        assertTrue(dist.pendingReport() != bytes32(0));
        assertEq(dist.lastReportBlock(), 1000);
        assertEq(dist.recipients().length, 3); // not in force until the next run

        // the next run, by anyone, applies it: what had arrived goes out by the old weights
        vm.prank(STRANGER);
        dist.distribute();
        assertEq(dist.pendingReport(), bytes32(0));
        assertEq(dist.recipients().length, 4);
        assertEq(fund.balanceOf(D), 0);
        assertApproxEqAbs(fund.totalSupply(), SEED_TOTAL + 34_000 ether, 3);

        sni.mint(address(safe), 10_000 ether);
        dist.distribute();
        assertApproxEqAbs(fund.balanceOf(D), 5_000 ether, 3);
    }

    function test_report_unchangedWeightsAreDropped() public {
        _seeded();
        vm.prank(OWNER);
        dist.setReporter(address(reporter));
        vm.roll(20);
        reporter.report(_holders());
        fx.deliver();
        assertEq(dist.pendingReport(), bytes32(0));
        assertEq(dist.lastReportBlock(), 20);
    }

    function test_report_onlyThroughTheBridgeAndFromTheReporter() public {
        vm.prank(OWNER);
        dist.setReporter(address(reporter));
        bytes memory data = abi.encode(uint256(5), _holders(), _arr(1, 1, 1));

        vm.prank(STRANGER);
        vm.expectRevert(SycDistributor.NotFxChild.selector);
        dist.processMessageFromRoot(1, address(reporter), data);

        vm.prank(address(fx));
        vm.expectRevert(SycDistributor.NotReporter.selector);
        dist.processMessageFromRoot(1, STRANGER, data);

        vm.prank(address(fx));
        dist.processMessageFromRoot(1, address(reporter), data);
        // an older or repeated report is ignored
        vm.prank(address(fx));
        vm.expectRevert(SycDistributor.StaleReport.selector);
        dist.processMessageFromRoot(2, address(reporter), data);
    }

    function test_report_ignoredUntilAReporterIsSet() public {
        bytes memory data = abi.encode(uint256(5), _holders(), _arr(1, 1, 1));
        vm.prank(address(fx));
        vm.expectRevert(SycDistributor.NotReporter.selector);
        dist.processMessageFromRoot(1, address(0), data);
    }

    function test_setReporter_onlyOnce_neverReplacedOrCleared() public {
        vm.prank(STRANGER);
        vm.expectRevert(SycDistributor.NotOwner.selector);
        dist.setReporter(STRANGER);
        vm.startPrank(OWNER);
        vm.expectRevert(SycDistributor.ZeroAddress.selector);
        dist.setReporter(address(0));
        dist.setReporter(address(reporter));
        vm.expectRevert(SycDistributor.ReporterAlreadySet.selector);
        dist.setReporter(STRANGER);
        vm.expectRevert(SycDistributor.ReporterAlreadySet.selector);
        dist.setReporter(address(0));
        vm.stopPrank();
        assertEq(dist.reporter(), address(reporter));
    }

    function test_ownership() public {
        vm.prank(STRANGER);
        vm.expectRevert(SycDistributor.NotOwner.selector);
        dist.transferOwnership(STRANGER);
        vm.prank(OWNER);
        vm.expectRevert(SycDistributor.ZeroAddress.selector);
        dist.transferOwnership(address(0));
        vm.prank(OWNER);
        dist.transferOwnership(STRANGER);
        assertEq(dist.owner(), STRANGER);
    }

    // -------------------------------------------------------------- reporter

    function test_reporter_sendsEveryBalance() public {
        vm.roll(777);
        reporter.report(_holders());
        assertEq(fx.lastReceiver(), address(dist));
        assertEq(fx.lastSender(), address(reporter));
        (uint256 blk, address[] memory to, uint256[] memory amounts) = abi.decode(fx.lastData(), (uint256, address[], uint256[]));
        assertEq(blk, 777);
        assertEq(to.length, 3);
        assertEq(to[1], B);
        assertEq(amounts[0], WA);
        assertEq(amounts[2], WC);
    }

    function test_reporter_refusesAnIncompleteList() public {
        address[] memory h = new address[](2);
        (h[0], h[1]) = (A, B); // the smallest holder left out
        vm.expectRevert(abi.encodeWithSelector(SniEthReporter.IncompleteHolders.selector, WA + WB, WA + WB + WC));
        reporter.report(h);
    }

    function test_reporter_refusesDuplicatesAndDisorder() public {
        address[] memory h = new address[](4);
        (h[0], h[1], h[2], h[3]) = (A, A, B, C);
        vm.expectRevert(SniEthReporter.NotAscending.selector);
        reporter.report(h);
        (h[0], h[1], h[2], h[3]) = (A, C, B, address(0xFFFF));
        vm.expectRevert(SniEthReporter.NotAscending.selector);
        reporter.report(h);
        address[] memory z = new address[](1);
        vm.expectRevert(SniEthReporter.NotAscending.selector); // the zero address
        reporter.report(z);
        vm.expectRevert(SniEthReporter.NoHolders.selector);
        reporter.report(new address[](0));
    }

    function test_reporter_refusesMoreRecipientsThanTheDistributorTakes() public {
        address[] memory many = new address[](101);
        MockToken token = new MockToken();
        SniEthReporter r = new SniEthReporter(IERC20Balances(address(token)), IFxRoot(address(fx)), address(dist), 0);
        for (uint256 i; i < 101; ++i) {
            many[i] = address(uint160(0x1000 + i));
            token.mint(many[i], 1 ether);
        }
        vm.expectRevert(SniEthReporter.TooManyRecipients.selector);
        r.report(many);
    }

    function test_reporter_dropsBalancesBelowTheMinimum_butStillCountsThem() public {
        SniEthReporter r = new SniEthReporter(IERC20Balances(address(sniEth)), IFxRoot(address(fx)), address(dist), 1 ether);
        r.report(_holders()); // C holds 0.05
        (, address[] memory to,) = abi.decode(fx.lastData(), (uint256, address[], uint256[]));
        assertEq(to.length, 2);
        // a holder too small to be sent may be left out of the list: it changes nothing that is sent
        address[] memory two = new address[](2);
        (two[0], two[1]) = (A, B);
        r.report(two);
        (, to,) = abi.decode(fx.lastData(), (uint256, address[], uint256[]));
        assertEq(to.length, 2);
        // a holder that would be sent may not
        (two[0], two[1]) = (A, C);
        vm.expectRevert(abi.encodeWithSelector(SniEthReporter.IncompleteHolders.selector, WA + WC, WA + WB + WC));
        r.report(two);
    }

    function test_reporter_treatsADelegatedWalletAsAWallet() public {
        // EIP-7702: a wallet whose code is just a delegation is still its owner's on every chain
        vm.etch(B, abi.encodePacked(hex"ef0100", address(0x1234)));
        reporter.report(_holders());
        (, address[] memory to,) = abi.decode(fx.lastData(), (uint256, address[], uint256[]));
        assertEq(to.length, 3);
        assertEq(to[1], B);
        // any other code is a contract: not paid
        vm.etch(B, hex"60006000");
        reporter.report(_holders());
        (, to,) = abi.decode(fx.lastData(), (uint256, address[], uint256[]));
        assertEq(to.length, 2);
    }

    function test_reporter_skipsEmptyWallets_andPaysEachHolderAtItsOwnAddress() public {
        address[] memory h = new address[](4);
        (h[0], h[1], h[2], h[3]) = (address(0x0001), A, B, C); // 0x0001 holds nothing
        reporter.report(h);
        (, address[] memory to, uint256[] memory amounts) = abi.decode(fx.lastData(), (uint256, address[], uint256[]));
        assertEq(to.length, 3);
        assertEq(to[0], A);
        assertEq(to[1], B);
        assertEq(amounts[1], WB);
        // there is no way to name another recipient
        vm.prank(B);
        (bool ok,) = address(reporter).call(abi.encodeWithSignature("setRecipient(address)", address(0xBEEF)));
        assertFalse(ok);
    }

    function testFuzz_reporter_weightsAlwaysAddUpToSupply(uint96[8] memory balances) public {
        MockToken token = new MockToken();
        SniEthReporter r = new SniEthReporter(IERC20Balances(address(token)), IFxRoot(address(fx)), address(dist), 0);
        address[] memory h = new address[](8);
        uint256 supply;
        for (uint256 i; i < 8; ++i) {
            h[i] = address(uint160(0x1000 + i));
            token.mint(h[i], balances[i]);
            supply += balances[i];
        }
        if (supply == 0) {
            vm.expectRevert(abi.encodeWithSelector(SniEthReporter.IncompleteHolders.selector, 0, 0));
            r.report(h);
            return;
        }
        r.report(h);
        (, address[] memory to, uint256[] memory amounts) = abi.decode(fx.lastData(), (uint256, address[], uint256[]));
        uint256 sum;
        for (uint256 i; i < amounts.length; ++i) {
            assertGt(amounts[i], 0);
            assertTrue(to[i] != address(0));
            sum += amounts[i];
        }
        assertEq(sum, supply);
    }
}
