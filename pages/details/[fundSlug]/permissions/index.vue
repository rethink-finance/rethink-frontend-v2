<template>
  <div class="page-permissions">
    <UiMainCard>
      <div class="info_container">
        <div class="info_container__buttons">
          <UiLinkExternalButton
            title="View OIV Permissions"
            :href="navigateToGnosis"
            :show-tooltip="false"
          />
          <v-btn color="primary" @click="navigateToCreatePermissions">
            Create Raw Permissions Proposal
          </v-btn>
        </div>
        <p class="info_container__text">
          Having trouble understanding how to read permissions?
          <a
            class="info_container__link"
            href="https://docs.rethink.finance/rethink.finance"
            target="_blank"
          >Learn more here</a>.
        </p>
      </div>

      <!-- Permissions loaded from zodiac roles modifier -->
      <!-- TODO here it flickers as we first have to fetch fundData and then roleModAddress, prevent flickering -->
      <FundPermissions
        class="mt-6"
        :chain-id="fund.chainId"
        :roles="roles"
        :is-loading="isFetchingPermissions"
      />
    </UiMainCard>
  </div>
</template>

<script setup lang="ts">
// types
import type IFund from "~/types/fund";
// components
import { fetchRoles } from "~/services/zodiac-subgraph";
import { getGnosisPermissionsUrl } from "~/composables/permissions/getGnosisPermissionsUrl";
import { useFundStore } from "~/store/fund/fund.store";
import type { Role } from "~/types/zodiac-roles/role";
import { useActionState, useActionStateStore } from "~/store/actionState.store";
import { ChainId } from "~/store/web3/networksMap";

const router = useRouter();
const fundStore = useFundStore();
const actionStateStore = useActionStateStore();

const fund = useAttrs().fund as IFund;
const { selectedFundSlug } = storeToRefs(useFundStore());

const roles = ref<Role[]>([]);
const navigateToGnosis = ref("");

const updateGnosisLink = async () => {
  if (!fund?.address) {
    roles.value = [];
    navigateToGnosis.value = "";
    return;
  }

  try {
    const roleModAddress = await fundStore.getRoleModAddress(fund.address);
    navigateToGnosis.value = getGnosisPermissionsUrl(fund.chainShort, roleModAddress);
    await fetchPermissions(roleModAddress);
  } catch (error) {
    console.error(error);
    navigateToGnosis.value = "";
  }
};

const isFetchingPermissions = computed(() =>
  actionStateStore.isActionStateLoading("fetchRolesAction"),
);

watch(
  () => [fund.chainShort, fundStore.getRoleModAddress],
  () => {
    updateGnosisLink();
  },
  { immediate: true },
);


// TODO move this into roles store.
function fetchRolesAction(chainId: ChainId, rolesModAddress: string): Promise<Role[]> {
  return useActionState("fetchRolesAction", () =>
    fetchRoles(chainId, rolesModAddress),
  );
}

const fetchPermissions = async (rolesModAddress: string) => {
  roles.value = await fetchRolesAction(fund.chainId, rolesModAddress);
  console.log("Fetched Roles", toRaw(roles.value));
}

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
  gap: 1rem;

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
