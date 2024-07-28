<template>
  <div class="nav">
    <UiHeader>
      <div>
        <div class="main_header__title">
          {{ fundTotalNAVFormattedShort }}
        </div>
        <div class="main_header__subtitle">
          Last updated on <strong>{{ fundLastNAVUpdateDate }}</strong>
        </div>
      </div>
      <div class="button_container">
        <FundNavSimulateDialog :use-last-nav-methods="true" />

        <ui-tooltip-click
          :tooltip-text="
            accountStore.isConnected ? '' : 'Connect your wallet to update NAV'
          "
          :hide-after="1500"
        >
          <v-btn
            :disabled="isLoading"
            class="bg-primary text-secondary"
            @click="accountStore.isConnected ? updateNAV() : null"
          >
            <template #prepend>
              <v-progress-circular
                v-if="isLoading"
                class="d-flex"
                size="20"
                width="3"
                indeterminate
              />
            </template>
            Update NAV
          </v-btn>
        </ui-tooltip-click>
      </div>
    </UiHeader>

    <div class="main_card">
      <UiHeader>
        <div>
          <div class="main_expansion_panel__subtitle mb-4">
            NAV Methods
          </div>
          <div>
            <nuxt-link
              class="nav__learn_more_link"
              href="https://docs.rethink.finance/rethink.finance/protocol/nav-calculator-contract"
              target="_blank"
            >
              Learn more about NAV methods ->
            </nuxt-link>
          </div>
        </div>
        <div>
          <nuxt-link :to="`/details/${selectedFundSlug}/nav/manage`">
            <v-btn class="text-secondary" variant="outlined">
              Manage Methods
            </v-btn>
          </nuxt-link>
        </div>
      </UiHeader>
      <div class="methods main_grid main_grid--full-width main_grid--no-gap">
        <FundNavMethodsTable :methods="fundLastNAVUpdateEntries" />
      </div>
    </div>

    <div class="main_card">
      <div class="main_expansion_panel__subtitle">
        NAV Updates
      </div>
      <div>
        <FundNavUpdates :fund="fund" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import addresses from "~/assets/contracts/addresses.json";
import { useAccountStore } from "~/store/account.store";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import { useWeb3Store } from "~/store/web3.store";
import type IFund from "~/types/fund";

const fundStore = useFundStore();
const accountStore = useAccountStore();
const toastStore = useToastStore();
const web3Store = useWeb3Store();

const fund = useAttrs().fund as IFund;
const {
  fundTotalNAVFormattedShort,
  selectedFundSlug,
  fundLastNAVUpdate,
  fundLastNAVUpdateEntries,
} = toRefs(useFundStore());

const isLoading = ref(false);

const fundLastNAVUpdateDate = computed(() => {
  if (!fundLastNAVUpdate.value) return "N/A";
  return fundLastNAVUpdate.value.date ?? "N/A";
});

const updateNAV = async () => {
  console.log("UPDATE NAV");
  try {
    isLoading.value = true;
    const chainId =
      web3Store.chainId as keyof (typeof addresses)["NAVExecutorBeaconProxy"];

    const navExecutorAddr = addresses.NAVExecutorBeaconProxy[chainId];

    if (!navExecutorAddr) {
      toastStore.errorToast(
        "The NAV Executor address is not available for this network. Please contact the Rethink Finance support.",
      );
      isLoading.value = false;
      return;
    }

    await fundStore.fundContract.methods
      .executeNAVUpdate(navExecutorAddr)
      .send({
        from: fundStore.activeAccountAddress,
        maxPriorityFeePerGas: null,
        maxFeePerGas: null,
      })
      .on("transactionHash", function (hash: any) {
        console.log("tx hash: " + hash);
        toastStore.warningToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", function (receipt: any) {
        console.log(receipt);
        if (receipt.status) {
          toastStore.successToast("The recalculation of OIV NAV has Succeeded");
        } else {
          toastStore.errorToast(
            "The recalculation of OIV NAV has failed. Please contact the Rethink Finance support.",
          );
        }
        isLoading.value = false;
      })
      .on("error", function (error: any) {
        console.log(error);
        isLoading.value = false;

        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error) {
    console.error("Error updating NAV: ", error);
    isLoading.value = false;
    toastStore.errorToast(
      "There has been an error. Please contact the Rethink Finance support.",
    );
  }
};
</script>

<style scoped lang="scss">
.nav {
  &__learn_more_link {
    font-weight: 500;
    color: $color-primary;
  }
}
.button_container {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @include sm {
    flex-direction: row;
  }
}
</style>
