<template>
  <div v-if="loading" class="w-100">
    <!-- TODO Create better skeletons in the future. -->
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
  </div>
  <div v-else-if="fund?.address" class="w-100">
    <!-- TODO this is where the fund header comes -->
    <div class="details_nav_container">
      <div class="details_nav">

        <div class="overlay-container" />

        <nuxt-link
          v-for="navRoute in computedRoutes"
          :to="navRoute.to"
        >

          <v-btn
            class="nav-link"
            variant="plain"
            :active="navRoute.isActive"
            :color="navRoute.pathColor"
          >

            <div :class="{ 'title-box': navRoute.isActive }">
              {{ navRoute.title }}
            </div>

          </v-btn>

        </nuxt-link>

      </div>
    </div>
    <NuxtPage :fund="fund" />
  </div>
  <div v-else class="d-flex flex-column h-100 align-center">
    <h2 class="mb-2">
      Fund not found
    </h2>
    <p class="text-center">
      Are you sure you are on the right network? <br>
      Try switching to a different network.
    </p>
  </div>

</template>

<script lang="ts" setup>
import { useFundStore } from "~/store/fund.store";
import { useWeb3Store } from "~/store/web3.store";
import type IFund from "~/types/fund";
import type IRoute from "~/types/route";

const fundStore = useFundStore();
const web3Store = useWeb3Store();
const route = useRoute();
const loading = ref(true);
const fundAddress = (route.params.id as string).split("-")[1];

onUnmounted(  () => {
  fundStore.fund = { } as IFund;
  fundStore.selectedFundAddress = "";
})

const fetchFund = async () => {
  if (!fundAddress) {
    console.error("No fund address provided in the route.");
    return;
  }
  loading.value = true;

  try {
    await fundStore.getFund(fundAddress);
  } catch (e) {
    console.error("Failed fetching fund -> ", e)
  }

  loading.value = false;
}

watch(() => web3Store.chainId, () => {
  fetchFund();
});

onMounted(  () => {
  fetchFund();
});
const fund = computed(() => fundStore.fund);

const routes : IRoute[] = [
  {
    to: `/details/${route.params.id}`,
    exactMatch: true,
    title: "Fund Details",
    text: "",
  },
  // {
  //   to: `/details/${route.params.id}/governance`,
  //   exactMatch: true,
  //   title: "Governance",
  //   text:"",
  // },
  {
    to: `/details/${route.params.id}/nav`,
    exactMatch: true,
    title: "NAV",
    text:"",
  },
  // {
  //   to: `/details/${route.params.id}/permissions`,
  //   exactMatch: true,
  //   title: "Permissions",
  //   text:"",
  // },
]

const isPathActive = (path: string = "", exactMatch = true) => exactMatch ? route?.path === path : route?.path.startsWith(path);
const getPathColor = (isActive = false, color = "var(--color-subtitle)") => (isActive ? "primary" : color);

const computedRoutes = computed(() => {
  return routes.map((routeItem: IRoute) => {
    let isActive;
    if (routeItem.exactMatch) {
      isActive = isPathActive(routeItem.to, true)
    } else if (
      isPathActive(routeItem.matchPrefix, false) ||
      isPathActive(routeItem.to, true)) {
      isActive = true;
    } else {
      isActive = false;
    }

    return {
      ...routeItem,
      isActive,
      pathColor: getPathColor(isActive, routeItem.color),
      target: routeItem.isExternal ? "_blank" : "",
    };
  });
});

</script>

<style lang="scss" scoped>
.fund_details {
  width: 100%;
}
.details_nav{
  position: relative;
  margin-bottom: 2rem;
  padding-top: 1rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  width: 83%;
}

.details_nav_container{
  display: flex;
  flex-direction: row;
  justify-content: center;
}

.nav-link {
  height: 100%;
  text-transform: Capitalize;
  font-size: 1rem;
  font-weight: 700;
  padding: 0.5rem;

  &:not(:hover) {
    opacity: 0.85;
  }
}

.title-box{
  position: relative;
  border-bottom: 2px solid;
  border-color: var(--color-primary);
  padding-bottom: 1rem;
}

.overlay-container {
  position: absolute;
  bottom: 0;
  background-color: var(--color-divider);
  width: 83%;
  height: 2px;
  margin-left: 1.5rem;
}
</style>
