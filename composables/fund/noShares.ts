/**
 * A vault between its first NAV update and its first mint has a NAV but no
 * shares, so it has no share price and no return. The backend has been dividing
 * by that empty supply anyway, storing a share price of 0 and a cumulative
 * return of -100% (the SNI Yield Claim Vault showed exactly that after it was
 * finalized). Those figures are dropped here rather than shown.
 *
 * A vault priced against a stand-in supply (see the backend's synthetic-supply
 * map) reports a real supply of 0 too, but a share price above 0: it keeps both.
 */

/** True only for a supply known to be zero; unknown is not zero. */
export const isZeroSupply = (totalSupply?: bigint | string | number | null): boolean => {
  if (totalSupply === undefined || totalSupply === null || totalSupply === "") return false;
  try {
    return BigInt(totalSupply) === 0n;
  } catch {
    return false;
  }
};

/** A vault with no shares and nothing that prices one. */
export const hasNoSharePrice = (
  sharePrice?: number | string | null,
  totalSupply?: bigint | string | number | null,
): boolean => !(Number(sharePrice) > 0) && isZeroSupply(totalSupply);
