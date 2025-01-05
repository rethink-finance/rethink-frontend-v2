import { type AbiFunctionFragment } from "web3";
import { encodeFunctionCall } from "web3-eth-abi";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { FundFeeType } from "~/types/enums/fee_type";

const collectFeesABI = GovernableFund.abi.find(
  (func: any) => func.name === "collectFees" && func.type === "function",
);

/**
 *
 * @param feeType enum IGovernableFundStorage.FundFeeType
 *    DepositFee,
 *    WithdrawFee,
 *    ManagementFee,
 *    PerformanceFee
 */
const encodeCollectFeesAbiJSON = (feeType: FundFeeType) => {
  return encodeFunctionCall(
    collectFeesABI as AbiFunctionFragment,
    [feeType],
  );
}

export const encodedCollectFlowFeesAbiJSON =
  encodeCollectFeesAbiJSON(FundFeeType.DepositFee);


export const encodedCollectManagerFeesAbiJSON =
  encodeCollectFeesAbiJSON(FundFeeType.ManagementFee);


export const encodedCollectPerformanceFeesAbiJSON =
  encodeCollectFeesAbiJSON(FundFeeType.PerformanceFee);
