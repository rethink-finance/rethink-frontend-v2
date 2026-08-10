import type { IIcon } from "~/types/network";

const chainIconMap: Record<string, IIcon> = {
  matic: {
    name: "cryptocurrency-color:matic",
    size: "1.5rem",
  },
  arb1: {
    name: "token-branded:arbitrum",
    size: "2rem",
  },
  eth: {
    // cryptocurrency-color draws the mark on its own full-bleed disc, the
    // same silhouette as matic. token-branded:eth is a bare pastel diamond
    // that reads as a floating shape rather than a token chip.
    name: "cryptocurrency-color:eth",
    size: "2rem",
  },
  base: {
    name: "token-branded:base",
    size: "2rem",
    color: "#0052ff",
  },
  HyperEVM: {
    name: "custom:hyperevm",
    size: "1.5rem",
  },
};


export const getChainIcon = (chainShort: string) => {
  return (
    chainIconMap[chainShort] ?? {
      name: "ph:circle-fill", // default circle fill gray
      size: "1.5rem",
    }
  );
};
