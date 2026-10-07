import { describe, expect, it } from "vitest";
import {
  humanizeContractName,
  readableContractName,
  WELL_KNOWN_LABELS,
} from "~/composables/contracts/contractNames";

describe("contract names", () => {
  it("puts verified contract names into words", () => {
    expect(humanizeContractName("CoreDepositWallet")).toBe("Core Deposit Wallet");
    expect(humanizeContractName("PoolInstance")).toBe("Pool Instance");
    expect(humanizeContractName("MetaMorphoV1_1")).toBe("Meta Morpho V1.1");
    expect(humanizeContractName("FiatTokenV2_2")).toBe("Fiat Token V2.2");
    expect(humanizeContractName("GnosisSafeL2")).toBe("Gnosis Safe L2");
    expect(humanizeContractName("UniswapV3Pool")).toBe("Uniswap V3 Pool");
    expect(humanizeContractName("NAVExecutor")).toBe("NAV Executor");
    expect(humanizeContractName("ERC20")).toBe("ERC20");
    expect(humanizeContractName("WETH9")).toBe("WETH9");
    expect(humanizeContractName("GovernableFundFactory")).toBe("Governable Fund Factory");
  });

  it("calls a token by its own name and symbol", () => {
    expect(readableContractName({ contractName: "MetaMorphoV1_1", token: { name: "Felix USDC", symbol: "feUSDC" } })).toBe("Felix USDC (feUSDC)");
    expect(readableContractName({ token: { name: "USDC", symbol: "USDC" } })).toBe("USDC");
    expect(readableContractName({ token: { symbol: "WETH" } })).toBe("WETH");
  });

  it("calls anything else by its verified contract name, never by a proxy's", () => {
    expect(readableContractName({ contractName: "CoreDepositWallet" })).toBe("Core Deposit Wallet");
    expect(readableContractName({ contractName: "AdminUpgradableProxy" })).toBeUndefined();
    expect(readableContractName({ contractName: "InitializableImmutableAdminUpgradeabilityProxy" })).toBeUndefined();
    expect(readableContractName({ contractName: "ERC1967Proxy" })).toBeUndefined();
    expect(readableContractName({ contractName: "Anything", isProxy: true })).toBeUndefined();
    expect(readableContractName({})).toBeUndefined();
  });

  it("keys hand-written names by lowercase address", () => {
    for (const address of Object.keys(WELL_KNOWN_LABELS)) {
      expect(address).toMatch(/^0x[0-9a-f]{40}$/);
    }
    expect(WELL_KNOWN_LABELS["0x6b9e773128f453f5c2c60935ee2de2cbc5390a24"]).toBe("USDC deposit to HyperCore");
    expect(WELL_KNOWN_LABELS["0x8a862fd6c12f9ad34c9c2ff45ab2b6712e8cea27"]).toBe("Felix USDC vault");
    expect(WELL_KNOWN_LABELS["0x00a89d7a5a02160f20150ebea7a2b5e4879a1a8b"]).toBe("HyperLend pool");
  });
});

describe("Rethink's own contracts", () => {
  const book = {
    NAVExecutorBeaconProxy: { "0x3e7": "0x49a2Ec2De6CbdB3282c5BdEc3b6ceb0157d84A47", "0xa4b1": "0x1111111111111111111111111111111111111111" },
    PoolPerformanceFeeBeaconProxy: { "0x3e7": "0xA290641Ecce7C0D7835Ca128810B240F74a399Be" },
    SomeNewContract: { "0x3e7": "0x2222222222222222222222222222222222222222" },
  };

  it("names them from the address book, on the right chain only", async () => {
    const { rethinkContractName } = await import("~/composables/contracts/contractNames");
    expect(rethinkContractName(book, "0x3e7", "0x49a2ec2de6cbdb3282c5bdec3b6ceb0157d84a47")).toBe("NAV executor");
    expect(rethinkContractName(book, "0x3e7", "0xa290641ecce7c0d7835ca128810b240f74a399be")).toBe("Performance fee contract");
    expect(rethinkContractName(book, "0x3e7", "0x2222222222222222222222222222222222222222")).toBe("Some New Contract");
    expect(rethinkContractName(book, "0xa4b1", "0x49a2ec2de6cbdb3282c5bdec3b6ceb0157d84a47")).toBeUndefined();
    expect(rethinkContractName(book, "0x3e7", "0x3333333333333333333333333333333333333333")).toBeUndefined();
  });
});
