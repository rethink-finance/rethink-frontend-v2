import type { ITokenTransfer, ITransaction } from "~/types/ethereum";
import type { Explorer } from "~/services/explorer";
import type { ChainId } from "~/types/enums/chain_id";

export function useExplorerTransactionsFetcher() {
  const loading = ref(false);
  const error = ref<string>("");

  const fetchTransactions = async (
    chainId: ChainId,
    walletAddress: string,
    startBlock: number,
    endBlock: number,
  ): Promise<ITransaction[]> => {

    if (!walletAddress) {
      throw new Error("missing-address");
    }
    if (startBlock == null) {
      throw new Error("missing-block");
    }

    const { $getExplorer } = useNuxtApp();
    let explorer: Explorer;
    try {
      explorer = $getExplorer(chainId);
    } catch (error: any) {
      return [];
    }
    error.value = "";
    loading.value = true;

    try {
      return await explorer.fetchWalletTransactions(walletAddress, startBlock, endBlock);
    } catch (err: any) {
      error.value = err.message || "Failed to fetch transactions";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchTokenTransfers = async (
    chainId: ChainId,
    walletAddress: string,
    startBlock: number,
    endBlock: number,
  ): Promise<ITokenTransfer[]> => {

    if (!walletAddress) {
      throw new Error("missing-address");
    }
    if (startBlock == null) {
      throw new Error("missing-block");
    }
    const { $getExplorer } = useNuxtApp();
    let explorer: Explorer;
    try {
      explorer = $getExplorer(chainId);
    } catch (error: any) {
      return [];
    }
    error.value = "";
    loading.value = true;

    try {
      return await explorer.fetchWalletTokenTransfers(walletAddress, startBlock, endBlock);
    } catch (err: any) {
      error.value = err.message || "Failed to fetch token transfers";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    fetchTransactions,
    fetchTokenTransfers,
  };
}
