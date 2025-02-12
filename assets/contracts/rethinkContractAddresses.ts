import type IContractAddressesMap from "~/types/addresses";
import { ChainId } from "~/store/web3/networksMap";

export const rethinkContractAddresses: IContractAddressesMap = {
  "WrappedTokenFactory": {
    [ChainId.ETHEREUM]: "0x79b15F47640C4e3ac3A9c4B7f1B999a8cccEEeC7",
    // [ChainId.GOERLI]: "0x50B55b0792a95508e524224bF7CCA39cA0Ee7dab",
    [ChainId.POLYGON]: "0xB9Ca0051232F773Bd3C6A7823E02449783a2B53F",
    // [ChainId.FRAXTAL]: "0x79b15F47640C4e3ac3A9c4B7f1B999a8cccEEeC7",
    [ChainId.BASE]: "0xE16b6C9C2CB8aE15f0872A3A46d2Eb070c27f20D",
    [ChainId.ARBITRUM]: "0x4278a6b150628470F28Af2Df6B43518f372A59E4",
  },
  "GovernableFundFactoryBeaconProxy": {
    [ChainId.ETHEREUM]: "0x9825a09FbC727Bb671f08Fa66e3508a2e8938d45",
    // [ChainId.GOERLI]: "0x2e71Eef0AE6C82902B6458655A36BfD7B76E6B2D",
    [ChainId.POLYGON]: "0x4C342E583A7Aa2840e07B4a3afB71533FBE37726",
    // [ChainId.FRAXTAL]: "0x9825a09FbC727Bb671f08Fa66e3508a2e8938d45",
    [ChainId.BASE]: "0x248a64e3EDd3F521ef2Aa6A3e804845B5A1C8008",
    [ChainId.ARBITRUM]: "0x79b15F47640C4e3ac3A9c4B7f1B999a8cccEEeC7",
  },
  "NAVCalculatorBeaconProxy": {
    [ChainId.ETHEREUM]: "0x045d6611b93bC7d046c2bA90a780F4577F78e33A",
    // [ChainId.GOERLI]: "0x26d70661664Fc2b4a1519Fa5766ccFF7E384a12F",
    [ChainId.POLYGON]: "0x248a64e3EDd3F521ef2Aa6A3e804845B5A1C8008",
    // [ChainId.FRAXTAL]: "0x045d6611b93bC7d046c2bA90a780F4577F78e33A",
    [ChainId.BASE]: "0xA2eC20a1D6139890962989d5F33DBF03BFbf0dD1",
    [ChainId.ARBITRUM]: "0x9825a09FbC727Bb671f08Fa66e3508a2e8938d45",
  },
  "NAVExecutorBeaconProxy": {
    [ChainId.ETHEREUM]:"0x6Bcbc7959CE79b8F27efe1EAe504f98CBe2647A8",
    // [ChainId.GOERLI]: "",
    [ChainId.POLYGON]:"0x540f022CD860c65FD4DF1969553263014C862bbd",
    [ChainId.BASE]: "0x5FA5a70A3A143E3F7B8906cbc08CAd606E4622b3",
    [ChainId.ARBITRUM]: "0xf25af37E48EE46EDE9489f80E73b9669915d8337",
  },
  "RethinkFundGovernerUpgradeableBeacon": {
    [ChainId.ETHEREUM]: "0xA2eC20a1D6139890962989d5F33DBF03BFbf0dD1",
    // [ChainId.GOERLI]: "0x30DB0Ca15AfB8a9D6ec6e3e377207B9E995E1901",
    [ChainId.POLYGON]: "0xB4c232f0cF194E530c39174F617Ec4ee9d69398C",
    // [ChainId.FRAXTAL]: "0xA2eC20a1D6139890962989d5F33DBF03BFbf0dD1",
    [ChainId.BASE]: "0x296203D903178e17DEF9C3891A578278aA230754",
    [ChainId.ARBITRUM]: "0x248a64e3EDd3F521ef2Aa6A3e804845B5A1C8008",
  },
  "GovernableFundUpgradeableBeacon": {
    [ChainId.ETHEREUM]: "0x296203D903178e17DEF9C3891A578278aA230754",
    // [ChainId.GOERLI]: "0xCEed8bA2ea5B30eDf31a4c022F51FF0FE4d30166",
    [ChainId.POLYGON]: "0x5A7f717B91c998d5DE9764DEA78c2EF20027bDe4",
    // [ChainId.FRAXTAL]: "0x296203D903178e17DEF9C3891A578278aA230754",
    [ChainId.BASE]: "0x296203D903178e17DEF9C3891A578278aA230754",
    [ChainId.ARBITRUM]: "0xB4c232f0cF194E530c39174F617Ec4ee9d69398C",
  },
  "SafeProxyFactory": {
    [ChainId.ETHEREUM]: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
    // [ChainId.GOERLI]: "0xa6b71e26c5e0845f74c812102ca7114b6a896ab2",
    [ChainId.POLYGON]: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
    // [ChainId.FRAXTAL]: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
    [ChainId.BASE]: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
    [ChainId.ARBITRUM]: "0xa6b71e26c5e0845f74c812102ca7114b6a896ab2",
  },
  "SafeSingleton": {
    [ChainId.ETHEREUM]: "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
    // [ChainId.GOERLI]: "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
    [ChainId.POLYGON]: "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
    // [ChainId.FRAXTAL]: "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
    [ChainId.BASE]: "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
    [ChainId.ARBITRUM]: "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
  },
  "ZodiacRolesV1ModifierUpgradeableBeacon": {
    [ChainId.ETHEREUM]: "0xbbf156CCc038b405001034573E77F3B2174B762a",
    // [ChainId.GOERLI]: "0xb3aec0e144e46ee4290ad93cc05609c160413087",
    [ChainId.POLYGON]: "0xdf587D859e76B0a6cE2254f1c0bf64C4aE0eD37f",
    // [ChainId.FRAXTAL]: "0x463F9eE917F71B7DB1c81fbFe44A95a4f5B540a6",
    [ChainId.BASE]: "0x463F9eE917F71B7DB1c81fbFe44A95a4f5B540a6",
    [ChainId.ARBITRUM]: "0x5A7f717B91c998d5DE9764DEA78c2EF20027bDe4",
  },
  "GovernableFundFlowsUpgradeableBeacon": {
    [ChainId.ETHEREUM]: "0x463F9eE917F71B7DB1c81fbFe44A95a4f5B540a6",
    // [ChainId.GOERLI]: "0x2C22E878Fd7aD631FFf5369C2ef239237926cDaF",
    [ChainId.POLYGON]: "0x8fE2e9470ceA2E83e8B89502d636CCAb2D1Ca21B",
    // [ChainId.FRAXTAL]: "0x5b8137fC792f1d054099fb2B7EEb7e575Ee8403B",
    [ChainId.BASE]: "0x5b8137fC792f1d054099fb2B7EEb7e575Ee8403B",
    [ChainId.ARBITRUM]: "0xdf587D859e76B0a6cE2254f1c0bf64C4aE0eD37f",
  },
  "GovernableFundNavUpgradeableBeacon": {
    [ChainId.ETHEREUM]: "0x5b8137fC792f1d054099fb2B7EEb7e575Ee8403B",
    // [ChainId.GOERLI]: "0x81b504b3b20a6B0fDDA0d990E68cf20C526Ae699",
    [ChainId.POLYGON]: "0x89254d6FF377a21aC0b99BD2e456e75b6C76E505",
    // [ChainId.FRAXTAL]: "0x26cEb3873ad8A3dee2e5d3d67d2d0800704B9fb5",
    [ChainId.BASE]: "0x26cEb3873ad8A3dee2e5d3d67d2d0800704B9fb5",
    [ChainId.ARBITRUM]: "0x8fE2e9470ceA2E83e8B89502d636CCAb2D1Ca21B",
  },
  "RethinkReader": {
    [ChainId.ETHEREUM]: "0x7a1f370658b4A17b0B5346fDef8809d5e73DdAa1",
    // [ChainId.GOERLI]: "",
    [ChainId.POLYGON]: "0x4791f1F4994d9d224B89134cd628F0F27FA4a326",
    // [ChainId.FRAXTAL]: "0xA290641Ecce7C0D7835Ca128810B240F74a399Be",
    [ChainId.BASE]: "0xd402f5B63474444970779dC37368A28F386fe984",
    [ChainId.ARBITRUM]: "0xD9a6312F597B97DEF6d56492e12C77D45F740807",
  },
  "PoolPerformanceFeeBeaconProxy": {
    [ChainId.ETHEREUM]: "0x6414575854d174dd59392846007deb3369d7480d",
    // [ChainId.GOERLI]: "",
    [ChainId.POLYGON]: "0xE9130bed8Ef2d11F1cEA775D1B8104f1A2AFF571",
    [ChainId.BASE]: "0x751545c0D7F2a696c9975c9d90428225A1e139cd",
    [ChainId.ARBITRUM]: "0xb358913726F3bAc8626f18a1b2C007F1a59c4fF4",
  },
};

export const NAVExecutorBeaconProxyAddress = (chainId: ChainId): string => {
  return rethinkContractAddresses.NAVExecutorBeaconProxy[chainId] || "";
};

/**
 *   "USDC": {
 *     "0x1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
 *     "0x5": "0xf85311877043B384af4F82544b2657299F7B7c4D",
 *     "0x2a": "0x2F375e94FC336Cdec2Dc0cCB5277FE59CBf1cAe5",
 *     "0x89": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
 *     "0xfc": "",
 *     "0x2e4": "",
 *     "0x1e29": "",
 *     "0x13881": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
 *     "0xa8c": "0xB97EF9Ef8734C71904d8002F8b6Bc66Dd9c48a6E",
 *     "0xa85": "0xB97EF9Ef8734C71904d8002F8b6Bc66Dd9c48a6E",
 *     "0x6724d": "",
 *   },
 *   "DAI": {
 *     "0x1": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
 *     "0x5": "0xD0F850D8936bC4D358d6375a53dE63a31e85bF53",
 *     "0x2a": "0x4c38cDC08f1260F5c4b21685654393BB1e66a858",
 *     "0x89": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
 *     "0xfc": "",
 *     "0x2e4": "",
 *     "0x1e29": "",
 *     "0x13881": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
 *     "0xa8c": "0xd586e7f844cea2f87f50152665bcbc2c279d8d70",
 *     "0xa85": "0xd586e7f844cea2f87f50152665bcbc2c279d8d70",
 *     "0x6724d": "",
 *   },
 *   "BTC": {
 *     "0x5": "0x66B638C7ECAbCc518D86b8512E68457295d8523e",
 *     "0x2a": "",
 *     "0x89": "",
 *     "0x2e4": "",
 *     "0x1e15": "",
 *     "0x13881": "",
 *     "0xa4b1": "",
 *     "0xa848": "",
 *     "0xa849": "",
 *     "0x66e9d": "",
 *   },
 *   "ETH": {
 *     "0x5": "0x70Ff04655084032a85985B8Fa2E503E06817380B",
 *     "0x2a": "",
 *     "0x89": "",
 *     "0x2e4": "",
 *     "0x1e15": "",
 *     "0x13881": "",
 *     "0xa4b1": "",
 *     "0xa848": "",
 *     "0xa849": "",
 *     "0x66e9d": "",
 *   },
 *   "MATIC": {
 *     "0x5": "0xDf842cfEb031b6c7A47cf7905855c36B65ac3386",
 *     "0x2a": "",
 *     "0x89": "",
 *     "0x2e4": "",
 *     "0x1e15": "",
 *     "0x13881": "",
 *     "0xa4b1": "",
 *     "0xa848": "",
 *     "0xa849": "",
 *     "0x66e9d": "",
 *   },
 *   "AVAX": {
 *     "0x5": "0x5DD20d7989B3313C8c3491C514880cd206D9be0E",
 *     "0x2a": "",
 *     "0x89": "",
 *     "0x2e4": "",
 *     "0x1e15": "",
 *     "0x13881": "",
 *     "0xa4b1": "",
 *     "0xa848": "",
 *     "0xa849": "",
 *     "0x66e9d": "",
 *   },
 */
