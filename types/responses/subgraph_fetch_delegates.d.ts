
export default interface ISubgraphFetchDelegatesResponse {
    id: string;
    totalWeight: {
      value: string;
    };
    weight: Array<{
      account: {
        id: string;
        delegationFrom: Array<{
          id: string;
          delegator: {
            voteWeigth: Array<{
              value: string;
            }>;
          };
        }>;
      };
      value: string;
  }>;
}
