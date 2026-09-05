<template>
  <!-- display: contents — the wrapper exists for the single-root rule and
       must not become a flex item between the wallet chip and the settings
       button. -->
  <div class="notif_root">
    <v-menu
      v-model="isOpen"
      location="bottom end"
      offset="10"
      :close-on-content-click="false"
    >
      <template #activator="{ props: menuProps }">
        <button
          class="notif_btn"
          :class="{ 'notif_btn--unread': unreadCount > 0 }"
          type="button"
          aria-label="Notifications"
          v-bind="menuProps"
        >
          <v-icon icon="mdi-bell-outline" size="18" />
          <span v-if="unreadCount" class="notif_btn__badge">
            {{ unreadCount > 9 ? "9+" : unreadCount }}
          </span>
        <!-- No hover tooltip: the pointer is still on the button when the
             panel opens under it, and a tooltip there would sit over the
             panel's own head row and eat the first click. -->
        </button>
      </template>

      <div class="notif_menu">
        <div class="notif_menu__head">
          <div class="notif_menu__eyebrow">
            Notifications
          </div>
          <button
            type="button"
            class="notif_menu__head_btn"
            @click="openSettings"
          >
            <v-icon icon="mdi-tune-variant" size="14" />
            Delivery
          </button>
        </div>

        <div class="notif_menu__list">
          <template v-if="store.isLoading">
            <div
              v-for="n in 3"
              :key="n"
              class="notif_item notif_item--skeleton"
            >
              <div class="notif_item__icon skeleton_block" />
              <div class="notif_item__text">
                <div class="skeleton_block skeleton_block--title" />
                <div class="skeleton_block skeleton_block--body" />
              </div>
            </div>
          </template>
          <div v-else-if="!store.isAvailable" class="notif_menu__empty">
            Notifications are unavailable right now. Your positions are unaffected.
          </div>
          <div v-else-if="!store.notifications.length" class="notif_menu__empty">
            Nothing yet. New proposals and settlements in the vaults you are
            invested in will show up here.
          </div>
          <button
            v-for="notification in store.notifications"
            v-else
            :key="notification.id"
            type="button"
            class="notif_item"
            :class="{ 'notif_item--unread': highlighted.has(notification.id) }"
            @click="open(notification)"
          >
            <v-icon
              class="notif_item__icon"
              :icon="notificationIcon(notification.kind)"
              size="17"
            />
            <div class="notif_item__text">
              <div class="notif_item__title">
                {{ notification.title }}
              </div>
              <div class="notif_item__body">
                {{ notification.body }}
              </div>
              <div class="notif_item__meta">
                <span class="notif_item__meta_item">{{ notification.fundName || "Vault" }}</span>
                <span class="notif_item__meta_sep" />
                <span class="notif_item__meta_item">{{ chainName(notification.chainId) }}</span>
                <span class="notif_item__meta_sep" />
                <span class="notif_item__meta_item">{{ formatRelativeTime(notification.createdAt) }}</span>
              </div>
            </div>
          </button>
        </div>

        <div class="notif_menu__foot">
          <button
            type="button"
            class="notif_menu__foot_btn"
            @click="openSettings"
          >
            Get these by email or Telegram
            <v-icon icon="mdi-arrow-right" size="14" />
          </button>
        </div>
      </div>
    </v-menu>

    <NavbarNotificationSettingsDialog v-model="settingsOpen" />
  </div>
</template>

<script setup lang="ts">
import { useAccountStore } from "~/store/account/account.store";
import { useNotificationsStore } from "~/store/notifications/notifications.store";
import { networksMap } from "~/store/web3/networksMap";
import {
  formatRelativeTime,
  isUnread,
  notificationIcon,
} from "~/composables/notifications/feed";
import type { INotification } from "~/types/notifications";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * The navbar bell. The badge counts what arrived since the panel was last
 * opened; opening it clears the badge but keeps those rows highlighted until
 * it closes, so what was new is still visible while it is being read.
 */
const accountStore = useAccountStore();
const store = useNotificationsStore();
const router = useRouter();

const isOpen = ref(false);
const settingsOpen = ref(false);
const highlighted = ref(new Set<number>());

const unreadCount = computed(() => store.unreadCount);

const chainName = (chainId: ChainId) =>
  networksMap[chainId]?.chainName ?? chainId;

watch(
  () => accountStore.activeAccountAddress,
  (address) => store.setAccount(address),
  { immediate: true },
);

watch(isOpen, (open) => {
  if (open) {
    highlighted.value = new Set(
      store.notifications
        .filter((notification) => isUnread(notification, store.seenAt))
        .map((notification) => notification.id),
    );
    store.markAllSeen();
    store.fetchFeed();
  } else {
    highlighted.value = new Set();
  }
});

const open = (notification: INotification) => {
  isOpen.value = false;
  router.push(notification.path);
};

const openSettings = () => {
  isOpen.value = false;
  settingsOpen.value = true;
};

onMounted(() => store.startPolling());
onUnmounted(() => store.stopPolling());
</script>

<style scoped lang="scss">
.notif_root {
  display: contents;
}

/* Same quiet square as the settings trigger beside it; the badge is the only
   thing that changes when there is news. */
.notif_btn {
  position: relative;
  flex: none;
  width: 36px;
  height: 36px;
  margin-left: 0.5rem;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: $default-border-radius;
  color: $color-steel-blue;
  cursor: pointer;
  transition:
    color $default-transition-time ease,
    border-color $default-transition-time ease;

  &:hover {
    color: $color-white;
    border-color: $color-line-2;
  }

  &--unread {
    color: $color-white;
  }

  &__badge {
    position: absolute;
    top: 4px;
    right: 3px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    display: grid;
    place-items: center;
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    color: #0c0d12;
    background: $color-cyan-raw;
    border-radius: 999px;
    box-shadow: 0 0 0 2px var(--bg);
  }
}

/* Dropdown panel — the settings/wallet menu treatment, wider, with a
   scrolling list between a pinned head and foot. Lives in an overlay. */
.notif_menu {
  width: 380px;
  max-width: calc(100vw - 2rem);
  background: $color-navy-gray-light;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  box-shadow: var(--shadow-float-lg);
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid $color-line;
  }

  &__eyebrow {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__head_btn,
  &__foot_btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: none;
    border-radius: $default-border-radius;
    font-size: 12.5px;
    font-weight: 600;
    color: $color-light-subtitle;
    cursor: pointer;
    transition:
      background $default-transition-time ease,
      color $default-transition-time ease;

    &:hover {
      background: $color-gray-light-transparent;
      color: $color-white;
    }
  }

  &__list {
    max-height: 420px;
    overflow-y: auto;
    padding: 0.375rem;
  }

  &__empty {
    padding: 1.5rem 1rem;
    font-size: 13px;
    line-height: 1.5;
    text-align: center;
    color: $color-steel-blue;
  }

  &__foot {
    display: flex;
    justify-content: center;
    padding: 0.5rem;
    border-top: 1px solid $color-line;
  }
}

.notif_item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: $default-border-radius;
  text-align: left;
  color: $color-light-subtitle;
  cursor: pointer;
  transition: background $default-transition-time ease;

  &:hover {
    background: $color-gray-light-transparent;
  }

  /* Unread: the accent tint the rest of the app uses for "selected", plus a
     cyan dot at the icon's corner — colour alone would not survive a glance. */
  &--unread {
    background: $color-accent-soft;

    .notif_item__icon::after {
      content: "";
      position: absolute;
      top: -2px;
      right: -2px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: $color-cyan-raw;
      box-shadow: 0 0 0 2px $color-navy-gray-light;
    }

    .notif_item__title {
      color: $color-white;
    }
  }

  &__icon {
    position: relative;
    margin-top: 1px;
    color: $color-steel-blue;
  }

  &__text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &__title {
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.3;
    color: $color-white;
  }

  &__body {
    font-size: 12.5px;
    line-height: 1.45;
    color: $color-light-subtitle;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 2px;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.04em;
    color: $color-steel-blue;
  }

  &__meta_item {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta_sep {
    flex: none;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: $color-steel-blue;
    opacity: 0.6;
  }

  &--skeleton {
    cursor: default;
    pointer-events: none;
  }
}

.skeleton_block {
  background: $color-gray-light-transparent;
  border-radius: 3px;

  &.notif_item__icon {
    width: 17px;
    height: 17px;
    border-radius: 50%;
  }

  &--title {
    width: 60%;
    height: 12px;
  }

  &--body {
    width: 90%;
    height: 10px;
  }
}
</style>
