<template>
  <div>
  <h3>Create Fund </h3>
  <input v-model="fund.depositFee" class="form-control deposit-input" placeholder="(Deposit Fee in BPS), Ex: 10">
  <input v-model="fund.withdrawFee" class="form-control deposit-input" placeholder="(Withdrawal Fee in BPS), Ex: 10">
  <input v-model="fund.managementFee" class="form-control deposit-input"  placeholder="(Management Fee in BPS), Ex: 10">
  <input v-model="fund.baseToken" class="form-control deposit-input" placeholder="(Token Address Used For Deposits/Withdrawals), Ex: 0x1000000000000000000000000000000000000000">
  <input v-model="fund.allowedDepositAddrs" class="form-control deposit-input" placeholder="(Whitelisted Deposit Addresses, Ex: [0x1000000000000000000000000000000000000000, 0x2000000000000000000000000000000000000000, 0x3000000000000000000000000000000000000000]">
  <input v-model="fund.allowedManagers" class="form-control deposit-input" placeholder="(Allowed Fund Manager Addresses), Ex: [0x1000000000000000000000000000000000000000, 0x2000000000000000000000000000000000000000, 0x3000000000000000000000000000000000000000]">
  <input v-model="fund.governanceToken" class="form-control deposit-input" placeholder="(External Governance Token), Ex: 0x0000000000000000000000000000000000000000">
  <input v-model="fund.fundName" class="form-control deposit-input" placeholder="(Name of Fund), Ex: Berlin Community Governance">
  <input v-model="fund.fundSymbol" class="form-control deposit-input" placeholder="(Symbol for Fund), Ex: BGG">

  <pre>{{ fund }}</pre>
  </div>
</template>

<script>

export default {
  name: "FundInput",
  props: ["fund"],

  components: { 
  },
}
</script>

<style>

</style>