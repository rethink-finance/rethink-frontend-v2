import type { TransactionReceipt } from "viem";
import { Contract, Web3, Web3PromiEvent, type HttpProvider } from "web3";
import {
  clearWalletRpcHint,
  reportWalletSendFailure,
} from "~/composables/web3/walletSendFailure";
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
      // Whether the app's own RPC estimated this call. A failure after that
      // cannot be a revert, which is what lets the wallet's RPC be blamed.
      let appRpcOk = false;
      const reportFailure = (error: any) =>
        reportWalletSendFailure(error, {
          chainId: this.initialChainId,
          appRpcOk,
          walletLabel: accountStore.connectedWallet?.label,
        });

      // Ensure the network is correct before proceeding
      this.ensureCorrectNetwork()
        .then(() => this.withGasLimit(methodName, options, calldataArgs))
        .then(({ sendOptions, estimated }: { sendOptions: any; estimated: boolean }) => {
          appRpcOk = estimated;
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

          console.warn("Sending transaction with user provider from: ", accountStore.activeAccountAddress);
          // TODO previously we used gasPrice: ""
          // let's se if it works without gasPrice: ""
          // has to test with multiple people first, remove the gasPrice and uncomment ignoreGasPricing = true
          contractWithUserProvider.config.ignoreGasPricing = true;
          return contractWithUserProvider.methods[methodName](...calldataArgs).send({
            from: accountStore.activeAccountAddress,
            ...sendOptions,
          }).on("transactionHash", (hash: any) => {
            // The wallet reached its node, so any standing RPC hint is stale.
            clearWalletRpcHint();
            promiEvent.emit("transactionHash", hash);
          })
            .on("receipt", (receipt: any) => {
              promiEvent.emit("receipt", receipt);
              resolve(receipt); // Resolve the promise with the receipt
            })
            // No "confirmation" forwarding: nothing in the app listens for
            // confirmations, and in web3 v4 merely registering the listener
            // starts a block-poll (eth_getBlockByNumber) through the WALLET's
            // RPC after every receipt — which drains rate-limited endpoints
            // and, when the endpoint refuses, fires a bogus "error" event on
            // a transaction that already succeeded.
            .on("error", (error) => {
              reportFailure(error);
              promiEvent.emit("error", error);
              reject(error); // Reject the promise with the error
            });
        })
        .catch((error: any) => {
          // web3 v4 rejects a declined or failed send without emitting
          // "error", so this is where most wallet failures land. The page's
          // own handler still speaks; this only adds the RPC hint when the
          // failure was the wallet's node.
          console.log("caught promi event err", error);
          reportFailure(error);
          promiEvent.emit("error", error);
          reject(error);
        });
    });

    return promiEvent;
  }

  /**
   * Fill in a gas limit when the caller didn't give one. Left to the wallet,
   * the limit is whatever the wallet decides: on HyperEVM a vault
   * initCreateFund needing ~4.9M gas was sent with a flat 1M and reverted out
   * of gas, though every RPC we list estimated it correctly. So estimate on
   * the app's own RPC (this contract's provider) and add a 20% buffer. If the
   * estimate fails, fall back to letting the wallet estimate as before.
   *
   * `estimated` says whether the app's RPC actually ran the call: a later
   * failure on the wallet side is then known not to be a revert.
   */
  async withGasLimit(
    methodName: string,
    options: any,
    calldataArgs: any[],
  ): Promise<{ sendOptions: any; estimated: boolean }> {
    if (options?.gas != null || options?.gasLimit != null) {
      return { sendOptions: options, estimated: false };
    }

    const accountStore = useAccountStore();
    try {
      const estimate = await this.methods[methodName](...calldataArgs).estimateGas({
        from: accountStore.activeAccountAddress,
        ...options,
      });
      return {
        sendOptions: { ...options, gas: (BigInt(estimate) * 120n) / 100n },
        estimated: true,
      };
    } catch (error: any) {
      console.warn(`Gas estimate for ${methodName} failed, leaving it to the wallet`, error);
      return { sendOptions: options, estimated: false };
    }
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
