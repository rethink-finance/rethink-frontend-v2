import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import { GovernableFund } from "../assets/contracts/GovernableFund";
import { encodeUpdateNavMethods } from "../composables/nav/navProposal";
import {
  type IRawNavEntry,
  rawEntriesToNavMethods,
} from "../composables/nav/rawNavEntries";
import type INAVMethod from "../types/nav_method";

// GovernableFundNav.processNav reads pastNAVUpdateEntryFundAddress[i] for
// EVERY entry i, whatever isPastNAVUpdate says. An updateNav call with fewer
// addresses than entries reverts "failed processNav" on chain, and once it is
// stored on the NAV executor every executeNAVUpdate reverts with it. So the
// calldata is decoded here, with the vault's own ABI, and the two arrays are
// compared.
const fundIface = new ethers.Interface(GovernableFund.abi as any);

const FUND = "0x533f164d91e3F8169a7043f7094f44af87Fb7CA4";
const OTHER_FUND = "0x30Fe6826a683B154703BbcAD1BCCAa1D32B0F674";
const SAFE = "0x2e59E2ee1c2d4e2A4bFd0aBd6A4d0C2a9b1FeEf7";
const STETH = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";

const balanceOfEntry = (token: string, positionName: string): IRawNavEntry => ({
  entryType: "NAVComposableUpdateType",
  composableUpdates: [
    {
      remoteContractAddress: token,
      functionSignatures: "balanceOf(address)",
      encodedFunctionSignatureWithInputs:
        "0x70a08231" + SAFE.slice(2).toLowerCase().padStart(64, "0"),
      normalizationDecimals: 18,
      isReturnArray: false,
      returnValIndex: 0,
      returnArraySize: 0,
      returnValType: 0,
      pastNAVUpdateIndex: 0,
      isNegative: false,
    },
  ],
  isPastNAVUpdate: false,
  pastNAVUpdateIndex: 0,
  pastNAVUpdateEntryIndex: 0,
  description: { positionName, valuationSource: "Test" },
});

const liquidEntry = (positionName: string): IRawNavEntry => ({
  entryType: "NAVLiquidUpdateType",
  liquidUpdates: [
    {
      tokenPair: "0x0000000000000000000000000000000000000000",
      aggregatorAddress: "0x86392dC19c0b719886221c78AB11eb8Cf5c52812",
      functionSignatureWithEncodedInputs: "0xfeaf968c",
      assetTokenAddress: STETH,
      nonAssetTokenAddress: "0x0000000000000000000000000000000000000000",
      isReturnArray: true,
      returnLength: 5,
      returnIndex: 1,
      pastNAVUpdateIndex: 0,
    },
  ],
  isPastNAVUpdate: false,
  pastNAVUpdateIndex: 0,
  pastNAVUpdateEntryIndex: 0,
  description: { positionName, valuationSource: "Chainlink" },
});

/** Rows as the "Raw NAV methods" form hands them to the table. */
const pasted = (entries: IRawNavEntry[]): INAVMethod[] =>
  rawEntriesToNavMethods(entries, 0);

/**
 * A row after MethodsTable.editMethod as it was when the bug was hit: a copy
 * of the row with the address set to the number 0. Saved drafts and any
 * caller that still does this must encode all the same.
 */
const editedTheOldWay = (row: INAVMethod, positionName: string): INAVMethod => {
  const copy = JSON.parse(
    JSON.stringify(row, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
  copy.positionName = positionName;
  copy.details.description = JSON.stringify({
    positionName,
    valuationSource: row.valuationSource,
  });
  copy.pastNAVUpdateEntryFundAddress = 0;
  copy.isNew = true;
  return copy;
};

const decode = (calldata: string) => {
  const parsed = fundIface.parseTransaction({ data: calldata })!;
  expect(parsed.name).toBe("updateNav");
  return {
    entries: parsed.args[0] as any[],
    addresses: (parsed.args[1] as string[]).map(String),
    processWithdraw: parsed.args[2] as boolean,
  };
};

const names = (entries: any[]): string[] =>
  entries.map((entry) => JSON.parse(entry.description).positionName);

describe("encodeUpdateNavMethods emits one address per entry", () => {
  it("raw-pasted rows without an address take the zero address each", () => {
    const methods = pasted([
      balanceOfEntry(STETH, "stETH"),
      balanceOfEntry(WSTETH, "wstETH"),
      liquidEntry("stETH price"),
    ]);
    const { entries, addresses, processWithdraw } = decode(
      encodeUpdateNavMethods(methods, 18),
    );
    expect(entries.length).toBe(3);
    expect(addresses.length).toBe(entries.length);
    expect(addresses).toEqual([ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
    expect(processWithdraw).toBe(false);
  });

  it("raw-pasted rows that name their vault keep it, in entry order", () => {
    const methods = pasted([
      { ...balanceOfEntry(STETH, "stETH"), pastNAVUpdateEntryFundAddress: FUND },
      { ...balanceOfEntry(WSTETH, "wstETH"), pastNAVUpdateEntryFundAddress: OTHER_FUND },
    ]);
    const { entries, addresses } = decode(encodeUpdateNavMethods(methods, 18));
    expect(names(entries)).toEqual(["stETH", "wstETH"]);
    expect(addresses).toEqual([FUND, OTHER_FUND]);
  });

  it("an edited row (address 0) still gets its address: the two-rows-edited case that stored an empty list", () => {
    // Tx 0x6a59c046…2abfad: two entries, both rows edited, address array [].
    const [first, second] = pasted([
      balanceOfEntry(STETH, "stETH"),
      balanceOfEntry(WSTETH, "wstETH"),
    ]);
    const methods = [
      editedTheOldWay(first, "Lido stETH"),
      editedTheOldWay(second, "Lido wstETH"),
    ];
    const { entries, addresses } = decode(encodeUpdateNavMethods(methods, 18));
    expect(names(entries)).toEqual(["Lido stETH", "Lido wstETH"]);
    expect(addresses.length).toBe(entries.length);
    expect(addresses).toEqual([ethers.ZeroAddress, ethers.ZeroAddress]);
  });

  it("a row with no address field at all, an empty one or a malformed one is treated the same", () => {
    const [a, b, c] = pasted([
      balanceOfEntry(STETH, "a"),
      balanceOfEntry(WSTETH, "b"),
      liquidEntry("c"),
    ]);
    delete a.pastNAVUpdateEntryFundAddress;
    b.pastNAVUpdateEntryFundAddress = "";
    c.pastNAVUpdateEntryFundAddress = "0" as any;
    const { entries, addresses } = decode(encodeUpdateNavMethods([a, b, c], 18));
    expect(addresses.length).toBe(entries.length);
    expect(addresses).toEqual([ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
  });

  it("a deleted row gives up its entry and its address together", () => {
    const methods = pasted([
      { ...balanceOfEntry(STETH, "kept 1"), pastNAVUpdateEntryFundAddress: FUND },
      { ...balanceOfEntry(WSTETH, "deleted"), pastNAVUpdateEntryFundAddress: OTHER_FUND },
      { ...liquidEntry("kept 2"), pastNAVUpdateEntryFundAddress: FUND },
    ]);
    methods[1].deleted = true;
    const { entries, addresses } = decode(encodeUpdateNavMethods(methods, 18));
    expect(names(entries)).toEqual(["kept 1", "kept 2"]);
    expect(addresses).toEqual([FUND, FUND]);
  });

  it("mixed rows: address i always belongs to entry i", () => {
    const [fromVault, toEdit, toDelete, rawRow, fromOtherVault] = pasted([
      { ...balanceOfEntry(STETH, "from this vault"), pastNAVUpdateEntryFundAddress: FUND },
      { ...balanceOfEntry(WSTETH, "before edit"), pastNAVUpdateEntryFundAddress: FUND },
      { ...balanceOfEntry(STETH, "deleted"), pastNAVUpdateEntryFundAddress: FUND },
      liquidEntry("raw"),
      { ...balanceOfEntry(WSTETH, "from another vault"), pastNAVUpdateEntryFundAddress: OTHER_FUND },
    ]);
    toDelete.deleted = true;
    // The table drops the edited row and appends its replacement at the end.
    const methods = [
      fromVault,
      toDelete,
      rawRow,
      fromOtherVault,
      editedTheOldWay(toEdit, "edited"),
    ];

    const { entries, addresses, processWithdraw } = decode(
      encodeUpdateNavMethods(methods, 18, true),
    );
    expect(names(entries)).toEqual(["from this vault", "raw", "from another vault", "edited"]);
    expect(addresses.length).toBe(entries.length);
    expect(addresses).toEqual([FUND, ethers.ZeroAddress, OTHER_FUND, ethers.ZeroAddress]);
    expect(processWithdraw).toBe(true);
  });

  it("an edited row that was given the vault's address encodes it", () => {
    // What editMethod does now, where the table knows its vault.
    const [row] = pasted([balanceOfEntry(STETH, "stETH")]);
    const edited = { ...editedTheOldWay(row, "edited"), pastNAVUpdateEntryFundAddress: FUND };
    const { addresses } = decode(encodeUpdateNavMethods([edited], 18));
    expect(addresses).toEqual([FUND]);
  });

  it("every method deleted leaves both arrays empty", () => {
    const methods = pasted([balanceOfEntry(STETH, "a"), liquidEntry("b")]);
    methods.forEach((method) => {
      method.deleted = true;
    });
    const { entries, addresses } = decode(encodeUpdateNavMethods(methods, 18));
    expect(entries.length).toBe(0);
    expect(addresses.length).toBe(0);
  });
});

describe("encodeUpdateNavMethods and entries that point at a past NAV update", () => {
  const pastEntry = (address?: string): INAVMethod => {
    const [row] = pasted([
      {
        ...balanceOfEntry(STETH, "reused"),
        isPastNAVUpdate: true,
        pastNAVUpdateIndex: 4,
        pastNAVUpdateEntryIndex: 2,
        ...(address ? { pastNAVUpdateEntryFundAddress: address } : {}),
      },
    ]);
    return row;
  };

  it("keeps the vault the entry is read from", () => {
    const { entries, addresses } = decode(
      encodeUpdateNavMethods([pastEntry(OTHER_FUND)], 18),
    );
    expect(entries[0].isPastNAVUpdate).toBe(true);
    expect(Number(entries[0].pastNAVUpdateEntryIndex)).toBe(2);
    expect(addresses).toEqual([OTHER_FUND]);
  });

  it("refuses to encode one whose vault is not known, naming the method", () => {
    // The calculator would read the entry from address(0): the zero address
    // is only a safe filler when isPastNAVUpdate is false.
    const row = pastEntry();
    row.pastNAVUpdateEntryFundAddress = 0 as any;
    expect(() => encodeUpdateNavMethods([row], 18)).toThrow(
      /NAV method "reused" reuses an entry of a past NAV update, but the vault it was defined on is not known/,
    );

    // rawEntriesToNavMethods fills a missing address with the zero address,
    // which is a real address as far as the encoder can tell. It is the
    // contract's "no vault" all the same, so it is refused too.
    expect(() => encodeUpdateNavMethods([pastEntry()], 18)).toThrow(/is not known/);
  });

  it("one bad row does not get encoded around: nothing is returned", () => {
    const good = pasted([balanceOfEntry(STETH, "fine")]);
    const bad = pastEntry();
    bad.pastNAVUpdateEntryFundAddress = undefined;
    expect(() => encodeUpdateNavMethods([...good, bad], 18)).toThrow(/reused/);
  });
});
