<template>
  <div class="w-100 text-center">

    <p>
      For a deeper look and additional information, please view the Soonami OIV on
      <a
        :href="rethinkSoonamiUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        rethink.finance
      </a>
    </p>
  </div>
</template>
<script setup lang="ts">
import { SOONAMI_FUND_DETAILS_URL } from "~/middleware/redirectToSoonamiFund.global";
const rethinkSoonamiUrl = `https://app.rethink.finance${SOONAMI_FUND_DETAILS_URL}`;
</script>

<style scoped lang="scss">

</style>
