<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import type IRoute from "~/types/route";
import { useSettingsStore } from "~/store/settings/settings.store";

const props = defineProps<{
  routes: IRoute[];
  fundDetailsRoute: string;
}>();

const route = useRoute();
const appSettingsStore = useSettingsStore();

const isPathActive = (path: string = "", exactMatch = true) =>
  exactMatch ? route?.path === path : route?.path.startsWith(path);

const computedRoutes = computed(() => {
  // Everything in this row is curator tooling, so the whole row only appears
  // once manage mode is on. Governance stays reachable without it, being linked
  // from its own card; the rest are curator-only pages reached from here.
  const showInManageMode = [
    `${props.fundDetailsRoute}/governance`,
    `${props.fundDetailsRoute}/nav`,
    `${props.fundDetailsRoute}/flows`,
    `${props.fundDetailsRoute}/execution-app`,
    `${props.fundDetailsRoute}/permissions`,
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
      target: routeItem.isExternal ? "_blank" : "",
      isHidden,
    };
  }).filter((routeItem: IRoute) => !routeItem.isHidden);
});

const isManageMode = computed(() => appSettingsStore.isManageMode);
</script>

<template>
  <div
    v-if="computedRoutes.length"
    class="details_nav"
    :class="{ 'details_nav--manage': isManageMode }"
  >
    <!-- The design frames this row as "Curator mode"; the label only makes
         sense once manage mode is on, but the sections themselves stay
         reachable either way (manage-only routes are filtered out above). -->
    <span v-if="isManageMode" class="details_nav__eyebrow">
      Curator mode
    </span>
    <div class="details_nav__links">
      <nuxt-link
        v-for="navRoute in computedRoutes"
        :key="navRoute.to"
        :to="navRoute.to"
        :target="navRoute.target"
        class="details_nav__link"
        :class="{ 'details_nav__link--active': navRoute.isActive }"
      >
        {{ navRoute.title }}
      </nuxt-link>
    </div>
  </div>
</template>

<style scoped lang="scss">
.details_nav {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  flex-wrap: wrap;

  &--manage {
    padding: 0.625rem 0.875rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    background: $color-accent-soft;
  }

  &__eyebrow {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
    white-space: nowrap;
  }

  &__links {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  &__link {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.04em;
    padding: 0.3125rem 0.625rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    color: $color-steel-blue;
    white-space: nowrap;
    text-decoration: none;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover {
      color: $color-white;
      border-color: $color-line-3;
    }

    &--active {
      color: $color-cyan;
      border-color: $color-accent-line;
      background: $color-accent-soft;
    }
  }
}
</style>
