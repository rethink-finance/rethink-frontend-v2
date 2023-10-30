<template>
  <div>
    <div v-for="fund in funds" v-bind:key="fund.address">
      <Fund :fund="fund" />
    </div>
  </div>
</template>

<script>
import Fund from './Fund.vue';

export default {
  name: "FundToggle",
  props: ["funds"],

  components: { 
    Fund 
  },
}
</script>

<style>

</style>