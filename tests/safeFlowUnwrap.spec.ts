import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { unwrapSafeTransaction } from "../services/vaultFlows";

const safe = new ethers.Interface([
  "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)",
  "function multiSend(bytes transactions)",
]);
const vault = new ethers.Interface([
  "function fundFlowsCall(bytes data)",
  "function requestDeposit(uint256 amount)",
  "function deposit()",
]);

const VAULT = "0x7890e0ff3d76f71a3d33b17fb5b3f3866512485b";
const MULTI_SEND = "0x9641d764fc13c8b624c04430c7356c1c7c8102e2";
const USDC = "0xb88339cb7199b77e23db6e890353e22632ba630f";

const exec = (to: string, data: string, operation = 0) =>
  safe.encodeFunctionData("execTransaction", [
    to, 0, data, operation, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, "0x",
  ]);

const packed = (calls: { to: string; data: string }[]) =>
  ethers.concat(
    calls.map(({ to, data }) =>
      ethers.solidityPacked(
        ["uint8", "address", "uint256", "uint256", "bytes"],
        [0, to, 0, ethers.dataLength(data), data],
      ),
    ),
  );

describe("unwrapSafeTransaction", () => {
  it("returns the vault call a Safe makes", () => {
    const inner = vault.encodeFunctionData("fundFlowsCall", [
      vault.encodeFunctionData("requestDeposit", [37_095_090_000n]),
    ]);
    expect(unwrapSafeTransaction(exec(VAULT, inner))).toEqual([
      { to: VAULT, input: inner.toLowerCase() },
    ]);
  });

  it("unpacks a MultiSend batch the Safe delegatecalls", () => {
    const approve = new ethers.Interface(["function approve(address,uint256)"])
      .encodeFunctionData("approve", [VAULT, 1n]);
    const deposit = vault.encodeFunctionData("fundFlowsCall", [vault.encodeFunctionData("deposit")]);
    const batch = safe.encodeFunctionData("multiSend", [
      packed([{ to: USDC, data: approve }, { to: VAULT, data: deposit }]),
    ]);
    expect(unwrapSafeTransaction(exec(MULTI_SEND, batch, 1)).map((call) => call.to)).toEqual([
      USDC,
      VAULT,
    ]);
  });

  it("ignores calldata that is not a Safe transaction", () => {
    expect(unwrapSafeTransaction(vault.encodeFunctionData("deposit"))).toEqual([]);
    expect(unwrapSafeTransaction("0x")).toEqual([]);
  });
});
