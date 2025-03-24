
import { ChainId } from "~/store/web3/networksMap";

export const fundMetaDataHardcoded = {
  // Polygon
  [ChainId.POLYGON]: [
    { address: "0x0dCd5D9cF6DFF56E7Ce2cbed1d39369e1B5f2ac4", strategistName: "ShineDAO", strategistUrl: "https://discord.gg/HMhRGBnxub" },
    { address: "0xBE0B0C435EA1156F76d3E116Fbd5606743ab179a", strategistName: "The DAO of Capital", strategistUrl: "https://discord.gg/punj9gPZP3" },
    { address: "0xFc3de74eA28474FF02e378F5F8658354E481d7B9", strategistName: "The DAO of Capital", strategistUrl: "https://discord.gg/punj9gPZP3" },
    { address: "0xc748d5E77B998608Ef84d063b9694f2dBB81a325", strategistName: "soonami.io", strategistUrl: "https://soonami.io/venture-staking" },
  ],
  // Base
  [ChainId.BASE]: [
    { address: "0x533f164d91e3F8169a7043f7094f44af87Fb7CA4", strategistName: "INDEFI", strategistUrl: "https://indefi.io/" },
  ],
  // Arbitrum One
  [ChainId.ARBITRUM]: [
    { address: "0x00a4DCBBB7Eb5d0c4Ef33Ab9763DDE5Cd91A4b10", strategistName: "Flex.hl", strategistUrl: "https://x.com/kinzflx" },
    { address: "0x5E0f37920DDee57dAbAf5A73B21D51075AeDbEBE", strategistName: "Harmonix", strategistUrl: "https://harmonix.fi/" },
    { address: "0xABC961AFc18dfE9F062cf9a8046346E92a934D08", strategistName: "QuantCheck Labs", strategistUrl: "https://www.quantchecklabs.com/" },

  ],
  // ETH Mainnet
  [ChainId.ETHEREUM]: [
    { address: "0xaC3D76E29f866702E17f571cccb15937E5A17303", strategistName: "soonami.io", strategistUrl: "https://soonami.io/venture-staking" },
  ],

} as Record<ChainId, { address: string; strategistName?: string; strategistUrl?: string; oivChatUrl?: string }[]>;
