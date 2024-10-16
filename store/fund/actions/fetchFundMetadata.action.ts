import { useFundStore } from "../fund.store";

import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import type INAVUpdate from "~/types/nav_update";

import defaultAvatar from "@/assets/images/default_avatar.webp";
import { ClockMode } from "~/types/enums/clock_mode";
import type IPositionTypeCount from "~/types/position_type";
import type IToken from "~/types/token";

export const fetchFundMetadataAction = async (fundSettings: IFundSettings): Promise<IFund> => {
  const fundStore = useFundStore();
  const rethinkReaderContract = fundStore.rethinkReaderContract;

  try {
    const results = await Promise.allSettled(
      [
        () =>
          rethinkReaderContract.methods
            .getFundNavMetaData(fundSettings.fundAddress)
            .call(),
        () =>
          rethinkReaderContract.methods
            .getGovernanceInfo(fundSettings.governor)
            .call(),
      ].map((fn: () => Promise<any>) =>
        fundStore.accountStore.requestConcurrencyLimit(() =>
          fundStore.callWithRetry(fn),
        ),
      ),
    );

    const [
      fundNavMetaData,
      governanceInfo,
    ]: any[] = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      console.error("Failed fetching fund data value for: ", index, result);
      return undefined;
    });

    const {
      cumulativeReturn,
      startTime,
      totalNav,
      totalDepositBal,
      feeBalance,
      illiquidLen, // eslint-disable-line @typescript-eslint/no-unused-vars
      liquidLen, // eslint-disable-line @typescript-eslint/no-unused-vars
      nftLen, // eslint-disable-line @typescript-eslint/no-unused-vars
      composableLen, // eslint-disable-line @typescript-eslint/no-unused-vars
      fundTokenDecimals,
      fundBaseTokenDecimals,
      fundGovernanceTokenDecimals,
      fundTokenSupply,
      fundBaseTokenSupply, // eslint-disable-line @typescript-eslint/no-unused-vars
      fundGovernanceTokenSupply,
      safeContractBaseTokenBalance,
      fundContractBaseTokenBalance,
      fundMetadata,
      fundName, // eslint-disable-line @typescript-eslint/no-unused-vars
      fundBaseTokenSymbol,
      fundGovernanceTokenSymbol,
    } = fundNavMetaData;

    const {
      votingDelay,
      votingPeriod,
      proposalThreshold,
      lateQuorumVoteExtension,
      quorumNumerator,
      quorumDenominator,
      clockMode,
    } = governanceInfo;

    const parsedClockMode = fundStore.parseClockMode(clockMode);
    console.log("parsedClockMode: ", parsedClockMode);
    console.log("fundSettings: ", fundSettings)
    const quorumVotes: bigint = ((((fundGovernanceTokenSupply as bigint) *
      quorumNumerator) as bigint) / quorumDenominator) as bigint;
    const votingUnit =
      parsedClockMode.mode === ClockMode.BlockNumber ? "block" : "second";

    const fund: IFund = {
      // Original fund settings
      originalFundSettings: fundSettings,

      chainName: fundStore.web3Store.chainName,
      chainShort: fundStore.web3Store.chainShort,
      address: fundSettings.fundAddress || "",
      title: fundSettings.fundName || "N/A",
      clockMode: parsedClockMode,
      description: "N/A",
      safeAddress: fundSettings.safe || "",
      governorAddress: fundSettings.governor || "",
      photoUrl: defaultAvatar,
      inceptionDate: startTime
        ? formatDate(new Date(Number(startTime) * 1000))
        : "",
      fundToken: {
        symbol: fundSettings.fundSymbol,
        address: fundSettings.fundAddress,
        decimals: Number(fundTokenDecimals) ?? 18,
      } as IToken,
      baseToken: {
        symbol: fundBaseTokenSymbol ?? "",
        address: fundSettings.baseToken,
        decimals: Number(fundBaseTokenDecimals) ?? 18,
      } as IToken,
      governanceToken: {
        symbol: fundGovernanceTokenSymbol ?? "",
        address: fundSettings.governanceToken,
        decimals: Number(fundGovernanceTokenDecimals) ?? 18,
      } as IToken,
      totalNAVWei: totalNav || BigInt("0"),
      totalDepositBalance: totalDepositBal || BigInt("0"),
      governanceTokenTotalSupply: fundGovernanceTokenSupply,
      fundTokenTotalSupply: fundTokenSupply,
      cumulativeReturnPercent: cumulativeReturn,
      monthlyReturnPercent: undefined,
      sharpeRatio: undefined,
      positionTypeCounts: [] as IPositionTypeCount[],

      // My Fund Positions
      netDeposits: "",

      // Overview fields
      isWhitelistedDeposits: fundSettings.isWhitelistedDeposits,
      allowedDepositAddresses: fundSettings.allowedDepositAddrs,
      allowedManagerAddresses: fundSettings.allowedManagers,
      plannedSettlementPeriod: "",
      minLiquidAssetShare: "",

      // Governance
      votingDelay: pluralizeWord(votingUnit, votingDelay),
      votingPeriod: pluralizeWord(votingUnit, votingPeriod),
      proposalThreshold:
        !proposalThreshold && proposalThreshold !== 0n
          ? "N/A"
          : `${commify(proposalThreshold)} ${fundGovernanceTokenSymbol || "votes"}`,
      quorumVotes,
      quorumVotesFormatted: formatTokenValue(
        quorumVotes,
        fundGovernanceTokenDecimals,
      ),
      quorumNumerator,
      quorumDenominator,
      quorumPercentage: formatPercent(
        quorumDenominator
          ? Number(quorumNumerator) / Number(quorumDenominator)
          : 0,
        false,
        "N/A",
      ),
      lateQuorum: pluralizeWord(votingUnit, lateQuorumVoteExtension),

      // Fees
      depositFee: fundSettings.depositFee.toString(),
      depositFeeAddress: fundSettings.feeCollectors[0],
      withdrawFee: fundSettings.withdrawFee.toString(),
      withdrawFeeAddress: fundSettings.feeCollectors[1],
      managementPeriod: fundSettings.managementPeriod.toString(),
      managementFee: fundSettings.managementFee.toString(),
      managementFeeAddress: fundSettings.feeCollectors[2],
      performancePeriod: fundSettings.performancePeriod.toString(),
      performanceFee: fundSettings.performanceFee.toString(),
      performanceFeeAddress: fundSettings.feeCollectors[3],
      performaceHurdleRateBps: fundSettings.performaceHurdleRateBps,
      feeCollectors: fundSettings.feeCollectors,
      feeBalance: feeBalance * -1n, // Fees should be negative
      safeContractBaseTokenBalance,
      fundContractBaseTokenBalance,

      // NAV Updates
      navUpdates: [] as INAVUpdate[],
    } as IFund;

    // Process metadata if available
    if (fundMetadata) {
      const metaData = JSON.parse(fundMetadata);
      fund.description = metaData.description;
      fund.photoUrl = metaData.photoUrl || defaultAvatar;
      fund.plannedSettlementPeriod = metaData.plannedSettlementPeriod;
      fund.minLiquidAssetShare = metaData.minLiquidAssetShare;
    }

    return fund;
  } catch (error) {
    console.error("Error in promises: ", error, "fund: ", fundSettings);
    return {} as IFund; // Return an empty or default object in case of error
  }
};
