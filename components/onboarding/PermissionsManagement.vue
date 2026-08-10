<template>
  <div class="prepopulated">
    <div class="prepopulated__title">
      Prepopulated permissions
    </div>

    <!-- Two across from tablet up. These are on by default and stay on for
         almost everyone; the section should read as a short checklist rather
         than as five decisions stacked down the page. -->
    <div class="prepopulated__grid">
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
    padding: 0.625rem 1rem;
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);

    @include md {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 1rem;
    /* Drawn on the top edge so the card never ends on a rule, whichever row
       happens to be last. */
    border-top: 1px solid $color-line;

    @include md {
      &:nth-child(odd) {
        border-right: 1px solid $color-line;
      }

      /* An odd number of toggles would otherwise leave the last one half-width
         with a rule hanging off nothing. */
      &:nth-child(odd):last-child {
        grid-column: 1 / -1;
        border-right: none;
      }
    }
  }

  &__text {
    min-width: 0;
    font-size: 13px;
    line-height: 1.4;
    color: $color-white;
  }
}
</style>
