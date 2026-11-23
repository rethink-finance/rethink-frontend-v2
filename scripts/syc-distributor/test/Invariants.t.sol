// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SycDistributor, IRolesModifier, IERC20Like} from "../src/SycDistributor.sol";
import {SniEthReporter, IERC20Balances, IFxRoot} from "../src/SniEthReporter.sol";
import {MockToken, MockFund, MockSafe, MockRoles, MockFx} from "./Mocks.sol";

/// @dev Everything that can happen around the distributor, in any order the fuzzer likes.
contract Handler is Test {
    uint256 constant N = 30; // more than one batch, few enough for a report to be stored
    bytes32 constant ROLE = "SYC-Distributor";

    MockToken public sni = new MockToken();
    MockToken public sniEth = new MockToken();
    MockSafe public safe = new MockSafe();
    MockRoles public roles;
    MockFund public fund;
    MockFx public fx = new MockFx();
    SycDistributor public dist;
    SniEthReporter public reporter;

    address[] public holders;
    address constant OUTSIDER = address(0xBAD);
    address constant OWNER = address(0x78E3);

    // what the distributor minted, measured from outside it
    uint256 public mintedByDistributor;
    // SYC that came from fair deposits into the vault
    uint256 public mintedByDeposits;
    bool public mintedUnbacked;
    bool public keeperLied;
    uint256 public distributions;
    uint256 public reportsApplied;

    constructor() {
        roles = new MockRoles(safe);
        safe.setRoles(address(roles));
        fund = new MockFund(address(safe));
        address[] memory r = new address[](N);
        uint256[] memory w = new uint256[](N);
        uint256[] memory s = new uint256[](N);
        for (uint256 i; i < N; ++i) {
            r[i] = address(uint160(0x9000 + i)); // ascending
            w[i] = (i + 1) * 1 ether;
            s[i] = (i + 1) * 1_000 ether;
            holders.push(r[i]);
            sniEth.mint(r[i], w[i]);
        }
        dist = new SycDistributor(
            SycDistributor.Config(IRolesModifier(address(roles)), ROLE, address(fund), address(safe), IERC20Like(address(sni)), address(fx), OWNER, 100 ether, 8 days),
            r,
            w,
            r,
            s
        );
        roles.assign(address(dist), ROLE, true);
        reporter = new SniEthReporter(IERC20Balances(address(sniEth)), IFxRoot(address(fx)), address(dist), 0.01 ether);
        vm.prank(OWNER);
        dist.setReporter(address(reporter));
        sni.mint(address(safe), 465_000 ether); // 1,000 x (1 + ... + 30)
        // seeded here directly: a contract cannot call itself while it is still being built
        dist.seed();
        mintedByDistributor = fund.totalSupply();
    }

    /// @dev Run something that may make the distributor mint, and account for what it minted.
    function _track(function() external fn) internal returns (bool ok) {
        uint256 before = fund.totalSupply();
        try fn() {
            ok = true;
        } catch {}
        uint256 grew = fund.totalSupply() - before;
        if (grew != 0) {
            mintedByDistributor += grew;
            if (fund.totalSupply() > sni.balanceOf(address(safe))) mintedUnbacked = true;
        }
    }

    // ------------------------------------------------------------ the world

    function sniArrives(uint256 amount) external {
        sni.mint(address(safe), bound(amount, 1, 500_000 ether));
    }

    function sniLeaves(uint256 amount) external {
        uint256 held = sni.balanceOf(address(safe));
        if (held == 0) return;
        sni.burn(address(safe), bound(amount, 1, held / 4 + 1));
    }

    function someoneDepositsIntoTheVault(uint256 amount) external {
        amount = bound(amount, 1, 100_000 ether);
        sni.mint(address(safe), amount);
        fund.mint(OUTSIDER, amount);
        mintedByDeposits += amount;
    }

    function timePasses(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1 hours, 4 days));
        vm.roll(block.number + 100);
    }

    function sniEthMoves(uint256 from, uint256 to, uint256 amount) external {
        address a = holders[from % N];
        address b = holders[to % N];
        uint256 has = sniEth.balanceOf(a);
        if (a == b || has == 0) return;
        amount = bound(amount, 1, has);
        sniEth.burn(a, amount);
        sniEth.mint(b, amount);
    }

    function someoneReports() external {
        vm.roll(block.number + 1);
        address[] memory list = holders;
        try reporter.report(list) {
            try fx.deliver() {} catch {}
        } catch {}
    }

    // ------------------------------------------------------ the distributor

    function callDistribute() external {
        address[] memory before = dist.recipients();
        if (_track(this.doDistribute)) distributions++;
        if (dist.recipients().length != before.length || dist.weightsFreshAt() == block.timestamp) reportsApplied++;
    }

    function doDistribute() external {
        dist.distribute();
    }

    function keeperRuns() external {
        (bool needed,) = dist.checkUpkeep("");
        if (!needed) return;
        // The keeper is told there is work: the work must not revert.
        if (!_track(this.doUpkeep)) keeperLied = true;
    }

    function doUpkeep() external {
        dist.performUpkeep("");
    }

    function outsiderPokes(uint256 which) external {
        vm.startPrank(OUTSIDER);
        if (which % 3 == 0) {
            try dist.setReporter(OUTSIDER) {} catch {}
        } else if (which % 3 == 1) {
            try dist.transferOwnership(OUTSIDER) {} catch {}
        } else {
            address[] memory r = new address[](1);
            uint256[] memory w = new uint256[](1);
            (r[0], w[0]) = (OUTSIDER, 1);
            try dist.applyReport(block.number, r, w) {} catch {}
            try dist.processMessageFromRoot(1, address(reporter), abi.encode(block.number + 1e6, r, w)) {} catch {}
        }
        vm.stopPrank();
    }

    function holderCount() external pure returns (uint256) {
        return N;
    }
}

/**
 * Properties that must hold after any sequence of the handler's actions: SNI arriving and leaving, deposits into
 * the vault, time passing, sniETH changing hands, reports, distributions, keeper runs, and an outsider trying
 * every door.
 */
contract InvariantsTest is Test {
    Handler h;

    function setUp() public {
        h = new Handler();
        targetContract(address(h));
        bytes4[] memory skip = new bytes4[](2);
        skip[0] = Handler.doDistribute.selector;
        skip[1] = Handler.doUpkeep.selector;
        excludeSelector(FuzzSelector(address(h), skip));
    }

    /// Not a check: how much really happened in a run, so an idle run cannot pass for a tested one.
    function afterInvariant() public {
        emit log_named_uint("mints in this run", h.dist().mintCount());
        emit log_named_uint("distribute() calls that went through", h.distributions());
        emit log_named_uint("recipients at the end", h.dist().recipients().length);
    }

    /// The distributor never mints SYC that has no SNI behind it.
    function invariant_everyMintIsBacked() public view {
        assertFalse(h.mintedUnbacked());
    }

    /// Every SYC in existence came from a deposit or is in the distributor's own log.
    function invariant_theMintLogAccountsForEverySyc() public view {
        SycDistributor d = h.dist();
        SycDistributor.MintRecord[] memory log = d.mints(0, d.mintCount());
        uint256 logged;
        for (uint256 i; i < log.length; ++i) {
            logged += log[i].total;
        }
        assertEq(logged, h.mintedByDistributor());
        assertEq(h.fund().totalSupply(), logged + h.mintedByDeposits());
    }

    /// Nobody outside the depositors receives anything from the distributor, and the owner never changes.
    function invariant_outsidersGetNothing() public view {
        assertEq(h.fund().balanceOf(address(0xBAD)), h.mintedByDeposits());
        assertEq(h.fund().balanceOf(address(0x78E3)), 0);
        assertEq(h.dist().owner(), address(0x78E3));
        assertEq(h.dist().reporter(), address(h.reporter()));
    }

    /// When the keeper is told there is work, doing it does not revert.
    function invariant_theKeeperIsNeverSentToARevert() public view {
        assertFalse(h.keeperLied());
    }

    /// A distribution in progress always points at a real recipient, and an idle one points nowhere.
    function invariant_theRoundStateIsConsistent() public view {
        SycDistributor d = h.dist();
        if (d.roundAmount() == 0) assertEq(d.roundNext(), 0);
        else assertLt(d.roundNext(), d.recipients().length);
        assertGt(d.totalWeight(), 0);
    }
}
