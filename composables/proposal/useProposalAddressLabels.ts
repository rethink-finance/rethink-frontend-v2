import { useFundStore } from "~/store/fund/fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useContractAddresses } from "~/composables/useContractAddresses";
import { getRegistryProtocols } from "~/composables/permissions/protocolPermissions";

/**
 * Names for the addresses a proposal touches, so the page can say "the
 * vault's Safe" instead of printing forty hex characters.
 *
 * Rethink's own contracts and the vault's tokens are named synchronously from
 * the store; anything else is looked up on the block explorer once `resolve`
 * is asked for it, and the label lands in the reactive map when it arrives.
 */
export const useProposalAddressLabels = () => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();
  const { rethinkContractAddresses } = useContractAddresses();

  const explorerLabels = reactive<Record<string, string>>({});

  // The protocols the permissions registry describes for this chain, with
  // every contract and token it names — Aave's pool, a Morpho vault, the
  // reserves' tokens. Cheaper and more precise than an explorer's
  // ContractName, and it works offline.
  const registryLabels = computed((): Record<string, string> => {
    const chainId = fundStore.selectedFundChain;
    if (!chainId) return {};
    try {
      const labels: Record<string, string> = {};
      for (const protocol of getRegistryProtocols(chainId)) {
        Object.assign(labels, protocol.addressLabels);
      }
      return labels;
    } catch {
      return {};
    }
  });
  const requested = new Set<string>();
  const roleModAddress = ref<string>("");

  const fetchRoleMod = async () => {
    const fundAddress = fundStore.fund?.address;
    if (!fundAddress) return;
    try {
      roleModAddress.value = (await fundStore.fetchRoleModAddress(fundAddress)) ?? "";
    } catch {
      roleModAddress.value = "";
    }
  };
  watch(() => fundStore.fund?.address, fetchRoleMod, { immediate: true });

  const knownLabel = (address: string): string | undefined => {
    const fund = fundStore.fund;
    const chainId = fundStore.selectedFundChain;
    const a = address.toLowerCase();
    const is = (other?: string) => !!other && other.toLowerCase() === a;

    if (is(fund?.address)) return fund?.title ? `${fund.title} vault` : "This vault";
    if (is(fund?.safeAddress)) return "Vault Safe";
    if (is(fund?.governorAddress)) return "Vault governor";
    if (is(roleModAddress.value)) return "Roles modifier";
    if (is(fund?.baseToken?.address)) return `${fund?.baseToken.symbol} (denomination asset)`;
    if (is(fund?.governanceToken?.address)) return `${fund?.governanceToken.symbol} (governance token)`;
    if (is(fund?.fundToken?.address)) return `${fund?.fundToken.symbol} (vault token)`;
    if (chainId) {
      if (is(rethinkContractAddresses.NAVExecutorBeaconProxy?.[chainId])) return "NAV executor";
      if (is(rethinkContractAddresses.NAVCalculatorBeaconProxy?.[chainId])) return "NAV calculator";
      if (is(web3Store.safeMultiSendCallOnlyToAddress(chainId))) return "Safe MultiSend";
    }
    return undefined;
  };

  /** Ask the explorer about addresses the store cannot name. */
  const resolve = (addresses: (string | undefined)[]) => {
    const chainId = fundStore.selectedFundChain;
    if (!chainId) return;
    addresses.forEach((address) => {
      if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return;
      const key = address.toLowerCase();
      if (requested.has(key) || knownLabel(address) || registryLabels.value[key]) return;
      requested.add(key);
      fundStore
        .getAddressLabel(address, chainId)
        .then((label) => {
          if (label) explorerLabels[key] = label;
        })
        .catch(() => undefined);
    });
  };

  const labelFor = (address?: string): string | undefined => {
    if (!address) return undefined;
    const key = address.toLowerCase();
    return knownLabel(address) ?? registryLabels.value[key] ?? explorerLabels[key];
  };

  return { labelFor, resolve, roleModAddress };
};

export type ProposalAddressLabels = ReturnType<typeof useProposalAddressLabels>;
