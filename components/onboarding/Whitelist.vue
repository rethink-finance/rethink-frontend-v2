<template>
  <section class="whitelist">
    <div class="whitelist__head">
      <div class="whitelist__titles">
        <div class="whitelist__title_row">
          <h2 class="whitelist__title">
            Whitelisted deposits
          </h2>
          <OnboardingFieldChip :tag="FieldTag.UpgradableCurator" />
        </div>
        <p class="whitelist__sub">
          Only the addresses below can deposit into the vault. Leave off for a
          permissionless vault.
        </p>
      </div>

      <OnboardingToggle
        v-model="isWhitelistEnabled"
        :disabled="!isEditable"
        label="Restrict deposits to a whitelist"
      />
    </div>

    <div class="whitelist__body" :class="{ 'whitelist__body--off': !isWhitelistEnabled }">
      <div v-if="isEditable" class="whitelist__add">
        <input
          v-model="newAddress"
          class="whitelist__input"
          type="text"
          placeholder="0x0000000000000000000000000000000000000000"
          @keydown.enter="addAddress"
        >
        <button
          type="button"
          class="whitelist__add_button"
          @click="addAddress"
        >
          Add address
        </button>
      </div>
      <p class="whitelist__error">
        {{ addError }}
      </p>

      <div class="whitelist__table">
        <div class="whitelist__row whitelist__row--head">
          <span>#</span>
          <span>Address</span>
          <span>State</span>
          <span />
        </div>

        <div
          v-for="(item, index) in whitelist"
          :key="item.address"
          class="whitelist__row"
        >
          <span class="whitelist__index">{{ index + 1 }}</span>
          <span class="whitelist__address">{{ item.address }}</span>
          <span class="whitelist__state">{{ stateOf(item) }}</span>
          <button
            v-if="isEditable"
            type="button"
            class="whitelist__remove"
            @click="removeAddress(item)"
          >
            {{ item.deleted ? "Undo" : "Remove" }}
          </button>
          <span v-else />
        </div>

        <div v-if="!whitelist.length" class="whitelist__empty">
          No addresses whitelisted yet.
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { IWhitelist } from "~/types/enums/fund_setting_proposal";
import { FieldTag } from "~/types/enums/stepper_onboarding";

/**
 * The deposit whitelist. Rows are never dropped once they exist on-chain —
 * removing one marks it `deleted`, which is what the settings transaction
 * reads; only an address added in this session disappears outright.
 */
const emit = defineEmits(["update:modelValue", "update:whitelistEnabled"]);

const props = defineProps({
  modelValue: {
    type: Array as () => IWhitelist[],
    default: () => [],
  },
  whitelistEnabled: {
    type: Boolean,
    default: false,
  },
  isEditable: {
    type: Boolean,
    default: true,
  },
});

const newAddress = ref("");
const addError = ref("");

const whitelist = computed({
  get: () => props?.modelValue || [],
  set: (value: IWhitelist[]) => {
    emit("update:modelValue", value);
  },
});

const isWhitelistEnabled = computed({
  get: () => props.whitelistEnabled || false,
  set: (value: boolean) => {
    emit("update:whitelistEnabled", value);
  },
});

const stateOf = (item: IWhitelist) => {
  if (item.deleted) return "Removed";
  if (item.isNew) return "Added";
  return "Active";
};

const addAddress = () => {
  const address = newAddress.value.trim();
  addError.value = "";

  if (formRules.isValidAddress(address) !== true) {
    addError.value = "Address is not valid.";
    return;
  }
  if (
    whitelist.value.some(
      (item) => item.address.toLowerCase() === address.toLowerCase(),
    )
  ) {
    addError.value = "This address is already in the whitelist.";
    return;
  }

  whitelist.value = [
    ...whitelist.value,
    { address, isNew: true, deleted: false },
  ];
  newAddress.value = "";
};

const removeAddress = (item: IWhitelist) => {
  // An address added in this session was never stored, so it just goes away.
  if (item.isNew) {
    whitelist.value = whitelist.value.filter((i) => i.address !== item.address);
    return;
  }
  item.deleted = !item.deleted;
};
</script>

<style scoped lang="scss">
.whitelist {
  display: flex;
  flex-direction: column;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.375rem;
  }

  &__title_row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  &__title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  &__sub {
    max-width: 62ch;
    margin-top: 0.375rem;
    font-size: 13px;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__body--off {
    opacity: 0.45;
    pointer-events: none;
  }

  &__add {
    display: flex;
    gap: 0.625rem;
  }

  &__input {
    flex: 1;
    min-width: 0;
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

  &__add_button {
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

    &:hover {
      border-color: $color-line-3;
    }
  }

  &__error {
    min-height: 13px;
    margin: 0.3125rem 0 0.875rem;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 13px;
    color: $color-neg;
  }

  &__table {
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    overflow: hidden;
  }

  &__row {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 110px 80px;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid $color-line;
    font-family: $font-mono;
    font-size: 12px;
    line-height: 1.4;
    color: $color-white;

    &:first-child {
      border-top: none;
    }

    &--head {
      font-size: 10.5px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: $color-steel-blue;
    }
  }

  &__index {
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;
  }

  &__address {
    word-break: break-all;
  }

  &__state {
    color: $color-cyan;
  }

  &__remove {
    justify-self: end;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-neg;
    }
  }

  &__empty {
    padding: 28px;
    text-align: center;
    font-size: 13px;
    color: $color-steel-blue;
  }

  @media (prefers-reduced-motion: reduce) {
    &__remove {
      transition: none;
    }
  }
}
</style>
