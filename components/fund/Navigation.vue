<script setup lang="ts">
import type IRoute from "~/types/route";
import { useSettingsStore } from "~/store/settings/settings.store";
import { computed } from "vue";
import { useRoute } from "vue-router";

const props = defineProps<{
  routes: IRoute[];
  fundDetailsRoute: string;
}>();

const route = useRoute();
const appSettingsStore = useSettingsStore();

const isPathActive = (path: string = "", exactMatch = true) =>
  exactMatch ? route?.path === path : route?.path.startsWith(path);

const getPathColor = (isActive = false, color = "#77839f") =>
  isActive ? "primary" : color;

const computedRoutes = computed(() => {
  const showInManageMode = [
    `${props.fundDetailsRoute}/flows`,
    `${props.fundDetailsRoute}/execution-app`,
  ]
  return props.routes.map((routeItem: IRoute) => {
    const isHidden = showInManageMode.includes(routeItem.to) ? !appSettingsStore.isManageMode : false;

    let isActive;
    if (routeItem.exactMatch) {
      isActive = isPathActive(routeItem.to, true);
    } else if (
      isPathActive(routeItem.matchPrefix, false) ||
      isPathActive(routeItem.to, true)
    ) {
      isActive = true;
    } else {
      isActive = false;
    }

    return {
      ...routeItem,
      isActive,
      pathColor: getPathColor(isActive, routeItem.color),
      target: routeItem.isExternal ? "_blank" : "",
      isHidden,
    };
  }).filter((routeItem: IRoute) => !routeItem.isHidden);
});
</script>

<template>
  <div class="details_nav_container">
    <div class="details_nav">
      <div class="overlay-container" />
      <nuxt-link
        v-for="navRoute in computedRoutes"
        :key="navRoute.to"
        :to="navRoute.to"
        class="link"
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
</template>

<style scoped lang="scss">
.details_nav {
  position: relative;
  padding-top: 8px;
  width: 100%;
}

.details_nav_container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: 4px;
  padding-left: 1rem;
  padding-right: 1rem;
  padding-bottom: 8px;
  margin-bottom: 40px;

  background-color: $color-bg-transparent;
  border-radius: 4px;

  @include sm {
    padding-left: 0;
    padding-right: 0;
  }
}

.link {
  &:first-of-type {
    .nav-link {
      padding-left: 8px;
    }
  }
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

.title-box {
  position: relative;
  border-bottom: 2px solid;
  border-color: var(--color-primary);
  padding-bottom: 1rem;
}

.overlay-container {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);

  background-color: var(--color-divider);
  width: calc(100% - 16px);
  height: 2px;
}
</style>
