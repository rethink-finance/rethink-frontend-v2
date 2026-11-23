// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockToken {
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external {
        balanceOf[from] -= amount;
        totalSupply -= amount;
    }
}

/// @dev The vault as the distributor sees it: share token + fundFlowsCall(mintToMany) that only the Safe may make.
contract MockFund is MockToken {
    address public immutable safe;
    uint256 public feeBps;
    address public constant FEE_TO = address(0xFEE);

    constructor(address safe_) {
        safe = safe_;
    }

    function setFee(uint256 bps) external {
        feeBps = bps;
    }

    /// @dev A vault that mints this much more, to itself, on top of every mint it is asked for.
    uint256 public extraBps;

    function setExtra(uint256 bps) external {
        extraBps = bps;
    }

    function fundFlowsCall(bytes calldata flowCall) external {
        require(msg.sender == safe, "only gov");
        require(bytes4(flowCall) == this.mintToMany.selector, "not allowed");
        (bool ok,) = address(this).delegatecall(flowCall);
        require(ok, "fail flowCall");
    }

    function mintToMany(uint256[] calldata amounts, address[] calldata recipients) external {
        require(amounts.length == recipients.length, "mismatch dims");
        for (uint256 i; i < amounts.length; ++i) {
            uint256 fee = amounts[i] * feeBps / 10_000;
            balanceOf[recipients[i]] += amounts[i] - fee;
            balanceOf[FEE_TO] += fee;
            emit Transfer(address(0), recipients[i], amounts[i] - fee);
            totalSupply += amounts[i];
            uint256 extra = amounts[i] * extraBps / 10_000;
            balanceOf[FEE_TO] += extra;
            totalSupply += extra;
        }
    }
}

contract MockSafe {
    address public roles;

    function setRoles(address roles_) external {
        roles = roles_;
    }

    function exec(address to, bytes calldata data) external {
        require(msg.sender == roles, "not module");
        (bool ok, bytes memory ret) = to.call(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }
}

contract MockRoles {
    MockSafe public immutable safe;
    mapping(address => mapping(bytes32 => bool)) public member;

    error NoMembership();

    constructor(MockSafe safe_) {
        safe = safe_;
    }

    function assign(address who, bytes32 roleKey, bool on) external {
        member[who][roleKey] = on;
    }

    function execTransactionWithRole(address to, uint256, bytes calldata data, uint8, bytes32 roleKey, bool)
        external
        returns (bool)
    {
        if (!member[msg.sender][roleKey]) revert NoMembership();
        safe.exec(to, data);
        return true;
    }
}

/// @dev FxRoot and FxChild in one: remembers the message, then delivers it the way FxChild does.
contract MockFx {
    address public lastSender;
    address public lastReceiver;
    bytes public lastData;
    uint256 public stateId;

    function sendMessageToChild(address receiver, bytes calldata data) external {
        lastSender = msg.sender;
        lastReceiver = receiver;
        lastData = data;
    }

    function deliver() external {
        (bool ok, bytes memory ret) = lastReceiver.call(
            abi.encodeWithSignature("processMessageFromRoot(uint256,address,bytes)", ++stateId, lastSender, lastData)
        );
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }
}

/// @dev A Roles modifier that, in the middle of a mint, calls back into whoever called it.
contract ReentrantRoles {
    MockSafe public immutable safe;
    bytes public callback;
    bool public callbackSucceeded;
    bytes public callbackResult;

    constructor(MockSafe safe_) {
        safe = safe_;
    }

    function setCallback(bytes calldata data) external {
        callback = data;
    }

    function execTransactionWithRole(address to, uint256, bytes calldata data, uint8, bytes32, bool) external returns (bool) {
        if (callback.length != 0) {
            bytes memory once = callback;
            delete callback; // one attempt per mint, so the outcome is that attempt's and nothing else's
            (callbackSucceeded, callbackResult) = msg.sender.call(once);
        }
        safe.exec(to, data);
        return true;
    }
}
