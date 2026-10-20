import { VENTURE_STAKING_VAULT } from "./ventureStakingConfig";
import { useWeb3Store } from "~/store/web3/web3.store";

/**
 * ETH currently staked in the venture staking vault. Stays 0 when the vault
 * is not deployed yet or the read fails, which the calculator treats as
 * pre-launch.
 */
export const useVenturePool = () => {
  const web3Store = useWeb3Store();
  const livePoolEth = ref(0);
  const isLoading = ref(false);

  const load = async () => {
    // TODO: VENTURE_STAKING_VAULT.address is empty until the vault is deployed.
    if (!VENTURE_STAKING_VAULT.address) return;
    isLoading.value = true;
    try {
      const vault = web3Store.getCustomContract(
        VENTURE_STAKING_VAULT.chainId,
        VENTURE_STAKING_VAULT.abi,
        VENTURE_STAKING_VAULT.address,
      );
      const wei = await web3Store.callWithRetry(VENTURE_STAKING_VAULT.chainId, () =>
        vault.methods[VENTURE_STAKING_VAULT.method]().call(),
      );
      livePoolEth.value = Number(BigInt(wei ?? 0)) / 10 ** VENTURE_STAKING_VAULT.decimals;
    } catch (error) {
      console.error("Failed reading the venture staking pool", error);
      livePoolEth.value = 0;
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(load);

  return { livePoolEth, isLoading, reload: load };
};
