import { useFundStore } from "../fund.store";

import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import type INAVUpdate from "~/types/nav_update";

import defaultAvatar from "@/assets/images/default_avatar.webp";
import { ClockMode } from "~/types/enums/clock_mode";
import type IToken from "~/types/token";
import { ERC20 } from "assets/contracts/ERC20";

export const fetchFundMetaDataAction = async (fundAddress: string): Promise<IFund> => {
  const fundStore = useFundStore();
  const rethinkReaderContract = fundStore.rethinkReaderContract;

  try {
    const fundNavMetaData = await fundStore.callWithRetry(
      () => rethinkReaderContract.methods.getFundMetaData(fundAddress).call(),
    );

    const {
      startTime,
      totalDepositBal,
      feeBalance,
      feePerformancePeriod,
      feeManagePeriod,
      fundTokenDecimals,
      fundBaseTokenDecimals,
      fundGovernanceTokenDecimals,
      fundTokenSupply,
      // fundBaseTokenSupply,
      fundGovernanceTokenSupply,
      safeContractBaseTokenBalance,
      fundContractBaseTokenBalance,
      fundMetadata,
      // fundName,
      fundBaseTokenSymbol,
      fundGovernanceTokenSymbol,
      fundGovernanceData,
      fundSettings,
    } = fundNavMetaData;

    const {
      votingDelay,
      votingPeriod,
      proposalThreshold,
      lateQuorumVoteExtension,
      quorumNumerator,
      quorumDenominator,
      clockMode,
    } = fundGovernanceData;

    fundSettings.performancePeriod = feePerformancePeriod;
    fundSettings.managementPeriod = feeManagePeriod;

    const parsedFundSettings: IFundSettings =
      fundStore.parseFundSettings(fundSettings);

    const parsedClockMode = fundStore.parseClockMode(clockMode);
    console.log("parsedClockMode: ", parsedClockMode);
    console.log("parsedFundSettings: ", parsedFundSettings);
    console.log("fundGovernanceTokenSupply: ", fundGovernanceTokenSupply);

    // TODO fundGovernanceTokenSupply is wrong from reader contract, until it is fixed and redeployed there
    //   manually fetch governance token total supply here. Then remove this line.
    const fundGovernanceTokenContract = new fundStore.web3.eth.Contract(ERC20, parsedFundSettings.governanceToken);
    const fundGovernanceTokenSupplyFixed = await fundGovernanceTokenContract.methods
      .totalSupply()
      .call();
    console.log("fundGovernanceTokenSupplyFixed: ", fundGovernanceTokenSupplyFixed);

    const quorumVotes: bigint = ((((fundGovernanceTokenSupplyFixed as bigint) *
      quorumNumerator) as bigint) / quorumDenominator) as bigint;
    const votingUnit =
      parsedClockMode.mode === ClockMode.BlockNumber ? "block" : "second";

    const fund: IFund = {
      // Original fund settings
      originalFundSettings: parsedFundSettings,
      lastNAVUpdateTotalNAV: undefined,
      chainName: fundStore.web3Store.chainName,
      chainShort: fundStore.web3Store.chainShort,
      address: parsedFundSettings.fundAddress || "",
      title: parsedFundSettings.fundName || "N/A",
      clockMode: parsedClockMode,
      description: "N/A",
      safeAddress: parsedFundSettings.safe || "",
      governorAddress: parsedFundSettings.governor || "",
      photoUrl: defaultAvatar,
      inceptionDate: startTime
        ? formatDate(new Date(Number(startTime) * 1000))
        : "",
      fundToken: {
        symbol: parsedFundSettings.fundSymbol,
        address: parsedFundSettings.fundAddress,
        decimals: Number(fundTokenDecimals) ?? 18,
      } as IToken,
      baseToken: {
        symbol: fundBaseTokenSymbol ?? "",
        address: parsedFundSettings.baseToken,
        decimals: Number(fundBaseTokenDecimals) ?? 18,
      } as IToken,
      governanceToken: {
        symbol: fundGovernanceTokenSymbol ?? "",
        address: parsedFundSettings.governanceToken,
        decimals: Number(fundGovernanceTokenDecimals) ?? 18,
      } as IToken,
      totalDepositBalance: totalDepositBal || BigInt("0"),
      governanceTokenTotalSupply: fundGovernanceTokenSupplyFixed,
      fundTokenTotalSupply: fundTokenSupply,

      // My Fund Positions
      netDeposits: "",

      // Overview fields
      isWhitelistedDeposits: parsedFundSettings.isWhitelistedDeposits,
      allowedDepositAddresses: parsedFundSettings.allowedDepositAddrs,
      allowedManagerAddresses: parsedFundSettings.allowedManagers,
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
      depositFee: parsedFundSettings.depositFee.toString(),
      depositFeeAddress: parsedFundSettings.feeCollectors[0],
      withdrawFee: parsedFundSettings.withdrawFee.toString(),
      withdrawFeeAddress: parsedFundSettings.feeCollectors[1],
      managementPeriod: parsedFundSettings.managementPeriod.toString(),
      managementFee: parsedFundSettings.managementFee.toString(),
      managementFeeAddress: parsedFundSettings.feeCollectors[2],
      performancePeriod: parsedFundSettings.performancePeriod.toString(),
      performanceFee: parsedFundSettings.performanceFee.toString(),
      performanceFeeAddress: parsedFundSettings.feeCollectors[3],
      performaceHurdleRateBps: parsedFundSettings.performaceHurdleRateBps,
      feeCollectors: parsedFundSettings.feeCollectors,
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
    fundStore.fund = fund;
    return fund;
  } catch (error) {
    console.error("Error in promises: ", error, "fund: ", fundAddress);
    return {} as IFund; // Return an empty or default object in case of error
  }
};
