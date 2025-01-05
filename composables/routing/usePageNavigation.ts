export const usePageNavigation = () => {
  const router = useRouter();


  const getFundDetailsUrl = (
    chainId: string,
    fundTokenSymbol: string,
    fundAddress: string,
  ): string => {
    return `/details/${chainId}-${fundTokenSymbol}-${fundAddress}`;
  };

  const navigateToFundDetails = (
    chainId: string,
    fundTokenSymbol: string,
    fundAddress: string,
  ) => {
    router.push(
      getFundDetailsUrl(chainId, fundTokenSymbol, fundAddress),
    )
  };

  return { getFundDetailsUrl, navigateToFundDetails };
};
