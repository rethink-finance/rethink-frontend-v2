import { defineNuxtPlugin } from "#app"
import coinbaseWalletModule from "@web3-onboard/coinbase"
import enkrypt from "@web3-onboard/enkrypt"
import safeModule from "@web3-onboard/gnosis"
import injectedModule from "@web3-onboard/injected-wallets"
import ledgerModule from "@web3-onboard/ledger"
import trezorModule from "@web3-onboard/trezor"
import { init } from "@web3-onboard/vue"
import walletConnectModule from "@web3-onboard/walletconnect"
import logoSVG from "@/assets/images/logo_mobile.svg"
import {
  connectByLabel,
  LAST_CONNECTED_WALLET_KEY,
  readLastConnectedWallet,
  withInterfaceErrors,
} from "~/composables/walletModules"
import { networksMap } from "~/store/web3/networksMap"
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

  // Coinbase's SDK: its smart wallet (passkey, nothing to install) and its
  // mobile app. The injected list comes first, so with the Coinbase extension
  // installed that entry wins the shared "Coinbase Wallet" label.
  const coinbase = coinbaseWalletModule({ supportedWalletType: "all" })

  // Trezor Connect asks every app for a contact and its URL (its manifest).
  const trezor = trezorModule({
    email: "admin@rethink.finance",
    appUrl: `https://${baseDomain}`,
  })

  const wallets = [
    withInterfaceErrors(injected, { extension: true }),
    withInterfaceErrors(safe),
    withInterfaceErrors(walletConnect),
    withInterfaceErrors(coinbase),
    withInterfaceErrors(ledger),
    withInterfaceErrors(trezor),
    withInterfaceErrors(enkryptModule, { extension: true }),
  ]

  // Web3-Onboard reconnects the last wallet inside init(), out of sight of
  // the app's connect modal; one still waiting there (a locked MetaMask)
  // would hold up every pick in the modal. So its key is held back for init
  // and the same reconnect is run below, through the tracked path.
  const lastWallet = readLastConnectedWallet()
  localStorage.removeItem(LAST_CONNECTED_WALLET_KEY)

  // The core API is handed to the app's own connect modal, which lists the
  // wallet modules and connects one by label with Web3-Onboard's modals off.
  const onboard = init({
    wallets,
    // rpcUrl is what wallets are registered with and what WalletConnect and
    // Ledger sessions read through; it lives in networksMap so the hint shown
    // when a wallet's own node fails names the same URL.
    chains: [
      {
        id: ChainId.POLYGON,
        token: "POL",
        label: "Polygon",
        rpcUrl: networksMap[ChainId.POLYGON].walletRpcUrl,
      },
      {
        id: ChainId.ARBITRUM,
        token: "ETH",
        label: "Arbitrum One",
        rpcUrl: networksMap[ChainId.ARBITRUM].walletRpcUrl,
      },
      {
        id: ChainId.ETHEREUM,
        token: "ETH",
        label: "Ethereum",
        rpcUrl: networksMap[ChainId.ETHEREUM].walletRpcUrl,
      },
      {
        id: ChainId.BASE,
        token: "ETH",
        label: "BASE",
        rpcUrl: networksMap[ChainId.BASE].walletRpcUrl,
      },
      {
        id: ChainId.HYPEREVM,
        token: "HYPE",
        label: "HyperEVM",
        rpcUrl: networksMap[ChainId.HYPEREVM].walletRpcUrl,
      },
    ],
    theme: "dark",
    appMetadata: {
      name: "Rethink.finance",
      icon: logoSVG,
      logo: logoSVG,
      description: "Powering the transition to decentralised and non-custodial asset management.",
      // The connect modal's "Get a wallet" list: browser wallets someone
      // without one can install, not ways to connect one they already have.
      recommendedInjectedWallets: [
        { name: "MetaMask", url: "https://metamask.io" },
        { name: "Rabby", url: "https://rabby.io" },
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

  if (lastWallet) {
    // As Web3-Onboard does: the list is cut to the wallet being reconnected,
    // and connecting it (autoConnectLastWallet stays on) records it again.
    localStorage.setItem(LAST_CONNECTED_WALLET_KEY, JSON.stringify([lastWallet]))
    connectByLabel(onboard.connectWallet, lastWallet)
  }

  return { provide: { onboard, onboardWallets: wallets } }
});

