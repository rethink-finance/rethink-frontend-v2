<template>
  <div v-if="!hasAccess" class="access_gate">
    <div class="access_gate__card">
      <img
        src="~/assets/images/logo.svg"
        alt="rethink.finance"
        class="access_gate__logo"
      >

      <p class="access_gate__prompt">
        Enter password to proceed to the app
      </p>

      <v-form @submit.prevent="submitPassword">
        <v-text-field
          v-model="password"
          type="password"
          placeholder="Password"
          variant="outlined"
          hide-details="auto"
          :error-messages="errorMessage"
          @input="errorMessage = ''"
        />
        <v-btn
          type="submit"
          color="primary"
          class="access_gate__submit"
          block
        >
          Submit
        </v-btn>
      </v-form>

      <div class="access_gate__info">
        <v-icon icon="mdi-information-outline" size="20" color="info" />
        <p>
          rethink.finance is currently in the closed beta stage.
          Please contact <strong>rok@rethink.finance</strong> for access.
        </p>
      </div>

      <div class="access_gate__divider">
        <span class="line"></span>
        <span class="label">or</span>
        <span class="line"></span>
      </div>

      <div v-if="isSubscribed" class="access_gate__subscribed">
        <v-icon icon="mdi-check" size="20" color="info" />
        <p>You're on the list — we'll email you when access opens.</p>
      </div>
      <div v-else class="access_gate__subscribe">
        <p>No password yet? Subscribe for updates.</p>
        <v-form class="access_gate__subscribe_row" @submit.prevent="subscribe">
          <v-text-field
            v-model="email"
            type="email"
            placeholder="you@email.com"
            variant="outlined"
            hide-details
          />
          <v-btn type="submit" variant="outlined" :loading="isSubscribing">
            Notify me
          </v-btn>
        </v-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

// Hardcoded gate password & persistence key.
const ACCESS_PASSWORD = "rethinkCreate";
const STORAGE_KEY = "rethink_app_access";

// Google Apps Script web app URL — see implementation/google-apps-script/Code.gs
const SUBSCRIBE_ENDPOINT = "https://script.google.com/macros/s/AKfycbzHYr4p2TrANCPa0f4re8q8mLQUnJUU4e0o8l8pMbptepn0Q9UQOx597Jo0h-tEGt7QcQ/exec";

const hasAccess = ref(true); // true until mounted to avoid SSR flash
const password = ref("");
const errorMessage = ref("");
const email = ref("");
const isSubscribed = ref(false);

onMounted(() => {
  hasAccess.value = localStorage.getItem(STORAGE_KEY) === ACCESS_PASSWORD;
});

const submitPassword = () => {
  if (password.value === ACCESS_PASSWORD) {
    localStorage.setItem(STORAGE_KEY, ACCESS_PASSWORD);
    hasAccess.value = true;
  } else {
    errorMessage.value = "Incorrect password. Please try again.";
  }
};

const isSubscribing = ref(false);

const subscribe = async () => {
  if (!email.value || !email.value.includes("@") || isSubscribing.value) return;
  isSubscribing.value = true;
  try {
    // Apps Script doesn't return CORS headers, so send as an opaque
    // no-cors request — we can't read the response, but the row is written.
    await fetch(SUBSCRIBE_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ email: email.value, source: "app-gate" }),
    });
    isSubscribed.value = true;
  } catch {
    // Network failure — keep the form so the user can retry.
  } finally {
    isSubscribing.value = false;
  }
};
</script>

<style scoped lang="scss">
.access_gate {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(12, 13, 18, 0.58);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);

  &__card {
    width: 100%;
    max-width: 470px;
    background: $color-surface;
    @include borderGray;
    padding: 2.5rem 2.25rem 2rem;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  &__logo {
    height: 28px;
    align-self: center;
    margin-bottom: 0.25rem;
  }

  &__prompt {
    margin: 0;
    font-size: $text-md;
    color: $color-light-subtitle;
  }

  &__submit {
    margin-top: 1rem;
  }

  &__info,
  &__subscribed {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;

    p {
      margin: 0;
      font-size: $text-sm;
      line-height: 1.55;
      color: $color-light-subtitle;

      strong {
        color: $color-title;
      }
    }
  }

  &__info {
    background: $color-card-background;
    @include borderGray;
    padding: 1rem 1.125rem;
  }

  &__divider {
    display: flex;
    align-items: center;
    gap: 0.875rem;

    .line {
      flex: 1;
      height: 1px;
      background: $color-gray-light-transparent;
    }

    .label {
      font-size: $text-xs;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: $color-subtitle;
    }
  }

  &__subscribe {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    p {
      margin: 0;
      font-size: $text-sm;
      color: $color-subtitle;
    }
  }

  &__subscribe_row {
    display: flex;
    gap: 0.625rem;
    align-items: stretch;

    .v-text-field {
      flex: 1;
    }
  }
}
</style>
