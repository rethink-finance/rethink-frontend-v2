<template>
  <div class="password_protect">
    <div class="password_protect__eyebrow">
      Closed beta
    </div>
    <h1 class="password_protect__title">
      Create vault
    </h1>

    <div class="password_protect__card">
      <label class="password_protect__label" for="create-vault-password">
        Enter password to proceed to the vault creation page
      </label>
      <input
        id="create-vault-password"
        v-model="password"
        class="password_protect__input"
        type="password"
        placeholder="Password"
        @keydown.enter="checkPassword"
      >
      <p class="password_protect__error">
        {{ error }}
      </p>
      <v-btn
        class="password_protect__submit bg-primary text-white"
        @click="checkPassword"
      >
        Submit
      </v-btn>
    </div>

    <p class="password_protect__note">
      rethink.finance is currently in the closed beta stage. Please contact
      <strong>rok@rethink.finance</strong> for access.
    </p>
  </div>
</template>

<script setup>

const props = defineProps({
  isPasswordCorrect: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:isPasswordCorrect"]);

const password = ref("");
const correctPasswords = ["rethinkCreate", "rethinkCreate2025"];
const error = ref("");

const checkPassword = () => {
  if (correctPasswords.includes(password.value)) {
    error.value = "";
    emit("update:isPasswordCorrect", true);
  } else {
    error.value = "Incorrect password. Please try again.";
    emit("update:isPasswordCorrect", false);
  }
};

watch(() => props.isPasswordCorrect, (newVal) => {
  if (!newVal) password.value = "";
});
</script>

<style scoped lang="scss">
.password_protect {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 520px;
  margin: 3rem auto;

  &__eyebrow {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__title {
    margin-top: 0.5rem;
    font-size: 32px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: $color-white;
  }

  &__card {
    display: flex;
    flex-direction: column;
    padding: 1.75rem 1.875rem;
    margin-top: 1.75rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-surface;
  }

  &__label {
    margin-bottom: 0.625rem;
    font-size: 13px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__input {
    width: 100%;
    padding: 11px 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.3;
    color: $color-white;

    &::placeholder {
      color: $color-steel-blue;
    }
    &:focus {
      outline: none;
      border-color: $color-accent-line;
    }
  }

  &__error {
    min-height: 13px;
    margin-top: 0.3125rem;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 13px;
    color: $color-neg;
  }

  &__submit {
    align-self: flex-start;
    margin-top: 0.875rem;
  }

  &__note {
    padding: 0.875rem 1.125rem;
    margin-top: 1.25rem;
    border: 1px solid $color-cyan-line;
    border-radius: $default-border-radius;
    background: $color-cyan-tint;
    font-size: 13px;
    line-height: 1.55;
    color: $color-white;
  }
}
</style>
