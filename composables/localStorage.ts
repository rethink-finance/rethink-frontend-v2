// Custom functions to handle BigInt in JSON
export const stringifyBigInt = (_: string, value: any) => {
  return typeof value === "bigint" ? value.toString() + "n" : value;
};

export const parseBigInt = (_: string, value: any) => {
  // Negative too: a vault's fee balance is stored negated, and an unrevived
  // "-5n" is a string that throws the moment it meets a bigint.
  if (value != null && typeof value === "string" && /^-?\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  return value;
};

export const getLocalStorageItem = (key: string, defaultValue: any = {}) => {
  const item = localStorage.getItem(key);
  try {
    return item ? JSON.parse(item, parseBigInt) : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const setLocalStorageItem = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value, stringifyBigInt));
};

export const clearLocalStorageItem = (key: string) => {
  localStorage.removeItem(key);
};
