import type { TransactionReceipt } from "viem";
import { Contract, Web3, Web3PromiEvent, type HttpProvider } from "web3";
import { useAccountStore } from "~/store/account/account.store";
import { type ChainId } from "~/types/enums/chain_id";

export class CustomContract extends Contract<any> {
  private readonly initialChainId: ChainId;

  constructor(
    abi: any,
    address: string,
    chainId: ChainId,
    provider?: HttpProvider,
    options = {},
  ) {
    super(abi, address, {
      ...options,
      provider,
    });
    this.initialChainId = chainId;
  }

  send(
    methodName: string,
    options: any,
    ...calldataArgs: any[]
  ): Web3PromiEvent<TransactionReceipt, any> {
    const accountStore = useAccountStore();

    // Create a Web3PromiEvent with a valid PromiseExecutor
    const promiEvent = new Web3PromiEvent<TransactionReceipt, any>((resolve, reject) => {
      // Ensure the network is correct before proceeding
      this.ensureCorrectNetwork()
        .then(() => {
          if (!accountStore.connectedWallet?.provider) {
            reject("No user provider detected.");
            return
          }

          const web3WithUserProvider = new Web3(accountStore.connectedWallet?.provider);
          const contractWithUserProvider = new web3WithUserProvider.eth.Contract(
            this.options.jsonInterface,
            this.options?.address,
          );
          console.warn(
            "User provided provider detected", web3WithUserProvider,
            this.options?.address,
            this.options,
          );

          console.warn("Sending transaction with user provider...");
          return contractWithUserProvider.methods[methodName](...calldataArgs).send({
            from: accountStore.activeAccountAddress,
            gasPrice: "",
            ...options,
          }).on("transactionHash", (hash: any) => promiEvent.emit("transactionHash", hash))
            .on("receipt", (receipt: any) => {
              promiEvent.emit("receipt", receipt);
              resolve(receipt); // Resolve the promise with the receipt
            })
            .on("confirmation", (args) =>
              promiEvent.emit("confirmation", args),
            )
            .on("error", (error) => {
              promiEvent.emit("error", error);
              reject(error); // Reject the promise with the error
            });
        })
        .catch((error: any) => {
          // Emit the network error and reject the promise
          console.log("caught promi event err", error);
          promiEvent.emit("error", error);
          reject(error);
        });
    });

    return promiEvent;
  }

  ensureCorrectNetwork(): any {
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
