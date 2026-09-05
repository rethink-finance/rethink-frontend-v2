<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="brand_modal">
      <div class="brand_modal__head">
        <div class="brand_modal__heading">
          <div class="brand_modal__eyebrow">
            Notifications
          </div>
          <h2 class="brand_modal__title">
            Delivery settings
          </h2>
        </div>
        <button
          type="button"
          class="brand_modal__close"
          aria-label="Close"
          @click="close"
        >
          <Icon icon="material-symbols:close" width="1.125rem" />
        </button>
      </div>

      <div class="brand_modal__body ns_body">
        <!-- Step one: prove the wallet. Nothing here is readable without it,
             so the dialog asks instead of pretending to have settings. -->
        <template v-if="!store.hasSession || !store.settings">
          <p>
            Settings are stored per wallet. Sign a short message to prove this
            one is yours — it costs no gas and sends no transaction.
          </p>
          <div class="ns_actions">
            <v-btn
              color="primary"
              :loading="store.isSigningIn || store.isLoadingSettings"
              @click="signIn"
            >
              Sign in with wallet
            </v-btn>
          </div>
        </template>

        <template v-else>
          <!-- Email -->
          <section class="ns_section">
            <div class="ns_section__head">
              <div class="ns_section__eyebrow">
                Email
              </div>
              <OnboardingToggle
                v-if="settings.email"
                :model-value="settings.emailEnabled"
                label="Send email notifications"
                @update:model-value="save({ emailEnabled: $event }, 'Email delivery updated.')"
              />
            </div>
            <div class="ns_row">
              <v-text-field
                v-model="emailDraft"
                class="ns_row__field"
                type="email"
                placeholder="you@example.com"
                density="compact"
                variant="outlined"
                hide-details
                @keyup.enter="saveEmail"
              />
              <v-btn
                color="primary"
                variant="flat"
                :disabled="!emailChanged"
                :loading="store.isSavingSettings && savingWhat === 'email'"
                @click="saveEmail"
              >
                {{ settings.email && !emailDraft.trim() ? "Remove" : "Save" }}
              </v-btn>
            </div>
            <div class="ns_hint">
              <template v-if="!settings.emailDeliveryAvailable">
                Email delivery is not switched on for this server yet; the
                address is kept for when it is.
              </template>
              <template v-else-if="settings.email && settings.emailVerified">
                <span class="ns_status ns_status--ok">Verified</span>
                {{ settings.email }} receives the events selected below.
              </template>
              <template v-else-if="settings.email">
                <span class="ns_status ns_status--pending">Unconfirmed</span>
                Open the confirmation email sent to {{ settings.email }}.
                <button
                  type="button"
                  class="ns_link"
                  :disabled="isResending"
                  @click="resend"
                >
                  Send it again
                </button>
              </template>
              <template v-else>
                Add an address to get notifications by email.
              </template>
            </div>
          </section>

          <!-- Telegram -->
          <section class="ns_section">
            <div class="ns_section__head">
              <div class="ns_section__eyebrow">
                Telegram
              </div>
              <OnboardingToggle
                v-if="settings.telegramLinked"
                :model-value="settings.telegramEnabled"
                label="Send Telegram notifications"
                @update:model-value="save({ telegramEnabled: $event }, 'Telegram delivery updated.')"
              />
            </div>
            <template v-if="!settings.telegramDeliveryAvailable">
              <div class="ns_hint">
                Telegram delivery is not switched on for this server yet.
              </div>
            </template>
            <template v-else-if="settings.telegramLinked">
              <div class="ns_row">
                <div class="ns_hint ns_hint--grow">
                  <span class="ns_status ns_status--ok">Linked</span>
                  {{ settings.telegramUsername ? `@${settings.telegramUsername}` : "A Telegram chat" }}
                  receives the events selected below.
                </div>
                <v-btn
                  variant="text"
                  class="ns_quiet_btn"
                  :loading="isUnlinking"
                  @click="unlink"
                >
                  Unlink
                </v-btn>
              </div>
            </template>
            <template v-else-if="store.telegramLink">
              <div class="ns_row">
                <a
                  class="v-btn v-btn--flat v-btn--density-default v-btn--size-default bg-primary ns_link_btn"
                  :href="store.telegramLink.deepLink"
                  target="_blank"
                  rel="noopener"
                >
                  Open @{{ store.telegramLink.botUsername }} in Telegram
                  <v-icon icon="mdi-open-in-new" size="14" class="ml-1" />
                </a>
              </div>
              <div class="ns_hint">
                Press <strong>Start</strong> in the chat, or send
                <code class="ns_code">/start {{ store.telegramLink.code }}</code>
                to the bot. Waiting for the link…
              </div>
            </template>
            <template v-else>
              <div class="ns_row">
                <v-btn
                  color="primary"
                  variant="flat"
                  :loading="isLinking"
                  @click="link"
                >
                  Link Telegram
                </v-btn>
              </div>
              <div class="ns_hint">
                Opens the Rethink bot with a one-time code; nothing else is shared.
              </div>
            </template>
          </section>

          <!-- Events -->
          <section class="ns_section">
            <div class="ns_section__eyebrow">
              Events
            </div>
            <div
              v-for="kind in settings.availableKinds"
              :key="kind.kind"
              class="ns_kind"
              @click="toggleKind(kind.kind)"
            >
              <div class="ns_kind__text">
                <div class="ns_kind__title">
                  {{ kind.label }}
                </div>
                <div class="ns_kind__hint">
                  {{ kind.description }}
                </div>
              </div>
              <OnboardingToggle
                :model-value="settings.kinds.includes(kind.kind)"
                :label="kind.label"
                @click.stop
                @update:model-value="toggleKind(kind.kind)"
              />
            </div>
            <div class="ns_hint">
              Only vaults this wallet is invested in — holding shares or with a
              request queued — produce notifications.
            </div>
          </section>
        </template>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { useNotificationsStore } from "~/store/notifications/notifications.store";
import { useToastStore } from "~/store/toasts/toast.store";
import type { NotificationKind } from "~/types/notifications";

/**
 * Where a wallet's notifications go. Every control saves itself: there is no
 * form to submit, because each row is its own decision and a person linking
 * Telegram should not have to remember to press Save afterwards.
 */
const props = defineProps({
  modelValue: Boolean,
});
const emit = defineEmits(["update:modelValue"]);

const store = useNotificationsStore();
const toastStore = useToastStore();

const settings = computed(() => store.settings!);

const emailDraft = ref("");
const savingWhat = ref<"email" | "other" | null>(null);
const isResending = ref(false);
const isLinking = ref(false);
const isUnlinking = ref(false);

const emailChanged = computed(
  () => emailDraft.value.trim().toLowerCase() !== (store.settings?.email ?? ""),
);

const close = () => emit("update:modelValue", false);

const reportError = (error: any, fallback: string) => {
  const message = error?.message || fallback;
  // A rejected signature is a choice, not a failure.
  if (/rejected|denied/i.test(message)) return;
  toastStore.errorToast(message);
};

const signIn = async () => {
  try {
    await store.loadSettings();
  } catch (error) {
    reportError(error, "Could not sign in.");
  }
};

const save = async (
  patch: Parameters<typeof store.saveSettings>[0],
  successMessage: string,
) => {
  savingWhat.value = "other";
  try {
    await store.saveSettings(patch);
    toastStore.successToast(successMessage);
  } catch (error) {
    reportError(error, "Could not save the settings.");
  } finally {
    savingWhat.value = null;
  }
};

const saveEmail = async () => {
  if (!emailChanged.value) return;
  const email = emailDraft.value.trim() || null;
  savingWhat.value = "email";
  try {
    const verificationSent = await store.saveSettings({ email });
    if (!email) {
      toastStore.successToast("Email address removed.");
    } else if (verificationSent) {
      toastStore.successToast(`Confirmation email sent to ${email}.`);
    } else {
      toastStore.successToast("Email address saved.");
    }
  } catch (error) {
    reportError(error, "Could not save the email address.");
  } finally {
    savingWhat.value = null;
  }
};

const resend = async () => {
  isResending.value = true;
  try {
    const sent = await store.resendVerification();
    toastStore.successToast(
      sent ? "Confirmation email sent." : "Email delivery is not available right now.",
    );
  } catch (error) {
    reportError(error, "Could not send the confirmation email.");
  } finally {
    isResending.value = false;
  }
};

const toggleKind = (kind: NotificationKind) => {
  const current = store.settings?.kinds ?? [];
  const kinds = current.includes(kind)
    ? current.filter((entry) => entry !== kind)
    : [...current, kind];
  save({ kinds }, "Notification events updated.");
};

// ---- Telegram link ---------------------------------------------------------

let linkPoll: ReturnType<typeof setInterval> | undefined;

const stopLinkPoll = () => {
  if (linkPoll) clearInterval(linkPoll);
  linkPoll = undefined;
};

const link = async () => {
  isLinking.value = true;
  try {
    await store.startTelegramLink();
    // The bot binds the chat out of band; poll until the settings say linked.
    stopLinkPoll();
    linkPoll = setInterval(async () => {
      await store.refreshSettings();
      if (store.settings?.telegramLinked) {
        stopLinkPoll();
        store.telegramLink = null;
        toastStore.successToast("Telegram linked.");
      }
    }, 4000);
  } catch (error) {
    reportError(error, "Could not start the Telegram link.");
  } finally {
    isLinking.value = false;
  }
};

const unlink = async () => {
  isUnlinking.value = true;
  try {
    await store.unlinkTelegram();
    toastStore.successToast("Telegram unlinked.");
  } catch (error) {
    reportError(error, "Could not unlink Telegram.");
  } finally {
    isUnlinking.value = false;
  }
};

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (store.hasSession && !store.settings) {
        store.loadSettings().catch((error) => reportError(error, "Could not load settings."));
      }
    } else {
      stopLinkPoll();
      store.telegramLink = null;
    }
  },
);

watch(
  () => store.settings?.email,
  (email) => {
    emailDraft.value = email ?? "";
  },
  { immediate: true },
);

onUnmounted(stopLinkPoll);
</script>

<style scoped lang="scss">
.ns_body {
  display: flex;
  flex-direction: column;
}

.ns_actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.ns_section {
  padding: 1.125rem 0;
  border-top: 1px solid $color-line;

  &:first-child {
    padding-top: 0;
    border-top: none;
  }

  &:last-child {
    padding-bottom: 0;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__eyebrow {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
    margin-bottom: 0.625rem;
  }
}

.ns_row {
  display: flex;
  align-items: center;
  gap: 0.625rem;

  &__field {
    flex: 1 1 auto;
  }
}

.ns_hint {
  margin-top: 0.5rem;
  font-size: 12.5px;
  line-height: 1.5;
  color: $color-steel-blue;

  &--grow {
    flex: 1 1 auto;
    margin-top: 0;
  }
}

.ns_status {
  display: inline-block;
  margin-right: 0.375rem;
  padding: 1px 6px;
  font-family: $font-mono;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: $default-border-radius;
  border: 1px solid $color-line-2;

  &--ok {
    color: $color-pos;
    border-color: $color-yield-line;
    background: $color-yield-soft;
  }

  &--pending {
    color: $color-warn;
    border-color: $color-warn-line;
    background: $color-warn-soft;
  }
}

.ns_link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: $color-cyan;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.ns_link_btn {
  text-decoration: none;
}

.ns_quiet_btn {
  color: $color-text-irrelevant !important;
}

.ns_code {
  font-family: $font-mono;
  font-size: 12px;
  padding: 1px 5px;
  border: 1px solid $color-line-2;
  border-radius: 3px;
  color: $color-white;
}

.ns_kind {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0.25rem;
  border-radius: $default-border-radius;
  cursor: pointer;
  user-select: none;
  transition: background $default-transition-time ease;

  &:hover {
    background: $color-gray-light-transparent;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &__title {
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.2;
    color: $color-white;
  }

  &__hint {
    font-size: 11.5px;
    line-height: 1.3;
    color: $color-steel-blue;
  }
}
</style>
