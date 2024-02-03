import { defineNuxtPlugin } from "#app"
import { init } from "@web3-onboard/vue"
import safeModule from "@web3-onboard/gnosis"
import walletConnectModule from "@web3-onboard/walletconnect"
import injectedModule from "@web3-onboard/injected-wallets"
import logoSVG from "@/assets/images/logo_mobile.svg";

export default defineNuxtPlugin(nuxtApp => {
  const runtimeConfig = useRuntimeConfig()
  const injected = injectedModule();

  // Wallets
  const safe = safeModule({
    whitelistedDomains: [/rethink.finance/],
  })
  const walletConnect = walletConnectModule({
    /**
         * Project ID associated with [WalletConnect account](https://cloud.walletconnect.com)
         */
    projectId: runtimeConfig.public.WALLET_CONNECT_PROJECT_ID || "",
    /**
         * Chains required to be supported by all wallets connecting to your DApp
         */
    // requiredChains: [1],
    /**
         * Chains required to be supported by all wallets connecting to your DApp
         */
    // optionalChains: [42161, 8453, 10, 137, 56],
    /**
         * Defaults to `appMetadata.explore` that is supplied to the web3-onboard init
         * Strongly recommended to provide atleast one URL as it is required by some wallets (i.e. MetaMask)
         * To connect with WalletConnect
         */
    dappUrl: "https://rethink.finance",
  })

  init({
    wallets: [injected, safe, walletConnect],
    chains: [
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
    theme: "dark",
    appMetadata: {
      name: "Rethink.finance",
      icon: logoSVG,
      logo: logoSVG,
      description: "Powering the transition to decentralised and non-custodial asset management.",
      recommendedInjectedWallets: [
        { name: "MetaMask", url: "https://metamask.io" },
        { name: "WalletConnect", url: "https://cloud.walletconnect.com/sign-in" },
        { name: "Safe", url: "https://app.safe.global/welcome" },
      ],
    },
    connect: {
      // TODO handle auto-connect callback logics to setup store data, add watcher or something.
      autoConnectLastWallet: true,
    },
  })
});
