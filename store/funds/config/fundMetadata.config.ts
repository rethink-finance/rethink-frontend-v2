
import { ChainId } from "~/types/enums/chain_id";

export const fundMetaDataHardcoded = {
  // Polygon
  [ChainId.POLYGON]: [
    {
      address: "0x0dCd5D9cF6DFF56E7Ce2cbed1d39369e1B5f2ac4",
      strategistName: "ShineDAO",
      strategistUrl: "https://discord.gg/HMhRGBnxub",
      subtitle: "DAO treasury of community funding and supporting DeFi.",
    },
    {
      address: "0xBE0B0C435EA1156F76d3E116Fbd5606743ab179a",
      strategistName: "The DAO of Capital",
      strategistUrl: "https://discord.gg/punj9gPZP3",
      subtitle:
        "BTC, ETH, stables and gold. Growth, yield, and resilience in one portfolio.",
    },
    {
      address: "0xFc3de74eA28474FF02e378F5F8658354E481d7B9",
      strategistName: "The DAO of Capital",
      strategistUrl: "https://discord.gg/punj9gPZP3",
      subtitle: "USDC, USDT and DAI stablecoin staking via AAVE.",
    },
    {
      address: "0xc748d5E77B998608Ef84d063b9694f2dBB81a325",
      strategistName: "soonami.io",
      strategistUrl: "https://soonami.io/venture-staking",
      subtitle: "Investing in pre-seed projects through Foundance platform.",
    },
  ],
  // Base
  [ChainId.BASE]: [
    {
      address: "0x533f164d91e3F8169a7043f7094f44af87Fb7CA4",
      strategistName: "INDEFI",
      strategistUrl: "https://indefi.io/",
      subtitle:
        "Volatility-driven rebalancing with sustained exposure to ETH appreciation.",
    },
  ],
  // Arbitrum One
  [ChainId.ARBITRUM]: [
    {
      address: "0x00a4DCBBB7Eb5d0c4Ef33Ab9763DDE5Cd91A4b10",
      strategistName: "Flex.hl",
      strategistUrl: "https://x.com/kinzflx",
      subtitle:
        "Adaptive perps strategy built to survive chop and thrive in runs.",
    },
    {
      address: "0x5E0f37920DDee57dAbAf5A73B21D51075AeDbEBE",
      strategistName: "Harmonix",
      strategistUrl: "https://harmonix.fi/",
    },
    {
      address: "0xABC961AFc18dfE9F062cf9a8046346E92a934D08",
      strategistName: "QuantCheck Labs",
      strategistUrl: "https://www.quantchecklabs.com/",
      subtitle: "Quant-driven perps strategy powered by cross-asset analytics.",
    },
    {
      address: "0x5A7638b7b831262081804e88657b2D83E8491b1E",
      strategistName: "carrotfunding.io",
      strategistUrl: "https://carrotfunding.io",
    },
    {
      address: "0x58BA86cF363De2Bdbe57ad885B47F1B985EA9F31",
      strategistName: "carrotfunding.io",
      strategistUrl: "https://carrotfunding.io",
      subtitle:
        "Trader funding vault backing consistently profitable perps traders.",
    },
    {
      // Eliot wave
      address: "0x55f4949AF6356BBb71aeCC23eb36aBA4171Ffdaa",
      subtitle:
        "Adaptive trading system that identifies market regimes and swing trade opportunities.",
    },
    {
      // SmartBTC
      address: "0x202Cf222611B827B3Ae5a3Ee055e38Bae18256F5",
      strategistName: "Open Alpha",
      strategistUrl: "https://openalpha.vc/",
      subtitle: "Smart Investing, Powered by a Global Intelligence Network.",
    },
  ],
  // ETH Mainnet
  [ChainId.ETHEREUM]: [
    {
      address: "0xaC3D76E29f866702E17f571cccb15937E5A17303",
      strategistName: "soonami.io",
      strategistUrl: "https://soonami.io/venture-staking",
      subtitle:
        "Native ETH staking and reinvesting yield into soonami.io ecosystem.",
    },
    {
      // Boreal USD Yield
      address: "0xd245A74898124ae10DE4DB5ec842032042654F0d",
      subtitle:
        "Yield on leveraged bravUSDC on Morpho, to access DeFi opportunities through arbitrage, basis trades, and liquidity provision.",
    },
  ],
} as Record<
  ChainId,
  {
    address: string;
    strategistName?: string;
    strategistUrl?: string;
    oivChatUrl?: string;
    subtitle?: string;
  }[]
>;
