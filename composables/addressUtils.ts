export const truncateAddress = (address?: string) => {
  if (!address) return "";
  if (address.length < 12) {
    return address
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
/**
 * The same shape as truncateAddress with a true ellipsis — 0x1234…abcd. Kept
 * apart rather than folded into it because the older screens are full of the
 * three-dot form and changing them all is not this change's business.
 */
export const truncateAddressEllipsis = (address?: string) => {
  const truncated = truncateAddress(address);
  return truncated.replace("...", "…");
};

export const isZeroAddress = (address?: string) => {
  // TODO maybe this should be clarified, that if address is null or undefined
  //   that it will treat it as zero address, or add additional parameter to
  //   strictly check for zero address match.
  if (!address) return true;
  const addressValue: number = parseInt(address, 16);
  return addressValue === 0;
};
