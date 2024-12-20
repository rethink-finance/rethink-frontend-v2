import { defineStore } from "pinia";
import { type HttpProvider, Web3 } from "web3";
import addressesJson from "~/assets/contracts/addresses.json";
import type IAddresses from "~/types/addresses";
import type { IContractAddresses } from "~/types/addresses";
import type INetwork from "~/types/network";
import { networksMap } from "~/store/web3/networksMap";
import { GovernableFundFactory } from "assets/contracts/GovernableFundFactory";
import { RethinkReader } from "assets/contracts/RethinkReader";
import { CustomContract } from "~/store/web3/customContract";
import { NAVCalculator } from "assets/contracts/NAVCalculator";
import SafeMultiSendCallOnlyJson from "assets/contracts/safe/SafeMultiSendCallOnly.json";
const addresses: IAddresses = addressesJson as IAddresses;
const SafeMultiSendCallOnlyAddresses: IContractAddresses =
  SafeMultiSendCallOnlyJson.networkAddresses as IContractAddresses;

interface IState {
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
  actions: {
    NAVExecutorBeaconProxyAddress(chainId: string): string {
      return addresses.NAVExecutorBeaconProxy[chainId];
    },
    safeMultiSendCallOnlyToAddress(chainId: string): string {
      return SafeMultiSendCallOnlyAddresses[
        parseInt(chainId).toString()
      ];
    },
    networkRpcUrls(chainId: string): string[] {
      const network = networksMap[chainId];
      return removeDuplicates(network.rpcUrls || []);
    },
    getCustomContract(
      chainId: string,
      abi: any,
      address: string,
    ): CustomContract {
      // TODO modify this function to just return normal contract, CustomContract has no effect.
      return new CustomContract(abi, address, chainId, this.chainProviders[chainId].provider as HttpProvider);
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

      // console.log("callWithRetry");
      if (!method) return;

      while (retries <= maxRetries && switchedRPCCount <= RPCUrlsLength) {
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

          const rpcUrl = (this.chainProviders[chainId].currentProvider as any)?.clientUrl;
          console.error(
            `RPC error ${retries}/${maxRetries}`,
            errorCodes,
            error?.message,
            "method:",
            method,
            `rpcUrl: ${rpcUrl}`,
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
      console.log(`Switching to RPC URL: ${chainId}: ${newRpcUrl}`, this.chainSelectedRpcIndex[chainId]);

      const chainProvider = this.chainProviders[chainId];

      if (!chainProvider) {
        this.chainProviders[chainId] = new Web3(newRpcUrl);
      } else {
        console.log("set new provider on chain", chainId, " to RPC url", newRpcUrl);
        chainProvider.setProvider(new Web3.providers.HttpProvider(newRpcUrl));
      }
    },
    delay(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
  },
});

