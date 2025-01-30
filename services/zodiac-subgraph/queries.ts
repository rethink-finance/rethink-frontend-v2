// services/subgraph/queries.ts
import { gql } from "@apollo/client/core";
import {
  ParameterType,
  ParamComparison,
  ConditionType,
} from "~/types/enums/zodiac-roles";
import type { Member } from "~/types/zodiac-roles/role";

export const RolesQuery = gql`
    query ($id: ID!) {
        rolesModifier(id: $id) {
            id
            address
            avatar
            roles {
                id
                name
                targets {
                    id
                    address
                    executionOptions
                    clearance
                    functions {
                        sighash
                        executionOptions
                        wildcarded
                        parameters {
                            index
                            type
                            comparison
                            comparisonValue
                        }
                    }
                }
                members {
                    id
                    member {
                        id
                        address
                    }
                }
            }
        }
    }
`

export interface RolesQueryResponse {
  rolesModifier: null | {
    id: string
    address: string
    avatar: string
    roles: {
      id: string
      name: string
      targets: {
        id: string
        address: string
        executionOptions: string
        clearance: ConditionType
        functions: {
          sighash: string
          executionOptions: string
          wildcarded: boolean
          parameters: {
            index: number
            type: ParameterType
            comparison: ParamComparison
            comparisonValue: string[]
          }[]
        }[]
      }[]
      members: {
        id: string
        member: Member
      }[]
    }[]
  }
}
