// services/subgraph/queries.ts
import { gql } from "@apollo/client/core";

export const FETCH_GOVERNANCE_PROPOSALS = gql`
  query FetchGovernanceProposals($governorAddress: String!) {
    proposals(where: { governor_: { id: $governorAddress } }) {
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
      calls {
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
      calls {
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
          delegationFrom {
            id
            delegator {
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
