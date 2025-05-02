// services/subgraph/index.ts
import { ApolloClient } from "@apollo/client/core";
import { ethers } from "ethers";
import {
  ConditionType,
  ExecutionOption,
} from "~/types/enums/zodiac-roles";

import { getFunctionConditionType } from "~/composables/zodiac-roles/conditions";
import { RolesQuery, type RolesQueryResponse } from "~/services/zodiac-subgraph/queries";
import { type ChainId } from "~/types/enums/chain_id";
import { SubgraphClientType } from "~/types/enums/subgraph";
import type {
  FunctionCondition,
  ParamCondition,
  Role,
  Target,
  TargetConditions,
} from "~/types/zodiac-roles/role";

/**
 * Code from:
 * https://github.com/gnosisguild/zodiac-modifier-roles-v1/tree/main/packages/subgraph
 */
export const fetchRoles = async (chainId: ChainId, rolesModifierAddress: string): Promise<Role[]> => {
  if (rolesModifierAddress == null || !ethers.isAddress(rolesModifierAddress)) {
    return []
  }

  const client = useNuxtApp().$getApolloClient(chainId, SubgraphClientType.Zodiac) as ApolloClient<any>;
  try {
    const roles = await client
      .query<RolesQueryResponse>({
        query: RolesQuery,
        variables: { id: rolesModifierAddress.toLowerCase() },
        fetchPolicy: "network-only", // Adjust based on caching needs
      })

    if (!roles.data || !roles.data.rolesModifier) {
      return []
    }
    console.log("roles.data", roles.data.rolesModifier.roles);

    return roles.data.rolesModifier.roles.map((role) => ({
      ...role,
      members: role.members.map((roleMember) => roleMember.member),
      targets: role.targets.map((target): Target => {
        const conditions: TargetConditions = Object.fromEntries(
          target.functions.map((func) => {
            const paramConditions = func.parameters.map((param) => {
              const paramCondition: ParamCondition = {
                index: param.index,
                condition: param.comparison,
                value: param.comparisonValue,
                type: param.type,
              }
              return paramCondition
            })

            console.log("paramConditions", func);
            console.log("paramConditions func.wildcarded", func.wildcarded);

            const funcConditions: FunctionCondition = {
              sighash: func.sighash,
              type: func.wildcarded ? ConditionType.WILDCARDED : getFunctionConditionType(paramConditions),
              executionOption: getExecutionOptionFromLabel(func.executionOptions),
              params: paramConditions,
            }
            return [func.sighash, funcConditions]
          }),
        )
        return {
          id: target.id,
          address: target.address,
          type: target.clearance,
          executionOption: getExecutionOptionFromLabel(target.executionOptions),
          conditions,
        }
      }),
    }))
  } catch (err) {
    console.log("error fetchRoles from zodiac subgraph", err)
    throw err
  }
}


function getExecutionOptionFromLabel(label: string): ExecutionOption {
  switch (label) {
    case "Both":
      return ExecutionOption.BOTH
    case "Send":
      return ExecutionOption.SEND
    case "DelegateCall":
      return ExecutionOption.DELEGATE_CALL
  }
  return ExecutionOption.NONE
}
