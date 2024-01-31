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
        :to="route.to"
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
    text-decoration: none;
    font-weight: 700;
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
