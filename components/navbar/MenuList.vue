<template>
  <ClientOnly>
    <v-navigation-drawer
      v-model="isMenuOpen"
      class="navbar_menu_list"
      location="top"
      temporary
    >
      <nuxt-link
        v-for="route in routes"
        :key="route.to"
        :to="route.disabled ? undefined : route.to"
        :target="route.isExternal ? '_blank' : ''"
        @click="isMenuOpen = false"
      >
        <v-list-item
          :disabled="route.disabled"
          :active="route.isActive"
          :color="route.pathColor"
          link
        >
          <template #default>
            <div class="navbar_menu_list__item">
              <div class="navbar_menu_list__title">
                {{ route.title }}
                <span v-if="route.badge" class="navbar_menu_list__badge">
                  {{ route.badge }}
                </span>
              </div>
              <div class="navbar_menu_list__subtitle">
                {{ route.text }}
              </div>
            </div>
          </template>
        </v-list-item>
      </nuxt-link>
    </v-navigation-drawer>
  </ClientOnly>
</template>

<script setup lang="ts">
interface RouteItem {
  to: string; // URL path
  exactMatch?: boolean; // Optional, indicates exact route matching
  title: string; // Title of the route
  text: string; // Description text
  disabled?: boolean; // Optional, indicates if the route is disabled
  badge?: string; // Optional, short mono tag next to the title (e.g. "SOON")
  isExternal?: boolean; // Optional, indicates if it's an external link
  isActive?: boolean;
  icon?: string; // Optional, icon for external links
  color?: string; // Optional, color for external links
  matchPrefix?: string; // Optional
  pathColor?: string; // Optional, color for external links
}

const props = defineProps({
  routes: {
    type: Array as PropType<RouteItem[]>,
    default: () => [],
  },
  modelValue: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(["update:modelValue"]);

const isMenuOpen = computed({
  get: () => props?.modelValue ?? false,
  set: (value) => {
    // Emit an event to update isOpen in the parent
    emit("update:modelValue", value);
  },
});
</script>


<style scoped lang="scss">
.navbar_menu_list {
  top: $navbar-height !important;
  height: 100% !important;

  &__item {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 1rem 2.5rem;

  }
  &__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    font-weight: 700;
  }
  &__badge {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    line-height: 1.4;
    font-weight: 500;
    color: $color-steel-blue;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    padding: 2px 6px;
  }
  &__subtitle {
    color: $color-subtitle !important;
    font-weight: 500;
  }
  a {
    text-decoration: none;
  }
}
</style>
