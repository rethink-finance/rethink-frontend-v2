import { useFundsStore } from "../funds.store";

import { PositionType, PositionTypesMap } from "~/types/enums/position_type";

import defaultAvatar from "@/assets/images/default_avatar.webp";

import type IFund from "~/types/fund";
import type IFundMetaData from "~/types/fund_meta_data";
import type INAVUpdate from "~/types/nav_update";
import type IPositionTypeCount from "~/types/position_type";
import type IToken from "~/types/token";

export async function fetchFundsMetadataAction(
  fundAddresses: string[],
  fundsInfo: any,
  excludeTestFunds: boolean,
  excludeFundAddrs: any,
): Promise<IFund[]> {
  const fundsStore = await useFundsStore();

  const funds: IFund[] = [];
  try {
    // @dev NOTE: the second parameter to getFundNavMetaData is navEntryIndex, but it is currently
    //  not used in the contract code, so I have set it to 0. Change this part in the future
    //  if the contract changes.
    const dataNAVs: IFundMetaData[] = await fundsStore.callWithRetry(() =>
      fundsStore.rethinkReaderContract.methods
        .getFundsNavMetaData(fundAddresses)
        .call(),
    );

    for (const [index, address] of fundAddresses.entries()) {
      const dataNAV: IFundMetaData = dataNAVs[index];
      if (
        excludeTestFunds &&
        excludeFundAddrs[fundsStore.web3Store.chainId].includes(address)
      ) {
        continue;
      }
      const totalDepositBalance = dataNAV.totalDepositBal || 0n;
      const totalNAVWei = dataNAV.totalNav || 0n;
      const baseTokenDecimals = Number(dataNAV.fundBaseTokenDecimals);

      const fundStartTime = dataNAV.startTime;
      const fund: IFund = {
        chainName: fundsStore.web3Store.chainName,
        chainShort: fundsStore.web3Store.chainShort,
        address,
        title: dataNAV.fundName || "N/A",
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
          symbol: dataNAV.fundBaseTokenSymbol,
          decimals: baseTokenDecimals,
        },
        governanceToken: {} as IToken, // Not important here, for now.
        governanceTokenTotalSupply: BigInt("0"),
        totalNAVWei,
        totalDepositBalance,
        cumulativeReturnPercent: Number(dataNAV.cumulativeReturn),
        monthlyReturnPercent: undefined,
        sharpeRatio: undefined,
        positionTypeCounts: [
          {
            type: PositionTypesMap[PositionType.Liquid],
            count: Number(dataNAV.liquidLen || 0),
          },
          {
            type: PositionTypesMap[PositionType.Composable],
            count: Number(dataNAV.composableLen || 0),
          },
          {
            type: PositionTypesMap[PositionType.NFT],
            count: Number(dataNAV.nftLen || 0),
          },
          {
            type: PositionTypesMap[PositionType.Illiquid],
            count: Number(dataNAV.illiquidLen || 0),
          },
        ] as IPositionTypeCount[],

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

      const metaDataJson = dataNAV.fundMetadata;
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
