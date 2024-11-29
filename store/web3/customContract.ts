import { Web3, Contract, Web3PromiEvent } from "web3";
import type { ContractMethodSend, PayableCallOptions } from "web3";
import type { TransactionReceipt } from "viem";
import { useAccountStore } from "~/store/account/account.store";

// Type for methods with 'call'
export type ContractMethodWithCall = {
  call: (options: any, ...args: any[]) => Promise<any>;
};

// Define a reusable type for contract methods with 'send'
export type ContractMethodWithSend = {
  (...args: any[]): {
    send: (
      options: any,
      ...args: any[]
    ) => Web3PromiEvent<TransactionReceipt, any>;
  };
};

export class CustomContract extends Contract<any> {
  private readonly initialChainId: string;

  constructor(abi: any, address: string, chainId: string, rpcUrls: string[], options = {}) {
    const initialProvider = new Web3.providers.HttpProvider(rpcUrls[0]);
    super(abi, address, {
      ...options,
      provider: initialProvider,
    });
    this.initialChainId = chainId;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Override .send() to dynamically fetch the user's provider
  send(
    methodName: string,
    options: any,
    ...calldataArgs: any[]
  ): ContractMethodSend {
    const accountStore = useAccountStore();
    const userProvider = accountStore.connectedWallet?.provider;

    // Access the contract method
    const method = this.methods[methodName];

    if (!method) {
      throw new Error(`Method ${methodName} not found on contract`);
    }

    // Check for user provider
    if (userProvider) {
      console.warn("User provided provider detected");

      const web3WithUserProvider = new Web3(userProvider);
      const contractWithUserProvider = new web3WithUserProvider.eth.Contract(
        this.options.jsonInterface,
        this.options?.address,
      );

      const userMethodWithSend = contractWithUserProvider.methods[
        methodName
      ];

      // Ensure correct network synchronously using a Promise for the user to handle
      return this.ensureCorrectNetwork().then(() => {
        console.warn("Sending transaction with user provider...");
        return userMethodWithSend(...calldataArgs).send({
          from: accountStore.activeAccountAddress,
          gasPrice: "",
          ...options,
        } as PayableCallOptions);
      }) as ContractMethodSend;
    }

    console.warn("Using default provider");
    return method(...calldataArgs).send({ ...options, from: options.from }) as ContractMethodSend;
  }

  ensureCorrectNetwork(): Promise<void> {
    /**
     * Make sure connected wallet is on the same network as the contract provider.
     * If not, prompt user to change network.
     */
    const accountStore = useAccountStore();

    if (this.initialChainId !== accountStore.connectedWalletChainId) {
      console.warn(`Switching to chain ID: ${this.initialChainId}`);
      return accountStore.switchNetwork(this.initialChainId);
    }
    return Promise.resolve();
  }
}
