// services/subgraph/index.ts
import { ApolloClient } from "@apollo/client/core";
import { ethers } from "ethers";
import {
  ConditionType,
  ExecutionOption,
} from "~/types/enums/zodiac-roles";

import { getFunctionConditionType } from "~/composables/zodiac-roles/conditions";
import {
  detectRolesVersion,
  RolesVersion,
} from "~/composables/permissions/useRoleExecution";
import { fetchOnChainRolesV1 } from "~/services/onchain/rolesV1";
import type { RolesV1Modifier } from "~/services/onchain/rolesV1Replay";
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

/** A hung gateway must not hold the permissions page; the chain is the answer anyway. */
const SUBGRAPH_TIMEOUT_MS = 8_000;

/**
 * Code from:
 * https://github.com/gnosisguild/zodiac-modifier-roles-v1/tree/main/packages/subgraph
 *
 * A Roles v1 modifier's roles, read from the chain first and the Zodiac
 * subgraph second. Gnosis Guild retired the v1 subgraphs on every chain in
 * September 2026 (see services/onchain/rolesV1Replay.ts), so the replay of the
 * modifier's own event log is the working path; the subgraph query stays as a
 * backstop in case the configured endpoints are ever pointed at a live
 * deployment again. Both produce the same response shape and share one mapper.
 */
export const fetchRoles = async (chainId: ChainId, rolesModifierAddress: string): Promise<Role[]> => {
  if (rolesModifierAddress == null || !ethers.isAddress(rolesModifierAddress)) {
    return []
  }

  // Nothing here applies to a v2 modifier — its events differ and the v2
  // permissions page reads membership off the chain itself — and the vault
  // page fires this before the factory version has arrived, so ask the
  // contract rather than the flag.
  const version = await detectRolesVersion(chainId, rolesModifierAddress, RolesVersion.V1);
  if (version === RolesVersion.V2) {
    return []
  }

  let rolesModifier: RolesV1Modifier | null;
  try {
    rolesModifier = await fetchOnChainRolesV1(chainId, rolesModifierAddress);
  } catch (onChainError) {
    console.warn("On-chain Roles v1 replay unavailable, trying the subgraph", onChainError);
    try {
      rolesModifier = await fetchRolesFromSubgraph(chainId, rolesModifierAddress);
    } catch (subgraphError) {
      console.debug("Zodiac subgraph unavailable too", subgraphError);
      // The chain-side error explains what to fix; the subgraph one is expected.
      throw onChainError
    }
  }

  if (!rolesModifier) {
    return []
  }
  return mapRolesModifier(rolesModifier)
}

const fetchRolesFromSubgraph = async (
  chainId: ChainId,
  rolesModifierAddress: string,
): Promise<RolesV1Modifier | null> => {
  const client = useNuxtApp().$getApolloClient(chainId, SubgraphClientType.Zodiac) as ApolloClient<any>;
  const roles = await Promise.race([
    client.query<RolesQueryResponse>({
      query: RolesQuery,
      variables: { id: rolesModifierAddress.toLowerCase() },
      fetchPolicy: "network-only",
    }),
    new Promise<never>((_resolve, reject) =>
      setTimeout(
        () => reject(new Error("Zodiac subgraph query timed out")),
        SUBGRAPH_TIMEOUT_MS,
      ),
    ),
  ]);
  return roles.data?.rolesModifier ?? null
}

const mapRolesModifier = (rolesModifier: RolesV1Modifier): Role[] =>
  rolesModifier.roles.map((role) => ({
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
