import { useActionState } from "~/store/actionState.store";

export interface TotalTVLResponse {
  totalTvl: string;
  totalTvlFormatted: string;
  calculatedAt: string;
  fundCount: number;
  totalTvlUSD: string;
  totalTvlUSDFormatted: string;
}

/**
 * Fetches the total TVL data from the backend
 * @returns The total TVL data
 */
export function fetchTotalTVLAction(): Promise<TotalTVLResponse | null> {
  return useActionState("fetchTotalTVLAction", () => fetchTotalTVL());
}

export async function fetchTotalTVL(): Promise<TotalTVLResponse | null> {
  const config = useRuntimeConfig();

  try {
    const response = await fetch(
      `${config.public.BACKEND_URL}/nav/total-tvl`,
    );

    if (!response.ok) {
      console.error("Failed to fetch total TVL:", response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching total TVL:", error);
    return null;
  }
}
