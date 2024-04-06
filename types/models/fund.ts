import type ICyclePendingRequest from "~/types/cycle_pending_request";
import type INAVUpdate from "~/types/nav_update";
import type IPositionType from "~/types/position_type";
import type IToken from "~/types/token";
import type IFund from "~/types/fund";

export default class Fund {
  id: number;
  address: string;
  title: string;
  subtitle: string;
  chain: string;
  avatarUrl: string;
  description: string;
  governorAddress: string;
  safeAddress: string;
  inceptionDate: string;
  aumValue: number;
  cumulativeReturnPercent: number;
  monthlyReturnPercent: number;
  sharpeRatio: number;
  userFundBalance: string;
  userFundUsdValue: string;
  nextSettlement: string;
  positionTypes: IPositionType[];
  cyclePendingRequests: ICyclePendingRequest[];
  fundToken: IToken;
  denominationToken: IToken;
  governorToken: IToken;
  fundToDenominationExchangeRate: number;
  netDeposits: string;
  currentValue: string;
  totalReturn: number;
  delegatingAddress: string;
  votingPower: string;
  depositAddresses: string[];
  managementAddresses: string[];
  plannedSettlementCycle: string;
  minLiquidAssetShare: string;
  votingDelay: string;
  votingPeriod: string;
  proposalThreshold: string;
  quorom: string;
  lateQuorom: string;
  navUpdates: INAVUpdate[];

  constructor({
    id = 0,
    address = "",
    title = "N/A",
    subtitle = "N/A",
    chain = "N/A",
    // TODO replace with default image/empty fund
    avatarUrl = "https://api.lorem.space/image/ai?w=60&h=60",
    description = "N/A",
    governorAddress = "",
    safeAddress = "",
    inceptionDate = "",
    aumValue = 0,
    cumulativeReturnPercent = 0,
    monthlyReturnPercent = 0,
    sharpeRatio = 0,
    userFundBalance = "N/A",
    userFundUsdValue = "N/A",
    nextSettlement = "N/A",
    positionTypes = [],
    cyclePendingRequests = [],
    fundToken = {} as IToken,
    denominationToken = {} as IToken,
    governorToken = {} as IToken,
    fundToDenominationExchangeRate = 0,
    netDeposits = "N/A",
    currentValue = "N/A",
    totalReturn = 0,
    delegatingAddress = "",
    votingPower = "N/A",
    depositAddresses = [],
    managementAddresses = [],
    plannedSettlementCycle = "N/A",
    minLiquidAssetShare = "N/A",
    votingDelay = "N/A",
    votingPeriod = "N/A",
    proposalThreshold = "N/A",
    quorom = "N/A",
    lateQuorom = "N/A",
    navUpdates = [],
  }: Partial<IFund> = {}) {
    this.id = id;
    this.address = address;
    this.title = title;
    this.subtitle = subtitle;
    this.chain = chain;
    this.avatarUrl = avatarUrl;
    this.description = description;
    this.governorAddress = governorAddress;
    this.safeAddress = safeAddress;
    this.inceptionDate = inceptionDate;
    this.aumValue = aumValue;
    this.cumulativeReturnPercent = cumulativeReturnPercent;
    this.monthlyReturnPercent = monthlyReturnPercent;
    this.sharpeRatio = sharpeRatio;
    this.userFundBalance = userFundBalance;
    this.userFundUsdValue = userFundUsdValue;
    this.nextSettlement = nextSettlement;
    this.positionTypes = positionTypes;
    this.cyclePendingRequests = cyclePendingRequests;
    this.fundToken = fundToken;
    this.denominationToken = denominationToken;
    this.governorToken = governorToken;
    this.fundToDenominationExchangeRate = fundToDenominationExchangeRate;
    this.netDeposits = netDeposits;
    this.currentValue = currentValue;
    this.totalReturn = totalReturn;
    this.delegatingAddress = delegatingAddress;
    this.votingPower = votingPower;
    this.depositAddresses = depositAddresses;
    this.managementAddresses = managementAddresses;
    this.plannedSettlementCycle = plannedSettlementCycle;
    this.minLiquidAssetShare = minLiquidAssetShare;
    this.votingDelay = votingDelay;
    this.votingPeriod = votingPeriod;
    this.proposalThreshold = proposalThreshold;
    this.quorom = quorom;
    this.lateQuorom = lateQuorom;
    this.navUpdates = navUpdates;
  }
}
