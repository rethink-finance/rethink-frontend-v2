import { describe, it, expect } from "vitest";
import {
  mergeAddressesIntoWhitelist,
  parseAddressCsv,
} from "../parseAddressCsv";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const C = "0x3333333333333333333333333333333333333333";
// Real mixed-case address, checksummed.
const CHECKSUMMED = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";

describe("parseAddressCsv", () => {
  it("reads one address per line", () => {
    const parsed = parseAddressCsv(`${A}\n${B}\n${C}`);

    expect(parsed.addresses).toEqual([A, B, C]);
    expect(parsed.invalid).toEqual([]);
    expect(parsed.duplicateCount).toBe(0);
  });

  it("keeps only the address cells of a multi-column row", () => {
    const parsed = parseAddressCsv(
      `name,address,allocation\nAlice,${A},50000\nBob,${B},25000`,
    );

    expect(parsed.addresses).toEqual([A, B]);
    expect(parsed.invalid).toEqual([]);
  });

  it("takes every address on a single comma-separated row", () => {
    expect(parseAddressCsv(`${A},${B},${C}`).addresses).toEqual([A, B, C]);
  });

  it("survives a BOM, CRLF, quotes, semicolons and comment lines", () => {
    const parsed = parseAddressCsv(
      `\uFEFF"Address";"Label"\r\n"${A}";"seed"\r\n# a note\r\n'${B}';'series a'\r\n`,
    );

    expect(parsed.addresses).toEqual([A, B]);
    expect(parsed.invalid).toEqual([]);
  });

  it("drops a header line only when it carries no 0x at all", () => {
    expect(parseAddressCsv(`wallet\n${A}`).addresses).toEqual([A]);
    // A first line that looks like an address but is not stays an error, so a
    // truncated paste is reported instead of silently swallowed as a header.
    expect(parseAddressCsv(`0x123\n${A}`).invalid).toEqual([
      { line: 1, value: "0x123" },
    ]);
  });

  it("checksums lower-cased input and de-duplicates case-insensitively", () => {
    const parsed = parseAddressCsv(
      `${CHECKSUMMED.toLowerCase()}\n${CHECKSUMMED.toUpperCase().replace("0X", "0x")}`,
    );

    expect(parsed.addresses).toEqual([CHECKSUMMED]);
    expect(parsed.duplicateCount).toBe(1);
  });

  it("reports the whole line when it holds no address", () => {
    const parsed = parseAddressCsv(`${A}\n\nnot-an-address,42\n${B}`);

    expect(parsed.addresses).toEqual([A, B]);
    expect(parsed.invalid).toEqual([{ line: 3, value: "not-an-address,42" }]);
  });

  it("returns nothing for an empty or blank file", () => {
    expect(parseAddressCsv("")).toEqual({
      addresses: [],
      invalid: [],
      duplicateCount: 0,
    });
    expect(parseAddressCsv("\n  \n\r\n")).toEqual({
      addresses: [],
      invalid: [],
      duplicateCount: 0,
    });
  });

  it("does not accept an ENS name or a shortened address", () => {
    const parsed = parseAddressCsv("vitalik.eth\n0x1111…1111");

    expect(parsed.addresses).toEqual([]);
    expect(parsed.invalid.map((row) => row.line)).toEqual([1, 2]);
  });
});

describe("mergeAddressesIntoWhitelist", () => {
  it("appends addresses the list does not hold yet", () => {
    const merge = mergeAddressesIntoWhitelist(
      [{ address: A, isNew: false, deleted: false }],
      [B, C],
    );

    expect(merge.whitelist).toEqual([
      { address: A, isNew: false, deleted: false },
      { address: B, isNew: true, deleted: false },
      { address: C, isNew: true, deleted: false },
    ]);
    expect(merge).toMatchObject({ added: 2, restored: 0, alreadyListed: 0 });
  });

  it("brings back a row that was queued for removal", () => {
    const merge = mergeAddressesIntoWhitelist(
      [{ address: A, isNew: false, deleted: true }],
      [A],
    );

    expect(merge.whitelist).toEqual([
      { address: A, isNew: false, deleted: false },
    ]);
    expect(merge).toMatchObject({ added: 0, restored: 1, alreadyListed: 0 });
  });

  it("leaves an address that is already listed exactly as it is", () => {
    // isNew must survive: on the curator page it is what marks the address as
    // a pending addition, and clearing it would drop it from the transaction.
    const existing = [
      { address: A, isNew: false, deleted: false },
      { address: B, isNew: true, deleted: false },
    ];
    const merge = mergeAddressesIntoWhitelist(existing, [A, B]);

    expect(merge.whitelist).toEqual(existing);
    expect(merge).toMatchObject({ added: 0, restored: 0, alreadyListed: 2 });
  });

  it("matches case-insensitively and does not mutate the list it was given", () => {
    const existing = [{ address: A, isNew: false, deleted: true }];
    const merge = mergeAddressesIntoWhitelist(existing, [A.toUpperCase().replace("0X", "0x")]);

    expect(existing[0].deleted).toBe(true);
    expect(merge.whitelist[0].deleted).toBe(false);
    expect(merge.whitelist).toHaveLength(1);
  });
});
