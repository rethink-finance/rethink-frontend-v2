import { describe, expect, it } from "vitest";
import {
  fullPermissions,
  oneOfPermissions,
  scopeTargetPermissions,
  scopeTargetPermissionsResult,
  oneOfPermissionsResult,
  oneOfTwoPermissions,
  oneOfTwoPermissionsResult,
  oneOfTwoParamsDifferentFunctionPermissions,
  oneOfTwoParamsDifferentFunctionPermissionsResult,
  scopeAllowFunctionPermissions,
  scopeAllowFunctionPermissionsResult,
  scopeFunctionPermissions,
  scopeFunctionPermissionsResult,
  scopeFunctionWithUnscopedParamsPermissions,
  scopeFunctionWithUnscopedParamsPermissionsResult,
  scopeFunctionWithTwoParamsPermissionsResult,
  scopeFunctionWithTwoParamsPermissions, scopeFunctionWithOneOfParamPermissions, fullPermissionsResult,
} from "~/composables/__tests__/mock_data/permissions/mockRawPermissions1";

import type { Target } from "~/types/zodiac-roles/role";
import {
  fullPermissions2,
  fullPermissions2Result,
} from "~/composables/__tests__/mock_data/permissions/mockRawPermissions2";
import {
  fullPermissions3,
  fullPermissions3Result, scopeParameterPermissions, scopeParameterPermissionsResult,
} from "~/composables/__tests__/mock_data/permissions/mockRawPermissions3";
import {
  fullPermissions4,
  fullPermissions4Result,
} from "~/composables/__tests__/mock_data/permissions/mockRawPermissions4";
import { parseRawPermissionsJson } from "~/composables/permissions/parseRawPermissionsJson";

/**
 * https://github.com/gnosisguild/zodiac-modifier-roles-v1/blob/main/packages/evm/contracts/Permissions.sol
 */
describe("addRawPermissions", () => {
  // TODO also check that it returns an empty array for customPermissions
  it ("scopeTarget", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(scopeTargetPermissions));
    expect(result).toEqual(scopeTargetPermissionsResult);
  });
  it ("scopeAllowFunction", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(scopeAllowFunctionPermissions));
    expect(result).toEqual(scopeAllowFunctionPermissionsResult);
  });
  it ("scopeFunction", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(scopeFunctionPermissions));
    expect(result).toEqual(scopeFunctionPermissionsResult);
  });
  it ("scopeFunctionWithUnscopedParams (unscoped param should be ignored)", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(scopeFunctionWithUnscopedParamsPermissions));
    expect(result).toEqual(scopeFunctionWithUnscopedParamsPermissionsResult);
  });
  it ("scopeFunctionWithTwoParams", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(scopeFunctionWithTwoParamsPermissions));
    expect(result).toEqual(scopeFunctionWithTwoParamsPermissionsResult);
  });
  it ("scopeFunctionWithOneOfParam (should throw exc)",  () => {
    expect(() => {
      parseRawPermissionsJson(scopeFunctionWithOneOfParamPermissions);
    }).toThrow("OneOf Comparison must be set via dedicated function");
  });
  it ("scopeParameterAsOneOf", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(oneOfPermissions));
    expect(result).toEqual(oneOfPermissionsResult);
  })
  it ("scopeParameterAsOneOf two params, same function", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(oneOfTwoPermissions));
    expect(result).toEqual(oneOfTwoPermissionsResult);
  })
  it ("scopeParameterAsOneOf two params, same function, one param another function", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(oneOfTwoParamsDifferentFunctionPermissions));
    expect(result).toEqual(oneOfTwoParamsDifferentFunctionPermissionsResult);
  })
  it ("full permissions json", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(fullPermissions));
    expect(result).toEqual(fullPermissionsResult);
  })

  // PERMS 2
  it ("full permissions2", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(fullPermissions2));
    expect(result).toEqual(fullPermissions2Result);
  })

  // PERMS 3
  it ("full permissions3", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(fullPermissions3));
    expect(result).toEqual(fullPermissions3Result);
  })
  it ("scopeParameter", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(scopeParameterPermissions));
    expect(result).toEqual(scopeParameterPermissionsResult);
  })

  // PERMS 4
  it ("full permissions4", () => {
    const result = testWithParamArrayCheck(() => parseRawPermissionsJson(fullPermissions4));
    expect(result).toEqual(fullPermissions4Result);
  })
})


function assertAllParamValuesAreArrays(roleTargets: Record<string, Record<string, Target>>) {
  for (const role of Object.values(roleTargets)) {
    for (const target of Object.values(role)) {
      for (const fn of Object.values(target.conditions)) {
        for (const param of fn.params) {
          if (!Array.isArray(param.value)) {
            throw new TypeError(`Expected param.value to be an array, but got: ${typeof param.value}`);
          }
        }
      }
    }
  }
}

function testWithParamArrayCheck(testFn: () => { roleTargets: Record<string, Record<string, Target>>, customPermissions: any[] }) {
  const result = testFn();
  // Assert that are values in params are arrays, even if they have only one value or none.
  assertAllParamValuesAreArrays(result.roleTargets);
  // Check that customPermissions array is empty
  expect(result.customPermissions).toEqual([]);
  return result.roleTargets;
}
