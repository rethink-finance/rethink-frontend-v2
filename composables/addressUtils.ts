export const truncateAddress = (address?: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
export const isZeroAddress = (address?: string) => {
  if (!address) return true;
  const addressValue: number = parseInt(address, 16);
  return addressValue === 0;
};
