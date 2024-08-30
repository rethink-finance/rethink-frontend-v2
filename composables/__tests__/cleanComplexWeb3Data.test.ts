import { it, expect, describe } from "vitest"
import { cleanComplexWeb3Data } from "~/composables/utils"
import { cleanedNavMethodDetails, rawNavMethod } from "~/composables/__tests__/mock_data/mockNavData";


describe("cleanComplexWeb3Data", () => {

  it("should clean arrays recursively", () => {
    const data = [1, "test", { key: "value", 0: "ignore" }];
    const expected = [1, "test", { key: "value" }];
    expect(cleanComplexWeb3Data(data)).toEqual(expected);
  });

  it("should remove numeric keys from objects", () => {
    const data = { 0: "ignore", 1: "ignore", key1: "value1", key2: "value2" };
    const expected = { key1: "value1", key2: "value2" };
    expect(cleanComplexWeb3Data(data)).toEqual(expected);
  });

  it("should keep hex keys but remove numeric keys", () => {
    const data = { 0: "ignore", "0x1234": "keep", key: "value" };
    const expected = { "0x1234": "keep", key: "value" };
    expect(cleanComplexWeb3Data(data)).toEqual(expected);
  });

  it("should clean nested objects", () => {
    const data = { level1: { 0: "ignore", key2: "value2", nested: { 1: "ignore", key3: "value3" } } };
    const expected = { level1: { key2: "value2", nested: { key3: "value3" } } };
    expect(cleanComplexWeb3Data(data)).toEqual(expected);
  });

  it("should handle BigInt values and preserve \"n\"", () => {
    const data = { big: BigInt("12345678901234567890") };
    const expected = { big: "12345678901234567890n" };
    expect(cleanComplexWeb3Data(data)).toEqual(expected);
  });

  it("should return primitive types unchanged", () => {
    expect(cleanComplexWeb3Data("test")).toBe("test");
    expect(cleanComplexWeb3Data(123)).toBe(123);
    expect(cleanComplexWeb3Data(true)).toBe(true);
    expect(cleanComplexWeb3Data(null)).toBeNull();
    expect(cleanComplexWeb3Data(undefined)).toBeUndefined();
  });

  it("should return empty objects unchanged", () => {
    const data = {};
    expect(cleanComplexWeb3Data(data)).toEqual({});
  });

  it("should handle complex Web3 data structures", () => {
    const data = {
      0: "ignore",
      1: "ignore",
      "0x1234": "keep",
      nested: {
        0: "ignore",
        key: BigInt(123),
      },
      value: "test",
    };
    const expected = {
      "0x1234": "keep",
      nested: {
        key: "123n",
      },
      value: "test",
    };
    expect(cleanComplexWeb3Data(data)).toEqual(expected);
  });

  it("should handle deeply nested structures with preservation of BigInt", () => {
    const data = {
      level1: {
        level2: {
          bigIntKey: BigInt(999),
        },
      },
    };
    const expected = {
      level1: {
        level2: {
          bigIntKey: "999n",
        },
      },
    };
    expect(cleanComplexWeb3Data(data)).toEqual(expected);
  });

  it("should handle actual NAV method returned from the web3 contract", () => {
    expect(cleanComplexWeb3Data(rawNavMethod)).toEqual(cleanedNavMethodDetails);
  });
});
