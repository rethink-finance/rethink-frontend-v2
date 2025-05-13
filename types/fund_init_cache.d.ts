import type IFundSettings from "~/types/fund_settings";
import type IFundFlowsConfig from "~/types/fund_flows_config";

export default interface IFundInitCache {
  fundContractAddr: string;
  rolesModifier: string;
  fundSettings: IFundSettings;
  flowsConfig: IFundFlowsConfig;
  _feeManagePeriod: string;
  _feePerformancePeriod: string;
  _fundMetadata: string;
  fundMetadata: Record<string, any>;
  governorData: Record<string, any>;
}
