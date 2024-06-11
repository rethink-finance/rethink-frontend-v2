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
        <FundNavSimulationTable :methods="methods" />
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
// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;

const isDialogOpen = ref(false);
const methods = ref<INAVMethod[]>([]);
const web3Store = useWeb3Store();
const fundStore = useFundStore();

const simulateLiq = async () => {
  if (!web3Store.web3) return;

  const NAVaddress = addresses.NAVCalculatorBeaconProxy[parseInt(web3Store.chainId)];
  const NAVCalculatorContract = new web3Store.web3.eth.Contract(
    NAVCalculatorJSON.abi,
    NAVaddress,
  );

  // function liquidCalculationReadOnly(IGovernableFundStorage.NAVLiquidUpdate[] calldata liquid, address safe, address fund, uint256 navEntryIndex, bool isPastNAVUpdate, uint256 pastNAVUpdateIndex, uint256 pastNAVUpdateEntryIndex, address pastNAVUpdateEntryFundAddress)

  this.simulatedLiqVal = await NAVCalculatorContract.methods.liquidCalculationReadOnly(
    this.prepNAVLiquidUpdate(
      this.entry.liquidUpdates,
    ),// NAVLiquidUpdate[] liquid;
    fundStore.fund?.safeAddress,
    fundStore.fund?.address, // fund
    0, // navEntryIndex
    this.PastNAVUpdateMap[this.entry.isPastNAVUpdate], // isPastNAVUpdate
    parseInt(this.entry.pastNAVUpdateIndex), // pastNAVUpdateIndex
    parseInt(this.entry.pastNAVUpdateEntryIndex), // pastNAVUpdateEntryIndex
    this.entry.pastNAVUpdateEntryFundAddress, // pastNAVUpdateEntryFundAddress
  ).call();
  this.loading = false;

  const encodedDataliquidCalculationReadOnly = web3Store.web3.eth.abi.encodeFunctionCall(NAVCalculatorJSON.abi[9],
    [
      this.prepNAVLiquidUpdate(
        this.entry.liquidUpdates,
      ),
      fundStore.fund?.safeAddress,
      fundStore.fund?.address, // fund
      0,
      this.PastNAVUpdateMap[this.entry.isPastNAVUpdate],
      parseInt(this.entry.pastNAVUpdateIndex),
      parseInt(this.entry.pastNAVUpdateEntryIndex),
      this.entry.pastNAVUpdateEntryFundAddress,
    ]);
  console.log("encodedDataliquidCalculationReadOnly:" + encodedDataliquidCalculationReadOnly)
}

// const simulateIliq = async () => {
//   this.loading = true;
//   const NAVaddress = addresses.NAVCalculatorBeaconProxy[parseInt(this.getChainId)];
//   const NAVCalculatorContract = new web3Store.web3.eth.Contract(
//     NAVCalculatorJSON.abi,
//     NAVaddress,
//   );
//
//   // function illiquidCalculationReadOnly(IGovernableFundStorage.NAVIlliquidUpdate[] calldata illiquid, address safe, address fund, uint256 navEntryIndex, bool isPastNAVUpdate, uint256 pastNAVUpdateIndex, uint256 pastNAVUpdateEntryIndex, address pastNAVUpdateEntryFundAddress)
//
//   this.simulatedIliqVal = await NAVCalculatorContract.methods.illiquidCalculationReadOnly(
//     this.prepNAVIlliquidUpdate(
//       this.entry.illiquidUpdates,
//     ),// NAVLiquidUpdate[] liquid;
//     this.fund.safe,
//     this.getSelectedFundAddress,// fund
//     0,// navEntryIndex
//     this.PastNAVUpdateMap[this.entry.isPastNAVUpdate],// isPastNAVUpdate
//     parseInt(this.entry.pastNAVUpdateIndex),// pastNAVUpdateIndex
//     parseInt(this.entry.pastNAVUpdateEntryIndex),// pastNAVUpdateEntryIndex
//     this.entry.pastNAVUpdateEntryFundAddress,// pastNAVUpdateEntryFundAddress
//   ).call();
//   this.loading = false;
//   const encodedDataIlliquidCalculationReadOnly = web3Store.web3.eth.abi.encodeFunctionCall(NAVCalculatorJSON.abi[7],
//     [
//       this.prepNAVIlliquidUpdate(
//         this.entry.illiquidUpdates,
//       ),
//       this.fund.safe,
//       this.getSelectedFundAddress,
//       0,
//       this.PastNAVUpdateMap[this.entry.isPastNAVUpdate],
//       parseInt(this.entry.pastNAVUpdateIndex),
//       parseInt(this.entry.pastNAVUpdateEntryIndex),
//       this.entry.pastNAVUpdateEntryFundAddress,
//     ]);
// }
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
