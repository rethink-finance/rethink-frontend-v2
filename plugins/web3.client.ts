import { useWeb3Store } from "~/store/web3/web3.store";

export default defineNuxtPlugin(async () => {
  const web3Store = useWeb3Store();
  await web3Store.init();
});
