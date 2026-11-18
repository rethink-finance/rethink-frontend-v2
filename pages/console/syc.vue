<template>
  <div class="syc_page page_shell">
    <div class="syc_page__head">
      <h1 class="syc_page__title">
        SNI Yield Claim Vault
      </h1>
      <div class="syc_page__meta">
        Execution console · Polygon
      </div>
    </div>
    <ExecutionSycConsole />
  </div>
</template>

<script setup lang="ts">
/**
 * The console on a route of its own. The vault's Execution App tab mounts the
 * same component, but a vault page only exists once the vault is finalized;
 * this one works from the moment the Safe and the Roles modifier exist.
 */
useHead({ title: "SNI Yield Claim Vault console" });
</script>

<style scoped lang="scss">
.syc_page {
  &__head {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.75rem;
  }

  &__title {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.2;
    color: $color-white;
  }

  &__meta {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }
}
</style>
