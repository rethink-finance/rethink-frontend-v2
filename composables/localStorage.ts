// Custom functions to handle BigInt in JSON
const stringifyBigInt = (_: string, value: any) => {
  return typeof value === "bigint" ? value.toString() + "n" : value;
};

const parseBigInt = (_: string, value: any) => {
  if (typeof value === "string" && /^\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  return value;
};

export const getLocalStorageItem = (key: string, defaultValue: any) => {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item, parseBigInt) : defaultValue;
};

export const setLocalStorageItem = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value, stringifyBigInt));
};
