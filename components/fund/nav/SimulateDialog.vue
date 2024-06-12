<template>
  <v-btn
    class="text-secondary"
    variant="outlined"
    @click="isDialogOpen = true"
  >
    Simulate NAV
  </v-btn>
  <v-dialog
    v-model="isDialogOpen"
    scrim="black"
    opacity="0.5"
  >
    <div class="main_card di-card">
      <div class="di-card__header">
        NAV Update Simulation
      </div>
      <div class="di-card__subtext">
        Simulate NAV before updating or creating a proposal
      </div>
      <div class="d-flex mb-5">
        <div class="di-card__text-total">
          Total NAV:
        </div>
        <div class="di-card__text-value">
          $333,212,321.12
        </div>
      </div>
      <div class="di-card__table">
        <!--        <FundNavSimulationTable :methods="methods" />-->
        <FundNavMethodsTable v-model:methods="fundManagedNAVMethods" show-simulated-nav />
      </div>
      <div class="action-buttons">
        <v-btn
          class="text-secondary"
          variant="plain"
          @click="isDialogOpen = false"
        >
          Close
        </v-btn>
        <v-btn
          class="text-secondary"
          variant="outlined"
        >
          Manage Methods
        </v-btn>
        <v-btn
          class="text-secondary"
          variant="flat"
        >
          Update NAV
        </v-btn>
      </div>
    </div>
  </v-dialog>

</template>

<script setup lang="ts">
import type INAVMethod from "~/types/nav_method";
import addressesJson from "~/assets/contracts/addresses.json";
import NAVCalculatorJSON from "~/assets/contracts/NAVCalculator.json";
import type IAddresses from "~/types/addresses";
import { useWeb3Store } from "~/store/web3.store";
import { useFundStore } from "~/store/fund.store";
import { PositionType } from "~/types/enums/position_type";
import { useToastStore } from "~/store/toast.store";
import { useFundsStore } from "~/store/funds.store";
// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;

const isDialogOpen = ref(false);
const web3Store = useWeb3Store();
const fundsStore = useFundsStore();
const fundStore = useFundStore();
const toastStore = useToastStore();
const { fundManagedNAVMethods } = toRefs(fundStore);

onMounted(async () => {
  if (!web3Store.web3) return;
  // TODO move this to another function
  // TODO add loading indicators
  // TODO only call after the modal is opened, not on created
  const fundsInfoArrays = await fundsStore.fetchFundsInfoArrays()
  const fundAddresses: string[] = fundsInfoArrays[0];
  await fundsStore.fetchAllNavMethods(fundAddresses);

  const navAddress = addresses.NAVCalculatorBeaconProxy[web3Store.chainId];
  console.log("navAddress ", navAddress);
  const NAVCalculatorContract = new web3Store.web3.eth.Contract(
    NAVCalculatorJSON.abi,
    navAddress,
  );

  const baseDecimals = fundStore.fund?.baseToken.decimals;
  if (!baseDecimals) {
    toastStore.errorToast("Failed preparing NAV Illiquid method, fund base token decimals are not known.")
    throw new Error("Failed preparing NAV Illiquid method, base decimals are not known.")
  }

  // TODO Simulate all at once as many promises instead of one by one.
  for (const navEntry of fundManagedNAVMethods.value as INAVMethod[]) {
    let pastNAVUpdateEntryFundAddress = navEntry.pastNAVUpdateEntryFundAddress;
    if (!pastNAVUpdateEntryFundAddress) {
      pastNAVUpdateEntryFundAddress = fundsStore.navMethodDetailsHashToFundAddress[navEntry.detailsHash ?? ""];
    }
    if (!pastNAVUpdateEntryFundAddress) {
      // If there is no pastNAVUpdateEntryFundAddress the simulation will fail later.
      console.error("Missing pastNAVUpdateEntryFundAddress for NAV entry ", navEntry)
    }

    let parsedNavEntry = null;
    if (navEntry.positionType === PositionType.Liquid) {
      parsedNavEntry = prepNAVMethodLiquid(navEntry.details);
    } else if (navEntry.positionType === PositionType.Illiquid) {
      parsedNavEntry = prepNAVMethodIlliquid(navEntry.details, baseDecimals);
    } else if (navEntry.positionType === PositionType.NFT) {
      parsedNavEntry = prepNAVMethodNFT(navEntry.details);
    } else if (navEntry.positionType === PositionType.Composable) {
      parsedNavEntry = prepNAVMethodComposable(navEntry.details);
    }

    // TODO to get pastNAVUpdateEntryFundAddress we have to search for it in the fundsStore.allNavMethods
    //    and make sure it is fetched before checking here with fundsStore.fetchAllNavMethods and then we
    //    have to match by the detailsHash to extract the pastNAVUpdateEntryFundAddress
    console.log("pastNAVUpdateEntryFundAddress: ", pastNAVUpdateEntryFundAddress);
    console.log("json: ", JSON.stringify([
      parsedNavEntry,// NAVLiquidUpdate[];
      fundStore.fund?.safeAddress,
      fundStore.fund?.address, // fund
      0, // navEntryIndex
      navEntry.details.isPastNAVUpdate, // isPastNAVUpdate
      parseInt(navEntry.details.pastNAVUpdateIndex), // pastNAVUpdateIndex
      parseInt(navEntry.details.pastNAVUpdateEntryIndex), // pastNAVUpdateEntryIndex
      pastNAVUpdateEntryFundAddress, // pastNAVUpdateEntryFundAddress
    ], null, 2))

    // TODO this code is still returning Web3ValidatorError check it out
    try {
      const simulatedVal: bigint = await NAVCalculatorContract.methods.liquidCalculationReadOnly(
        parsedNavEntry,// NAVLiquidUpdate[];
        fundStore.fund?.safeAddress,
        fundStore.fund?.address, // fund
        0, // navEntryIndex
        navEntry.details.isPastNAVUpdate, // isPastNAVUpdate
        parseInt(navEntry.details.pastNAVUpdateIndex), // pastNAVUpdateIndex
        parseInt(navEntry.details.pastNAVUpdateEntryIndex), // pastNAVUpdateEntryIndex
        pastNAVUpdateEntryFundAddress, // pastNAVUpdateEntryFundAddress
      ).call();
      console.log("simulated value: ", simulatedVal)
      navEntry.simulatedNav = simulatedVal ?? BigInt("0");
    } catch (error: any) {
      console.error("Failed simulating value for entry: ", navEntry, error)
    }
  }
});

</script>

<style lang="scss" scoped>
.di-card{
    @include borderGray;
    width: 100%;
    color: white;

    &__header{
        font-size: $text-md;
        font-weight: 700;
        margin-bottom: 1rem;
    }

    &__subtext{
        font-size: $text-sm;
        font-weight: 500;
        color: $color-text-irrelevant;
        margin-bottom: 4rem
    }

    &__text-total{
        font-size: $text-md;
        font-weight: 400;
        margin-right: .5rem
    }

    &__text-value{
        font-size: $text-md;
        font-weight: 700;
    }

    &__table{
        @include borderGray;
        border-radius: .5rem;
        max-height: 21rem;
        overflow-y: auto;
        margin-bottom: 1.5rem;
    }
}

.action-buttons{
    display: flex;
    flex-direction: row;
    justify-content: end;
    gap: 1.5rem;
    margin: 1rem 0;
}

</style>
