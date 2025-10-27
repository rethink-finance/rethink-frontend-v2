// Some funds are excluded on main base domain app.rethink.finance.
// But we want to show them on stage.
// Some of them are bugged, so we don't want to show them anywhere, for those we set alwaysExclude: true.
const config = useRuntimeConfig();
const ENV_EXCLUDE_TEST_FUNDS = config.public.ENV_EXCLUDE_TEST_FUNDS;

// Local storage variable has priority, if it set to false, test funds will not be excluded (except
// those that have alwaysExclude: true, those will always be excluded).
const EXCLUDE_TEST_FUNDS = getLocalStorageItem("excludeTestFunds", ENV_EXCLUDE_TEST_FUNDS);


const rawExcludedFundAddresses = {
  // Polygon
  "0x89": [
    { address: "0xf48E3fa13cb2390e472cf1CA64F941eB7BD27475", alwaysExclude: true }, // bug
    { address: "0x0657DC652F88B55Dd16f5D6cE687672264f9b61E", alwaysExclude: true }, // bug
    { address: "0x8fAE33f10854c20a811246849A0d4131caf72125", alwaysExclude: true }, // bug
    { address: "0x6DFbEE70f1250C2dECb3E9bCb2BE3AF19b15e631", alwaysExclude: true }, // bug
    { address: "0x82CBA6D1A6dCeb408d7F048493262b83c9744f4D", alwaysExclude: false },
    { address: "0xcfD904C4C857784686029995886d627da1aeFbe4", alwaysExclude: false },
    { address: "0xe93CB20Fc113355753B6D237c3949E0452981dC3", alwaysExclude: true }, // TSHN 15. feb
    { address: "0x6edC5f675C5A20e867aeF0633033a17EA256637E", alwaysExclude: true }, // TSHN 16. feb
    { address: "0x920fdA0F59bDc852eD19e3ad975a808101ea2a29", alwaysExclude: true }, // DOCTP 29. feb 24
    { address: "0x1550D564fEBE8c398F3cc398c9ac2a9e89E89A4F", alwaysExclude: false },
    { address: "0x07094Bb5f175A4E6b074e5E79F6439a8A929533B", alwaysExclude: false },
    { address: "0x98F1c2035680E4215cD5726a11279da96C07835F", alwaysExclude: false },
    { address: "0xdac03eD03EFDa65A1488c7f3f0302636491726B6", alwaysExclude: true }, // SOONF1 9. aug
    { address: "0xBb1E02AcA8F7Cb2403c0Bf3aaA74001d38Beb488", alwaysExclude: true }, // SOON1 14. aug
    { address: "0x1673458dDf6C0ea24ce5598918F3cA1e58f2d795", alwaysExclude: false },
  ],
  // Arbitrum One
  "0xa4b1": [
    { address: "0xA5138779Bb08C8DE44692e183c586817a0bcEb42", alwaysExclude: false },
    { address: "0x74759a4607B97360956AbFd44cA4B2A0EC2A27C9", alwaysExclude: false },
    { address: "0xd1FCcFb737E1b436Da057011Dc56231035285688", alwaysExclude: false },
    { address: "0x80b5426A71c19Da522ddDeD4745eADE57a51E334", alwaysExclude: false },
    { address: "0x4DF9aD4B872D8E906990205aD055Bc00c39EEa74", alwaysExclude: false },
    { address: "0xbaA81241A186BC547Ec9e7a306755D4079b559cD", alwaysExclude: false },
    { address: "0xB9e1dC350af83a3127aDc8CFB48a9B4abADCA184", alwaysExclude: false },
    { address: "0xe3c31b33FCBd905E978aCEa64b2b043Cc81DDA7c", alwaysExclude: true },  // ADEMO2
    { address: "0xC27eE955a44F0A9e7AC509dD54E8221eE06A9592", alwaysExclude: true },  // TESTARB
    { address: "0x539a56974295B8BF7023F2d85144Ca0010953ee2", alwaysExclude: true },  // QCLG 22. jan 25
    { address: "0x5A7638b7b831262081804e88657b2D83E8491b1E", alwaysExclude: false },  // carrotfunding.io gCFG 31. mar 25
    { address: "0x5E0f37920DDee57dAbAf5A73B21D51075AeDbEBE", alwaysExclude: false },  // Harmonix HES 14. may 25
    { address: "0x1D672d59724082EeeB575d1c7f42A6e5d1e327be", alwaysExclude: true },  // TEST 2025-07-01
    { address: "0x9674B98e146c6bB120604a12E2EB03AC957BB6C6", alwaysExclude: true },  // Altcoin Swing Trade Vault 2025-08-15
    { address: "0xDD0B24e283f9084129380a1aEc325e05e691E47A", alwaysExclude: true },  // Altcoin Swing Trade Vault 2025-08-15
    { address: "0xB637Af0447faABDc10151152DD359cf947584120", alwaysExclude: true },  // carrotfunding test
    { address: "0xACfc595Fb72b530323E13D231B7B1849184a616c", alwaysExclude: true },  // Test
    { address: "0x64e64f1EFfF211E253f0F6C7de64E575F32c1076", alwaysExclude: true },  // Arbitrum Demo OIV
    { address: "0x47bFca13dBcEDc40B0911c2440e11eafea102f16", alwaysExclude: true },  // test
    { address: "0x37b2237594C3D72718bEEBFeE46B9c9FbdE4eAdc", alwaysExclude: true },  // test
    { address: "0x6D69C6cdacDD56b45FF0040042Ef776AB8E7e208", alwaysExclude: true },  // test 1
    { address: "0x76f30a490cCA1fC054B878cC93608471cA7683d3", alwaysExclude: true },  // test 2
    { address: "0xe338BEF930AD5F47B2dAB67c6690470e6a42aeFB", alwaysExclude: true },  // test 3
    { address: "0x6F8d5123A4aDB30ea9a2149b290e6b4421f6770A", alwaysExclude: true },  // test 4
    { address: "0x390DDAb10363a10c9B848dfa3AF4E800544D0476", alwaysExclude: true },  // test 5
    { address: "0x7e030800a54B501904798322a81dDe1D9DFEc121", alwaysExclude: true },  // test 6
    { address: "0xe9286fF990279De1F2305C626775b40EBd9d5c5a", alwaysExclude: true },  // test 7
    { address: "0x41633a238A1e7f7Dd19A8fe391AA9C6d38aD477a", alwaysExclude: true },  // test 8
    { address: "0xd1A5500f1776b306cA820C4408CA95922e1BDe98", alwaysExclude: true },  // test 9
  ],
  // Fraxtal
  "0xfc": [],
  // ETH Mainnet
  "0x1": [
    { address: "0x7ed95418063d5b61bDE7b40D65F93739c0CFdcf4", alwaysExclude: false },
    { address: "0x51cf0Bc0f5312d824a55B83B2c032Fb8c96c249a", alwaysExclude: false },
    { address: "0xB6aB76d451B98a992FB84A93602527CC30cd3b22", alwaysExclude: false }, // QCLE
    { address: "0x938f2a213464e7307aD19CeD57D3F809A2B0a3Df", alwaysExclude: false }, // DEMO ETH NEW
    { address: "0xB8686BA67E17b986F4b57A089789CE8A9Ac7ECB0", alwaysExclude: false }, // Leveraged Avant+ DeFi Yield
  ],
  // Base
  "0x2105": [
    { address: "0x1D66EB6cC3b80c76B6fF08aC13f93a2DAEA4C855", alwaysExclude: false },
    { address: "0xFC5fF4dc70EaEc998863668212B01cBE51000A4b", alwaysExclude: false },
    { address: "0xC38e9E111CCBd435d9DE53ED2Dd7Db3993839238", alwaysExclude: false },
    { address: "0x61d5e3dC0907EADa4D9B06D8B33Cd96c3510b533", alwaysExclude: false },
    { address: "0x016623a2b54F7a6DAdB35D3400557a1b79466429", alwaysExclude: false },
    { address: "0x2e40fDbA4d07E6b7aBCcBCCe3f6D28bDea727395", alwaysExclude: false },
    { address: "0x34f1Ec0A0af19d622B281488C1B1ba0B5aE20860", alwaysExclude: true },  // BDAO
    { address: "0x23C44260731B8614aa7F3B28AB0bafDb1610743c", alwaysExclude: true },  // bDEMO4
    { address: "0x16dd2b60DEc7d3fE7C08f6B29732Fb51dDd2c176", alwaysExclude: true },  // ATF 19. mar 25
    { address: "0x86acCa1a926FEa47985Df8Ef5A8c0d0cDA650a62", alwaysExclude: true },  // gCFT 19. mar 25
    { address: "0x457960e6946ed94e82512992ba9dAaBDa5539010", alwaysExclude: true },  // DEMO ABC 25. apr 25
  ],
} as Record<string, { address: string; alwaysExclude: boolean }[]>;

export const excludedFundAddresses = Object.fromEntries(
  Object.entries(rawExcludedFundAddresses).map(([chainId, entries]) => {
    const filtered = entries.filter(entry => {
      return EXCLUDE_TEST_FUNDS ? true : entry.alwaysExclude;
    }).map(entry => entry.address.toLowerCase());
    return [chainId, filtered];
  }),
) as Record<string, string[]>;
