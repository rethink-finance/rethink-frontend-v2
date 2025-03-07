import localforage from "localforage";

export const setLocalForageItem = async (key: string, data: any) => {
  try {
    const rawData = JSON.parse(JSON.stringify(toRaw(data), stringifyBigInt), parseBigInt);
    await localforage.setItem(key, rawData);
    console.log(`Saved data to ${key}`);
  } catch (error) {
    console.error(`Error saving data to ${key}:`, error);
  }
};

export const getLocalForageItem = async (key: string, defaultValue: any = {}) => {
  try {
    const data = await localforage.getItem(key);
    console.log(`Loaded data from ${key}:`, data);
    return data || defaultValue;
  } catch (error) {
    console.error(`Error loading data from ${key}:`, error);
    return null;
  }
};

export const clearLocalForageItem = async (key: string) => {
  try {
    await localforage.removeItem(key);
    console.log(`Removed data from ${key}`);
  } catch (error) {
    console.error(`Error removing data from ${key}:`, error);
  }
};
