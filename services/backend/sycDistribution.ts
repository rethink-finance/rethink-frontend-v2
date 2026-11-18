/**
 * The backend's SYC distribution: what each sniETH depositor is owed and what
 * to mint now, recomputed once a day. Returned as text because the
 * console validates it exactly as it would a file (parseDistribution) before
 * anything is built from it.
 */
const baseUrl = () => String(useRuntimeConfig().public.BACKEND_URL ?? "");

export type SycDistributionFetch =
  | { ok: true; text: string }
  /** 503 while the backend is still on its first pass; anything else is an outage. */
  | { ok: false; warming: boolean };

export const fetchSycDistribution = async (): Promise<SycDistributionFetch> => {
  try {
    const response = await fetch(`${baseUrl()}/syc-distribution/latest`);
    if (!response.ok) return { ok: false, warming: response.status === 503 };
    return { ok: true, text: await response.text() };
  } catch (error) {
    console.warn("[BACKEND] SYC distribution unavailable:", error);
    return { ok: false, warming: false };
  }
};
