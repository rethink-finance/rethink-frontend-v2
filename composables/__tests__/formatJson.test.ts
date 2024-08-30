import { it, expect, describe } from "vitest"
import {
  cleanedNavMethodDetails,
  formattedCleanedNavMethodDetailsJson,
} from "~/composables/__tests__/mock_data/mockNavData";


describe("formatJson", () => {

  it("should sort JSON keys alphabetically", () => {
    const data = {
      b: 2,
      a: 1,
      c: 3,
    };
    const expected = `{
  "a": 1,
  "b": 2,
  "c": 3
}`;
    expect(formatJson(data)).toBe(expected);
  });

  it("should handle nested objects and sort keys alphabetically", () => {
    const data = {
      b: { d: 4, c: 3 },
      a: { f: 6, e: 5 },
    };
    const expected = `{
  "a": {
    "e": 5,
    "f": 6
  },
  "b": {
    "c": 3,
    "d": 4
  }
}`;
    expect(formatJson(data)).toBe(expected);
  });

  it("should convert BigInt values to strings", () => {
    const data = {
      a: BigInt("12345678901234567890"),
      b: 23,
    };
    const expected = `{
  "a": "12345678901234567890n",
  "b": 23
}`;
    expect(formatJson(data)).toBe(expected);
  });

  // Ensure that arrays are not being sorted to verify that the function respects the natural
  // order of arrays while sorting the keys of objects within those arrays.
  it("should handle arrays without sorting them", () => {
    const data = {
      a: [3, 1, 2],
      b: [
        { z: 3, y: 2 },
        { x: 1, w: 4 },
      ],
    };
    const expected = `{
  "a": [
    3,
    1,
    2
  ],
  "b": [
    {
      "y": 2,
      "z": 3
    },
    {
      "w": 4,
      "x": 1
    }
  ]
}`;
    expect(formatJson(data)).toBe(expected);
  });

  it("should handle empty objects and arrays correctly", () => {
    const data = {
      a: {},
      b: [],
    };
    const expected = `{
  "a": {},
  "b": []
}`;
    expect(formatJson(data)).toBe(expected);
  });

  it("should handle primitive values correctly", () => {
    expect(formatJson(123)).toBe("123");
    expect(formatJson("test")).toBe("\"test\"");
    expect(formatJson(true)).toBe("true");
    expect(formatJson(null)).toBe("null");
    expect(formatJson(undefined)).toBe(undefined); // JSON.stringify(undefined) returns undefined
  });

  it("should handle deeply nested objects with BigInt values", () => {
    const data = {
      z: BigInt("98765432109876543210"),
      y: {
        x: BigInt("12345678901234567890"),
        w: 42,
      },
      a: BigInt("98765432109876543210555555555555555555555555555555555"),
    };
    const expected = `{
  "a": "98765432109876543210555555555555555555555555555555555n",
  "y": {
    "w": 42,
    "x": "12345678901234567890n"
  },
  "z": "98765432109876543210n"
}`;
    expect(formatJson(data)).toBe(expected);
  });

  it("should handle actual NAV method details", () => {
    expect(formatJson(cleanedNavMethodDetails)).toEqual(formattedCleanedNavMethodDetailsJson);
  });
});
