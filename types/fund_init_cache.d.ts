import type IFundSettings from "~/types/fund_settings";

export default interface IFundInitCache {
  fundContractAddr: string;
  rolesModifier: string;
  fundSettings: IFundSettings;
  _feeManagePeriod: string;
  _feePerformancePeriod: string;
  _fundMetadata: string;
  fundMetadata: Record<string, any>;
  governorData: Record<string, any>;
  fundFactoryContractV2Used: boolean;
}
