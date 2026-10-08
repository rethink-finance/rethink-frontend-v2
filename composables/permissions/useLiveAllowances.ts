import { reactive, ref, watch } from "vue";
import type { IRolesAllowance } from "~/composables/permissions/roleScopeLogs";
import { fetchRolesAllowance } from "~/composables/permissions/useRoleExecution";
import type { ChainId } from "~/types/enums/chain_id";

export interface ILiveAllowancesSource {
  chainId: ChainId;
  rolesModAddress: string;
  /** The allowance keys to read, lowercase bytes32. */
  keys: string[];
  /**
   * The modifier's log as last read. A new read (a Refresh included) reads
   * the balances again: they move with every use, and the log does not say
   * where they stand.
   */
  logs: unknown;
}

/**
 * The allowances a Roles V2 modifier stores, read live: one eth_call per key
 * when the vault, the set of keys or the log read changes, and never because
 * a balance it wrote changed. Each value is undefined while it is being read
 * and null when the read failed.
 */
export const useLiveAllowances = (source: () => ILiveAllowancesSource) => {
  // Keyed by modifier and allowance, so another vault's read never shows.
  const live = reactive<Record<string, IRolesAllowance | null>>({});
  const liveKey = (modifier: string, key: string) => `${modifier.toLowerCase()}:${key}`;

  const logsRead = ref(0);
  watch(
    () => source().logs,
    () => logsRead.value++,
  );

  // Only the newest pass may write: a slow read must not overwrite a newer one.
  let pass = 0;
  watch(
    // A string, so that writing a balance (which readers of `live` depend
    // on) never counts as a change and starts another pass.
    () => {
      const { chainId, rolesModAddress, keys } = source();
      return `${chainId}|${rolesModAddress}|${keys.join()}|${logsRead.value}`;
    },
    async () => {
      const current = ++pass;
      const { chainId, rolesModAddress, keys } = source();
      if (!chainId || !rolesModAddress) return;
      for (const key of [...keys]) {
        let value: IRolesAllowance | null;
        try {
          value = await fetchRolesAllowance(chainId, rolesModAddress, key);
        } catch (error) {
          console.warn(`Could not read allowance ${key}`, error);
          value = null;
        }
        if (current !== pass) return;
        live[liveKey(rolesModAddress, key)] = value;
      }
    },
    { immediate: true },
  );

  return {
    liveAllowance: (key: string): IRolesAllowance | null | undefined =>
      live[liveKey(source().rolesModAddress, key)],
  };
};
