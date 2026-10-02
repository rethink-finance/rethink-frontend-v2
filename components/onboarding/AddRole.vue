<template>
  <form class="add_role" @submit.prevent="submit">
    <div class="add_role__head">
      <span class="add_role__eyebrow">Add a custom role</span>
      <OnboardingInfoTip
        text="A further role with its own members, for example a second operator limited to one protocol. It starts with no permissions: add positions to it once it is created. The name becomes the role's key on the Roles modifier."
        label="About custom roles"
        align="left"
      />
    </div>
    <div class="add_role__controls">
      <input
        v-model="name"
        class="add_role__input"
        type="text"
        maxlength="31"
        placeholder="Role name, for example Trader"
        aria-label="Name of the new role"
        @input="error = ''"
      >
      <button
        type="submit"
        class="add_role__button"
        :disabled="!name.trim()"
      >
        Add role
      </button>
    </div>
    <p v-if="error" class="add_role__error">
      {{ error }}
    </p>
  </form>
</template>

<script setup lang="ts">
/**
 * The way to a custom role on the create flow's Permissions step: a name,
 * which becomes a new role tab. Whether the name can be used is the parent's
 * call: it knows the roles the vault already has.
 */
const props = defineProps<{
  /** Adds the role; returns why it could not be added, or "". */
  add: (name: string) => string;
}>();

const name = ref("");
const error = ref("");

const submit = () => {
  error.value = props.add(name.value);
  if (!error.value) name.value = "";
};
</script>

<style scoped lang="scss">
.add_role {
  padding: 0.875rem 1.125rem;
  border: 1px dashed $color-line-2;
  border-radius: $default-border-radius;

  &__head {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  &__eyebrow {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__controls {
    display: flex;
    align-items: stretch;
    gap: 0.625rem;
    margin-top: 0.625rem;
  }

  /* The app's global input rule sets a min-height and padding on every bare
     input; all three are set here so the field matches the member field. */
  &__input {
    flex: 1 1 auto;
    min-width: 0;
    height: auto;
    min-height: 0;
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

  &__button {
    flex: none;
    padding: 0 14px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-white;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: $color-line-3;
    }
    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  &__error {
    margin-top: 0.5rem;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-neg;
  }
}
</style>
