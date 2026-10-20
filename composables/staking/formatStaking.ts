/** Number formats shared by the staking page's cards. */

export const DASH = "–";

export const formatInt = (value: number) => Math.round(value).toLocaleString("en-US");

/** $15,075 below a million, $1.23M above. */
export const formatUsd = (value: number) =>
  value >= 1e6 ? `$${(value / 1e6).toFixed(2)}M` : `$${formatInt(value)}`;

export const formatCompact = (value: number, digits = 1) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: digits }).format(value);

export const formatAmount = (value: number, decimals = 3) =>
  value.toLocaleString("en-US", { maximumFractionDigits: decimals });

/** 0.035 -> "3.5%", without the float tail that `* 100` leaves. */
export const formatRate = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;

/** $3.72M, $6M, $310K: for tier sizes and progress where cents are noise. */
export const formatUsdCompact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
