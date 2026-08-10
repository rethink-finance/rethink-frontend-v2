// services/subgraph/queries.ts
import { gql } from "@apollo/client/core";

export const FETCH_GOVERNANCE_PROPOSALS = gql`
  query FetchGovernanceProposals($governorAddress: String!) {
    proposals(first: 1000, where: { governor_: { id: $governorAddress } }) {
      id
      proposalId
      voteStart
      voteEnd
      description
      canceled
      queued
      executed
      proposer {
        id
      }
      proposalCanceled {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalCreated {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalExecuted {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalQueued {
        timestamp
        transaction {
          blockNumber
        }
      }
      calls(first: 1000, orderBy: index, orderDirection: asc) {
        calldata
        index
        signature
        value
        target {
          id
        }
      }
      receipts(first: 1000) {
        id
        voter {
          id
        }
        support {
          support
        }
        weight
        voteCasts {
          transaction {
            id
            timestamp
            blockNumber
          }
        }
      }
    }
  }
`;

export const FETCH_GOVERNANCE_PROPOSAL = gql`
  query FetchSingleProposal($proposalId: String!, $governorAddress: String!) {
    proposals(
      where: { proposalId: $proposalId, governor_: { id: $governorAddress } }
    ) {
      id
      proposalId
      voteStart
      voteEnd
      description
      canceled
      queued
      executed
      proposer {
        id
      }
      proposalCanceled {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalCreated {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalExecuted {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalQueued {
        timestamp
        transaction {
          blockNumber
        }
      }
      calls(orderBy: index, orderDirection: asc, first: 1000) {
        calldata
        index
        signature
        value
        target {
          id
        }
      }
      receipts {
        id
        voter {
          id
        }
        support {
          support
        }
        weight
        voteCasts {
          transaction {
            id
            timestamp
            blockNumber
          }
        }
      }
    }
  }
`;

export const FETCH_DELEGATES = gql`
  query FetchDelegates($votingContract: String!) {
    votingContract(id: $votingContract) {
      id
      totalWeight {
        value
      }
      weight(where: { value_gt: 0, account_not: null }) {
        account {
          id
          delegationFrom(where: { contract_: { id: $votingContract } }) {
            delegator {
              id
              voteWeigth(where: { contract_: { id: $votingContract } }) {
                value
              }
            }
          }
        }
        value
      }
    }
  }
`;

export const FETCH_FUND_FLOWS = gql`
  query FetchFundFlows($fundAddress: String!, $first: Int!, $skip: Int!) {
    fundFlows(
      first: $first
      skip: $skip
      where: { fund_: { fundContractAddr: $fundAddress } }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      timestamp
      blockNumber
      txFrom {
        id
      }
      transaction {
        id
      }
      caller {
        id
      }
      raw
      selector
      selectorHex
      name
      amount
      amount2
      feeKind
      flag
      account {
        id
      }
      fund {
        id
        fundName
        fundContractAddr
        govContractAddr
      }
    }
  }
`;

/**
 * Same feed narrowed to an operation family. A separate query because The
 * Graph has no optional filters — passing an empty $names list would match
 * nothing rather than everything.
 */
export const FETCH_FUND_FLOWS_BY_NAMES = gql`
  query FetchFundFlowsByNames($fundAddress: String!, $first: Int!, $skip: Int!, $names: [String!]!) {
    fundFlows(
      first: $first
      skip: $skip
      where: { fund_: { fundContractAddr: $fundAddress }, name_in: $names }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      timestamp
      blockNumber
      txFrom {
        id
      }
      transaction {
        id
      }
      caller {
        id
      }
      raw
      selector
      selectorHex
      name
      amount
      amount2
      feeKind
      flag
      account {
        id
      }
      fund {
        id
        fundName
        fundContractAddr
        govContractAddr
      }
    }
  }
`;

/**
 * Every flow a wallet has signed, newest first — feeds the portfolio page.
 *
 * Paged, because the portfolio measures a wallet's return from its whole
 * history: a capped query would quietly leave out early deposits and overstate
 * every figure derived from them.
 */
export const FETCH_USER_FLOWS = gql`
  query FetchUserFlows($userAddress: String!, $first: Int!, $skip: Int!) {
    fundFlows(
      first: $first
      skip: $skip
      where: { txFrom: $userAddress }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      timestamp
      blockNumber
      txFrom {
        id
      }
      transaction {
        id
      }
      caller {
        id
      }
      raw
      selector
      selectorHex
      name
      amount
      amount2
      feeKind
      flag
      account {
        id
      }
      fund {
        id
        fundName
        fundContractAddr
        govContractAddr
      }
    }
  }
`;
