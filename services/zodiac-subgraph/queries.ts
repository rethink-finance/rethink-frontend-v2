// services/subgraph/queries.ts
import { gql } from "@apollo/client/core";
import type { ConditionType, Member, ParamComparison, ParameterType } from "~/types/zodiac/role";

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
