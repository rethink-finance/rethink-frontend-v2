<template>
  <div class="prepopulated">
    <div class="prepopulated__title">
      Prepopulated permissions
    </div>

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

    <!-- Roles V1 grants this from the NAV methods step instead, as part of the
         second transaction there; a toggle here would do nothing. -->
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
         admin. They also both need a one-time governance activation before
         the manager can actually use them (see the activation notice on the
         page). -->
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
</template>

<script setup lang="ts">
defineProps<{
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
</script>

<style scoped lang="scss">
.prepopulated {
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__title {
    padding: 0.875rem 1.125rem;
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 0.875rem 1.125rem;
    border-top: 1px solid $color-line;
  }

  &__text {
    max-width: 72ch;
    font-size: 13.5px;
    line-height: 1.5;
    color: $color-white;
  }
}
</style>
