/**
 * Parses an object and converts any bigint values to strings.
 * @param data The object to parse
 * @returns A new object with the same structure but with bigint values converted to strings
 */
export const parseBigintsToString = <T>(data: any): T => {
  const result: Partial<T> = {};

  // Directly iterate over the object's entries.
  Object.entries(data).forEach(([key, value]) => {
    // Assume that every key in the input corresponds to a valid key in T.
    const detailKey = key as keyof T;

    // Convert bigint values to strings, otherwise assign the value directly.
    result[detailKey] =
      typeof value === "bigint" ? value.toString() as T[keyof T] : value as T[keyof T];
  });

  return result as T;
};
