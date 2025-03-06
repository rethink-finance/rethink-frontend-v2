/**
 * define a plugin to use localforage for storing NAV updates
 * used to store NAV updates in the browser because of the large amount of data
 */

import localforage from "localforage";

export default defineNuxtPlugin(() => {
  localforage.config({
    name: "nav",
    storeName: "navUpdates",
    description: "Stores NAV update entries",
  });

  // set driver to indexedDB
  (async () => {
    try {
      await localforage.setDriver(localforage.INDEXEDDB);
      console.log("Using IndexedDB for storage");
    } catch (error) {
      console.error("Failed to set IndexedDB as the driver:", error);
    }
  })();

  return {
    provide: {
      localforage,
    },
  };
});
