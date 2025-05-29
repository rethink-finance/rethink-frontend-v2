import { ethers } from "ethers";
import memoize from "lodash.memoize";
import { Explorer } from "~/services/explorer";
import { networksMap } from "~/store/web3/networksMap";
import { ChainId } from "~/types/enums/chain_id";
import type { ExplorerConfig } from "~/types/explorer";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();

  const ETHERSCAN_KEY = config.public.ETHERSCAN_KEY as string;
  const POLYGONSCAN_KEY = config.public.POLYGONSCAN_KEY as string;
  const ARBISCAN_KEY = config.public.ARBISCAN_KEY as string;
  const BASESCAN_KEY = config.public.BASESCAN_KEY as string;

  if (!ETHERSCAN_KEY) throw new Error("ETHERSCAN_KEY env is not set");
  if (!POLYGONSCAN_KEY) throw new Error("POLYGONSCAN_KEY env is not set");
  if (!ARBISCAN_KEY) throw new Error("ARBISCAN_KEY env is not set");
  if (!BASESCAN_KEY) throw new Error("BASESCAN_KEY env is not set");

  const explorerConfig: Record<ChainId, ExplorerConfig> = {
    [ChainId.POLYGON]: {
      apiUrl: "https://api.polygonscan.com/api",
      apiKey: POLYGONSCAN_KEY,
    },
    [ChainId.ARBITRUM]: {
      apiUrl: "https://api.arbiscan.io/api",
      apiKey: ARBISCAN_KEY,
    },
    [ChainId.ETHEREUM]: {
      apiUrl: "https://api.etherscan.io/api",
      apiKey: ETHERSCAN_KEY,
    },
    [ChainId.BASE]: {
      apiUrl: "https://api.basescan.org/api",
      apiKey: BASESCAN_KEY,
    },
    [ChainId.HYPEREVM]: {
      apiUrl: "https://api.purrsec.com/api",
      apiKey: BASESCAN_KEY,
    },
  }

  const getExplorer = memoize((chainId: ChainId) => {
    const config = explorerConfig[chainId]
    const rpcUrl = networksMap[chainId]?.rpcUrls[0];
    const provider = new ethers.JsonRpcProvider(
      rpcUrl,
      undefined,
      { staticNetwork: ethers.Network.from(parseInt(chainId, 16)) },
    );
    return new Explorer(config, provider)
  })

  return {
    provide: {
      getExplorer,
    },
  };
});
