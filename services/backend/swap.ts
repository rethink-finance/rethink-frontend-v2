import type { ChainId } from "~/types/enums/chain_id";

/**
 * The backend's 1inch relay (GET /swap/1inch/*). The API key lives there;
 * the browser only ever sees router calldata, which the console then checks
 * against the vault's own permissions before a wallet opens.
 */

export interface OneInchStatus {
  configured: boolean;
  chains: ChainId[];
}

/** One split of one hop of the pathfinder's route. */
export interface OneInchProtocolLeg {
  name: string;
  part: number;
  fromTokenAddress?: string;
  toTokenAddress?: string;
}

export interface OneInchSwapBuild {
  chainId: ChainId;
  src: string;
  dst: string;
  amount: string;
  from: string;
  receiver: string;
  slippage: number;
  /** Expected output in base units of `dst`, before slippage. */
  dstAmount: string;
  tx: {
    to: string;
    data: string;
    value: string;
    gas?: number;
    gasPrice?: string;
  };
  /** hops → splits → legs. */
  protocols?: OneInchProtocolLeg[][][];
  quotedAt: string;
}

export interface OneInchSwapParams {
  chainId: ChainId;
  src: string;
  dst: string;
  /** Base units of `src`. */
  amount: bigint;
  /** The Safe: it sends the router call and, by default, receives the proceeds. */
  from: string;
  receiver?: string;
  /** Percent. */
  slippage: number;
}

export class OneInchBackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OneInchBackendError";
  }

  /** No API key on the backend — the console falls back to pasted calldata. */
  get unconfigured() {
    return this.status === 503;
  }
}

const baseUrl = () => String(useRuntimeConfig().public.BACKEND_URL ?? "");

const readError = async (response: Response): Promise<string> => {
  const body: any = await response.json().catch(() => null);
  if (typeof body?.error === "string") return body.error;
  // Nest's validation pipe answers with a message array.
  if (Array.isArray(body?.message)) return body.message.join("; ");
  if (typeof body?.message === "string") return body.message;
  return `The backend answered ${response.status}.`;
};

export const fetchOneInchStatus = async (): Promise<OneInchStatus> => {
  const response = await fetch(`${baseUrl()}/swap/1inch/status`);
  if (!response.ok) {
    throw new OneInchBackendError(await readError(response), response.status);
  }
  return (await response.json()) as OneInchStatus;
};

export const buildOneInchSwap = async (
  params: OneInchSwapParams,
): Promise<OneInchSwapBuild> => {
  const query = new URLSearchParams({
    chainId: params.chainId,
    src: params.src,
    dst: params.dst,
    amount: params.amount.toString(),
    from: params.from,
    receiver: params.receiver ?? params.from,
    slippage: String(params.slippage),
  });
  const response = await fetch(`${baseUrl()}/swap/1inch/build?${query}`);
  if (!response.ok) {
    throw new OneInchBackendError(await readError(response), response.status);
  }
  return (await response.json()) as OneInchSwapBuild;
};
