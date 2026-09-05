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
  const TRY_ETHERNAL_KEY = config.public.TRY_ETHERNAL_KEY as string;

  if (!ETHERSCAN_KEY) throw new Error("ETHERSCAN_KEY env is not set");

  // Etherscan retired the per-chain v1 hosts (api.arbiscan.io/api and the
  // like answer every call with a "deprecated V1 endpoint" error). The v2
  // API serves all of them from one host under one key, selected by
  // `chainid`. The old per-chain keys are read but no longer required.
  void POLYGONSCAN_KEY;
  void ARBISCAN_KEY;
  const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api";
  const etherscanV2 = (chainId: ChainId): ExplorerConfig => ({
    apiUrl: ETHERSCAN_V2_API,
    apiKey: ETHERSCAN_KEY,
    chainId: parseInt(chainId, 16),
  });

  const explorerConfig: Record<ChainId, ExplorerConfig> = {
    [ChainId.POLYGON]: etherscanV2(ChainId.POLYGON),
    [ChainId.ARBITRUM]: etherscanV2(ChainId.ARBITRUM),
    [ChainId.ETHEREUM]: etherscanV2(ChainId.ETHEREUM),
    [ChainId.BASE]: etherscanV2(ChainId.BASE),
    [ChainId.HYPEREVM]: {
      apiUrl: "https://api.purrsec.com/api",
      apiKey: BASESCAN_KEY
    },
    [ChainId.LOCAL_NODE]: {
      apiUrl: "https://api.tryethernal.com",
      apiKey: TRY_ETHERNAL_KEY,
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
