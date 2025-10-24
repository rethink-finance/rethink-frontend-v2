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
    name: "token-branded:eth",
    size: "2rem",
  },
  base: {
    name: "token-branded:base",
    size: "2rem",
    color: "#0052ff",
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
