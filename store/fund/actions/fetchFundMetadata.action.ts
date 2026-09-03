import { useFundStore } from "../fund.store";

import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import type INAVUpdate from "~/types/nav_update";

import defaultAvatar from "@/assets/images/default_avatar.webp?inline";
import { ERC20 } from "assets/contracts/ERC20";
import { formatQuorumPercentage } from "~/composables/formatters";
import { parseClockMode } from "~/composables/fund/parseClockMode";
import { parseBigintsToString } from "~/composables/fund/parseBigintsToString";
import {
  fetchGovernorGovernanceData,
  resolveFundGovernorAddress,
} from "~/composables/fund/resolveFundGovernor";
import { fetchBackendFundMetadata } from "~/services/backend/fund";
import { fundMetaDataHardcoded } from "~/store/funds/config/fundMetadata.config";
import { patchCachedFundOverview } from "~/store/funds/fundOverviewCache";
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
      "getFundMetaData",
      fundAddress,
      fundChainId,
      rethinkReaderContract,
    );

    // Tier 1: the backend assembles the whole dependent chain below — reader
    // struct, resolved governor, that governor's governance data, the live
    // governance token supply, the factory flag — and serves it as one answer.
    // Soft-fails to null, so everything after it stays exactly as it was.
    const backendSnapshot = await fetchBackendFundMetadata(
      fundChainId,
      fundAddress,
    );

    const fundMetaData =
      backendSnapshot?.fundMetaData ??
      (await web3Store.callWithRetry(fundChainId, () =>
        rethinkReaderContract.methods.getFundMetaData(fundAddress).call(),
      ));
    console.log("fundMetaData", fundMetaData);
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
    } = fundMetaData;

    fundSettings.performancePeriod = feePerformancePeriod;
    fundSettings.managementPeriod = feeManagePeriod;

    const parsedFundSettings: IFundSettings = parseBigintsToString(fundSettings);
    console.log("parsedFundSettings: ", parsedFundSettings);

    // After Roles v2 activation settings.governor is the Safe, so the reader
    // aimed its governance staticcalls at a Safe and handed back a zeroed
    // struct. Resolve the real governor and read governance off that instead.
    // Two more serial round trips on the RPC path; already folded in on the
    // backend one.
    const governorAddress =
      backendSnapshot?.governorAddress ??
      (await resolveFundGovernorAddress(fundChainId, parsedFundSettings));
    let governanceData = backendSnapshot?.governanceData ?? fundGovernanceData;
    if (
      !backendSnapshot &&
      governorAddress &&
      governorAddress.toLowerCase() !==
        (parsedFundSettings.governor ?? "").toLowerCase()
    ) {
      governanceData =
        (await fetchGovernorGovernanceData(fundChainId, governorAddress)) ??
        fundGovernanceData;
    }

    const {
      votingDelay,
      votingPeriod,
      proposalThreshold,
      lateQuorumVoteExtension,
      quorumNumerator,
      quorumDenominator,
      clockMode,
    } = governanceData;

    const parsedClockMode = parseClockMode(clockMode);

    // TODO fundGovernanceTokenSupply is wrong from reader contract, until it is fixed and redeployed there
    //   manually fetch governance token total supply here. Then remove this line.
    const fundGovernanceTokenContract = web3Store.getCustomContract(
      fundChainId,
      ERC20,
      parsedFundSettings?.governanceToken ?? "",
    );
    const fundGovernanceTokenSupplyFixed =
      backendSnapshot
        ? BigInt(backendSnapshot.governanceTokenSupply || "0")
        : await web3Store.callWithRetry(
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

    // A zero denominator means governance could not be read at all. Dividing
    // by it throws, and a throw here loses the entire fund — the page can only
    // render "problem loading the vault".
    const quorumVotes: bigint = quorumDenominator
      ? ((fundGovernanceTokenSupplyFixed as bigint) * quorumNumerator) /
        quorumDenominator
      : 0n;

    // TOOD no need to fetch this here, it would be better to fetch it when needed for formatting.
    // Same reasoning as quorumVotes above: this throws when a chain's RPCs will
    // not serve eth_getBlockByNumber, and an uncaught throw here costs the whole
    // vault. averageBlockTime only formats block counts as durations and already
    // falls back to 0, so a vault without it renders everything else fine.
    let averageBlockTime = 0;
    try {
      const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(fundChainId);
      averageBlockTime = blockTimeContext?.averageBlockTime || 0;
    } catch (error) {
      console.warn(
        "Failed to resolve block time context, continuing without it. chain:",
        fundChainId,
        error,
      );
    }

    const fundNetwork = networksMap[fundChainId];
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
      // Not parsedFundSettings.governor: that field is the Safe on vaults that
      // have activated Roles v2. See resolveFundGovernorAddress.
      governorAddress: governorAddress || "",
      photoUrl: defaultAvatar,
      inceptionDate: startTime
        ? formatDate(new Date(Number(startTime) * 1000))
        : "",
      inceptionDateTimestamp: startTime ? Number(startTime) : undefined,
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

      // Check later in the code if it is V2
      fundFactoryContractV2Used: false,
    } as IFund;
    console.log("fund fund: ", fund);

    // Process metadata if available
    if (fundMetadata) {
      const metaData = JSON.parse(fundMetadata);

      const { strategistName, strategistUrl, oivChatUrl } = fundMetaDataHardcoded[fundChainId]?.find(
        (fund) => fund?.address === fundAddress,
      ) || { strategistName: "", strategistUrl: "", oivChatUrl: "" };

      fund.description = metaData.description;
      fund.photoUrl = metaData.photoUrl || defaultAvatar;
      fund.plannedSettlementPeriod = metaData.plannedSettlementPeriod;
      fund.minLiquidAssetShare = metaData.minLiquidAssetShare;
      fund.strategistName = metaData?.strategistName || strategistName;
      fund.strategistUrl = metaData?.strategistUrl || strategistUrl;
      fund.oivChatUrl = metaData?.oivChatUrl || oivChatUrl;
    }

    // The NAV history and the total it carries are loaded by fetchFundNAVData,
    // and a page served from cache already holds last visit's. Metadata must
    // not blank them for the round trip in between.
    const stored = (fundStore.chainFunds[fundChainId][fundAddress] ??=
      {} as IFund);
    const { navUpdates, lastNAVUpdateTotalNAV, ...metadata } = fund;
    Object.assign(stored, metadata);
    if (!stored.navUpdates?.length) {
      stored.navUpdates = navUpdates;
      stored.lastNAVUpdateTotalNAV = lastNAVUpdateTotalNAV;
    }

    // The backend already knows which factory registered this vault, so on that
    // path the flag is set before the fund is stored rather than by a probe
    // that lands afterwards — the curator Vault Profile page renders off this
    // flag, and its "needs a Roles V2 vault" branch is what a late answer shows
    // in the meantime.
    if (backendSnapshot) {
      fund.fundFactoryContractV2Used = backendSnapshot.factoryVersion === "v2";
      stored.fundFactoryContractV2Used = fund.fundFactoryContractV2Used;
    } else {
      fundStore.fetchGovernableFundFactoryVersion(fundChainId, fundAddress).then(
        version => {
          const current = fundStore.chainFunds[fundChainId]?.[fundAddress];
          if (current) {
            current.fundFactoryContractV2Used = version === "v2";
            patchCachedFundOverview(fundChainId, fundAddress, { fund: current });
          }
        },
      )
    }
    // The next visit paints from this before asking anyone.
    patchCachedFundOverview(fundChainId, fundAddress, { fund: stored });
    return fund;
  } catch (error) {
    console.error("Error in promises: ", error, "fund: ", fundAddress);
    return {} as IFund; // Return an empty or default object in case of error
  }
};
