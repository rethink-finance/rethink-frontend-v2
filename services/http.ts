// src: https://github.com/gnosisguild/zodiac-modifier-roles-v1/blob/main/packages/app/src/utils/http.ts
import localforage from "localforage"
import memoryDriver from "localforage-memoryStorageDriver";
import { setup } from "axios-cache-adapter"
import type { AxiosRequestConfig } from "axios";

export async function configureAxios(config: AxiosRequestConfig) {
  await localforage.defineDriver(memoryDriver)

  const forageStore = localforage.createInstance({
    driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE, memoryDriver._driver],
    name: "zodiac-roles-mod-app",
  })

  const client = setup({
    ...config,
    cache: {
      maxAge: 30 * 24 * 60 * 1000, // 30 days
      store: forageStore,
      exclude: { query: false },
    },
  })

  return {
    store: forageStore,
    client,
  }
}
