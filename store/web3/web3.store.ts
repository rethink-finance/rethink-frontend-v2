import { defineStore } from "pinia";
import { Web3 } from "web3";
import addressesJson from "~/assets/contracts/addresses.json";
import type IAddresses from "~/types/addresses";
import type INetwork from "~/types/network";
import { networksMap } from "~/store/web3/networksMap";
import { GovernableFundFactory } from "assets/contracts/GovernableFundFactory";
import { RethinkReader } from "assets/contracts/RethinkReader";
import { CustomContract } from "~/store/web3/contract";
const addresses: IAddresses = addressesJson as IAddresses;

interface IState {
  web3?: Web3;
  currentRpcIndex: number;
  retryDelay: number;
  chainId: string;
  chainName: string;
  chainShort: string;
  cachedTokens: Record<string, any>;
  // Determines what RPC url is used for each chain.
  chainSelectedRpcUrl: Record<string, string>;
}

const removeDuplicates = (arr: any[]) => {
  const seen = new Set();
  return arr.filter((item) => {
    if (seen.has(item)) {
      return false;
    }
    seen.add(item);
    return true;
  });
};

export const useWeb3Store = defineStore({
  id: "web3store",
  state: (): IState => {
    const chainSelectedRpcUrl: Record<string, string> = {};
    for (const chainId in networksMap) {
      chainSelectedRpcUrl[chainId] = networksMap[chainId]?.rpcUrls[0];
    }

    return {
      web3: undefined,
      currentRpcIndex: -1,
      retryDelay: 1500,
      chainId: "",
      chainName: "",
      chainShort: "",
      chainSelectedRpcUrl,
      cachedTokens: {
        "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063": {
          symbol: "DAI",
          decimals: 18,
        },
        "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": {
          symbol: "USDC",
          decimals: 6,
        },
      },
    };
  },
  getters: {
    networks(): INetwork[] {
      return Object.values(networksMap);
    },
    currentNetworkRPCUrls(): string[] {
      const network = networksMap[this.chainId];
      return removeDuplicates([network.rpcUrl, ...(network.rpcUrls || [])]);
    },
    currentRPC(): string {
      const currentProvider: any = this.web3?.provider;

      // Check if the provider has a 'host' attribute (HTTP Provider)
      if (currentProvider?.clientUrl) {
        return currentProvider.clientUrl;
      }
      return "";
    },
    currentNetwork(): INetwork {
      return networksMap[this.chainId];
    },
    NAVCalculatorBeaconProxyAddress(): string {
      return addresses.NAVCalculatorBeaconProxy[this.chainId];
    },
    NAVExecutorBeaconProxyAddress(): string {
      return addresses.NAVExecutorBeaconProxy[this.chainId];
    },
    providers(): Record<string, Web3> {
      const providersMap: Record<string, Web3> = {};

      // Initialize providers map by iterating over all networks and use the
      // selected chain's RPC url to init the provider.
      for (const chainId in networksMap) {
        providersMap[chainId] = new Web3(this.chainSelectedRpcUrl[chainId]);
      }

      return providersMap;
    },
    contracts(): Record<string, any> {
      const contractsMap: Record<string, any> = {};

      for (const network of this.networks) {
        const chainId = network.chainId;
        const provider = this.providers[chainId];
        if (!provider) continue;

        // Initialize contracts if addresses are available
        contractsMap[chainId] = {
          fundFactoryContract: new CustomContract(
            GovernableFundFactory.abi,
            addresses.GovernableFundFactoryBeaconProxy[chainId],
            network.rpcUrls,
          ),
          rethinkReaderContract: new CustomContract(
            RethinkReader.abi,
            addresses.RethinkReader[chainId],
            network.rpcUrls,
          ),
        };
      }
      return contractsMap;
    },
  },
  actions: {
    /**
     * Fetches specified information (e.g., 'symbol', 'decimals') about a token from a smart contract.
     * If the information is cached, it returns the cached value to avoid unnecessary blockchain calls.
     * Otherwise, it fetches the information using the specified contract method, caches it, and returns it.
     *
     * @param {Object} tokenContract - The web3 contract instance of the token.
     * @param {string} tokenAddress - The address of the token contract.
     * @param {string} infoType - The type of information to fetch from the token contract ('symbol' or 'decimals').
     * @returns {Promise<string|number>} - A promise that resolves with the token information (either a string for the symbol or a number for the decimals).
     */
    async getTokenInfo<T>(
      tokenContract: any,
      infoType: string,
      tokenAddress?: string,
    ): Promise<T | undefined> {
      if (!tokenAddress) return undefined;

      // Check if the cached value already exists.
      if (
        this.cachedTokens[tokenAddress] &&
        this.cachedTokens[tokenAddress][infoType]
      ) {
        return this.cachedTokens[tokenAddress][infoType];
      }

      // It does not exist, fetch it from the contract method.
      const value = await this.callWithRetry(() =>
        tokenContract.methods[infoType]().call(),
      );
      this.cachedTokens[tokenAddress] = this.cachedTokens[tokenAddress] || {};
      this.cachedTokens[tokenAddress][infoType] = value;
      return value;
    },
    async init(chainId?: string, web3Provider?: any): Promise<void> {
      console.log("INIT: ", chainId, web3Provider);
      if (!chainId) {
        // Check if there exists last used chainId in the local storage.
        // It also needs to be a valid chainId.
        const lastUsedChainId = localStorage.getItem("lastUsedChainId");
        if (lastUsedChainId && lastUsedChainId in networksMap) {
          chainId = lastUsedChainId;
        } else {
          // Otherwise, return the default chainId.
          chainId = this.networks[0]?.chainId || "";
        }
      }

      const network: INetwork = networksMap[chainId];
      this.chainName = network.chainName ?? "";
      this.chainShort = network.chainShort ?? "";
      // Lastly set chainId, as we sometimes use watcher on chainId to reload other pages.
      this.chainId = chainId;

      if (web3Provider) {
        console.warn("[INIT] has new web3provider", web3Provider);
        this.web3 = web3Provider;
      } else {
        console.warn("[INIT] NO NEW web3provider");
        // Handle connecting to a working RPC
        this.switchRpcUrl();
        await this.checkConnection();
      }

      localStorage.setItem("lastUsedChainId", chainId.toString());
      console.log(`init web3 chain: ${this.chainId} on ${this.currentRPC}`);
      console.log("----------------\n");
    },
    async checkConnection() {
      return await this.callWithRetry(() => this?.web3?.eth.getBlockNumber());
    },
    async callWithRetry(
      method: () => any,
      maxRetries: number = 1,
      extraIgnorableErrorCodes?: any[],
    ): Promise<any> {
      // TODO: see the TODO below for the possible upgrade of callWithRetry
      const RPCUrlsLength = this.currentNetworkRPCUrls.length;
      let retries = 0;
      let switchedRPCCount = 0;
      // Save chain ID the method was called with. So that we can ignore retries if the chain was changed.
      const methodChainId = toRaw(this.chainId);

      // console.log("callWithRetry");
      if (!method) {
        return method;
      }
      while (retries <= maxRetries && switchedRPCCount <= RPCUrlsLength) {
        if (methodChainId !== toRaw(this.chainId)) {
          throw new Error(
            `Chain changed from ${methodChainId} to ${toRaw(this.chainId)}`,
          );
        }
        try {
          return await method();
        } catch (error: any) {
          const ignorableErrorCodes = [4001];
          // If user passed additional error codes that we don't want to retry, add them to ignorableErrorCodes.
          // For example sometimes we know that method may fail with internal RPC error (-32603) and it's not RPC's
          // fault, and we just want it to fail, instead of endlessly repeating it and switching RPC URL. Can happen
          // when simulating NAV method with wrong parameters.
          if (extraIgnorableErrorCodes?.length) {
            ignorableErrorCodes.push(...extraIgnorableErrorCodes);
          }

          // Get a list of error codes. Use innerError to catch Metamask exception codes.
          const errorCodes = new Set([error?.code, error?.innerError?.code]);

          // Check Metamask errors:
          // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
          // Metamask rejected.
          if (
            ignorableErrorCodes.some((code) => errorCodes.has(code)) ||
            error?.message?.indexOf("User denied transaction") >= 0
          ) {
            console.log(
              "RPC error is one of known metamask errors",
              error?.code,
              error?.message,
            );
            throw error;
          }

          const rpcUrl = (this.web3?.currentProvider as any)?.clientUrl;
          console.error(
            "RPC error:",
            errorCodes,
            error?.message,
            method,
            rpcUrl,
          );
          retries++;
          if (retries > maxRetries) {
            this.switchRpcUrl();
            retries = 0;
            switchedRPCCount++;
          }
          await this.delay(this.retryDelay);
        }
      }
      throw new Error("Max retries reached for all RPC URLs");
    },
    switchRpcUrl(): void {
      if (!this.chainId) return;
      const rpcUrls = this.currentNetworkRPCUrls;
      this.currentRpcIndex = (this.currentRpcIndex + 1) % rpcUrls.length;
      const newRpcUrl = rpcUrls[this.currentRpcIndex];
      console.log(`Switching to RPC URL: ${newRpcUrl}`, this.currentRpcIndex);
      console.log(this.web3);
      if (!this.web3) {
        this.web3 = new Web3(newRpcUrl);
      } else {
        console.log("set new provider to RPC url", newRpcUrl);
        this.web3?.setProvider(new Web3.providers.HttpProvider(newRpcUrl));
      }
    },
    delay(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
  },
});

/**
 * Possible upgrade of callWithRetry would be creating a custom provider, so there will be no need to call any other
 * method such as callWithRetry, but it can be used as is and internal logic of switching RPCs can be done inside
 * this custom provider.
 * Small Problem: if we are using already initialized provider passed from Metamask or something, we have to get the
 * url from it and maybe some other settings also?
 * TODO: pass chainId also to the provider
 * TODO: override call method also
 *
 * Example:
 *
 * class CustomWeb3Provider extends Web3.providers.HttpProvider {
 *   constructor(url, options = { suppressErrors: false, maxRetries: 3, fallbackNode: null }) {
 *     super(url);  // Call the parent constructor (HttpProvider)
 *     this.options = options;  // Store custom options
 *     this.retryCount = 0;     // Initialize retry counter
 *   }
 *
 *   // Override the send() method to add custom logic
 *   send(payload, callback) {
 *     const handleSend = (retryCount = 0) => {
 *       super.send(payload, (error, result) => {
 *         if (error) {
 *           // Handle retries if maxRetries is set
 *           if (retryCount < this.options.maxRetries) {
 *             console.warn(`Retrying... (${retryCount + 1}/${this.options.maxRetries})`);
 *             return handleSend(retryCount + 1); // Retry transaction
 *           }
 *
 *           // Handle fallback node if provided and retries exhausted
 *           if (this.options.fallbackNode && retryCount >= this.options.maxRetries) {
 *             console.warn('Switching to fallback node:', this.options.fallbackNode);
 *             this.setProvider(new Web3.providers.HttpProvider(this.options.fallbackNode));  // Switch to fallback node
 *             return handleSend(0);  // Reset retry counter and try again
 *           }
 *
 *           // Error suppression logic
 *           if (this.options.suppressErrors) {
 *             console.warn('Error suppressed:', error.message);  // Log as warning, suppress console.error
 *             callback(null, null);  // Suppress the error in the callback
 *           } else {
 *             callback(error, null);  // Return the error if not suppressed
 *           }
 *         } else {
 *           callback(null, result);  // Pass result if no error
 *         }
 *       });
 *     };
 *
 *     handleSend();  // Initiate the send process with retry logic
 *   }
 * }
 */
