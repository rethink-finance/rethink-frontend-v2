import { Web3, Contract, Web3PromiEvent } from "web3";
import type { ContractOptions } from "web3";
import type { ContractAbi } from "web3-types";
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

export class CustomContract<Abi extends ContractAbi> extends Contract<Abi> {
  private readonly rpcUrls: string[];
  private currentRpcIndex: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(abi: any, address: string, rpcUrls: string[], options = {}) {
    const initialProvider = new Web3.providers.HttpProvider(rpcUrls[0]);
    super(abi, address, {
      ...options,
      provider: initialProvider,
    });
    this.rpcUrls = rpcUrls;
    this.currentRpcIndex = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  private switchRpcUrl(): void {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
    const newRpcUrl = this.rpcUrls[this.currentRpcIndex];
    console.log(`Switching to RPC URL: ${newRpcUrl}`);
    this.setProvider(new Web3.providers.HttpProvider(newRpcUrl));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async callWithRetry(methodCall: () => Promise<any>): Promise<any> {
    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        return await methodCall();
      } catch (error: any) {
        console.error(`Error in call: ${error.message}`);
        retries++;

        if (retries >= this.maxRetries) {
          console.warn("Max retries reached, switching provider...");
          this.switchRpcUrl();
          retries = 0;
        }

        await this.delay(this.retryDelay);
      }
    }

    throw new Error("Max retries reached for all RPC URLs");
  }

  call(methodName: string, options?: any): any {
    const method = this.methods[
      methodName
    ] as unknown as ContractMethodWithCall;
    if (!method) {
      throw new Error(`Method ${methodName} not found on contract`);
    }

    return this.callWithRetry(() => method.call(options));
  }

  // Override .send() to dynamically fetch the user's provider
  send(
    methodName: string,
    options: ContractOptions,
    ...calldataArgs: any[]
  ): Promise<any> {
    const accountStore = useAccountStore();
    const userProvider = accountStore.connectedWallet?.provider;
    // Access the contract method
    const method = this.methods[
      methodName
    ] as unknown as ContractMethodWithSend;
    if (!method) {
      throw new Error(`Method ${methodName} not found on contract`);
    }

    // Check if the user's provider is available
    if (userProvider) {
      console.warn("user provdided provider")
      // Use the user's provider to create a new Web3 instance and contract
      const web3WithUserProvider = new Web3(userProvider);
      const contractWithUserProvider = new web3WithUserProvider.eth.Contract(
        this.options.jsonInterface,
        this.options?.address,
      );

      // Get the method with the user's provider
      const userMethodWithSend = contractWithUserProvider.methods[
        methodName
      ] as unknown as ContractMethodWithSend;
      console.warn("methods", contractWithUserProvider.methods)
      console.warn("options", options)
      console.warn("calldataArgs", calldataArgs)

      // Explicitly include the calldata
      return userMethodWithSend(...calldataArgs).send(
        { ...options,
          from: accountStore.activeAccountAddress,
          gasPrice: "",
        },
      );
    }
    console.warn("user DID NOT  provide provider")

    // Default logic: use the existing contract instance and shared Web3 provider
    return method(...calldataArgs).send({ ...options, from: options.from });
  }
}
