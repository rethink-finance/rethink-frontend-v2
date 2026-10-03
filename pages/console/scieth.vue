<template>
  <div class="sci_page page_shell">
    <div class="sci_page__head">
      <h1 class="sci_page__title">
        Scientific Vote Vault
      </h1>
      <p class="sci_page__subtitle">
        Execution console. Depositors' ETH is staked, a share stays worth one ETH, and only the yield leaves, to the
        Scientific Vote multisig.
      </p>
    </div>
    <ExecutionSciEthConsole />
  </div>
</template>

<script setup lang="ts">
/**
 * The console on a route of its own. The vault's Execution App tab mounts the
 * same component, but a vault page only exists once the vault is finalized;
 * this one works from the moment the Safe and the Roles modifier exist, which
 * is what lets the whole flow be rehearsed before the first deposit.
 */
useHead({ title: "Scientific Vote Vault console" });
</script>

<style scoped lang="scss">
.sci_page {
  &__head {
    margin-bottom: 1.75rem;
  }

  &__title {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.2;
    color: $color-white;
  }

  &__subtitle {
    max-width: 640px;
    margin-top: 0.5rem;
    font-size: 14px;
    line-height: 1.55;
    color: $color-steel-blue;
  }
}
</style>
