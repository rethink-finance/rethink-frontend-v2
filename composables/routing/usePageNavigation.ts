import { type ChainId } from "~/types/enums/chain_id";

export const usePageNavigation = () => {
  const router = useRouter();


  const getFundDetailsUrl = (
    chainId: ChainId,
    fundTokenSymbol: string,
    fundAddress: string,
  ): string => {
    return `/details/${chainId}-${fundTokenSymbol}-${fundAddress}`;
  };

  const navigateToFundDetails = (
    chainId: ChainId,
    fundTokenSymbol: string,
    fundAddress: string,
  ) => {
    router.push(
      getFundDetailsUrl(chainId, fundTokenSymbol, fundAddress),
    )
  };

  return { getFundDetailsUrl, navigateToFundDetails };
};
