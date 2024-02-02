// import { ethers } from "ethers"
// // import { truncateAddress, sleep } from "shared/utils/util"
// // import WalletConnectProvider from "@walletconnect/web3-provider"
// import { AVALANCHE_MAINNET_PARAMS, AVALANCHE_TESTNET_PARAMS } from "@/components/global/constants.json"
// // import { ToastApi } from "vue-toast-notification"
//
// type ChainId = 0xa86a | 0xa869
// const CONNECTED_ACCOUNT = "connected-account"
// const PROVIDER_SOURCE = "provider-source"
// const METAMASK = "metamask"
// const WALLET_CONNECT = "wallet-connect"
//
// let isListenerInit = false
//
// class WalletConnectConnector {
//
//   // injected dependencies
//   private chainId?: ChainId
//   // private Toast?: ToastApi
//   private promptConnect?: () => Promise<any>
//   private closeDialog?: () => void
//   private setConnectedAddress?: (connectedAddress: string | null) => void
//
//   private provider: any
//   private connectedProvider: ethers.BrowserProvider | null = null
//
//   public connectedAccountValue: string | null = null
//
//   // async constructor
//   injectDependencies (dependencies: any) {
//     Object.assign(this, dependencies) // Toast, Web3Modal & Wallet methods, chainId
//   }
//
//   get ethereum () {
//     return (window as any).ethereum
//   }
//
//   get isConnected () {
//     return Boolean(this.connectedAccount)
//   }
//
//   get walletConnectProvider () {
//     return new WalletConnectProvider({
//       infuraId: "03cb1660f8e24fbea64a3aeb8945a23a",
//       rpc: {
//         43114: "https://api.avax.network/ext/bc/C/rpc",
//         43113: "https://api.avax-test.network/ext/bc/C/rpc",
//       },
//       qrcode: true,
//       pollingInterval: 5000,
//       chainId: this.chainId,
//     })
//   }
//
//   get connectedAccount (): string | null {
//     return this.connectedAccountValue
//   }
//
//   set connectedAccount (connectedAccount: string | null) {
//     this.connectedAccountValue = connectedAccount
//     console.log("set", connectedAccount)
//     localStorage.setItem(CONNECTED_ACCOUNT, connectedAccount!)
//         this.setConnectedAddress!(connectedAccount)
//   }
//
//   checkConnection = async () => {
//     console.log("check connection")
//     const { ethereum } = this
//
//     // check if metamask connected
//     const metamaskAccount = this.ethereum && await new ethers.BrowserProvider(ethereum).listAccounts().then((accounts: any) => accounts[0])
//     if (localStorage.getItem(PROVIDER_SOURCE) === METAMASK && metamaskAccount) {
//       console.log("connection exists - metamask")
//       await this.connectMetamask()
//     } else if (localStorage.getItem(PROVIDER_SOURCE) === WALLET_CONNECT) {
//       console.log("connection exists - walletconnect")
//       await this.connectWalletConnect()
//     }
//     return this.connectedAccount
//   }
//
//   connect = async () => {
//     console.log("connect")
//     const account = await this.checkConnection()
//     console.log("connected:", account)
//     if (account) {
//       return this.connectedProvider
//     }
//
//     const option: "metamask" | "wallet-connect" = await this.promptConnect!()
//     const connectedProvider = await {
//       metamask: this.connectMetamask,
//       "wallet-connect": this.connectWalletConnect,
//     }[option]()
//         this.closeDialog!()
//
//         // const { chainId } = await connectedProvider.getNetwork()
//         // const connectedAddress = await this.getAddress()
//         // this.Toast!.success(`${truncateAddress(connectedAddress)} connected to chainId ${chainId}`)
//
//         return connectedProvider
//   }
//
//   connectMetamask = async () => {
//     console.log("connectMetamask")
//     await this.attemptChainSwitch(this.chainId!)
//     const { ethereum } = this
//     this.connectedAccount = await ethereum.request({ method: "eth_requestAccounts" })
//       .then((accounts: string[]) => accounts[0].toLowerCase())
//     localStorage.setItem(PROVIDER_SOURCE, METAMASK)
//     return this.setProvider(ethereum)
//   }
//
//   connectWalletConnect = async () => {
//     console.log("connectWalletConnect")
//     const { walletConnectProvider } = this
//     this.connectedAccount = await walletConnectProvider.enable()
//       .then((accounts: any) => accounts[0].toLowerCase())
//       .catch((e: any) => {
//         this.closeDialog!()
//         throw e
//       })
//     localStorage.setItem(PROVIDER_SOURCE, WALLET_CONNECT)
//     return this.setProvider(walletConnectProvider)
//   }
//
//   setProvider = (provider: any) => {
//     this.provider = provider
//     this.initListeners(provider)
//     return this.setConnectedProvider(provider)
//   }
//
//   setConnectedProvider = (provider: any) => {
//     return this.connectedProvider = new ethers.BrowserProvider(provider, "any")
//   }
//
//   initListeners = (provider: any) => {
//     if (isListenerInit) return
//     provider.on("accountsChanged", this.handleAccountsChanged)
//     provider.on("chainChanged", this.handleChainChanged)
//     isListenerInit = true
//   }
//
//   handleAccountsChanged = (accounts: string[]) => {
//     const account = accounts[0]?.toLowerCase()
//     console.log("account changed: ", account)
//     if (!account) {
//       localStorage.removeItem(PROVIDER_SOURCE)
//     }
//     if (localStorage.getItem(CONNECTED_ACCOUNT) !== account) {
//       console.log("actually changed", localStorage.getItem(CONNECTED_ACCOUNT), account)
//       // this.Toast!.open({ type: "info", message: "Reloading page" })
//       location.reload()
//     }
//   }
//
//   handleChainChanged = (chainId: ChainId) => {
//     console.log("chain changed: ", chainId)
//     this.verifyChain()
//       .then(() => console.log("Connected!"))
//       .catch(e => console.error(e.message))
//       // .then(() => this.Toast!.success("Connected!"))
//       // .catch(e => this.Toast!.error(e.message))
//     // this.connectedProvider = await this.initConnectedProvider(this.provider)
//   }
//
//   getProvider = () => {
//     if (!this.isConnected || !this.connectedProvider) {
//       return this.connect()
//     }
//     return Promise.resolve(this.connectedProvider)
//   }
//
//   getChainId = () => {
//     return this.getProvider()
//       .then(provider => provider!.getNetwork())
//       .then(network => network.chainId)
//   }
//
//   getSigner = () => {
//     return this.getProvider()
//       .then(provider => provider!.getSigner())
//   }
//
//   getAddress = () => {
//     return this.getSigner()
//       .then(signer => signer.getAddress())
//       .then(address => address.toLowerCase())
//   }
//
//   // getAddressOptional = async () => {
//   //   try {
//   //     return await this.getAddress() // await necessary to unpack promise
//   //   } catch (e) {
//   //     return Promise.resolve(undefined)
//   //   }
//   // }
//   //
//   // getBumpedGasPrice = (mul = 21, div = 20) => {
//   //   return this.getProvider()
//   //     .then(provider => provider!.getGasPrice())
//   //     .then(gasPrice => {
//   //       const bumpedGas = gasPrice.mul(mul).div(div)
//   //       console.log("estimated gas", gasPrice.toString())
//   //       console.log("bumped gas", bumpedGas.toString())
//   //       return bumpedGas
//   //     })
//   // }
//
//   verifyChain = async () => {
//     if (await this.getChainId() !== this.chainId) {
//       throw new Error("Your wallet is connected to the wrong network")
//     }
//   }
//
//   attemptChainSwitch = async (chainId: ChainId) => {
//     const { ethereum } = this
//     const params = {
//       0xa86a: [AVALANCHE_MAINNET_PARAMS],
//       0xa869: [AVALANCHE_TESTNET_PARAMS],
//     }[chainId]
//     await ethereum.request({ method: "wallet_addEthereumChain", params })
//     // await sleep(500) // wait for metamask dialog to close, otherwise the next one doesn't pop into foreground
//   }
//
//   // disconnect = async () => {
//   //   // check if metamask connected
//   //   const { ethereum } = this
//   //   const connectedAccount = this.ethereum && await new ethers.BrowserProvider(ethereum).listAccounts().then(accounts => accounts[0])
//   //   if (connectedAccount) {
//   //           this.Toast!.default("Please disconnect through Metamask")
//   //           return
//   //   }
//   //   this.connectedProvider = null
//   //   this.connectedAccount = null
//   //   if (this.provider) {
//   //     this.provider?.disconnect()
//   //     this.provider.removeAllListeners()
//   //   }
//   //   this.provider = null
//   //       this.Toast!.default("Disconnected")
//   //       localStorage.removeItem(PROVIDER_SOURCE)
//   //       this.closeDialog!()
//   //       location.reload()
//   // }
// }
//
// export const web3Connector = new WalletConnectConnector()
