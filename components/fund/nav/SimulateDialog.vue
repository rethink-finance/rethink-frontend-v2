<template>
  <v-dialog
    scrim="black"
    opacity="0.5"
    height="80%"
    max-width="90%"
    scrollable
  >
    <template #activator="{ props: activatorProps }">
      <v-btn
        class="text-secondary"
        variant="outlined"
        v-bind="activatorProps"
      >
        Simulate NAV
      </v-btn>
    </template>
    <template #default="{ isActive }">
      <v-card class="di_card">
        <v-card-title>
          <div class="di_card__header">
            NAV Update Simulation
          </div>
          <div class="di_card__subtext">
            Simulate NAV before updating or creating a proposal
          </div>
          <div class="d-flex mb-2">
            <div class="di_card__text_total">
              <strong>Total NAV:</strong>
            </div>
            <div class="di_card__text_value">
              {{ formattedTotalSimulatedNAV }}
            </div>
          </div>
          <div class="di_card__balances">
            <div class="d-flex">
              <div class="di_card__text_total">
                Fund Contract Balance:
              </div>
              <div class="di_card__text_value">
                {{ formattedFundContractBaseTokenBalance }}
              </div>
            </div>
            <div class="d-flex">
              <div class="di_card__text_total">
                Safe Balance:
              </div>
              <div class="di_card__text_value">
                {{ formattedSafeContractBaseTokenBalance }}
              </div>
            </div>
            <div class="d-flex">
              <div class="di_card__text_total">
                Fees Balance:
              </div>
              <div class="di_card__text_value">
                {{ formattedFeeBalance }}
              </div>
            </div>
          </div>
        </v-card-title>
        <v-card-text>
          <div class="di_card__table">
            <FundNavMethodsTable
              v-model:methods="fundManagedNAVMethods"
              show-simulated-nav
            />
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <div class="di_card__action_buttons">
            <v-btn
              class="text-secondary"
              variant="plain"
              @click="isActive.value = false"
            >
              Close
            </v-btn>
            <v-btn
              class="text-secondary"
              variant="outlined"
              @click="manageMethods(isActive)"
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
        </v-card-actions>
      </v-card>

    </template>
  </v-dialog>

</template>

<script setup lang="ts">
import NAVCalculatorJSON from "~/assets/contracts/NAVCalculator.json";
import { useFundStore } from "~/store/fund.store";
import { useFundsStore } from "~/store/funds.store";
import { useToastStore } from "~/store/toast.store";
import { useWeb3Store } from "~/store/web3.store";
import { PositionType, PositionTypeToNAVCalculationMethod } from "~/types/enums/position_type";
import type INAVMethod from "~/types/nav_method";
// Since the direct import won't infer the custom type, we cast it here.:

const router = useRouter();
const web3Store = useWeb3Store();
const fundsStore = useFundsStore();
const fundStore = useFundStore();
const toastStore = useToastStore();
const totalSimulatedNAV = ref(0n);
const {selectedFundSlug, fundManagedNAVMethods } = toRefs(fundStore);

const formattedTotalSimulatedNAV = computed(() => {
  const fund = fundStore.fund;
  const totalNAV = (
    totalSimulatedNAV.value +
    (fund?.fundContractBaseTokenBalance || 0n) +
    (fund?.safeContractBaseTokenBalance || 0n) +
    (fund?.feeBalance || 0n)
  );
  return formatNAV(totalNAV);
});

const formattedFeeBalance = computed(() => {
  return formatNAV(fundStore.fund?.feeBalance);
});
const formattedSafeContractBaseTokenBalance = computed(() => {
  return formatNAV(fundStore.fund?.safeContractBaseTokenBalance);
});
const formattedFundContractBaseTokenBalance = computed(() => {
  return formatNAV(fundStore.fund?.fundContractBaseTokenBalance);
});

const formatNAV = (value: any) => {
  const baseSymbol = fundStore.fund?.baseToken.symbol;
  const baseDecimals = fundStore.fund?.baseToken.decimals;
  if (!baseDecimals) {
    return value;
  }

  const valueFormatted = value ? formatNumberShort(
    Number(formatTokenValue(value, baseDecimals, false)),
  ) : "0";
  return valueFormatted + " " + baseSymbol;
}

onMounted(async () => {
  if (!web3Store.web3) return;
  // TODO move this to another function
  // TODO add loading indicators
  // TODO only call after the modal is opened, not on created
  const fundsInfoArrays = await fundsStore.fetchFundsInfoArrays()
  const fundAddresses: string[] = fundsInfoArrays[0];

  // To get pastNAVUpdateEntryFundAddress we have to search for it in the fundsStore.allNavMethods
  // and make sure it is fetched before checking here with fundsStore.fetchAllNavMethods, and then we
  // have to match by the detailsHash to extract the pastNAVUpdateEntryFundAddress
  await fundsStore.fetchAllNavMethods(fundAddresses);

  const NAVCalculatorContract = new web3Store.web3.eth.Contract(
    NAVCalculatorJSON.abi,
    web3Store.NAVCalculatorBeaconProxyAddress,
  );

  const baseDecimals = fundStore.fund?.baseToken.decimals;
  if (!baseDecimals) {
    toastStore.errorToast("Failed preparing NAV Illiquid method, fund base token decimals are not known.")
    throw new Error("Failed preparing NAV Illiquid method, base decimals are not known.")
  }

  // TODO Simulate all at once as many promises instead of one by one.
  for (const navEntry of fundManagedNAVMethods.value as INAVMethod[]) {
    navEntry.foundMatchingPastNAVUpdateEntryFundAddress = true;
    if (!navEntry.pastNAVUpdateEntryFundAddress) {
      navEntry.pastNAVUpdateEntryFundAddress = fundsStore.navMethodDetailsHashToFundAddress[navEntry.detailsHash ?? ""];
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
      navEntry.pastNAVUpdateEntryFundAddress = fundStore.fund?.address;
      navEntry.foundMatchingPastNAVUpdateEntryFundAddress = false;
    }

    const callData = [];
    if (navEntry.positionType === PositionType.Liquid) {
      callData.push(prepNAVMethodLiquid(navEntry.details));
      callData.push(fundStore.fund?.safeAddress);
    } else if (navEntry.positionType === PositionType.Illiquid) {
      callData.push(prepNAVMethodIlliquid(navEntry.details, baseDecimals));
      callData.push(fundStore.fund?.safeAddress);
    } else if (navEntry.positionType === PositionType.NFT) {
      callData.push(prepNAVMethodNFT(navEntry.details));
      // callData.push(fundStore.fund?.safeAddress);
    } else if (navEntry.positionType === PositionType.Composable) {
      callData.push(prepNAVMethodComposable(navEntry.details));
    }

    callData.push(
      ...[
        fundStore.fund?.address, // fund
        0, // navEntryIndex
        navEntry.details.isPastNAVUpdate, // isPastNAVUpdate
        parseInt(navEntry.details.pastNAVUpdateIndex), // pastNAVUpdateIndex
        parseInt(navEntry.details.pastNAVUpdateEntryIndex), // pastNAVUpdateEntryIndex
        navEntry.pastNAVUpdateEntryFundAddress, // pastNAVUpdateEntryFundAddress
      ],
    )

    // console.log("json: ", JSON.stringify(callData, null, 2))
    const navCalculationMethod = PositionTypeToNAVCalculationMethod[navEntry.positionType];
    navEntry.simulatedNav = "N/A"
    try {
      const simulatedVal: bigint = await NAVCalculatorContract.methods[navCalculationMethod] (
        ...callData,
      ).call();
      totalSimulatedNAV.value += simulatedVal;
      console.log("simulated value: ", simulatedVal)

      navEntry.simulatedNav = formatNAV(simulatedVal);
    } catch (error: any) {
      console.error(
        "Failed simulating value for entry, check if there was some difference when " +
        "hashing details on INAVMethod detailsHash: ",
        navEntry,
        error,
      )
    }
  }
});

const manageMethods = (isActive: Ref<boolean>) => {
  router.push(`/details/${selectedFundSlug.value}/nav/manage`);
  isActive.value = false;
};
</script>

<style lang="scss" scoped>
.di_card {
  @include borderGray;
  color: white;

  &__balances {
    line-height: 1.5rem;
  }
  &__header{
    font-size: $text-md;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }
  &__subtext {
    font-size: $text-sm;
    font-weight: 500;
    color: $color-text-irrelevant;
    margin-bottom: 2.5rem
  }
  &__text_total {
    font-size: $text-md;
    font-weight: 400;
    margin-right: .5rem
  }
  &__text_value {
    font-size: $text-md;
    font-weight: 700;
  }
  &__table {
    @include borderGray;
    border-radius: .5rem;
    overflow-y: auto;
    margin-bottom: 1.5rem;
  }
  &__action_buttons {
    display: flex;
    flex-direction: row;
    justify-content: end;
    gap: 1.5rem;
    margin: 1rem 0;
  }
}
</style>
