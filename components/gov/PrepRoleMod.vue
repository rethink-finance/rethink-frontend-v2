/* eslint-disable */
<template>
  <!------ Add Role Mod Transaction ------>

  <div class="section-big row mt-4 mx-3">
    <div class="col-md-12">
      <RoleModFormatting :transactions="transactions" :fund="fund" />
      <span></span>
    </div>
    <button @click="addTransaction" class="btn btn-success">
      Add Role Mod Transaction
    </button>
  </div>

</template>

<script>
import { mapGetters } from "vuex";
import RoleModFormatting from './RoleModFormatting.vue';

export default {
  name: "PrepRoleMod",
  props: ["fund"],

  computed: {
      ...mapGetters("accounts", ["getActiveAccount", "getChainName", "getWeb3", "isUserConnected"]),

  },

  created() {
    if (!this.getWeb3 || !this.isUserConnected) {
      this.$router.push({ name: 'home'});
    }
    console.log(this.fund)
  },

  data() {
    return {
      transactions: [],
      txIdx: 0,
    }
  },
  components: {
    RoleModFormatting
  },

  methods: {
    addTransaction: function () {
      this.transactions.push({
        idx: this.txIdx++,
        data: null,
      });
    },
  }
}
</script>
