<template>
  <div class="page-permissions">
    <UiMainCard
      title="🛠️ We are working on displaying permissions within Rethink dApp. Until then please use Gnosis Guild frontend."
    >
      <div class="info_container">
        <p class="info_container__text">
          Having trouble understanding how to read permissions?
          <a
            class="info_container__link"
            href="https://docs.rethink.finance/rethink.finance"
            target="_blank"
          >Learn more here</a>.
        </p>
        <div class="info_container__buttons">
          <UiLinkExternalButton
            title="View OIV Permissions"
            :href="navigateToGnosis"
          />
          <v-btn color="primary" @click="navigateToCreatePermissions">
            Create Permissions Proposal
          </v-btn>
        </div>
      </div>
    </UiMainCard>
  </div>
</template>

<script setup lang="ts">
// types
import type IFund from "~/types/fund";
// components
import { useFundStore } from "~/store/fund/fund.store";
import { getGnosisPermissionsUrl } from "~/composables/permissions/getGnosisPermissionsUrl";

const router = useRouter();
const fundStore = useFundStore();

const fund = useAttrs().fund as IFund;
const { selectedFundSlug } = storeToRefs(useFundStore());


const navigateToGnosis = ref("");

const updateGnosisLink = async () => {
  if (!fund) {
    navigateToGnosis.value = "";
    return;
  }

  try {
    const roleModAddress = await fundStore.getRoleModAddress(fund.address);
    navigateToGnosis.value = getGnosisPermissionsUrl(fund.chainShort, roleModAddress);
  } catch (error) {
    console.error(error);
    navigateToGnosis.value = "";
  }
};

watch(
  () => [fund.chainShort, fundStore.getRoleModAddress],
  () => {
    updateGnosisLink();
  },
  { immediate: true },
);

const navigateToCreatePermissions = () => {
  router.push(
    `/details/${selectedFundSlug.value}/governance/delegated-permissions`,
  );
};
</script>

<style scoped lang="scss">
.info_container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 15px;

  &__text {
    font-size: $text-sm;
    color: $color-light-subtitle;
  }
  &__link {
    color: $color-primary;
    text-decoration: underline;
  }
  &__buttons {
    display: flex;
    flex-direction: column;
    gap: 15px;

    @include md {
      flex-direction: row;
    }
  }
}
</style>
