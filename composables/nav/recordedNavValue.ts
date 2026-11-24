/**
 * What the NAV calculator recorded for one method at the last NAV update.
 *
 * The calculator stores a method's values only when they add up to something
 * other than zero, so an empty list is a method that was valued at zero, not
 * a value that is missing.
 */
export const sumRecordedNavValues = (values: readonly (bigint | string | number)[] = []): bigint =>
  values.reduce<bigint>((sum, value) => sum + BigInt(value), 0n);

/**
 * True for any value that was read, zero included. Only a value that was never
 * read (no NAV update yet, still loading, the read failed) has nothing to show.
 */
export const hasRecordedNavValue = (
  value?: bigint | string | number | null,
): value is bigint | string | number => value !== undefined && value !== null && value !== "";
