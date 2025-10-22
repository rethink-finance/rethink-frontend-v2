import { useContractAddresses } from "~/composables/useContractAddresses";
import { useAccountStore } from "~/store/account/account.store";
import { useFundsStore } from "~/store/funds/funds.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";
import {
  PositionType,
  PositionTypeToNAVCalculationMethod,
} from "~/types/enums/position_type";
import type INAVMethod from "~/types/nav_method";

export const fetchSimulatedNAVMethodValueAction = async (
  fundChainId: ChainId,
  fundAddress: string,
  safeAddress: string,
  baseDecimals: number,
  baseSymbol: string,
  navEntry: INAVMethod,
  isFundNonInit: boolean = false,
  fundFactoryContractV2Used: boolean = false,
): Promise<void> => {
  const fundsStore = useFundsStore();
  const web3Store = useWeb3Store();
  const accountStore = useAccountStore();
  console.log(
    "fetchSimulatedNAVMethodValueAction: ",
    navEntry,
    "safeAddress", safeAddress,
    "baseDecimals", baseDecimals,
    "baseSymbol", baseSymbol,
  );

  if (!navEntry.detailsHash) {
    console.error("No detailsHash provided in navEntry.", navEntry);
    return;
  }
  if (!baseDecimals || !baseSymbol) {
    console.error("simulateNAVMethodValue error: No fund base decimals or symbol.");
    return;
  }
  if (!safeAddress) {
    console.error("simulateNAVMethodValue error: No fund safe address.");
    return;
  }
  const navCalculatorContract =
    web3Store.chainContracts[fundChainId]?.navCalculatorContract;

  try {
    navEntry.foundMatchingPastNAVUpdateEntryFundAddress = true;

    if (!navEntry.pastNAVUpdateEntryFundAddress) {
      navEntry.pastNAVUpdateEntryFundAddress =
        fundsStore.navMethodDetailsHashToFundAddress[
          navEntry.detailsHash ?? ""
        ];
    }
    if (!navEntry.pastNAVUpdateEntryFundAddress) {
      // If there is no pastNAVUpdateEntryFundAddress the simulation will fail later.
      // A missing pastNAVUpdateEntryFundAddress can mean two things:
      //   1) A proposal is not approved yet and so its methods are not yet in the allNavMethods
      //     -> that means the method was created on this fund, so we take address of this fund.
      //  2) There was some difference when hashing details on INAVMethod detailsHash.
      //    -> it will be hard to detect this, NAV simulation will fail, and we will take a look what happened.
      //    -> We have a bigger problem if it won't fail, we should mark the address somewhere in the table.
      //
      // Here we take solution 1), as we assume that the method was not yet added to allMethods
      navEntry.pastNAVUpdateEntryFundAddress = fundAddress;
      navEntry.foundMatchingPastNAVUpdateEntryFundAddress = false;
    }

    let navCalculationMethod =
      PositionTypeToNAVCalculationMethod[navEntry.positionType];

    const callData: any[] = [];
    if (navEntry.positionType === PositionType.Liquid) {
      callData.push(prepNAVMethodLiquid(navEntry.details));
      callData.push(safeAddress);
    } else if (navEntry.positionType === PositionType.Illiquid) {
      callData.push(prepNAVMethodIlliquid(navEntry.details, baseDecimals));
      callData.push(safeAddress);
    } else if (navEntry.positionType === PositionType.NFT) {
      callData.push(prepNAVMethodNFT(navEntry.details));
      // callData.push(this.safeAddress);
    } else if (navEntry.positionType === PositionType.Composable) {
      callData.push(
        prepNAVMethodComposable(
          navEntry.details,
        ),
      );
      console.warn("IS NON INIT TRUE")
      // If it is non init, we call different NAV composable simulation method.
      // Non init means that the fund was not yet created.
      if (isFundNonInit) {
        navCalculationMethod = navCalculationMethod.replace(
          "ReadOnly",
          "NonInitReadOnly",
        )
      }
    }

    callData.push(
      ...[
        fundAddress, // fund
        0, // navEntryIndex
        false, // isPastNAVUpdate -- set to false to simulate on current fund.
        parseInt(navEntry.details.pastNAVUpdateIndex), // pastNAVUpdateIndex
        parseInt(navEntry.details.pastNAVUpdateEntryIndex), // pastNAVUpdateEntryIndex
        navEntry.pastNAVUpdateEntryFundAddress, // pastNAVUpdateEntryFundAddress
      ],
    );

    if (isFundNonInit && navEntry.positionType === PositionType.Composable) {
      // Add 2 more parameters to calldata:
      // - governable fund factory contract address
      // - deployer
      const { rethinkContractAddresses } = useContractAddresses();
      const contractKey = fundFactoryContractV2Used ? "GovernableFundFactoryV1.5BeaconProxy" : "GovernableFundFactoryBeaconProxy";

      callData.push(
        ...[
          rethinkContractAddresses[contractKey][fundChainId],
          accountStore.activeAccountAddress,
        ],
      )
    }

    console.debug("simulate json: ", JSON.stringify(callData, null, 2))
    navEntry.simulatedNavFormatted = "N/A";
    navEntry.simulatedNav = 0n;

    // console.log("navCalculationMethod:", navCalculationMethod);
    // console.log("callData:", callData);
    // const calldata = navCalculatorContract.methods[navCalculationMethod](...callData).encodeABI();
    // console.debug(Simulate calldata being sent:", calldata);
    try {
      const simulatedVal: bigint = await web3Store.callWithRetry(
        fundChainId,
        () =>
          navCalculatorContract.methods[navCalculationMethod](
            ...callData,
          ).call(),
        1,
        [-32603, 310], // Do not retry internal errors (probably invalid NAV method)
      );
      console.warn("simulated value: ", simulatedVal);

      const valueFormatted = simulatedVal
        ? formatTokenValue(
          simulatedVal,
          baseDecimals,
          true,
          false,
        )
        : "0";
      navEntry.simulatedNavFormatted = valueFormatted + " " + baseSymbol;
      navEntry.simulatedNav = simulatedVal;
      navEntry.isSimulatedNavError = false;
    } catch (error: any) {
      navEntry.isSimulatedNavError = true;
      console.error(
        "simulateNAVMethodValue: Failed simulating value for entry, check if there was some difference " +
          "when hashing details on INAVMethod detailsHash: ",
        navEntry,
        error,
      );
    }
  } catch (error: any) {
    console.error("simulateNAVMethodValue error: ", error);
  }
};
