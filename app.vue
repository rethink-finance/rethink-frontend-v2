<script lang="ts" setup>
import { init, useOnboard } from "@web3-onboard/vue"
import injectedModule from "@web3-onboard/injected-wallets"
import logoSVG from "@/assets/images/logo.svg";

import { useAccountsStore } from "~/store/modules/accounts.store";
const runtimeConfig = useRuntimeConfig()

const injected = injectedModule();
const infuraKey = runtimeConfig.public.INFURA_KEY || "ssss";
const rpcUrl = `https://mainnet.infura.io/v3/${infuraKey}`;

init({
  wallets: [injected],
  chains: [
    {
      id: "0x1",
      token: "ETH",
      label: "Ethereum Mainnet",
      rpcUrl,
    },
    {
      id: 42161,
      token: "ARB-ETH",
      label: "Arbitrum One",
      rpcUrl: "https://rpc.ankr.com/arbitrum",
    },
    {
      id: "0xa4ba",
      token: "ARB",
      label: "Arbitrum Nova",
      rpcUrl: "https://nova.arbitrum.io/rpc",
    },
  ],
  appMetadata: {
    name: "Rethink.finance",
    icon: logoSVG,
    logo: logoSVG,
    description: "Powering the transition to decentralised and non-custodial asset management.",
    // recommendedInjectedWallets: [
    //   { name: "MetaMask", url: "https://metamask.io" },
    //   { name: "Coinbase", url: "https://wallet.coinbase.com/" },
    // ],
  },
  connect: {
    autoConnectLastWallet: true,
  },
})

onMounted(() => {
  useAccountsStore().web3Onboard = useOnboard();
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
