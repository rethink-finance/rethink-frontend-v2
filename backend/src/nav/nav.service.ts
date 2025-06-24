import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cron } from "@nestjs/schedule";
import { ethers } from "ethers";
import { Web3 } from "web3";
import pLimit, { LimitFunction } from "p-limit";
import { GovernableFundFactory } from "../../assets/contracts/GovernableFundFactory";
import { GovernableFund } from "../../assets/contracts/GovernableFund";
import { NAVCalculator } from "../../assets/contracts/NAVCalculator";
import { RethinkReader } from "../../assets/contracts/RethinkReader";
import { chainIds, networks, networksMap } from "../shared/networksMap";
import { getContractAddress } from "../types/contract_addresses";
import INetwork from "../types/network";
import { ChainId } from "../types/enums/chain_id";
import IFundMetaData from "../types/fund_meta_data";
import type INAVMethod from "../types/nav_method";
import type IToken from "../types/token";
import type INAVUpdate from "../types/nav_update";
import type IFund from "../types/fund";
import type IFundNavData from "../types/fund_nav_data";
import type INAVParts from "../types/nav_parts";
import {
  NAVEntryTypeToPositionTypeMap,
  PositionType,
  PositionTypeToNAVCalculationMethod,
} from "../types/enums/position_type";
import { NavUpdate } from "./entities/nav-update.entity";
import { NavMethod } from "./entities/nav-method.entity";
import { NavMethodValue } from "./entities/nav-method-value.entity";
import { TotalNavSnapshot } from "./entities/total-nav-snapshot.entity";

@Injectable()
export class NavService {
  private readonly logger = new Logger(NavService.name);
  private retryDelay: 1500;
  private chainProviders: Record<string, Web3> = {};
  private chainContracts: Record<string, any> = {};
  private chainSelectedRpcUrl: Partial<Record<ChainId, string>> = {};
  private chainSelectedRpcIndex: Record<string, number> = {};
  private chainFunds: Record<string, Record<string, IFund>> = {};
  private chainFundNAVUpdates: Record<string, Record<string, INAVUpdate[]>> = {};

  // We want to limit concurrent requests to 2.
  // 2 was chosen arbitrary, it needs to be a low number as RPC nodes block requests if too many are made
  // at the same time.
  private requestConcurrencyLimit: LimitFunction = pLimit(2);

  constructor(
    @InjectRepository(NavUpdate)
    private navUpdateRepository: Repository<NavUpdate>,
    @InjectRepository(NavMethod)
    private navMethodRepository: Repository<NavMethod>,
    @InjectRepository(NavMethodValue)
    private navMethodValueRepository: Repository<NavMethodValue>,
    @InjectRepository(TotalNavSnapshot)
    private totalNavSnapshotRepository: Repository<TotalNavSnapshot>,
  ) {
    // Initialize providers for different chains
    this.initializeProviders();

    this.chainFunds = Object.fromEntries(
      chainIds.map((chainId) => [chainId, {}]),
    ) as Record<string, Record<string, IFund>>;
    this.chainFundNAVUpdates = Object.fromEntries(
      chainIds.map((chainId) => [chainId, {}]),
    ) as Record<string, Record<string, INAVUpdate[]>>;
  }

  private initializeProviders() {
    console.debug("Initialize providers");

    networks.forEach((network: INetwork) => {
      const chainId = network.chainId as ChainId;
      const rpcUrl = networksMap[chainId]?.rpcUrls[0];
      if (!rpcUrl) {
        console.error("No RPC url for chainId", chainId);
      }

      this.chainSelectedRpcUrl[chainId] = rpcUrl || "";
      this.chainSelectedRpcIndex[chainId] = 0;
      // Initialize providers map by iterating over all networks and use the
      // selected chain's RPC url to init the provider.
      const provider = new Web3(this.chainSelectedRpcUrl[chainId]);
      this.chainProviders[chainId] = provider;

      // Initialize contracts if addresses are available
      this.chainContracts[chainId] = {
        fundFactoryContract: new provider.eth.Contract(
          GovernableFundFactory.abi,
          getContractAddress("GovernableFundFactoryBeaconProxy", chainId),
        ),
        rethinkReaderContract: new provider.eth.Contract(
          RethinkReader.abi,
          getContractAddress("RethinkReader", chainId),
        ),
        navCalculatorContract: new provider.eth.Contract(
          NAVCalculator.abi,
          getContractAddress("NAVCalculatorBeaconProxy", chainId),
        ),
      };
    });
  }

  async fetchSimulatedNAVMethodValue(
    fundChainId: ChainId,
    fundAddress: string,
    safeAddress: string,
    baseDecimals: number,
    baseSymbol: string,
    navEntry: INAVMethod,
  ): Promise<INAVMethod> {
    this.logger.log(
      `Calculating NAV for fund ${fundAddress} on chain ${fundChainId}`,
    );

    try {
      // Validate inputs
      if (!navEntry.detailsHash) {
        throw new Error("No detailsHash provided in navEntry");
      }
      if (!baseDecimals || !baseSymbol) {
        throw new Error("No fund base decimals or symbol");
      }
      if (!safeAddress) {
        throw new Error("No fund safe address");
      }

      // Create contract instance
      const navCalculatorContract =
        this.chainContracts[fundChainId]?.navCalculatorContract;

      // Set up navEntry properties
      navEntry.foundMatchingPastNAVUpdateEntryFundAddress = true;
      // navEntry.pastNAVUpdateEntryFundAddress = navEntry.pastNAVUpdateEntryFundAddress || fundAddress;

      // Determine NAV calculation method
      const navCalculationMethod =
        PositionTypeToNAVCalculationMethod[navEntry.positionType];

      // Prepare call data
      const callData: any[] = [];
      if (navEntry.positionType === PositionType.Liquid) {
        callData.push(prepNAVMethodLiquid(navEntry.details));
        callData.push(safeAddress);
      } else if (navEntry.positionType === PositionType.Illiquid) {
        callData.push(prepNAVMethodIlliquid(navEntry.details, baseDecimals));
        callData.push(safeAddress);
      } else if (navEntry.positionType === PositionType.NFT) {
        callData.push(prepNAVMethodNFT(navEntry.details));
      } else if (navEntry.positionType === PositionType.Composable) {
        callData.push(prepNAVMethodComposable(navEntry.details));
      }

      callData.push(
        ...[
          fundAddress, // fund
          0, // navEntryIndex
          false, // isPastNAVUpdate -- set to false to simulate on current fund
          parseInt(navEntry.details.pastNAVUpdateIndex || "0"), // pastNAVUpdateIndex
          parseInt(navEntry.details.pastNAVUpdateEntryIndex || "0"), // pastNAVUpdateEntryIndex
          navEntry.pastNAVUpdateEntryFundAddress, // pastNAVUpdateEntryFundAddress
        ],
      );

      this.logger.debug(
        `Simulating NAV with method ${navCalculationMethod} and data: ${JSON.stringify(callData)}`,
      );

      // Initialize default values
      navEntry.simulatedNavFormatted = "N/A";
      navEntry.simulatedNav = "0";
      navEntry.isSimulatedNavError = false;

      // Call the contract
      const simulatedVal: bigint = await this.callWithRetry(
        fundChainId,
        () =>
          navCalculatorContract.methods[navCalculationMethod](
            ...callData,
          ).call(),
        1,
        [-32603, 310], // Do not retry internal errors (probably invalid NAV method)
      );

      this.logger.log(`Simulated NAV value: ${simulatedVal}`);

      // Format the value
      const valueFormatted = simulatedVal
        ? formatTokenValue(simulatedVal, baseDecimals, true, false)
        : "0";

      navEntry.simulatedNavFormatted = `${valueFormatted} ${baseSymbol}`;
      navEntry.simulatedNav = simulatedVal.toString();
      return navEntry;
    } catch (error) {
      this.logger.error(`Error calculating NAV: ${error.message}`, error.stack);
      throw error;
    }
  }

  networkRpcUrls(chainId: ChainId): string[] {
    const network = networksMap[chainId];
    return removeDuplicates(network.rpcUrls || []);
  }

  async callWithRetry(
    chainId: ChainId,
    method: () => any,
    maxRetries: number = 1,
    extraIgnorableErrorCodes?: any[],
    timeoutMs: number = 4000,
  ): Promise<any> {
    // TODO: see the TODO below for the possible upgrade of callWithRetry
    const RPCUrlsLength = this.networkRpcUrls(chainId).length;
    let retries = 0;
    let switchedRPCCount = 0;
    if (!method) return;

    while (retries <= maxRetries && switchedRPCCount <= RPCUrlsLength) {
      try {
        // Call the method, but also do a timeout promise of 1.5 seconds.
        return await Promise.race([
          method(),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error(`Method call timed out after ${timeoutMs}ms`)),
              timeoutMs,
            ),
          ),
        ]);
      } catch (error: any) {
        const ignorableErrorCodes = [4001];
        // If user passed additional error codes that we don't want to retry, add them to ignorableErrorCodes.
        // For example sometimes we know that method may fail with internal RPC error (-32603) and it's not RPC's
        // fault, and we just want it to fail, instead of endlessly repeating it and switching RPC URL. Can happen
        // when simulating NAV method with wrong parameters.
        if (extraIgnorableErrorCodes?.length) {
          ignorableErrorCodes.push(...extraIgnorableErrorCodes);
        }

        // Get a list of error codes. Use innerError to catch Metamask exception codes.
        const errorCodes = new Set([error?.code, error?.innerError?.code]);
        let errorData = error?.message;
        try {
          // https://docs.web3js.org/api/web3-errors/class/InternalError
          errorData = error.toJSON();
        } catch {}

        // Check Metamask errors:
        // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
        // Metamask rejected.
        if (
          ignorableErrorCodes.some((code) => errorCodes.has(code)) ||
          error?.message?.indexOf("User denied transaction") >= 0
        ) {
          console.debug(
            "RPC error is one of known metamask errors",
            error?.code,
            errorData,
          );
          throw error;
        }

        const rpcUrl = (this.chainProviders[chainId].currentProvider as any)
          ?.clientUrl;
        console.error(
          `RPC error ${retries}/${maxRetries}`,
          errorCodes,
          "method:",
          method,
          errorData,
          "data:",
          error.data,
          `rpcUrl: ${rpcUrl}`,
        );
        retries++;
        if (retries > maxRetries) {
          this.switchRpcUrl(chainId);
          retries = 0;
          switchedRPCCount++;
        }
        await delay(this.retryDelay);
      }
    }
    throw new Error("Max retries reached for all RPC URLs");
  }

  switchRpcUrl(chainId: ChainId): void {
    if (!chainId) return;
    const rpcUrls = this.networkRpcUrls(chainId);
    this.chainSelectedRpcIndex[chainId] =
      (this.chainSelectedRpcIndex[chainId] + 1) % rpcUrls.length;
    const newRpcUrl = rpcUrls[this.chainSelectedRpcIndex[chainId]];
    console.log(
      `Switching to RPC URL: ${chainId}: ${newRpcUrl}`,
      this.chainSelectedRpcIndex[chainId],
    );

    const chainProvider = this.chainProviders[chainId];

    if (!chainProvider) {
      this.chainProviders[chainId] = new Web3(newRpcUrl);
    } else {
      console.log(
        "set new provider on chain",
        chainId,
        " to RPC url",
        newRpcUrl,
      );
      chainProvider.setProvider(new Web3.providers.HttpProvider(newRpcUrl));
    }

    // Also update the provider for all contracts
    Object.values(this.chainContracts[chainId]).forEach((contract: any) => {
      if (contract.setProvider) {
        contract.setProvider(new Web3.providers.HttpProvider(newRpcUrl));
      }
    });
  }

  async getLatestNavUpdateTotalValue(fundAddress: string, fundChainId?: ChainId): Promise<{
    totalValue: string,
    formattedValue: string,
    baseSymbol: string,
    baseDecimals: number,
  }> {
    // Create a query to find the fund
    const query: any = { fundAddress };

    if (fundChainId) {
      query.fundChainId = fundChainId;
    }

    // TODO check fund nav updates on chain if this is really the latest nav update index,
    //    if not, fetch them to prevent serving stale data
    // TODO if nav updates length is 0, don't try fetching here, to prevent infinite recursion
    // Find the latest navUpdateIndex for this fund using NavUpdate
    const latestNavUpdate = await this.navUpdateRepository.findOne({
      where: query,
      order: { navUpdateIndex: "DESC" },
      select: ["id", "navUpdateIndex", "baseSymbol", "baseDecimals"],
    });

    if (!latestNavUpdate) {
      // If no value in cache and chainId is provided, try calculating NAV for this fund
      if (fundChainId) {
        this.logger.log(`No NAV data found for fund ${fundAddress} on chain ${fundChainId}, calculating now...`);
        try {
          await this.calculateNavForFund(fundChainId, fundAddress);

          // Try to get the data again after calculation
          return this.getLatestNavUpdateTotalValue(fundAddress, fundChainId);
        } catch (error) {
          this.logger.error(`Failed to calculate NAV for fund ${fundAddress} on chain ${fundChainId}: ${error.message}`);
        }
      }

      return {
        totalValue: "0",
        formattedValue: "0",
        baseSymbol: "",
        baseDecimals: 0,
      };
    }

    // Use a direct query to get the latest NavMethodValue for each navMethodId
    const latestNavMethodValues = await this.navMethodValueRepository
      .createQueryBuilder("nmv")
      .select("nmv.*")
      .where("nmv.fundAddress = :fundAddress", { fundAddress })
      .andWhere("nmv.navUpdateId = :navUpdateId", { navUpdateId: latestNavUpdate.id })
      .andWhere(qb => {
        const subQuery = qb
          .subQuery()
          .select("MAX(nmv2.calculatedAt)")
          .from(NavMethodValue, "nmv2")
          .where("nmv2.fundAddress = nmv.fundAddress")
          .andWhere("nmv2.fundChainId = nmv.fundChainId")
          .andWhere("nmv2.navUpdateId = nmv.navUpdateId")
          .andWhere("nmv2.navMethodId = nmv.navMethodId")
          .getQuery();
        return "nmv.calculatedAt = " + subQuery;
      })
      .getRawMany();

    if (latestNavMethodValues.length === 0) {
      return {
        totalValue: "0",
        formattedValue: "0",
        baseSymbol: latestNavUpdate.baseSymbol || "",
        baseDecimals: latestNavUpdate.baseDecimals || 0,
      };
    }

    // Sum the values
    let totalValue = BigInt(0);
    for (const navMethodValue of latestNavMethodValues) {
      totalValue += BigInt(navMethodValue.simulatedNav);
    }

    // Format the total value
    const formattedValue = formatTokenValue(totalValue, latestNavUpdate.baseDecimals, true, false);

    return {
      totalValue: totalValue.toString(),
      formattedValue: `${formattedValue} ${latestNavUpdate.baseSymbol}`,
      baseSymbol: latestNavUpdate.baseSymbol,
      baseDecimals: latestNavUpdate.baseDecimals || 0,
    };
  }

  /**
   * Get the latest NAV update snapshot for a fund
   * @param fundAddress The fund address
   * @param fundChainId The fund chain ID
   * @returns The latest NAV update snapshot
   */
  async getLatestNavUpdateSnapshot(fundAddress: string, fundChainId?: ChainId): Promise<TotalNavSnapshot> {
    // Create a query to find the fund
    const query: any = { fundAddress };

    if (fundChainId) {
      query.fundChainId = fundChainId;
    }

    // Find the latest NAV update snapshot for this fund
    const latestSnapshot = await this.totalNavSnapshotRepository.findOne({
      where: query,
      order: { navUpdateIndex: "DESC" },
      relations: ["navUpdate", "navMethodValues"],
    });

    if (!latestSnapshot) {
      // If no snapshot in cache and chainId is provided, try calculating NAV for this fund
      if (fundChainId) {
        this.logger.log(`No NAV snapshot found for fund ${fundAddress} on chain ${fundChainId}, calculating now...`);
        try {
          await this.calculateNavForFund(fundChainId, fundAddress);

          // Try to get the data again after calculation
          return this.getLatestNavUpdateSnapshot(fundAddress, fundChainId);
        } catch (error) {
          this.logger.error(`Failed to calculate NAV for fund ${fundAddress} on chain ${fundChainId}: ${error.message}`);
          throw error;
        }
      }

      throw new Error(`No NAV snapshot found for fund ${fundAddress}`);
    }

    return latestSnapshot;
  }

  /**
   * Process NAV data for funds
   * @param chainId The chain ID
   * @param fundsInfo Record of fund info
   */
  private async processNavForFunds(
    chainId: ChainId,
    fundsInfo: Record<string, any>,
  ): Promise<void> {
    // Fetch metadata for the funds
    const fetchedFunds = await this.fetchFundsMetaDataAction(
      chainId,
      fundsInfo,
    );

    this.chainFunds[chainId] = {
      ...(this.chainFunds[chainId] || {}),
      ...fetchedFunds,
    };

    // If fundsInfoArrays is provided, use:
    await this.fetchFundsNavMethods(chainId, fundsInfo);

    //   // Simulate current NAV
    //   await this.fetchSimulateCurrentNAVAction(chainId, fundAddress);
    // }
  }

  @Cron("0 */5 * * * *") // Run every 5 minutes
  async calculateNavForAllFunds() {
    this.logger.log("Running scheduled NAV calculation for all funds");

    try {
      // TODO: remove this ChainId filter
      for (const chainId of chainIds.filter(chainId => chainId === ChainId.POLYGON)) {
        this.logger.log("Running scheduled NAV calculation for chain", chainId);

        try {
          // Get the fund factory contract address
          const fundFactoryAddress = getContractAddress(
            "GovernableFundFactoryBeaconProxy",
            chainId,
          );
          if (!fundFactoryAddress) {
            throw new Error(
              `No fund factory contract address found for chainId: ${chainId}`,
            );
          }

          // Create fund factory contract instance
          const fundFactoryContract =
            this.chainContracts[chainId]?.fundFactoryContract;
          if (!fundFactoryContract) {
            throw new Error(
              `No fund factory contract found for chainId: ${chainId}`,
            );
          }

          // Get the total number of registered funds
          const fundsLength = await this.callWithRetry(chainId, () =>
            fundFactoryContract.methods.registeredFundsLength().call(),
          );
          this.logger.log(
            "Running scheduled NAV calculation for chain",
            chainId,
            fundsLength,
          );

          // Get all registered funds data
          const fundsInfoArrays = await this.callWithRetry(chainId, () =>
            fundFactoryContract.methods
              .registeredFundsData(0, fundsLength)
              .call(),
          );

          this.logger.log(`Found ${fundsLength} funds on chain ${chainId}`);

          // NOTE: SAME AS processChain in fetchFundsAction
          const fundsInfo: Record<string, any> = {};
          // Filter out excluded test funds if necessary
          for (let i = 0; i < fundsInfoArrays[0].length; i++) {
            const fundAddress = fundsInfoArrays[0][i];
            const fundInfo = fundsInfoArrays[1][i];
            if (
              excludedFundAddresses[chainId]?.includes(
                fundAddress.toLowerCase(),
              )
            ) {
              continue;
            }
            fundsInfo[fundAddress] = fundInfo;
          }

          // Process NAV for the filtered funds
          await this.processNavForFunds(chainId, fundsInfo);
        } catch (error) {
          this.logger.error(
            `Error in scheduled NAV calculation for chain ${chainId}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error in scheduled NAV calculation: ${error.message}`);
    }
  }

  async calculateNavForFund(
    fundChainId: ChainId,
    fundAddress: string,
  ): Promise<void> {
    this.logger.log(`Calculating NAV for fund ${fundAddress} on chain ${fundChainId}`);

    try {
      // Get the rethink reader contract
      const rethinkReaderContract =
        this.chainContracts[fundChainId]?.rethinkReaderContract;
      if (!rethinkReaderContract) {
        throw new Error(`No reader contract found for chainId: ${fundChainId}`);
      }

      // Fetch fund metadata
      const fundMetaData = await this.callWithRetry(fundChainId, () =>
        rethinkReaderContract.methods.getFundMetaData(fundAddress).call(),
      );

      // Create a fundsInfo object with just this fund
      const fundsInfo: Record<string, any> = {};
      fundsInfo[fundAddress] = {
        fundSymbol: fundMetaData.fundSettings.fundSymbol,
      };

      // Process NAV for the single fund
      await this.processNavForFunds(fundChainId, fundsInfo);

      this.logger.log(`Completed NAV calculation for fund ${fundAddress} on chain ${fundChainId}`);
    } catch (error) {
      this.logger.error(`Error calculating NAV for fund ${fundAddress} on chain ${fundChainId}: ${error.message}`);
      throw error;
    }
  }

  async fetchFundsMetaDataAction(
    chainId: ChainId,
    fundsInfo: Record<string, any>,
  ): Promise<Record<string, IFund>> {
    console.log(
      "process fund fetchFundsMetaDataAction fetchFundsMetaDataAction fetchFundsMetaDataAction ",
      chainId,
    );
    const funds: Record<string, IFund> = {};
    const rethinkReaderContract =
      this.chainContracts[chainId]?.rethinkReaderContract;
    if (!rethinkReaderContract) {
      throw new Error(`No reader contract found for chainId: ${chainId}`);
    }
    const fundNetwork = networksMap[chainId];
    const fundAddresses: string[] = Object.keys(fundsInfo);

    try {
      console.log("process fund fundsMetaData", chainId, fundAddresses);
      const fundsMetaData: IFundMetaData[] = await this.callWithRetry(chainId, () =>
        rethinkReaderContract.methods.getFundsMetaData(fundAddresses).call(),
      );
      console.debug(
        "process fund fundsMetaData done",
        chainId,
        "fundsMetaData:",
        fundsMetaData,
      );

      for (const [index, address] of fundAddresses.entries()) {
        const fundMetaData: IFundMetaData = fundsMetaData[index];
        const totalDepositBalance = fundMetaData.totalDepositBal || 0n;
        const baseTokenDecimals = Number(fundMetaData.fundBaseTokenDecimals);
        const fundTokenDecimals = Number(fundMetaData.fundTokenDecimals);

        funds[address] = {
          chainId,
          chainName: fundNetwork.chainName,
          chainShort: fundNetwork.chainShort,
          address,
          title: fundMetaData.fundName || "N/A",
          description: "N/A",
          safeAddress: fundMetaData?.fundSettings?.safe || "",
          governorAddress: fundMetaData?.fundSettings?.governor || "",
          photoUrl: "",
          lastNavUpdateTime: "",
          inceptionDate: "",
          fundToken: {
            symbol: fundsInfo[address].fundSymbol,
            address,
            decimals: fundTokenDecimals,
          } as IToken,
          fundTokenTotalSupply: fundMetaData.fundTokenSupply || 0n,
          baseToken: {
            address: fundMetaData.fundSettings?.baseToken || "",
            symbol: fundMetaData.fundBaseTokenSymbol,
            decimals: baseTokenDecimals,
          },
          governanceToken: {
            symbol: fundMetaData.fundGovernanceTokenSymbol,
            address: fundMetaData.fundSettings?.governanceToken || "",
            decimals: Number(fundMetaData.fundGovernanceTokenDecimals),
          } as IToken, // Not important here, for now.
          governanceTokenTotalSupply:
            fundMetaData.fundGovernanceTokenSupply || 0n,
          totalDepositBalance,
          cumulativeReturnPercent: undefined,
          monthlyReturnPercent: undefined,
          sharpeRatio: undefined,
          positionTypeCounts: [],

          // Share Price
          sharePrice: undefined,

          // My Fund Positions
          netDeposits: "",
          // Overview fields
          isWhitelistedDeposits: true,
          allowedDepositAddresses:
            fundMetaData.fundSettings?.allowedDepositAddrs || [],
          allowedManagerAddresses:
            fundMetaData.fundSettings?.allowedManagers || [],
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
          feeCollectors: fundMetaData.fundSettings?.feeCollectors || [],
          feeBalance: fundMetaData.feeBalance || 0n,
          safeContractBaseTokenBalance:
            fundMetaData.safeContractBaseTokenBalance || 0n,
          fundContractBaseTokenBalance:
            fundMetaData.fundContractBaseTokenBalance || 0n,

          // NAV Updates
          navUpdates: [] as INAVUpdate[],
          isNavUpdatesLoading: true,
        } as IFund;
      }
    } catch (error) {
      console.error(
        "Error calling getFundNavMetaData: ",
        error,
        " addresses: ",
        fundAddresses,
      );
    }
    return funds;
  }

  async fetchFundsNavMethods(chainId: ChainId, fundsInfo: Record<string, any>) {
    this.logger.log("start calculating fund nav data ", chainId);

    // Create a fund factory contract instance
    const rethinkReaderContract =
      this.chainContracts[chainId]?.rethinkReaderContract;
    if (!rethinkReaderContract) {
      throw new Error(`No reader contract found for chainId: ${chainId}`);
    }
    console.log("get nav data", chainId);
    const fundAddresses: string[] = Object.keys(fundsInfo);
    const allFundsNavData = await this.callWithRetry(chainId, () =>
      rethinkReaderContract.methods.getFundsNAVData(fundAddresses).call(),
    );

    // Process each fund's NAV data
    for (const [fundIndex, fundNavData] of allFundsNavData.entries()) {
      const fundAddress = fundAddresses[fundIndex];
      this.processFundNavData(
        chainId,
        fundNavData,
        fundAddress,
      );
      await this.fetchSimulateCurrentNAVAction(chainId, fundAddress);
    }
  }

  fetchSimulateCurrentNAVAction = async (
    fundChainId: ChainId,
    fundAddress: string,
  ): Promise<void> => {
    // Simulate fund's latest NAV update NAV methods.
    console.log("[CURRENT NAV] START SIMULATE:");
    const fund = this.chainFunds[fundChainId]?.[fundAddress];
    const safeAddress = fund?.safeAddress || "";
    const baseDecimals = fund?.baseToken?.decimals || 18;
    const baseSymbol = fund?.baseToken?.symbol || "";
    if (!fund) {
      throw new Error(`Fund not found for chainId: ${fundChainId} address: ${fundAddress}`);
    }
    if (!safeAddress || !baseDecimals || !baseSymbol) {
      throw new Error(`Fund safeAddress or baseDecimals or baseSymbol not found for chainId: ${fundChainId} ` +
      `address: ${fundAddress} safeAddress: ${safeAddress} baseDecimals: ${baseDecimals} baseSymbol: ${baseSymbol}`);
    }

    // Simulate all at once as many promises instead of one by one.
    const promises = [];
    console.log("[CURRENT NAV] START SIMULATE fundLastNavUpdate:");

    const fundNAVUpdates = fund.navUpdates || [];
    // Note: here we are intentionally taking index + 1, as they start with 1 and not 0.
    const lastNavUpdateIndex = fundNAVUpdates?.length;
    const fundLastNavUpdate = fundNAVUpdates?.length ? fundNAVUpdates[lastNavUpdateIndex - 1] : undefined;
    const fundLastNAVUpdateMethods = fundLastNavUpdate?.entries || [];
    console.log("[CURRENT NAV] START SIMULATE fundLastNavUpdate for loop");

    for (const navEntry of fundLastNAVUpdateMethods) {
      // TODO first just save the nav entry data and save it to the database, then we can use another script to simulate values
      promises.push(
        this.requestConcurrencyLimit(() =>
          this.callWithRetry(
            fundChainId,
            () =>
              this.fetchSimulatedNAVMethodValue(
                fundChainId,
                fundAddress,
                safeAddress,
                baseDecimals,
                baseSymbol,
                navEntry,
              ),
            1,
            // Do not retry internal errors (probably invalid NAV method), better to fail on 1st try.
            // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
            [-32603],
          ),
        ),
      );
    }
    console.log("[CURRENT NAV] START SIMULATE fundLastNavUpdate forloop await settled");
    const results = await Promise.allSettled(promises);
    const fulfilledResults = results.filter(r => r.status === "fulfilled");

    // TODO: for now we raise if any of calculations fail, but maybe we should allow partial calculations.
    const areAllNavSimulationsSuccessful = fulfilledResults.length === results.length;
    if (!areAllNavSimulationsSuccessful) {
      throw new Error("Failed to simulate all NAV methods");
    }

    // 1. Find or create NavUpdate
    let navUpdate = await this.navUpdateRepository.findOne({
      where: {
        fundAddress,
        fundChainId,
        navUpdateIndex: lastNavUpdateIndex,
      },
    });

    if (!navUpdate) {
      navUpdate = new NavUpdate();
      navUpdate.fundAddress = fundAddress;
      navUpdate.fundChainId = fundChainId;
      navUpdate.navUpdateIndex = lastNavUpdateIndex;
      navUpdate.safeAddress = safeAddress;
      navUpdate.baseDecimals = baseDecimals;
      navUpdate.baseSymbol = baseSymbol;
      navUpdate = await this.navUpdateRepository.save(navUpdate);
    }

    const calculationTime = new Date();

    // Create the totalNavSnapshot with 0 values.
    const totalNavSnapshot = new TotalNavSnapshot();
    totalNavSnapshot.fundAddress = fundAddress;
    totalNavSnapshot.fundChainId = fundChainId;
    totalNavSnapshot.navUpdateId = navUpdate.id;
    totalNavSnapshot.navUpdateIndex = lastNavUpdateIndex;
    totalNavSnapshot.totalSimulatedNav = "0";
    totalNavSnapshot.totalSimulatedNavFormatted = "0 " + baseSymbol;
    totalNavSnapshot.calculatedAt = calculationTime;
    const savedTotalNavSnapshot = await this.totalNavSnapshotRepository.save(totalNavSnapshot);

    let totalSimulatedNav = 0n;
    const navMethodValues: NavMethodValue[] = [];

    // Save NAV method values to the just created totalNavSnapshot.
    for (const result of fulfilledResults) {
      const navEntry = result.value;

      // 2. Find or create NavMethod
      let navMethod = await this.navMethodRepository.findOne({
        where: {
          fundAddress,
          fundChainId,
          navUpdateId: navUpdate.id,
          detailsHash: navEntry.detailsHash,
        },
      });

      if (!navMethod) {
        navMethod = new NavMethod();
        navMethod.fundAddress = fundAddress;
        navMethod.fundChainId = fundChainId;
        navMethod.navUpdateIndex = lastNavUpdateIndex;
        navMethod.navUpdateId = navUpdate.id;
        navMethod.methodDetails = navEntry;
        navMethod.detailsHash = navEntry.detailsHash;
        navMethod = await this.navMethodRepository.save(navMethod);
      }

      // 3. Create NavMethodValue
      const navMethodValue = new NavMethodValue();
      navMethodValue.fundAddress = fundAddress;
      navMethodValue.fundChainId = fundChainId;
      navMethodValue.navUpdateId = navUpdate.id;
      navMethodValue.navUpdateIndex = lastNavUpdateIndex;
      navMethodValue.navMethodId = navMethod.id;
      navMethodValue.detailsHash = navEntry.detailsHash;
      navMethodValue.simulatedNav = navEntry.simulatedNav.toString();
      navMethodValue.simulatedNavFormatted = navEntry.simulatedNavFormatted;
      navMethodValue.calculatedAt = calculationTime;
      navMethodValue.totalNavSnapshotId = savedTotalNavSnapshot.id;

      // Add navMethodValue to the array for later saving.
      navMethodValues.push(navMethodValue);
      totalSimulatedNav += BigInt(navEntry.simulatedNav);
    }

    // Save all NavMethodValue entities
    await this.navMethodValueRepository.save(navMethodValues);

    // Update the totalNavSnapshot with the correct total value
    savedTotalNavSnapshot.totalSimulatedNav = totalSimulatedNav.toString();
    savedTotalNavSnapshot.totalSimulatedNavFormatted = formatTokenValue(totalSimulatedNav, baseDecimals, true, false) + " " + baseSymbol;
    await this.totalNavSnapshotRepository.save(savedTotalNavSnapshot);
  };

  processFundNavData(
    chainId: ChainId, // the type of FundNavData
    fundNAVData: any, // the type of FundNavData
    fundAddress: string,
  ) {
    this.chainFundNAVUpdates[chainId][fundAddress] = [];

    if (!fundNAVData.encodedNavUpdate?.length) return;
    const navUpdates = this.parseFundNAVUpdates(fundNAVData);
    // TODO save navUpdates here to the database

    this.chainFundNAVUpdates[chainId][fundAddress] = navUpdates;
    if (this.chainFunds?.[chainId]?.[fundAddress]) {
      // Save NAV updates to the fund in store.
      this.chainFunds[chainId][fundAddress].navUpdates = navUpdates;
    }
    const lastNavUpdate = navUpdates[navUpdates.length - 1];

    const fund = this.chainFunds[chainId]?.[fundAddress];

    if (fund) {
      // fund.positionTypeCounts = parseNavMethodsPositionTypeCounts(
      //   lastNavUpdate?.entries,
      //   lastNavUpdate,
      // );

      fund.lastNAVUpdateTotalNAV = navUpdates.length
        ? lastNavUpdate.totalNAV || 0n
        : fund.totalDepositBalance || 0n;
    }
  }

  parseFundNAVUpdates(fundNAVData: IFundNavData) {
    // Decode and parse navParts
    const navParts: (INAVParts | undefined)[] = [];
    fundNAVData.encodedNavParts.forEach((encodedNavPart) => {
      const decodedNavPart: Record<string, any> = decodeNavPart(encodedNavPart);
      navParts.push({
        baseAssetOIVBal: decodedNavPart.baseAssetOIVBal,
        baseAssetSafeBal: decodedNavPart.baseAssetSafeBal,
        feeBal: decodedNavPart.feeBal,
        totalNAV: decodedNavPart.totalNAV,
      } as INAVParts);
    });

    // Create navUpdates array
    const navUpdates = [] as INAVUpdate[];
    const navUpdatesLen = fundNAVData.updateTimes.length;
    const fundNavUpdateTimes = fundNAVData.updateTimes;
    for (let i = 0; i < navUpdatesLen; i++) {
      const navTimestamp = Number(fundNavUpdateTimes[i] * 1000n);
      navUpdates.push({
        index: i + 1,
        date: `#${(i + 1).toString()}}`,
        timestamp: navTimestamp,
        navParts: navParts[i],
        totalNAV: navParts[i]?.totalNAV,
        entries: [],
      });
    }

    // Parse NAV methods and populate entries and pastNavValues for the last update
    fundNAVData.encodedNavUpdate.forEach((navUpdate, navUpdateIndex) => {
      let navMethods: Record<string, any>[] = [];

      try {
        navMethods = decodeNavUpdateEntry(navUpdate);
      } catch (error) {
        console.error("Error decoding navUpdate entry: ", error);
      }

      for (const [navMethodIndex, navMethod] of navMethods.entries()) {
        const parsedNavMethod = parseNAVMethod(navMethodIndex, navMethod);
        navUpdates[navUpdateIndex].entries.push(parsedNavMethod);
      }
    });

    // Only get past NAV update values for all methods for the last NAV update.
    // const lastNavUpdateNavMethods =
    //   navUpdates[navUpdates.length - 1]?.entries ?? [];
    // console.log("lastNavUpdateNavMethods: ", lastNavUpdateNavMethods);

    // for (let i= 0; i< lastNavUpdateNavMethods.length; i++){
    //   await this.updateNavMethodPastNavValue(
    //     fundChainId,
    //     fundAddress,
    //     i,
    //     lastNavUpdateNavMethods[i],
    //   );
    // }

    return navUpdates;
  }

  // async updateNavMethodPastNavValue(
  //   fundChainId: ChainId,
  //   fundAddress: string,
  //   navMethodIndex: number,
  //   navMethod: INAVMethod,
  // ) {
  //   const navCalculatorContract =
  //     this.chainContracts[fundChainId]?.navCalculatorContract;
  //   if (!navCalculatorContract) {
  //     throw new Error(`No navCalculatorContract found for chainId: ${fundChainId}`);
  //   }
  //
  //   // NOTE: Important to know, that this currently only works for the methods of the last NAV update.
  //   // Fetch NAV method cached past value.
  //   const calculatorMethod = PositionTypeToNAVCacheMethod[navMethod.positionType];
  //
  //   navMethod.pastNavValue = undefined;
  //   navMethod.pastNavValueLoading = true;
  //   navMethod.pastNavValueError = false;
  //
  //   try {
  //     const navCacheResult = await navCalculatorContract.methods[
  //       calculatorMethod
  //     ](fundAddress, navMethodIndex).call();
  //     navMethod.pastNavValue = navCacheResult.reduce(
  //       (acc: bigint, val: bigint) => acc + val,
  //       0n,
  //     );
  //   } catch (error) {
  //     navMethod.pastNavValueError = true;
  //     console.error(
  //       `Failed to fetch NAV method last NAV value ${navMethodIndex}:`,
  //       navMethod,
  //       error,
  //     );
  //   }
  //   navMethod.pastNavValueLoading = false;
  // }
}

/**
 * From: frontend/composables/nav/navDecoder.ts
 */
export const getNavUpdateEntryFunctionABI: any[] = (GovernableFund.abi.find(
  (func:any) => func.name === "getNavEntry" && func.type === "function",
) as any )?.outputs || [];

export const getNavPartsFunctionABI: any[] =
  (
    NAVCalculator.abi.find(
      (func: any) => func.name === "getNAVParts" && func.type === "function",
    ) as any
  )?.outputs || [];

export const decodeNavUpdateEntry = (encodedNavUpdate: string):Record<string, any>[] => {
  const web3 = new Web3();
  return web3.eth.abi.decodeParameters(
    getNavUpdateEntryFunctionABI,
    encodedNavUpdate,
  )[0] as any[];
}

export const decodeNavPart = (
  encodedNavUpdate: string,
): Record<string, any>[] => {
  const web3 = new Web3();
  return web3.eth.abi.decodeParameters(
    getNavPartsFunctionABI,
    encodedNavUpdate,
  )[0] as any[];
};


export const parseNAVMethod = (index: number, navMethodData: Record<string, any>): INAVMethod => {
  let description;
  const positionType =
    NAVEntryTypeToPositionTypeMap[navMethodData.entryType];

  try {
    if (navMethodData.description === "") {
      description = {};
    } else {
      description = JSON.parse(navMethodData.description ?? "{}");
    }
  } catch (error) {
    // Handle the error or rethrow it
    console.warn(
      "Failed to parse NAV entry JSON description string: ",
      error,
    );
  }

  // console.log("DETAILS raw 0 ", JSON.stringify(navMethodData, stringifyBigInt, 2))
  const details = cleanComplexWeb3Data(navMethodData);
  // console.log("DETAILS cleaned 1 ", JSON.stringify(details, null, 2))
  const detailsJson = formatJson(details);
  // console.log("DETAILS json 2 ", detailsJson)


  // NOTE: this is a UI hack around displaying nested rethink structures
  // inside PositionType.Composable types.
  let displayPositionType = positionType;
  if (positionType === PositionType.Composable) {
    if (details.composable[0].functionSignatures.includes("illiquidCalc")) {
      displayPositionType = PositionType.Illiquid;
    } else if (details.composable[0].functionSignatures.includes("liquidCalc")) {
      displayPositionType = PositionType.Liquid;
    }
  }

  return {
    index,
    positionType,
    displayPositionType,
    positionName: description?.positionName,
    valuationSource: description?.valuationSource,
    details,
    detailsJson,
    detailsHash: ethers.keccak256(ethers.toUtf8Bytes(detailsJson)),
    pastNAVUpdateEntryFundAddress: ethers.ZeroAddress,
    pastNAVUpdateEntrySafeAddress: ethers.ZeroAddress,
  } as INAVMethod;
}


// Recursive function to clean complex nested data from numeric indices
const ignoreKeys: Set<string> = new Set(["__length__"]);

/**
 * Recursively cleans complex Web3 data by processing arrays and objects.
 * - For arrays, it applies the cleaning function to each element.
 * - For objects, it creates a new object excluding keys that are numeric or in the `ignoreKeys` set.
 * - Primitive values (non-objects and non-arrays) are returned unchanged.
 *
 * It is basically done to clean the WEB3 data that comes with numeric indexes and also with the key properties
 * after the data is ABI decoded. Numeric indexes are removed.
 *
 * @param {any} data - The data to be cleaned. It can be of any type.
 * @param level Depth level when serializing nested objects.
 * @returns {any} - The cleaned data, with arrays and objects recursively processed.
 */
export const cleanComplexWeb3Data = (data: any, level: number = 0): any => {
  if (Array.isArray(data)) {
    // Recursively clean each item in the array
    return data.map((item) => cleanComplexWeb3Data(item, level + 1));
  } else if (typeof data === "object" && data !== null) {
    // Prepare an object to accumulate the cleaned data
    const cleanedData: { [key: string]: any } = {};
    Object.keys(data).forEach((key) => {
      if (ignoreKeys.has(key)) return;

      // Check if the key is not numeric, ignore numeric values, but keep hex keys like ("0x5231").
      // Ignore index keys such as { 0: {}, 1: "test" }
      if (!key.startsWith("0x") && !isNaN(Number(key))) {
        return;
      }
      // Recursively clean and assign if key is not numeric and not ignored
      cleanedData[key] = cleanComplexWeb3Data(data[key], level + 1);
    });
    return cleanedData;
  } else if (typeof data === "bigint") {
    return data.toString();
  }
  // Return primitive types unchanged
  return data;
};

export const formatJson = (data: any) => {
  /**
   * This function also sorts JSON keys alphabetically.
   * **/
  const sortKeys = (value: any): any => {
    // If the value is an array, return it as-is.
    // Arrays, unlike objects, have an inherent order that is significant and should be preserved.
    if (Array.isArray(value)) {
      return value.map(sortKeys); // Recursively apply sortKeys to each element of the array
    }

    // If the value is an object (but not null), sort its keys
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sortedObj: any, key) => {
          sortedObj[key] = sortKeys(value[key]);
          return sortedObj;
        }, {});
    }
    return value;
  };

  return JSON.stringify(
    sortKeys(data),
    (_, value) => {
      // Convert BigInt to string
      if (typeof value === "bigint") {
        return value.toString();
      }
      // Return the value unchanged if it doesn't need transformation
      return value;
    },
    2,
  );
};

export type IExcludeNAVDetailsHashes = Partial<Record<ChainId, string[]>>;

export const excludeNAVDetailsHashes: IExcludeNAVDetailsHashes = {
  [ChainId.POLYGON]: [
    "0xd87d9b63abe927264903466398cabf9e105ac2fae7c6dc76f822d8ef89e7012d",
    "0xe63fd752a9fdc61a6bb0ac72d9134f09f1f85778192fa6d10278bd9a09a425e9",
    "0x36e7ba53628d044345c9d4e0e9b917f5479d1d4a3e212a0e5b56493f67958020",
    "0x6798edd8ad8861e9e653967ad7938d3646b3058d1a5b6dc98352d99648f45e43",
    "0xeaf175c9485c6b69e0d2005b58a57da04d12c8b0f27bae21547abebdf527c374",
    "0x94f12e7002169840f86b41a8dd9b238449dcf449c2f9be33e3d3717c4bdb3b84",
    "0x37c0cad1bac6a4cdd3a7e5f13162b8b1c7fd8db96ce2557de5db67e1f8213ece",
    "0x003651b0da2306f94cde72d015b08ba7d647d94cddd832a0ece2814a433abf5f",
    "0xb749dd887a361f0a54620e6b951cdbe81b247fd13579b1adccbebb3f20d2fdc5",
    // List from Rok goes from here to the bottom
    "0xb2ff5e623b7d7968f1be9368581d2a8b81a196be14fd49bf17f2d81cc6a5a792",
    "0xb39cda6e5b4682c22be024de190ef1b4d51272080717f6736d23336d66816d90",
    "0x2c7539dd92643763ddfeb50e7128163bd84b23888ef23aa51b8699c3062f7afe",
    "0xd0725050839976f202c5b166fc8ace2bdf0efbebff6b6c1948a4ad1bc381dab2",
    "0x052b2ebc7e0f9a5bf5a1669a37adece81720835d78a2c59017ef13067815be5a",
    "0x49c45e0947c491f5335b0e7928042945fe18d8068b9177b8abb869d8197eab68",
    "0x46288396afeaf4a1627e8ecfabbd155b6af4c57c915634e39773d4cfe204cb54",
    "0x0090f1dd1b1b6d4e795ee88b9e68106c6850652c3a8d20b60abb698d837fdfa5",
    "0x193875a6a73b0fdb7f91a8d1fec9720631c0e15a77381bb8705ae664820ff191",
    "0x3f1ebea95611c81d5d1796f2b8ba5aa0a4c096be233b1b6e364d672a90b51541",
    "0x185b86eb262389d024f24547dbe747fac1fd105d4fdb289760271d283f8455bc",
    "0x89af9028f446bd5dfa641ae943850706f94954a90276b37bec6d85c240b3fba2",
    "0xd35f068cd38e3889ea64c766e5f0bc2dc3115b277da66a8f45ae03a8b36bbb56",
  ],
  [ChainId.ARBITRUM]: [],
  // [ChainId.FRAXTAL]: [],
  [ChainId.ETHEREUM]: [],
  [ChainId.BASE]: [
    "0x4226e636db1dbaa1da860ce7df92d151aaea7f23934b94a21bc75d2c1d6233ee",
    "0x50a4f3bc878614729c8dc9365a4ad9ea717e089870d706459c85e1f8fb89ac94",
  ],
};


/**
 * Position Type Methods preparing data from actual Object to an array of values that are ready to be encoded.
 **/
export const prepNAVMethodLiquid = (details: Record<string, any>): any[] => {
  return details.liquid.map((method: Record<string, any>) => [
    method.tokenPair || ethers.ZeroAddress,
    method.aggregatorAddress || "",
    method.functionSignatureWithEncodedInputs || "0x",
    method.assetTokenAddress || "",
    method.nonAssetTokenAddress || ethers.ZeroAddress,
    method.isReturnArray || false,
    parseInt(method.returnLength) || 0,
    parseInt(method.returnIndex) || 0,
    parseInt(method.pastNAVUpdateIndex) || 0,
  ]);
}

export const prepNAVMethodIlliquid = (details: Record<string, any>, baseDecimals: number): any[] => {
  if (!baseDecimals) {
    throw new Error("Failed preparing NAV Illiquid method, base decimals are not known.")
  }
  return details.illiquid.map((method: Record<string, any>) => {
    const trxHashes = method.otcTxHashes?.map(
      // Remove leading and trailing whitespace
      (hash: any) => hash.trim(),
    ).filter(
      // Remove empty strings;
      (hash: any) => hash !== "",
    ) || [];

    return [
      ethers.parseUnits(method.baseCurrencySpent?.toString() ?? "0", baseDecimals),
      parseInt(method.amountAquiredTokens) || 0,
      method.tokenAddress,
      method.isNFT,
      trxHashes,
      parseInt(method.nftType) || 0,
      parseInt(method.nftIndex) || 0,
      parseInt(method.pastNAVUpdateIndex) || 0,
    ]
  });
}

export const prepNAVMethodNFT = (details: Record<string, any>): any[] => {
  return details.nft.map((method: Record<string, any>) => [
    method.oracleAddress,
    method.nftAddress,
    method.nftType,
    parseInt(method.nftIndex) || 0,
    parseInt(method.pastNAVUpdateIndex) || 0,
  ]);
}

export const prepNAVMethodComposable = (
  details: Record<string, any>,
): any[] => {
  return details.composable.map((method: Record<string, any>) => [
    method.remoteContractAddress,
    method.functionSignatures,
    method.encodedFunctionSignatureWithInputs,
    parseInt(method.normalizationDecimals) || 0,
    method.isReturnArray,
    parseInt(method.returnValIndex) || 0,
    parseInt(method.returnArraySize) || 0,
    parseInt(method.returnValType) || 0,
    parseInt(method.pastNAVUpdateIndex) || 0,
    method.isNegative,
  ]);
}

const rawExcludedFundAddresses = {
  // Polygon
  "0x89": [
    { address: "0xf48E3fa13cb2390e472cf1CA64F941eB7BD27475", alwaysExclude: true }, // bug
    { address: "0x0657DC652F88B55Dd16f5D6cE687672264f9b61E", alwaysExclude: true }, // bug
    { address: "0x8fAE33f10854c20a811246849A0d4131caf72125", alwaysExclude: true }, // bug
    { address: "0x6DFbEE70f1250C2dECb3E9bCb2BE3AF19b15e631", alwaysExclude: true }, // bug
    { address: "0x82CBA6D1A6dCeb408d7F048493262b83c9744f4D", alwaysExclude: false },
    { address: "0xcfD904C4C857784686029995886d627da1aeFbe4", alwaysExclude: false },
    { address: "0xe93CB20Fc113355753B6D237c3949E0452981dC3", alwaysExclude: true }, // TSHN 15. feb
    { address: "0x6edC5f675C5A20e867aeF0633033a17EA256637E", alwaysExclude: true }, // TSHN 16. feb
    { address: "0x920fdA0F59bDc852eD19e3ad975a808101ea2a29", alwaysExclude: true }, // DOCTP 29. feb 24
    { address: "0x1550D564fEBE8c398F3cc398c9ac2a9e89E89A4F", alwaysExclude: false },
    { address: "0x07094Bb5f175A4E6b074e5E79F6439a8A929533B", alwaysExclude: false },
    { address: "0x98F1c2035680E4215cD5726a11279da96C07835F", alwaysExclude: false },
    { address: "0xdac03eD03EFDa65A1488c7f3f0302636491726B6", alwaysExclude: true }, // SOONF1 9. aug
    { address: "0xBb1E02AcA8F7Cb2403c0Bf3aaA74001d38Beb488", alwaysExclude: true }, // SOON1 14. aug
    { address: "0x1673458dDf6C0ea24ce5598918F3cA1e58f2d795", alwaysExclude: false },
  ],
  // Arbitrum One
  "0xa4b1": [
    { address: "0xA5138779Bb08C8DE44692e183c586817a0bcEb42", alwaysExclude: false },
    { address: "0x74759a4607B97360956AbFd44cA4B2A0EC2A27C9", alwaysExclude: false },
    { address: "0xd1FCcFb737E1b436Da057011Dc56231035285688", alwaysExclude: false },
    { address: "0x80b5426A71c19Da522ddDeD4745eADE57a51E334", alwaysExclude: false },
    { address: "0x4DF9aD4B872D8E906990205aD055Bc00c39EEa74", alwaysExclude: false },
    { address: "0xbaA81241A186BC547Ec9e7a306755D4079b559cD", alwaysExclude: false },
    { address: "0xB9e1dC350af83a3127aDc8CFB48a9B4abADCA184", alwaysExclude: false },
    { address: "0xe3c31b33FCBd905E978aCEa64b2b043Cc81DDA7c", alwaysExclude: true },  // ADEMO2
    { address: "0xC27eE955a44F0A9e7AC509dD54E8221eE06A9592", alwaysExclude: true },  // TESTARB
    { address: "0x539a56974295B8BF7023F2d85144Ca0010953ee2", alwaysExclude: true },  // QCLG 22. jan 25
    { address: "0x5A7638b7b831262081804e88657b2D83E8491b1E", alwaysExclude: false },  // carrotfunding.io gCFG 31. mar 25
    { address: "0x5E0f37920DDee57dAbAf5A73B21D51075AeDbEBE", alwaysExclude: false },  // Harmonix HES 14. may 25
  ],
  // Fraxtal
  "0xfc": [],
  // ETH Mainnet
  "0x1": [
    { address: "0x7ed95418063d5b61bDE7b40D65F93739c0CFdcf4", alwaysExclude: false },
    { address: "0x51cf0Bc0f5312d824a55B83B2c032Fb8c96c249a", alwaysExclude: false },
    { address: "0xB6aB76d451B98a992FB84A93602527CC30cd3b22", alwaysExclude: false }, // QCLE
  ],
  // Base
  "0x2105": [
    { address: "0x1D66EB6cC3b80c76B6fF08aC13f93a2DAEA4C855", alwaysExclude: false },
    { address: "0xFC5fF4dc70EaEc998863668212B01cBE51000A4b", alwaysExclude: false },
    { address: "0xC38e9E111CCBd435d9DE53ED2Dd7Db3993839238", alwaysExclude: false },
    { address: "0x61d5e3dC0907EADa4D9B06D8B33Cd96c3510b533", alwaysExclude: false },
    { address: "0x016623a2b54F7a6DAdB35D3400557a1b79466429", alwaysExclude: false },
    { address: "0x2e40fDbA4d07E6b7aBCcBCCe3f6D28bDea727395", alwaysExclude: false },
    { address: "0x34f1Ec0A0af19d622B281488C1B1ba0B5aE20860", alwaysExclude: true },  // BDAO
    { address: "0x23C44260731B8614aa7F3B28AB0bafDb1610743c", alwaysExclude: true },  // bDEMO4
    { address: "0x16dd2b60DEc7d3fE7C08f6B29732Fb51dDd2c176", alwaysExclude: true },  // ATF 19. mar 25
    { address: "0x86acCa1a926FEa47985Df8Ef5A8c0d0cDA650a62", alwaysExclude: true },  // gCFT 19. mar 25
    { address: "0x457960e6946ed94e82512992ba9dAaBDa5539010", alwaysExclude: true },  // DEMO ABC 25. apr 25
  ],
} as Record<string, { address: string; alwaysExclude: boolean }[]>;

export const excludedFundAddresses = Object.fromEntries(
  Object.entries(rawExcludedFundAddresses).map(([chainId, entries]) => {
    const filtered = entries.map(entry => entry.address.toLowerCase());
    return [chainId, filtered];
  }),
) as Record<string, string[]>;

const removeDuplicates = (arr: any[]) => {
  const seen = new Set();
  return arr.filter((item) => {
    if (seen.has(item)) {
      return false;
    }
    seen.add(item);
    return true;
  });
};


const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


// Helper function to format token values
const formatTokenValue = (
  value: bigint,
  decimals: number,
  includeCommas: boolean = true,
  truncate: boolean = false,
): string => {
  if (!value) return "0";

  const valueStr = value.toString();
  let result = "";

  if (valueStr.length <= decimals) {
    result = "0." + "0".repeat(decimals - valueStr.length) + valueStr;
  } else {
    const integerPart = valueStr.slice(0, valueStr.length - decimals);
    const fractionalPart = valueStr.slice(valueStr.length - decimals);
    result = integerPart + "." + fractionalPart;
  }

  // Remove trailing zeros
  result = result.replace(/\.?0+$/, "");

  // Add commas to integer part if requested
  if (includeCommas) {
    const parts = result.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    result = parts.join(".");
  }

  // Truncate if requested
  if (truncate && result.includes(".")) {
    const parts = result.split(".");
    if (parts[1].length > 4) {
      parts[1] = parts[1].substring(0, 4);
      result = parts.join(".");
    }
  }

  return result;
};
