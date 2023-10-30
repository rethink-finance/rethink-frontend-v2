<template>
  <div>
    <div
      v-for="tx in transactions"
      v-bind:key="tx.idx"
      class="flex flex-col gap-2"
    >
      <h3>Add or Modify Existing Symbol</h3>
      <textarea
        v-model="tx.data"
        class="form-control deposit-input"
        placeholder="(Raw Tx Bytes), Ex: 0xd81F810fc394e96c5D67af8395607C71B0a42d52"
      ></textarea>
    </div>

    <div class="pool-submit-buttons">
      <button @click="formatRoleMods" class="btn btn-success">
        Format Role Mods
      </button>
    </div>

    <pre>{{ processedTxs }}</pre>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import SafeMultiSendCallOnlyJSON from "../../assets/contracts/safe/SafeMultiSendCallOnly.json";
import GnosisSafeL2JSON from "../../assets/contracts/safe/GnosisSafeL2_v1_3_0.json";

export default {
  name: "RoleModFormatting",
  props: ["transactions", "fund"],

  data() {
    return {
      processedTxs: [],
    };
  },

  components: {},

  created() {
    if (!this.getWeb3 || !this.isUserConnected) {
      this.$router.push({ name: "home" });
    }
  },

  computed: {
    ...mapGetters("accounts", [
      "getActiveAccount",
      "getChainName",
      "getWeb3",
      "isUserConnected",
      "getChainId",
    ]),

    getSelectedFundGovenerAddress() {
      console.log(this.fund);
      return this.fund.governor;
    },
  },

  methods: {
    formatRoleMods() {
      let to =
        SafeMultiSendCallOnlyJSON.networkAddresses[
          parseInt(this.getChainId).toString()
        ];
      console.log(to);
      let multisendAbiJSON = SafeMultiSendCallOnlyJSON.abi[0];
      this.processedTxs = [];

      //execTransaction function
      let execTransactionAbiJSON = GnosisSafeL2JSON.abi[29];

      const signature =
        "0x000000000000000000000000" +
        this.getSelectedFundGovenerAddress.slice(2) +
        "0000000000000000000000000000000000000000000000000000000000000000" +
        "01";
      for (var tx in this.transactions) {
        let filteredTxData = this.getWeb3.eth.abi.encodeFunctionCall(
          multisendAbiJSON,
          [this.transactions[tx].data]
        );

        let formatSafeTxInput = [
          to, //MultiSendCallOnly
          0, //value
          filteredTxData, //data
          1, //operation
          0, //safeTxGas
          0, //baseGas
          0, //gasPrice
          "0x0000000000000000000000000000000000000000", //gasToken
          "0x0000000000000000000000000000000000000000", //refundReceiver
          signature,
        ];

        let filteredFinalTxData = this.getWeb3.eth.abi.encodeFunctionCall(
          execTransactionAbiJSON,
          formatSafeTxInput
        );

        this.processedTxs.push(filteredFinalTxData);
      }
    },
  },
};
</script>

<style></style>
