import { defineStore } from "pinia";
import { Web3 } from "web3";
import type { ContractAbi } from "web3-types";
import addressesJson from "~/assets/contracts/addresses.json";
import type IAddresses from "~/types/addresses";
import type { IContractAddresses } from "~/types/addresses";
import type INetwork from "~/types/network";
import { networksMap } from "~/store/web3/networksMap";
import { GovernableFundFactory } from "assets/contracts/GovernableFundFactory";
import { RethinkReader } from "assets/contracts/RethinkReader";
import { CustomContract } from "~/store/web3/contract";
import { NAVCalculator } from "assets/contracts/NAVCalculator";
import SafeMultiSendCallOnlyJson from "assets/contracts/safe/SafeMultiSendCallOnly.json";
const addresses: IAddresses = addressesJson as IAddresses;
const SafeMultiSendCallOnlyAddresses: IContractAddresses =
  SafeMultiSendCallOnlyJson.networkAddresses as IContractAddresses;

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
  chainSelectedRpcIndex: Record<string, number>;
  chainProviders: Record<string, Web3>;
  chainContracts: Record<string, any>;
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
    const chainSelectedRpcIndex: Record<string, number> = {};
    const chainProviders: Record<string, Web3> = {};
    const chainContracts: Record<string, any> = {};

    for (const network of Object.values(networksMap)) {
      const chainId = network.chainId;
      chainSelectedRpcUrl[chainId] = networksMap[chainId]?.rpcUrls[0];
      chainSelectedRpcIndex[chainId] = 0;
      // Initialize providers map by iterating over all networks and use the
      // selected chain's RPC url to init the provider.
      const provider = new Web3(chainSelectedRpcUrl[chainId]);
      chainProviders[chainId] = provider;

      // Initialize contracts if addresses are available
      chainContracts[chainId] = {
        fundFactoryContract: new provider.eth.Contract(
          GovernableFundFactory.abi,
          addresses.GovernableFundFactoryBeaconProxy[chainId],
        ),
        rethinkReaderContract: new provider.eth.Contract(
          RethinkReader.abi,
          addresses.RethinkReader[chainId],
        ),
        navCalculatorContract: new provider.eth.Contract(
          NAVCalculator.abi,
          addresses.NAVCalculatorBeaconProxy[chainId],
        ),
      };
    }
    return {
      web3: undefined,
      currentRpcIndex: -1,
      retryDelay: 1500,
      chainId: "",
      chainName: "",
      chainShort: "",
      chainProviders,
      chainContracts,
      chainSelectedRpcUrl,
      chainSelectedRpcIndex,
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
    NAVExecutorBeaconProxyAddress(): string {
      return addresses.NAVExecutorBeaconProxy[this.chainId];
    },
  },
  actions: {
    safeMultiSendCallOnlyToAddress(chainId: string): string {
      return SafeMultiSendCallOnlyAddresses[
        parseInt(chainId).toString()
      ];
    },
    networkRpcUrls(chainId: string): string[] {
      const network = networksMap[chainId];
      return removeDuplicates([network.rpcUrl, ...(network.rpcUrls || [])]);
    },
    getCustomContract(
      chainId: string,
      abi: any,
      address: string,
    ): CustomContract<ContractAbi> {
      const rpcUrls = this.networkRpcUrls(chainId);
      return new CustomContract(abi, address, rpcUrls);
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
        this.switchRpcUrl(chainId);
        await this.checkConnection(chainId);
      }

      localStorage.setItem("lastUsedChainId", chainId.toString());
      console.log(`init web3 chain: ${this.chainId} on ${this.currentRPC}`);
      console.log("----------------\n");
    },
    async checkConnection(chainId: string) {
      const web3Provider = this.chainProviders[chainId];
      return await this.callWithRetry(
        chainId,
        () => web3Provider?.eth.getBlockNumber(),
      );
    },
    async callWithRetry(
      chainId: string,
      method: () => any,
      maxRetries: number = 1,
      extraIgnorableErrorCodes?: any[],
    ): Promise<any> {
      // TODO: see the TODO below for the possible upgrade of callWithRetry
      const RPCUrlsLength = this.networkRpcUrls(chainId).length;
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

          const rpcUrl = (this.chainProviders[chainId] as any)?.clientUrl;
          console.error(
            "RPC error:",
            errorCodes,
            error?.message,
            method,
            rpcUrl,
          );
          retries++;
          if (retries > maxRetries) {
            this.switchRpcUrl(chainId);
            retries = 0;
            switchedRPCCount++;
          }
          await this.delay(this.retryDelay);
        }
      }
      throw new Error("Max retries reached for all RPC URLs");
    },
    switchRpcUrl(chainId: string): void {
      if (!chainId) return;
      const rpcUrls = this.networkRpcUrls(chainId);
      this.chainSelectedRpcIndex[chainId] = (this.chainSelectedRpcIndex[chainId] + 1) % rpcUrls.length;
      const newRpcUrl = rpcUrls[this.chainSelectedRpcIndex[chainId]];
      console.log(`Switching to RPC URL: ${newRpcUrl}`, this.chainSelectedRpcIndex[chainId]);

      const chainProvider = this.chainProviders[chainId];

      if (!chainProvider) {
        this.web3 = new Web3(newRpcUrl);
      } else {
        console.log("set new provider on chain", chainId, " to RPC url", newRpcUrl);
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
