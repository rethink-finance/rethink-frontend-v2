import { defineNuxtPlugin } from "#app"
import enkrypt from "@web3-onboard/enkrypt"
import safeModule from "@web3-onboard/gnosis"
import injectedModule from "@web3-onboard/injected-wallets"
import ledgerModule from "@web3-onboard/ledger"
import { init } from "@web3-onboard/vue"
import walletConnectModule from "@web3-onboard/walletconnect"
import logoSVG from "@/assets/images/logo_mobile.svg"
import { ChainId } from "~/types/enums/chain_id"

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()
  const injected = injectedModule();
  const baseDomain = runtimeConfig.public.BASE_DOMAIN || "rethink.finance"

  // Wallets
  const safe = safeModule({
    whitelistedDomains: [new RegExp(baseDomain)],
  })
  const walletConnect = walletConnectModule({
    /**
         * Project ID associated with [WalletConnect account](https://cloud.walletconnect.com)
         */
    projectId: runtimeConfig.public.WALLET_CONNECT_PROJECT_ID || "1",
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
    dappUrl: `https://${baseDomain}`,
  })

  const enkryptModule = enkrypt()


  const ledger = ledgerModule({
    /**
     * Project ID associated with [WalletConnect account](https://cloud.walletconnect.com)
     */
    walletConnectVersion: 2,
    projectId: runtimeConfig.public.WALLET_CONNECT_PROJECT_ID || "1",
  })

  init({
    wallets: [injected, safe, walletConnect, ledger, enkryptModule],
    chains: [
      {
        id: ChainId.POLYGON,
        token: "MATIC",
        label: "Polygon",
      },
      {
        id: ChainId.ARBITRUM,
        token: "ARB1",
        label: "Arbitrum One",
      },
      {
        id: ChainId.ETHEREUM,
        token: "ETH",
        label: "Ethereum",
      },
      {
        id: ChainId.BASE,
        token: "ETH",
        label: "BASE",
      },
      {
        id: ChainId.HYPEREVM,
        token: "HYPE",
        label: "HYPEREVM",
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

