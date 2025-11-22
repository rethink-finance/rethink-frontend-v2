import { defineStore } from "pinia";
import { type HttpProvider, Web3 } from "web3";
import { GovernableFundFactory } from "assets/contracts/GovernableFundFactory";
import { NAVCalculator } from "assets/contracts/NAVCalculator";
import { useContractAddresses } from "~/composables/useContractAddresses";
import { RethinkReader } from "assets/contracts/RethinkReader";
import SafeMultiSendCallOnlyJson from "assets/contracts/safe/SafeMultiSendCallOnly.json";
import { CustomContract } from "~/store/web3/customContract";
import { networksMap } from "~/store/web3/networksMap";
import { type ChainId, ChainId as ChainIdValue } from "~/types/enums/chain_id";
const SafeMultiSendCallOnlyAddresses: Partial<Record<string, string>> = SafeMultiSendCallOnlyJson.networkAddresses;


const L2_TO_L1_CHAIN_ID_MAP = {
  // Arbitrum uses L1 ETH as block time.
  [ChainIdValue.ARBITRUM]: ChainIdValue.ETHEREUM,
} as const;

interface IState {
  currentRpcIndex: number;
  retryDelay: number;
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
    const chainSelectedRpcUrl: Partial<Record<ChainId, string>> = {};
    const chainSelectedRpcIndex: Record<string, number> = {};
    const chainProviders: Record<string, Web3> = {};
    const chainContracts: Record<string, any> = {};
    const { rethinkContractAddresses } = useContractAddresses();

    for (const network of Object.values(networksMap)) {
      const chainId = network.chainId as ChainId;
      const rpcUrl = networksMap[chainId]?.rpcUrls[0];
      if (!rpcUrl) {
        console.error("No RPC url for chainId", chainId);
      }
      chainSelectedRpcUrl[chainId] = rpcUrl || "";
      chainSelectedRpcIndex[chainId] = 0;
      // Initialize providers map by iterating over all networks and use the
      // selected chain's RPC url to init the provider.
      const provider = new Web3(chainSelectedRpcUrl[chainId]);
      chainProviders[chainId] = provider;
      const fundFactoryContractV2Address = rethinkContractAddresses["GovernableFundFactoryV1.5BeaconProxy"][chainId];

      // Initialize contracts if addresses are available
      chainContracts[chainId] = {
        fundFactoryContract: new CustomContract(
          GovernableFundFactory.abi,
          rethinkContractAddresses.GovernableFundFactoryBeaconProxy[chainId],
          chainId,
          chainProviders[chainId].provider as HttpProvider,
        ),
        fundFactoryContractV2: fundFactoryContractV2Address ? new CustomContract(
          GovernableFundFactory.abi,
          rethinkContractAddresses["GovernableFundFactoryV1.5BeaconProxy"][chainId],
          chainId,
          chainProviders[chainId].provider as HttpProvider,
        ) : null,
        rethinkReaderContract: new provider.eth.Contract(
          RethinkReader.abi,
          rethinkContractAddresses.RethinkReader[chainId],
        ),
        navCalculatorContract: new provider.eth.Contract(
          NAVCalculator.abi,
          rethinkContractAddresses.NAVCalculatorBeaconProxy[chainId],
        ),
      };
    }
    return {
      currentRpcIndex: -1,
      retryDelay: 1500,
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
    safeMultiSendCallOnlyToAddress(chainId: ChainId): string {
      return SafeMultiSendCallOnlyAddresses[
        parseInt(chainId).toString()
      ] || "";
    },
    networkRpcUrls(chainId: ChainId): string[] {
      const network = networksMap[chainId];
      return removeDuplicates(network.rpcUrls || []);
    },
    getCustomContract(
      chainId: ChainId,
      abi: any,
      address: string,
    ): CustomContract {
      // TODO modify this function to just return normal contract, CustomContract has no effect.
      return new CustomContract(abi, address, chainId, this.chainProviders[chainId].provider as HttpProvider);
    },
    async callWithRetry(
      chainId: ChainId,
      method: () => any,
      maxRetries: number = 1,
      extraIgnorableErrorCodes?: any[],
      timeoutMs: number = 4000,
    ): Promise<any> {
      // TODO: see the TODO below for the possible upgrade of callWithRetry
      const RPCUrlsLength = this.networkRpcUrls(chainId).length;
      let retries = 0;
      let switchedRPCCount = 0;
      if (!method) return;

      while (retries <= maxRetries && switchedRPCCount <= RPCUrlsLength) {
        try {
          // Call the method, but also do a timeout promise of 1.5 seconds.
          return await Promise.race([
            method(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Method call timed out after ${timeoutMs}ms`)), timeoutMs),
            ),
          ]);
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
          let errorData = error?.message;
          try {
            // https://docs.web3js.org/api/web3-errors/class/InternalError
            errorData = error.toJSON();
          } catch {}

          // Check Metamask errors:
          // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
          // Metamask rejected.
          if (
            ignorableErrorCodes.some((code) => errorCodes.has(code)) ||
            error?.message?.indexOf("User denied transaction") >= 0
          ) {
            console.debug(
              "RPC error is one of known metamask errors",
              error?.code,
              errorData,
            );
            throw error;
          }

          const rpcUrl = (this.chainProviders[chainId].currentProvider as any)?.clientUrl;
          console.error(
            `RPC error ${retries}/${maxRetries}`,
            errorCodes,
            "method:",
            method,
            errorData,
            "data:",
            error.data,
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
    switchRpcUrl(chainId: ChainId): void {
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

      // Also update the provider for all contracts
      Object.values(this.chainContracts[chainId]).forEach((contract: any) => {
        if (contract?.setProvider) {
          contract.setProvider(new Web3.providers.HttpProvider(newRpcUrl));
        }
      });
    },
    delay(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    getL2ToL1ChainId(chainId: ChainId): ChainId {
      return L2_TO_L1_CHAIN_ID_MAP[chainId as keyof typeof L2_TO_L1_CHAIN_ID_MAP] || chainId;
    },
    getWeb3Instance(chainId: ChainId, convertToL1 = true): Web3 {

      if (convertToL1) {
        const mappedChainId = this.getL2ToL1ChainId(chainId);
        return this.chainProviders[mappedChainId];
      }

      return this.chainProviders[chainId];
    },
  },
});
