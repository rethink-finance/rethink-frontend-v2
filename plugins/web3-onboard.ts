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
   whitelistedDomains: [
     /^https:\/\/app\.safe\.global$/,
     /^https:\/\/safe\.global$/,
  new RegExp(baseDomain),
    ],
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
        token: "POL",
        label: "Polygon",
        rpcUrl: "https://polygon-rpc.com",
      },
      {
        id: ChainId.ARBITRUM,
        token: "ETH",
        label: "Arbitrum One",
        rpcUrl: "https://arb1.arbitrum.io/rpc",
      },
      {
        id: ChainId.ETHEREUM,
        token: "ETH",
        label: "Ethereum",
        rpcUrl: "https://eth.drpc.org",
      },
      {
        id: ChainId.BASE,
        token: "ETH",
        label: "BASE",
        rpcUrl: "https://mainnet.base.org",
      },
      {
        id: ChainId.HYPEREVM,
        token: "HYPE",
        label: "HyperEVM",
        rpcUrl: "https://rpc.hyperliquid.xyz/evm",
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
    // The navbar already shows the connected wallet, network and disconnect,
    // so Web3-Onboard's floating account center is redundant.
    accountCenter: {
      desktop: { enabled: false },
      mobile: { enabled: false },
    },
  })
});

