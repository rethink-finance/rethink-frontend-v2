<template>
  <div class="crt_page page_shell">
    <div class="crt_page__head">
      <h1 class="crt_page__title">
        CarrotFunding Vault
      </h1>
      <p class="crt_page__subtitle">
        Execution console for the Roles v2 vault on HyperEVM. The executor moves the Safe's capital between its own
        venues; the admin Safe pays the payout wallet, keeps the API traders registered and decides who the executors are.
      </p>
    </div>
    <ExecutionCrtV2Console />
  </div>
</template>

<script setup lang="ts">
/**
 * The console on a route of its own. The vault's Execution App tab mounts the
 * same component, but a vault page only exists once the vault is finalized;
 * this one works from the moment the Safe and the Roles modifier exist, which
 * is what lets the whitelist be checked and rehearsed on deployment day.
 */
useHead({ title: "CarrotFunding Vault console" });
</script>

<style scoped lang="scss">
.crt_page {
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
    max-width: 680px;
    margin-top: 0.5rem;
    font-size: 14px;
    line-height: 1.55;
    color: $color-steel-blue;
  }
}
</style>
