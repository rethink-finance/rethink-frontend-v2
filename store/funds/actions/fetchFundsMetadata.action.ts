import { useFundsStore } from "../funds.store";


import defaultAvatar from "@/assets/images/default_avatar.webp";

import type IFund from "~/types/fund";
import type IFundMetaData from "~/types/fund_meta_data";
import type INAVUpdate from "~/types/nav_update";
import type IPositionTypeCount from "~/types/position_type";
import type IToken from "~/types/token";

export async function fetchFundsMetaDataAction(
  fundAddresses: string[],
  fundsInfo: any,
): Promise<IFund[]> {
  const fundsStore = await useFundsStore();

  const funds: IFund[] = [];
  try {
    const fundsMetaData: IFundMetaData[] = await fundsStore.callWithRetry(() =>
      fundsStore.rethinkReaderContract.methods
        .getFundsMetaData(fundAddresses)
        .call(),
    );

    for (const [index, address] of fundAddresses.entries()) {
      const fundMetaData: IFundMetaData = fundsMetaData[index];

      const totalDepositBalance = fundMetaData.totalDepositBal || 0n;
      const baseTokenDecimals = Number(fundMetaData.fundBaseTokenDecimals);

      const fundStartTime = fundMetaData.startTime;
      const fund: IFund = {
        chainName: fundsStore.web3Store.chainName,
        chainShort: fundsStore.web3Store.chainShort,
        address,
        title: fundMetaData.fundName || "N/A",
        description: "N/A",
        safeAddress: "",
        governorAddress: "",
        photoUrl: defaultAvatar,
        inceptionDate: fundStartTime
          ? formatDate(new Date(Number(fundStartTime) * 1000))
          : "",
        fundToken: {
          symbol: fundsInfo[address].fundSymbol,
          address,
          decimals: -1,
        } as IToken,
        fundTokenTotalSupply: BigInt("0"),
        baseToken: {
          address: "", // Not important here.
          symbol: fundMetaData.fundBaseTokenSymbol,
          decimals: baseTokenDecimals,
        },
        governanceToken: {} as IToken, // Not important here, for now.
        governanceTokenTotalSupply: BigInt("0"),
        totalDepositBalance,
        cumulativeReturnPercent: undefined,
        monthlyReturnPercent: undefined,
        sharpeRatio: undefined,
        positionTypeCounts: [] as IPositionTypeCount[],

        // My Fund Positions
        netDeposits: "",
        // Overview fields
        isWhitelistedDeposits: true,
        allowedDepositAddresses: [],
        allowedManagerAddresses: [],
        plannedSettlementPeriod: "",
        minLiquidAssetShare: "",

        // Governance
        votingDelay: "",
        votingPeriod: "",
        proposalThreshold: "",
        quorumVotes: 0n,
        quorumVotesFormatted: "0",
        quorumNumerator: BigInt(0),
        quorumDenominator: BigInt(0),
        quorumPercentage: "N/A",
        lateQuorum: "",

        // Fees
        depositFee: "",
        depositFeeAddress: "",
        withdrawFee: "",
        withdrawFeeAddress: "",
        managementPeriod: "",
        managementFee: "",
        managementFeeAddress: "",
        performancePeriod: "",
        performanceFee: "",
        performanceFeeAddress: "",
        performaceHurdleRateBps: "",
        feeCollectors: [],
        feeBalance: BigInt(0), // in base token
        safeContractBaseTokenBalance: BigInt(0),
        fundContractBaseTokenBalance: BigInt(0),

        // NAV Updates
        navUpdates: [] as INAVUpdate[],
        isNavUpdatesLoading: true,
      };

      const metaDataJson = fundMetaData.fundMetadata;
      // Process metadata if available
      if (metaDataJson) {
        const metaData = JSON.parse(metaDataJson);
        fund.description = metaData.description;
        fund.photoUrl = metaData.photoUrl || defaultAvatar;
        fund.plannedSettlementPeriod = metaData.plannedSettlementPeriod;
        fund.minLiquidAssetShare = metaData.minLiquidAssetShare;
      }
      funds.push(fund);
    }
    return funds;
  } catch (error) {
    console.error(
      "Error calling getFundNavMetaData: ",
      error,
      " addresses: ",
      fundAddresses,
    );
    return funds;
  }
}
