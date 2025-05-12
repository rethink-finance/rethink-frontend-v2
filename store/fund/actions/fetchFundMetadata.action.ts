import { useFundStore } from "../fund.store";

import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import type INAVUpdate from "~/types/nav_update";

import defaultAvatar from "@/assets/images/default_avatar.webp";
import { ERC20 } from "assets/contracts/ERC20";
import { formatQuorumPercentage } from "~/composables/formatters";
import { parseClockMode } from "~/composables/fund/parseClockMode";
import { parseFundSettings } from "~/composables/fund/parseFundSettings";
import { fundMetaDataHardcoded } from "~/store/funds/config/fundMetadata.config";
import { networksMap } from "~/store/web3/networksMap";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";
import { type ChainId } from "~/types/enums/chain_id";
import type IToken from "~/types/token";

export const fetchFundMetaDataAction = async (
  fundChainId: ChainId,
  fundAddress: string,
): Promise<IFund> => {
  const web3Store = useWeb3Store();
  const blockTimeStore = useBlockTimeStore();
  const fundStore = useFundStore();
  const rethinkReaderContract =
    web3Store.chainContracts[fundChainId]?.rethinkReaderContract;
  try {
    console.debug(
      "fundNavMetaData",
      fundAddress,
      fundChainId,
      rethinkReaderContract,
    );

    const fundNavMetaData = await web3Store.callWithRetry(
      fundChainId,
      () =>
        rethinkReaderContract.methods.getFundMetaData(fundAddress).call(),
    );
    console.log("fundNavMetaData", fundNavMetaData);
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
    console.debug("fundSettings: ", fundSettings);

    const parsedFundSettings: IFundSettings = parseFundSettings(fundSettings);
    const parsedClockMode = parseClockMode(clockMode);
    console.debug("parsedClockMode: ", parsedClockMode);
    console.log("parsedFundSettings: ", parsedFundSettings);
    console.debug("fundGovernanceTokenSupply: ", fundGovernanceTokenSupply);

    // TODO fundGovernanceTokenSupply is wrong from reader contract, until it is fixed and redeployed there
    //   manually fetch governance token total supply here. Then remove this line.
    const fundGovernanceTokenContract = web3Store.getCustomContract(
      fundChainId,
      ERC20,
      parsedFundSettings?.governanceToken ?? "",
    );
    const fundGovernanceTokenSupplyFixed =
      await web3Store.callWithRetry(
        fundChainId,
        () => fundGovernanceTokenContract.methods.totalSupply().call(),
      );
    if (fundGovernanceTokenSupply !== fundGovernanceTokenSupplyFixed)
      console.warn(
        "[MISMATCH] fundGovernanceTokenSupply: ",
        fundGovernanceTokenSupply,
        "fundGovernanceTokenSupplyFixed: ",
        fundGovernanceTokenSupplyFixed,
      );

    const quorumVotes: bigint = ((((fundGovernanceTokenSupplyFixed as bigint) *
      quorumNumerator) as bigint) / quorumDenominator) as bigint;

    const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(fundChainId);
    const averageBlockTime = blockTimeContext?.averageBlockTime || 0;
    console.warn("fetchFundMetaDataAction blockTimeContext", blockTimeContext)

    const fundNetwork = networksMap[fundChainId];
    // console.log("fundMetadata.updateTimes");
    // console.log(fundMetadata.updateTimes);
    const lastNavUpdateTime = undefined;//= fundMetadata.updateTimes[fundMetadata.updateTimes.length-1];
    const fund: IFund = {
      // Original fund settings
      originalFundSettings: parsedFundSettings,
      lastNAVUpdateTotalNAV: undefined,
      chainId: fundChainId,
      chainName: fundNetwork.chainName,
      chainShort: fundNetwork.chainShort,
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
      lastNavUpdateTime: lastNavUpdateTime
        ? formatDate(new Date(Number(lastNavUpdateTime) * 1000))
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
      votingDelay: getVoteTimeValue(votingDelay, averageBlockTime, parsedClockMode.mode),
      votingPeriod: getVoteTimeValue(votingPeriod, averageBlockTime, parsedClockMode.mode),
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
      quorumPercentage: formatQuorumPercentage(quorumNumerator, quorumDenominator),
      lateQuorum: getVoteTimeValue(lateQuorumVoteExtension, averageBlockTime, parsedClockMode.mode),

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
    console.log("fund fund: ", fund);

    // Process metadata if available
    if (fundMetadata) {
      const metaData = JSON.parse(fundMetadata);

      const { strategistName, strategistUrl, oivChatUrl } = fundMetaDataHardcoded[fundChainId].find(
        (fund) => fund.address === fundAddress,
      ) || { strategistName: "", strategistUrl: "", oivChatUrl: "" };

      fund.description = metaData.description;
      fund.photoUrl = metaData.photoUrl || defaultAvatar;
      fund.plannedSettlementPeriod = metaData.plannedSettlementPeriod;
      fund.minLiquidAssetShare = metaData.minLiquidAssetShare;
      fund.strategistName = metaData?.strategistName || strategistName;
      fund.strategistUrl = metaData?.strategistUrl || strategistUrl;
      fund.oivChatUrl = metaData?.oivChatUrl || oivChatUrl;
    }
    fundStore.chainFunds[fundChainId][fundAddress] = fund;
    return fund;
  } catch (error) {
    console.error("Error in promises: ", error, "fund: ", fundAddress);
    return {} as IFund; // Return an empty or default object in case of error
  }
};
