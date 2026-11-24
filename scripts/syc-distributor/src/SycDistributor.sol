// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20Like {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

interface IRolesModifier {
    function execTransactionWithRole(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        bytes32 roleKey,
        bool shouldRevert
    ) external returns (bool success);
}

interface IFundFlows {
    function fundFlowsCall(bytes calldata flowCall) external;
    function mintToMany(uint256[] calldata amounts, address[] calldata recipients) external;
}

/// @notice Receives messages sent from Ethereum through Polygon's FxPortal (FxChild calls this).
interface IFxMessageProcessor {
    function processMessageFromRoot(uint256 stateId, address rootMessageSender, bytes calldata data) external;
}

/**
 * @title SycDistributor
 * @notice Mints SYC, the SNI Yield Claim Vault's share token, to sniETH depositors. Nobody decides the
 *         amounts: anyone may call distribute(), and it mints exactly the SNI that sits in the vault's Safe
 *         without SYC issued against it, split by each depositor's sniETH.
 *
 *         One rule bounds everything: after any mint, SYC supply <= SNI in the Safe. There is no fixed cap
 *         to raise when SNI gets cheap and a little yield buys a lot of it, and no way to mint SYC that
 *         nothing backs.
 *
 *         The contract is the only member of one role on the vault's Zodiac Roles modifier, and that role may
 *         do one thing: make the Safe call mintToMany on the vault. This contract holds no funds and has no
 *         other outward call.
 *
 *         Weights (who holds how much sniETH) are fixed at deployment and afterwards change only through a
 *         reporter contract on Ethereum, which reads sniETH balances and sends them through FxPortal. Nobody,
 *         the owner included, can set weights by hand, and the reporter is named once and never replaced, so
 *         no person decides who receives SYC. SNI that arrived before a change is first distributed by the
 *         old weights.
 *
 *         The first issuance (everything owed since the first sniETH deposit) is fixed at deployment and
 *         minted once by seed(); its split differs from today's weights because balances changed over time.
 *
 *         A distribution smaller than `minDistribution` is skipped, so nobody can fill the mint log with dust.
 *         A distribution to many wallets is made in batches of BATCH, each within a keeper's gas limit; the
 *         weights cannot change until the last batch is out. Once a reporter is named, weights older than
 *         `maxWeightAge` stop distributions until a report confirms or replaces them, so a holder who has
 *         left cannot go on earning unnoticed.
 *
 *         There is no pause here. The kill switch is the role: whoever owns the vault's Roles modifier takes
 *         it away, and from then on every mint reverts. After the vault is finalized that owner is the governor,
 *         which votes with SYC, so until a vote has handed the modifier to the Safe (possible only once the
 *         first issuance exists) stopping this contract takes a governance vote.
 */
contract SycDistributor is IFxMessageProcessor {
    uint256 public constant MAX_RECIPIENTS = 100;
    /// @notice A report with at most this many recipients is kept in storage on arrival and applied by the next
    ///         distribution, with nobody involved. A larger one only commits its hash and waits for applyReport;
    ///         storing it could exceed the gas Polygon gives a bridge delivery.
    uint256 public constant AUTO_APPLY_MAX = 32;
    /// @notice Recipients minted per call. More than this and a distribution takes several calls.
    uint256 public constant BATCH = 25;

    IRolesModifier public immutable roles;
    bytes32 public immutable roleKey;
    /// @notice The vault: its share token is SYC, and mintToMany is reached through fundFlowsCall.
    address public immutable fund;
    address public immutable safe;
    IERC20Like public immutable sni;
    /// @notice Polygon's FxChild: the only address a cross-chain report may come from.
    address public immutable fxChild;
    /// @notice Distributions below this total are skipped.
    uint256 public immutable minDistribution;
    /// @notice Once a reporter is named: how old the weights may be before distributions wait for a report.
    ///         Zero switches the check off.
    uint256 public immutable maxWeightAge;

    address public owner;
    /// @notice The reporter on Ethereum whose messages are accepted. Zero until the owner names it, once.
    address public reporter;

    address[] private _recipients;
    uint256[] private _weights;
    uint256 public totalWeight;
    /// @notice keccak256(abi.encode(recipients, weights)) of the weights in force.
    bytes32 public weightsHash;

    address[] private _seedRecipients;
    uint256[] private _seedAmounts;
    bool public seeded;

    /// @notice One entry per mint this contract made, oldest first; entry 0 is the first issuance.
    struct MintRecord {
        uint64 time;
        uint64 blockNumber;
        uint128 total;
    }

    MintRecord[] private _mints;

    /// @notice Hash of a report received from Ethereum and not applied yet. distribute() waits for it.
    bytes32 public pendingReport;
    /// @notice Ethereum block of the newest report received.
    uint256 public lastReportBlock;
    /// @dev The unapplied report itself, when it is small enough to keep (see AUTO_APPLY_MAX).
    bytes private _pendingData;
    /// @notice SNI that was waiting when the unapplied report arrived. It goes out by the old weights first.
    uint256 public flushAmount;

    /// @notice When the weights were last set, or confirmed by a report that repeated them.
    uint256 public weightsFreshAt;

    /// @notice A distribution in progress: the amount being split, and the next recipient. Zero when none.
    uint256 public roundAmount;
    uint256 public roundNext;

    uint256 private _entered = 1;

    event Seeded(uint256 total);
    event Distributed(uint256 total);
    event WeightsSet(uint256 indexed reportBlock, address[] recipients, uint256[] weights);
    event ReportReceived(uint256 indexed reportBlock, bytes32 reportHash);
    /// @dev A report that changes nothing, or that could never be stored, is dropped on arrival.
    event ReportIgnored(uint256 indexed reportBlock, bool unchanged);
    /// @dev SNI left the Safe between two batches; the rest of that distribution could not be backed.
    event RoundAbandoned(uint256 amount, uint256 nextRecipient);
    event ReporterSet(address reporter);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotFxChild();
    error NotReporter();
    error ReporterAlreadySet();
    error StaleReport();
    error WrongReport();
    error ReportPending();
    error WeightsStale();
    error RoundInProgress();
    error BadWeights();
    error AlreadySeeded();
    error NotSeeded();
    error NotBacked();
    error NothingToDistribute();
    error MintMismatch();
    error Reentered();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_entered != 1) revert Reentered();
        _entered = 2;
        _;
        _entered = 1;
    }

    /// @notice Where everything is, fixed at deployment.
    struct Config {
        IRolesModifier roles;
        bytes32 roleKey;
        address fund;
        address safe;
        IERC20Like sni;
        address fxChild;
        address owner;
        uint256 minDistribution;
        uint256 maxWeightAge;
    }

    constructor(
        Config memory c,
        address[] memory recipients_,
        uint256[] memory weights_,
        address[] memory seedRecipients_,
        uint256[] memory seedAmounts_
    ) {
        if (
            address(c.roles) == address(0) || c.fund == address(0) || c.safe == address(0) || address(c.sni) == address(0)
                || c.fxChild == address(0) || c.owner == address(0)
        ) revert ZeroAddress();
        roles = c.roles;
        roleKey = c.roleKey;
        fund = c.fund;
        safe = c.safe;
        sni = c.sni;
        fxChild = c.fxChild;
        minDistribution = c.minDistribution;
        maxWeightAge = c.maxWeightAge;
        owner = c.owner;
        emit OwnershipTransferred(address(0), c.owner);
        _storeWeights(0, recipients_, weights_);

        // The first issuance obeys the same rules as weights: no empty entry, no wallet twice.
        if (seedRecipients_.length != 0 && !_validList(seedRecipients_, seedAmounts_)) revert BadWeights();
        if (seedRecipients_.length != seedAmounts_.length) revert BadWeights();
        _seedRecipients = seedRecipients_;
        _seedAmounts = seedAmounts_;
        // Nothing to seed: the first issuance was made some other way.
        if (seedRecipients_.length == 0) seeded = true;
    }

    // ----------------------------------------------------------------- views

    function recipients() external view returns (address[] memory) {
        return _recipients;
    }

    function weights() external view returns (uint256[] memory) {
        return _weights;
    }

    function seedPlan() external view returns (address[] memory, uint256[] memory) {
        return (_seedRecipients, _seedAmounts);
    }

    /// @notice SNI in the Safe that has no SYC issued against it yet.
    function undistributed() public view returns (uint256) {
        uint256 held = sni.balanceOf(safe);
        uint256 supply = IERC20Like(fund).totalSupply();
        return held > supply ? held - supply : 0;
    }

    /// @notice What distribute() would mint right now, per recipient.
    function preview() external view returns (address[] memory, uint256[] memory) {
        return (_recipients, _split(undistributed()));
    }

    function mintCount() external view returns (uint256) {
        return _mints.length;
    }

    /// @notice Up to `count` mints starting at index `from`. The SYC Transfer events of each mint are in its block.
    function mints(uint256 from, uint256 count) external view returns (MintRecord[] memory page) {
        uint256 n = _mints.length;
        if (from >= n) return page;
        if (count > n - from) count = n - from;
        page = new MintRecord[](count);
        for (uint256 i; i < count; ++i) {
            page[i] = _mints[from + i];
        }
    }

    /// @notice False once a reporter is named and no report has set or confirmed the weights for maxWeightAge.
    function weightsFresh() public view returns (bool) {
        return reporter == address(0) || maxWeightAge == 0 || block.timestamp - weightsFreshAt <= maxWeightAge;
    }

    /// @dev The total a split of `amount` comes to; zero when it is not worth distributing.
    function _wholeOf(uint256 amount) private view returns (uint256 whole) {
        if (amount == 0 || totalWeight == 0) return 0;
        uint256 n = _weights.length;
        for (uint256 i; i < n; ++i) {
            whole += amount * _weights[i] / totalWeight;
        }
        if (whole < minDistribution) return 0;
    }

    /// @dev What is still to be minted of the distribution in progress.
    function _roundRemaining() private view returns (uint256 remaining) {
        if (roundAmount == 0) return 0;
        uint256 n = _weights.length;
        for (uint256 i = roundNext; i < n; ++i) {
            remaining += roundAmount * _weights[i] / totalWeight;
        }
    }

    // ---------------------------------------------------------------- keepers

    /// @notice For a keeper network (Chainlink Automation's interface). `checkData` may hold a minimum amount,
    ///         a uint256 in wei: below it the keeper waits. A distribution in progress and a report that can be
    ///         applied are worked on whatever the amount.
    function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData) {
        performData = "";
        if (roundAmount != 0) return (true, performData);
        if (pendingReport != bytes32(0)) return (flushAmount != 0 || _pendingData.length != 0, performData);
        if (!seeded || !weightsFresh()) return (false, performData);
        uint256 minimum = checkData.length == 32 ? abi.decode(checkData, (uint256)) : 0;
        uint256 total = _wholeOf(undistributed());
        upkeepNeeded = total != 0 && total >= minimum;
    }

    /// @notice What the keeper calls. The same as distribute(): the caller has no say in the amounts.
    function performUpkeep(bytes calldata) external nonReentrant {
        _run();
    }

    // ------------------------------------------------------------ distribute

    /// @notice The first issuance, exactly as fixed at deployment. Once, by anyone.
    function seed() external nonReentrant {
        if (seeded) revert AlreadySeeded();
        // No "supply must be zero" here. SYC someone paid for before this (SNI in, SYC out) does no harm, and SYC
        // handed out for nothing makes the backing check in _mint fail. Refusing any earlier supply would let a
        // one-wei deposit block the first issuance for good.
        seeded = true;
        uint256 total = _mint(_seedAmounts, _seedRecipients);
        emit Seeded(total);
    }

    /// @notice Mint the SNI that arrived since the last mint, split by the current weights. Anyone may call.
    ///         With more than BATCH recipients it takes several calls; each continues where the last stopped.
    function distribute() external nonReentrant returns (uint256 total) {
        total = _run();
    }

    /// @dev One step, in this order: the next batch of a distribution in progress; then, if a report is waiting,
    ///      the SNI that predates it (by the old weights) and the report itself; otherwise a new distribution.
    function _run() private returns (uint256 total) {
        if (roundAmount != 0) return _batch(roundAmount, roundNext);

        if (pendingReport != bytes32(0)) {
            uint256 owed = flushAmount;
            bool stored = _pendingData.length != 0;
            if (owed != 0) {
                flushAmount = 0;
                uint256 waiting = undistributed();
                total = _startRound(owed < waiting ? owed : waiting);
                // More batches to go, or nothing kept to apply: that was this step.
                if (roundAmount != 0 || !stored) return total;
            }
            // A report too large to keep: someone has to hand its data to applyReport.
            if (!stored) revert ReportPending();
            (uint256 reportBlock, address[] memory r, uint256[] memory w) =
                abi.decode(_pendingData, (uint256, address[], uint256[]));
            pendingReport = bytes32(0);
            delete _pendingData;
            _storeWeights(reportBlock, r, w);
            return total;
        }

        if (!seeded) revert NotSeeded();
        if (!weightsFresh()) revert WeightsStale();
        total = _startRound(undistributed());
        if (total == 0) revert NothingToDistribute();
    }

    /// @dev Begin distributing `amount` by the weights in force. Returns what the first batch minted; zero when
    ///      the amount is dust.
    function _startRound(uint256 amount) private returns (uint256) {
        if (!seeded || _wholeOf(amount) == 0) return 0;
        return _batch(amount, 0);
    }

    /// @dev Mint recipients [from, from + BATCH) their share of `amount`.
    function _batch(uint256 amount, uint256 from) private returns (uint256 total) {
        uint256 n = _recipients.length;
        uint256 to = from + BATCH;
        if (to > n) to = n;
        address[] memory who = new address[](to - from);
        uint256[] memory amounts = new uint256[](to - from);
        for (uint256 i = from; i < to; ++i) {
            who[i - from] = _recipients[i];
            amounts[i - from] = amount * _weights[i] / totalWeight;
            total += amounts[i - from];
        }
        // SNI left the Safe between two batches: the rest of this distribution has nothing behind it. Drop it
        // rather than block everything; the next distribution starts from what is really there.
        if (from != 0 && IERC20Like(fund).totalSupply() + total > sni.balanceOf(safe)) {
            roundAmount = 0;
            roundNext = 0;
            emit RoundAbandoned(amount, from);
            return 0;
        }
        if (to == n) {
            roundAmount = 0;
            roundNext = 0;
        } else {
            roundAmount = amount;
            roundNext = to;
        }
        _mint(amounts, who);
        emit Distributed(total);
    }

    /// @dev Pro-rata, rounded down. The few wei left over stay undistributed until next time.
    function _split(uint256 amount) private view returns (uint256[] memory amounts) {
        uint256 n = _weights.length;
        amounts = new uint256[](n);
        if (totalWeight == 0) return amounts;
        for (uint256 i; i < n; ++i) {
            amounts[i] = amount * _weights[i] / totalWeight;
        }
    }

    /// @dev The only outward call this contract makes: the Safe, through the Roles modifier, calls mintToMany.
    function _mint(uint256[] memory amounts, address[] memory to) private returns (uint256 total) {
        uint256 n = to.length;
        uint256[] memory before = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            total += amounts[i];
            before[i] = IERC20Like(fund).balanceOf(to[i]);
        }
        if (total == 0) return 0;
        uint256 supplyBefore = IERC20Like(fund).totalSupply();

        bytes memory mint = abi.encodeCall(IFundFlows.mintToMany, (amounts, to));
        roles.execTransactionWithRole(fund, 0, abi.encodeCall(IFundFlows.fundFlowsCall, (mint)), 0, roleKey, true);

        // Exactly what was asked for was minted, each recipient got its full amount (a mint fee would take a
        // cut and fail here; no wallet is listed twice, so none can absorb the cut for another), and every SYC
        // is still backed by an SNI in the Safe.
        uint256 supplyAfter = IERC20Like(fund).totalSupply();
        if (supplyAfter != supplyBefore + total) revert MintMismatch();
        for (uint256 i; i < n; ++i) {
            if (IERC20Like(fund).balanceOf(to[i]) < before[i] + amounts[i]) revert MintMismatch();
        }
        if (supplyAfter > sni.balanceOf(safe)) revert NotBacked();
        if (total > type(uint128).max) revert MintMismatch();
        _mints.push(MintRecord(uint64(block.timestamp), uint64(block.number), uint128(total)));
    }

    // --------------------------------------------------------------- weights

    /// @notice A report from Ethereum, called by FxChild. It never mints. A report that repeats the weights in
    ///         force is dropped, so resending one costs the sender gas and changes nothing here. A changed one
    ///         is committed, and kept in full when small enough for the next distribution to apply it.
    function processMessageFromRoot(uint256, address rootMessageSender, bytes calldata data) external override {
        if (msg.sender != fxChild) revert NotFxChild();
        if (rootMessageSender != reporter || reporter == address(0)) revert NotReporter();
        (uint256 reportBlock, address[] memory r, uint256[] memory w) = abi.decode(data, (uint256, address[], uint256[]));
        if (reportBlock <= lastReportBlock) revert StaleReport();
        lastReportBlock = reportBlock;
        bool unchanged = keccak256(abi.encode(r, w)) == weightsHash;
        if (unchanged || !_validList(r, w)) {
            // The balances were read and are what is in force: the weights are confirmed.
            if (unchanged) weightsFreshAt = block.timestamp;
            emit ReportIgnored(reportBlock, unchanged);
            return;
        }
        // What is waiting now predates this report, so it is owed by the old weights. (A second report before
        // the first is applied keeps the first one's figure. Weights already stale are owed nothing.)
        if (pendingReport == bytes32(0)) {
            uint256 waiting = undistributed();
            uint256 inRound = _roundRemaining();
            flushAmount = seeded && weightsFresh() && waiting > inRound ? waiting - inRound : 0;
        }
        pendingReport = keccak256(data);
        if (r.length <= AUTO_APPLY_MAX) _pendingData = data;
        else delete _pendingData;
        emit ReportReceived(reportBlock, pendingReport);
    }

    /// @notice Apply a report that was too large to keep. Anyone may call with the data from the reporter's
    ///         Reported event, once distribute() has sent out the SNI that predates it.
    function applyReport(uint256 reportBlock, address[] calldata recipients_, uint256[] calldata weights_)
        external
        nonReentrant
    {
        if (pendingReport == bytes32(0) || keccak256(abi.encode(reportBlock, recipients_, weights_)) != pendingReport) {
            revert WrongReport();
        }
        if (roundAmount != 0 || flushAmount != 0) revert RoundInProgress();
        pendingReport = bytes32(0);
        delete _pendingData;
        _storeWeights(reportBlock, recipients_, weights_);
    }

    /// @dev A usable list: 1 to MAX_RECIPIENTS entries, no zero address, no zero or oversized amount, and no
    ///      wallet twice. Amounts fit 128 bits so that amount x weight cannot overflow in a split.
    function _validList(address[] memory who, uint256[] memory amounts) private pure returns (bool) {
        uint256 n = who.length;
        if (n == 0 || n != amounts.length || n > MAX_RECIPIENTS) return false;
        for (uint256 i; i < n; ++i) {
            if (who[i] == address(0) || amounts[i] == 0 || amounts[i] > type(uint128).max) return false;
            for (uint256 j; j < i; ++j) {
                if (who[j] == who[i]) return false;
            }
        }
        return true;
    }

    function _storeWeights(uint256 reportBlock, address[] memory recipients_, uint256[] memory weights_) private {
        if (!_validList(recipients_, weights_)) revert BadWeights();
        uint256 total;
        for (uint256 i; i < weights_.length; ++i) {
            total += weights_[i];
        }
        _recipients = recipients_;
        _weights = weights_;
        totalWeight = total;
        weightsHash = keccak256(abi.encode(recipients_, weights_));
        weightsFreshAt = block.timestamp;
        emit WeightsSet(reportBlock, recipients_, weights_);
    }

    // ----------------------------------------------------------------- owner

    /// @notice Name the Ethereum reporter. Once: after that nobody can replace or clear it, so the owner
    ///         cannot swap in a reporter that sends other weights.
    function setReporter(address reporter_) external onlyOwner {
        if (reporter != address(0)) revert ReporterAlreadySet();
        if (reporter_ == address(0)) revert ZeroAddress();
        reporter = reporter_;
        // The clock for the first report starts now, not at deployment.
        weightsFreshAt = block.timestamp;
        emit ReporterSet(reporter_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
