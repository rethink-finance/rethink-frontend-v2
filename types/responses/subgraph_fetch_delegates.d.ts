
export default interface ISubgraphFetchDelegatesResponse {
  id: string;
  totalWeight: {
    value: string;
  };
  weight: Array<{
    account: {
      id: string;
      delegationFrom: Array<{
        delegator: {
          id: string;
          voteWeigth: Array<{
            value: string;
          }>;
        };
      }>;
    };
    value: string;
  }>;
}
