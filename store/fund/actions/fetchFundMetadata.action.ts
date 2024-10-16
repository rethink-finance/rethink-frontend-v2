import { useFundStore } from "../fund.store";

import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import type INAVUpdate from "~/types/nav_update";

import defaultAvatar from "@/assets/images/default_avatar.webp";
import { ERC20 } from "~/assets/contracts/ERC20";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { RethinkFundGovernor } from "~/assets/contracts/RethinkFundGovernor";
import { ClockMode } from "~/types/enums/clock_mode";
import type IPositionTypeCount from "~/types/position_type";
import type IToken from "~/types/token";

export const fetchFundMetadataAction = async (fundSettings: IFundSettings): Promise<IFund> => {
  const fundStore = useFundStore();
  const fundBaseTokenContract = new fundStore.web3.eth.Contract(ERC20, fundSettings.baseToken);
  const fundTokenContract = new fundStore.web3.eth.Contract(ERC20, fundSettings.fundAddress);
  const governanceTokenContract = new fundStore.web3.eth.Contract(ERC20, fundSettings.governanceToken);
  const rethinkFundGovernorContract = new fundStore.web3.eth.Contract(
    RethinkFundGovernor.abi,
    fundSettings.governor,
  );

  // GovernableFund contract to get totalNAV.
  const fundContract = new fundStore.web3.eth.Contract(GovernableFund.abi, fundSettings.fundAddress);

  try {
    // Fetch all token symbols, decimals and values.
    // TODO move all these metadata calls to one ReaderContract method.
    const results = await Promise.allSettled(
      [
        () => fundContract.methods.getFundStartTime().call(),
        () => fundContract.methods.fundMetadata().call(),
        () => fundContract.methods._feeBal().call(),
        () => fundBaseTokenContract.methods.balanceOf(fundSettings.safe).call(),
        () => fundBaseTokenContract.methods.balanceOf(fundSettings.fundAddress).call(),
        () => fundStore.web3Store.getTokenInfo(fundBaseTokenContract, "symbol", fundSettings.baseToken),
        () => fundStore.web3Store.getTokenInfo(fundBaseTokenContract, "decimals", fundSettings.baseToken),
        () => fundStore.web3Store.getTokenInfo(governanceTokenContract, "symbol", fundSettings.governanceToken),
        () => fundStore.web3Store.getTokenInfo(governanceTokenContract, "decimals", fundSettings.governanceToken),
        () => governanceTokenContract.methods.totalSupply().call(),  // Get un-cached total supply.
        () => fundStore.web3Store.getTokenInfo(fundTokenContract, "decimals", fundSettings.governanceToken),
        () => fundTokenContract.methods.totalSupply().call(),  // Get un-cached total supply.
        () => fundContract.methods.totalNAV().call(),
        () => fundContract.methods._totalDepositBal().call(),
        () => rethinkFundGovernorContract.methods.votingDelay().call(),
        () => rethinkFundGovernorContract.methods.votingPeriod().call(),
        () => rethinkFundGovernorContract.methods.proposalThreshold().call(),
        () => rethinkFundGovernorContract.methods.lateQuorumVoteExtension().call(),
        () => rethinkFundGovernorContract.methods.quorumNumerator().call(),
        () => rethinkFundGovernorContract.methods.quorumDenominator().call(),
        () => rethinkFundGovernorContract.methods.CLOCK_MODE().call(),
      ].map((fn: () => Promise<any>) => fundStore.accountStore.requestConcurrencyLimit(
        () => fundStore.callWithRetry(fn)),
      ),
    );

    const [
      fundStartTime,
      metaDataJson,
      feeBalance,
      safeContractBaseTokenBalance,
      fundContractBaseTokenBalance,
      baseTokenSymbol,
      baseTokenDecimals,
      governanceTokenSymbol,
      governanceTokenDecimals,
      governanceTokenTotalSupply,
      fundTokenDecimals,
      fundTokenTotalSupply,
      fundTotalNAV,
      fundTotalDepositBalance,
      fundVotingDelay,
      fundVotingPeriod,
      fundProposalThreshold,
      fundLateQuorum,
      quorumNumerator,
      quorumDenominator,
      clockModeString,
    ]: any[] = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value
      }
      console.error("Failed fetching fund data value for: ", index, result)
      return undefined
    });

    const clockMode = fundStore.parseClockMode(clockModeString);
    console.log("clockMode: ", clockMode);
    console.log("fundSettings: ", fundSettings)
    const quorumVotes: bigint = governanceTokenTotalSupply as bigint * quorumNumerator as bigint / quorumDenominator as bigint;
    const votingUnit = clockMode.mode === ClockMode.BlockNumber ? "block" : "second";

    const fund: IFund = {
      // Original fund settings
      originalFundSettings: fundSettings,

      chainName: fundStore.web3Store.chainName,
      chainShort: fundStore.web3Store.chainShort,
      address: fundSettings.fundAddress || "",
      title: fundSettings.fundName || "N/A",
      clockMode,
      description: "N/A",
      safeAddress: fundSettings.safe || "",
      governorAddress: fundSettings.governor || "",
      photoUrl: defaultAvatar,
      inceptionDate: fundStartTime ? formatDate(new Date(Number(fundStartTime) * 1000)) : "",
      fundToken: {
        symbol: fundSettings.fundSymbol,
        address: fundSettings.fundAddress,
        decimals: Number(fundTokenDecimals) ?? 18,
      } as IToken,
      baseToken: {
        symbol: baseTokenSymbol ?? "",
        address: fundSettings.baseToken,
        decimals: Number(baseTokenDecimals) ?? 18,
      } as IToken,
      governanceToken: {
        symbol: governanceTokenSymbol ?? "",
        address: fundSettings.governanceToken,
        decimals: Number(governanceTokenDecimals) ?? 18,
      } as IToken,
      totalNAVWei: fundTotalNAV || BigInt("0"),
      totalDepositBalance: fundTotalDepositBalance || BigInt("0"),
      governanceTokenTotalSupply,
      fundTokenTotalSupply,
      cumulativeReturnPercent: calculateCumulativeReturnPercent(fundTotalDepositBalance, fundTotalNAV, baseTokenDecimals),
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
      votingDelay: pluralizeWord(votingUnit, fundVotingDelay),
      votingPeriod: pluralizeWord(votingUnit, fundVotingPeriod),
      proposalThreshold: (!fundProposalThreshold && fundProposalThreshold !== 0n) ? "N/A" : `${commify(fundProposalThreshold)} ${governanceTokenSymbol || "votes"}`,
      quorumVotes,
      quorumVotesFormatted: formatTokenValue(quorumVotes, governanceTokenDecimals),
      quorumNumerator,
      quorumDenominator,
      quorumPercentage: formatPercent(
        quorumDenominator ? Number(quorumNumerator) / Number(quorumDenominator) : 0,
        false,
        "N/A",
      ),
      lateQuorum: pluralizeWord(votingUnit, fundLateQuorum),

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
    if (metaDataJson) {
      const metaData = JSON.parse(metaDataJson);
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
