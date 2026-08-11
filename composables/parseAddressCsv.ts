import { ethers } from "ethers";
import type { IWhitelist } from "~/types/enums/fund_setting_proposal";

export interface IInvalidAddressRow {
  /** 1-based line number in the source file, for the error message. */
  line: number;
  value: string;
}

export interface IParsedAddressCsv {
  /** Checksummed, de-duplicated, in file order. */
  addresses: string[];
  invalid: IInvalidAddressRow[];
  /** Rows whose address had already appeared earlier in the same file. */
  duplicateCount: number;
}

export interface IWhitelistMerge {
  whitelist: IWhitelist[];
  added: number;
  /** Rows that were queued for removal and are wanted again. */
  restored: number;
  alreadyListed: number;
}

/** Files past this are not a whitelist, and reading one blocks the tab. */
export const MAX_ADDRESS_CSV_BYTES = 1024 * 1024;

const CELL_SEPARATOR = /[,;\t|]/;

const stripCell = (cell: string) =>
  cell.trim().replace(/^["']+|["']+$/g, "").trim();

// Lower-cased before the check, exactly like formRules.isValidAddress: a list
// exported from a spreadsheet has usually lost its checksum casing, and
// refusing it there would be a puzzle with no clue attached.
const toChecksummed = (value: string) => {
  const lowercased = value.toLowerCase();
  if (!ethers.isAddress(lowercased)) return null;
  return ethers.getAddress(lowercased);
};

/**
 * Pull addresses out of an uploaded CSV.
 *
 * Deliberately forgiving about shape, because the file comes from whatever the
 * curator's cap table exports: any of the usual separators, quoted cells, CRLF
 * or CR line endings, a BOM, `#` comments. A row keeps only the cells that are
 * addresses, so `Alice,0xabc…,50000` imports the address and ignores the name
 * and the allocation; a row with no address at all is reported whole, which is
 * what makes a typo readable in the error.
 *
 * A leading header row is dropped rather than reported, but only when the file
 * proves itself elsewhere: no `0x` anywhere on that first line AND a later line
 * that does hold an address. A file of nothing but bad rows keeps its first one,
 * so a mangled paste is never quietly one row shorter than the user counted.
 */
export const parseAddressCsv = (text: string): IParsedAddressCsv => {
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/)
    .map((rawLine, index) => ({ line: index + 1, value: rawLine.trim() }))
    .filter((row) => row.value && !row.value.startsWith("#"))
    .map((row) => {
      const cells = row.value
        .split(CELL_SEPARATOR)
        .map(stripCell)
        .filter(Boolean);

      return {
        ...row,
        hasHexCell: cells.some((cell) => cell.toLowerCase().startsWith("0x")),
        rowAddresses: cells
          .map(toChecksummed)
          .filter((address): address is string => address !== null),
      };
    });

  const hasHeaderRow =
    rows.length > 1 &&
    !rows[0].hasHexCell &&
    rows.slice(1).some((row) => row.rowAddresses.length > 0);

  const addresses: string[] = [];
  const invalid: IInvalidAddressRow[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    if (index === 0 && hasHeaderRow) return;

    if (!row.rowAddresses.length) {
      invalid.push({ line: row.line, value: row.value });
      return;
    }

    for (const address of row.rowAddresses) {
      const key = address.toLowerCase();
      if (seen.has(key)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(key);
      addresses.push(address);
    }
  });

  return { addresses, invalid, duplicateCount };
};

/**
 * Fold imported addresses into a whitelist, additively.
 *
 * Import never replaces the list: a curator adding a tranche of investors must
 * not silently drop the addresses already on the vault. An address that is
 * already there is left exactly as it is — including its `isNew` flag, which
 * the settings transaction reads as a delta — and one that was queued for
 * removal comes back rather than turning into a second copy of itself.
 */
export const mergeAddressesIntoWhitelist = (
  whitelist: IWhitelist[],
  addresses: string[],
): IWhitelistMerge => {
  const merged = [...whitelist];
  const indexByAddress = new Map(
    merged.map((item, index) => [item.address.toLowerCase(), index]),
  );
  let added = 0;
  let restored = 0;
  let alreadyListed = 0;

  for (const address of addresses) {
    const key = address.toLowerCase();
    const index = indexByAddress.get(key);

    if (index === undefined) {
      merged.push({ address, isNew: true, deleted: false });
      indexByAddress.set(key, merged.length - 1);
      added += 1;
    } else if (merged[index].deleted) {
      merged[index] = { ...merged[index], deleted: false };
      restored += 1;
    } else {
      alreadyListed += 1;
    }
  }

  return { whitelist: merged, added, restored, alreadyListed };
};
