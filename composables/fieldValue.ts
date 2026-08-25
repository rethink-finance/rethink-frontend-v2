import type { IField } from "~/types/enums/input_type";

/** Nothing typed: an untouched box and one that was cleared read the same. */
export const isFieldValueEmpty = (value: any) =>
  value === "" || value === undefined || value === null;

/**
 * What a field is worth when its box is empty.
 *
 * Fields marked `usesDefaultWhenEmpty` show their default greyed instead of
 * pre-filling it, so the curator can type straight over it. The value behind
 * the empty box is still that default — anything reading the field has to go
 * through here, or the form reads as unfilled while the review dialog and the
 * transaction disagree.
 */
export const effectiveFieldValue = (field: IField | undefined, value: any) =>
  field?.usesDefaultWhenEmpty && isFieldValueEmpty(value)
    ? field?.defaultValue
    : value;
