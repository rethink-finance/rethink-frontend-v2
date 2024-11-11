import { ethers } from "ethers";
import type { Eip712TypedData } from "web3-types";

const FundFlowsCallAbi: Record<string, any[]> = {
  "requestDeposit": [ "function requestDeposit(uint256 amount)" ],
  "deposit": [ "function deposit()" ],
  "depositAndDelegateBySig": [
    "function depositAndDelegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)",
  ],
  "revokeDepositWithrawal": [ "function revokeDepositWithrawal(bool isDeposit)" ],
  "requestWithdraw": [ "function requestWithdraw(uint256 amount)" ],
  "withdraw": [ "function withdraw()" ],
} as const;



const getFundFlowsCallAbi = (functionName: string) => {
  return new ethers.Interface(FundFlowsCallAbi[functionName]);
}


export const encodeFundFlowsCallFunctionData = (functionName: string, data?: any) => {
  const functionAbi = getFundFlowsCallAbi(functionName);
  return functionAbi.encodeFunctionData(functionName, data ?? []);
}

export const createDelegateBySigMessage = (
  compAddress?: string,
  delegatee?: string,
  expiry: number = 10e9,
  chainId: number = 1,
  nonce: number = 0,
): Eip712TypedData => {
  // Create data to be signed as the EIP-712 message
  // https://medium.com/compound-finance/delegation-and-voting-with-eip-712-signatures-a636c9dfec5e
  const types = {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    Delegation: [
      { name: "delegatee", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "expiry", type: "uint256" },
    ],
  };

  const primaryType = "Delegation(address delegatee,uint256 nonce,uint256 expiry)";
  const domain = { name: "VotesUpgradeable", chainId, verifyingContract: compAddress };
  const message = { delegatee, nonce: Number(nonce), expiry: Number(expiry) };
  return { types, primaryType, domain, message } as Eip712TypedData;
};
