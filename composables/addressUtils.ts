export const truncateAddress = (address?: string) => {
  if (!address) return "";
  if (address.length < 12) {
    return address
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
export const isZeroAddress = (address?: string) => {
  // TODO maybe this should be clarified, that if address is null or undefined
  //   that it will treat it as zero address, or add additional parameter to
  //   strictly check for zero address match.
  if (!address) return true;
  const addressValue: number = parseInt(address, 16);
  return addressValue === 0;
};
