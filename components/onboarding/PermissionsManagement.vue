<template>
  <div class="prepopulated">
    <!-- Collapsed by default. These are on for almost every vault, so the
         step opens on one decision — "keep them all" — and the five rows are
         there for the curator who actually wants to change something. -->
    <div class="prepopulated__head">
      <button
        type="button"
        class="prepopulated__disclosure"
        :aria-expanded="isExpanded"
        @click="isExpanded = !isExpanded"
      >
        <Icon
          class="prepopulated__chevron"
          :class="{ 'prepopulated__chevron--open': isExpanded }"
          icon="material-symbols:keyboard-arrow-down-rounded"
          width="1.125rem"
          height="1.125rem"
        />
        <span class="prepopulated__title">Prepopulated permissions</span>
        <span class="prepopulated__summary">{{ summary }}</span>
      </button>

      <div class="prepopulated__master">
        <span class="prepopulated__master_label">Enable all</span>
        <OnboardingToggle
          :model-value="areAllEnabled"
          label="Enable all prepopulated permissions"
          @update:model-value="setAll"
        />
      </div>
    </div>

    <div v-if="isExpanded" class="prepopulated__rows">
      <div class="prepopulated__row">
        <p class="prepopulated__text">
          Send funds to admin contract &amp; settle flows
        </p>
        <OnboardingToggle
          :model-value="allowManagerToSendFundsToFundContract"
          label="Send funds to admin contract & settle flows"
          @update:model-value="(v: boolean) => emit('update:allowManagerToSendFundsToFundContract', v)"
        />
      </div>

      <div class="prepopulated__row">
        <p class="prepopulated__text">
          Collect fee
        </p>
        <OnboardingToggle
          :model-value="allowManagerToCollectFees"
          label="Collect fee"
          @update:model-value="(v: boolean) => emit('update:allowManagerToCollectFees', v)"
        />
      </div>

      <!-- Roles V1 grants this from the NAV methods step instead, as part of
           the second transaction there; a toggle here would do nothing. -->
      <div v-if="fundFactoryContractV2Used" class="prepopulated__row">
        <p class="prepopulated__text">
          Update NAV
        </p>
        <OnboardingToggle
          :model-value="allowManagerToUpdateNav"
          label="Update NAV"
          @update:model-value="(v: boolean) => emit('update:allowManagerToUpdateNav', v)"
        />
      </div>

      <!-- Both toggles below only exist on Roles V2: V1 cannot scope inside
           the Settings tuple, and its modifier has no separate membership
           admin. Both also need a one-time governance activation, offered
           from the vault's Permissions page once it is finalized. -->
      <div v-if="fundFactoryContractV2Used" class="prepopulated__row">
        <p class="prepopulated__text">
          Update vault metadata &amp; whitelist
        </p>
        <OnboardingToggle
          :model-value="allowManagerToUpdateSettings"
          label="Update vault metadata & whitelist"
          @update:model-value="(v: boolean) => emit('update:allowManagerToUpdateSettings', v)"
        />
      </div>

      <div v-if="fundFactoryContractV2Used" class="prepopulated__row">
        <p class="prepopulated__text">
          Manage role members
        </p>
        <OnboardingToggle
          :model-value="allowManagerToManageRoleMembers"
          label="Manage role members"
          @update:model-value="(v: boolean) => emit('update:allowManagerToManageRoleMembers', v)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  fundFactoryContractV2Used: boolean;
  allowManagerToSendFundsToFundContract: boolean;
  allowManagerToCollectFees: boolean;
  allowManagerToUpdateNav: boolean;
  allowManagerToUpdateSettings: boolean;
  allowManagerToManageRoleMembers: boolean;
}>();

const emit = defineEmits<{
  (e: "update:allowManagerToSendFundsToFundContract", value: boolean): void;
  (e: "update:allowManagerToCollectFees", value: boolean): void;
  (e: "update:allowManagerToUpdateNav", value: boolean): void;
  (e: "update:allowManagerToUpdateSettings", value: boolean): void;
  (e: "update:allowManagerToManageRoleMembers", value: boolean): void;
}>();

/** Only what this vault's Roles version actually shows a row for. */
const shownValues = computed(() => {
  const values = [
    props.allowManagerToSendFundsToFundContract,
    props.allowManagerToCollectFees,
  ];

  if (props.fundFactoryContractV2Used) {
    values.push(
      props.allowManagerToUpdateNav,
      props.allowManagerToUpdateSettings,
      props.allowManagerToManageRoleMembers,
    );
  }

  return values;
});

const enabledCount = computed(
  () => shownValues.value.filter(Boolean).length,
);
const areAllEnabled = computed(
  () => enabledCount.value === shownValues.value.length,
);

/**
 * The switch has no third state, so the count is what tells a curator that
 * some are off — otherwise "all on" and "two of five on" would look alike.
 */
const summary = computed(() =>
  areAllEnabled.value
    ? "All on"
    : `${enabledCount.value} of ${shownValues.value.length} on`,
);

// Opens itself when something is already off, so a returning curator sees
// which one rather than an innocent-looking collapsed row.
const isExpanded = ref(!areAllEnabled.value);

const setAll = (value: boolean) => {
  emit("update:allowManagerToSendFundsToFundContract", value);
  emit("update:allowManagerToCollectFees", value);

  if (props.fundFactoryContractV2Used) {
    emit("update:allowManagerToUpdateNav", value);
    emit("update:allowManagerToUpdateSettings", value);
    emit("update:allowManagerToManageRoleMembers", value);
  }

  // Turning everything off is how someone says they want to pick; leaving it
  // collapsed on an all-off card would just be a dead end.
  if (!value) isExpanded.value = true;
};
</script>

<style scoped lang="scss">
.prepopulated {
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 1rem;
  }

  &__disclosure {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;

    &:focus-visible {
      outline: none;

      .prepopulated__title {
        color: $color-white;
      }
    }
  }

  &__chevron {
    flex: none;
    color: $color-steel-blue;
    transition: transform $default-transition-time ease;

    &--open {
      transform: rotate(180deg);
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  &__title {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__summary {
    font-size: 12px;
    line-height: 1.4;
    color: $color-steel-blue;
    opacity: 0.75;
  }

  &__master {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex: none;
  }

  &__master_label {
    font-size: 13px;
    line-height: 1.4;
    color: $color-white;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 1rem;
    /* Drawn on the top edge so the card never ends on a rule. */
    border-top: 1px solid $color-line;
  }

  &__text {
    min-width: 0;
    font-size: 13px;
    line-height: 1.4;
    color: $color-white;
  }
}
</style>
