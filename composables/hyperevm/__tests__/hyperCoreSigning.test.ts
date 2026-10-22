import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  APPROVE_AGENT_FIELDS,
  APPROVE_AGENT_PRIMARY_TYPE,
  L1_ACTION_DOMAIN,
  L1_ACTION_TYPES,
  approveAgentAction,
  encodeMsgpack,
  evmUserModifyAction,
  l1ActionHash,
  signL1Action,
  splitSignature,
  typedDataRequest,
  userSignedTypedData,
} from "../hyperCoreSigning";

// The key Hyperliquid's Python SDK signs its own test vectors with
// (tests/signing_test.py).
const SDK_TEST_KEY = "0x0123456789012345678901234567890123456789012345678901234567890123";

const hex = (bytes: Uint8Array) => ethers.hexlify(bytes);
const ascii = (text: string) => ethers.hexlify(ethers.toUtf8Bytes(text)).slice(2);

describe("encodeMsgpack", () => {
  it("writes evmUserModify byte for byte", () => {
    expect(hex(encodeMsgpack(evmUserModifyAction(true)))).toBe(
      "0x82" +
        "a4" + ascii("type") +
        "ad" + ascii("evmUserModify") +
        "ae" + ascii("usingBigBlocks") +
        "c3",
    );
    expect(hex(encodeMsgpack(evmUserModifyAction(false))).slice(-2)).toBe("c2");
  });

  it("takes the smallest integer form, as Python's msgpack does", () => {
    expect(hex(encodeMsgpack(127))).toBe("0x7f");
    expect(hex(encodeMsgpack(128))).toBe("0xcc80");
    expect(hex(encodeMsgpack(256))).toBe("0xcd0100");
    expect(hex(encodeMsgpack(65_536))).toBe("0xce00010000");
    expect(hex(encodeMsgpack(2 ** 32))).toBe("0xcf0000000100000000");
    expect(hex(encodeMsgpack(2n ** 64n - 1n))).toBe("0xcfffffffffffffffff");
  });

  it("writes str8 between 32 and 255 bytes, and str16 above", () => {
    expect(hex(encodeMsgpack("a".repeat(31))).slice(0, 4)).toBe("0xbf");
    expect(hex(encodeMsgpack("a".repeat(32))).slice(0, 6)).toBe("0xd920");
    expect(hex(encodeMsgpack("a".repeat(256))).slice(0, 8)).toBe("0xda0100");
  });

  it("keeps map keys in insertion order", () => {
    expect(hex(encodeMsgpack({ b: 1, a: 2 }))).toBe("0x82a16201a16102");
  });

  it("refuses what the exchange never sends", () => {
    expect(() => encodeMsgpack(1.5)).toThrow();
    expect(() => encodeMsgpack(-1)).toThrow();
    expect(() => encodeMsgpack({ type: undefined } as any)).toThrow(/undefined/);
  });
});

describe("l1ActionHash", () => {
  // signing_test.py: test_phantom_agent_creation_matches_production — an
  // order the exchange accepted, so this pins nested maps, arrays, strings,
  // booleans and the nonce together.
  it("reproduces the SDK's production order hash", () => {
    const order = {
      type: "order",
      orders: [
        { a: 4, b: true, p: "1670.1", s: "0.0147", r: false, t: { limit: { tif: "Ioc" } } },
      ],
      grouping: "na",
    };
    expect(l1ActionHash(order, 1677777606040)).toBe(
      "0x0fcbeda5ae3c4950a548021552a4fea2226858c4453571bf3f24ba017eac2908",
    );
  });

  // Posted to the live exchange on 2026-10-22, signed by a throwaway key:
  // it answered with that key's own address ("User or API Wallet … does not
  // exist"), so it recovered the signer from this exact hash.
  it("matches the evmUserModify hash the live exchange recovered a signer from", () => {
    expect(l1ActionHash(evmUserModifyAction(true), 1792674289175)).toBe(
      "0x6e2997be914f08ca08ead3a66bf5dc5e326c4ca06f403aabd74fe06ea3a29771",
    );
  });
});

describe("signL1Action", () => {
  // signing_test.py: test_l1_action_signing_matches, num =
  // float_to_int_for_hashing(1000). The SDK prints r without its leading
  // zero, hence the comparison as numbers.
  it("matches the SDK's mainnet and testnet signatures", async () => {
    const wallet = new ethers.Wallet(SDK_TEST_KEY);
    const action = { type: "dummy", num: 100_000_000_000 };

    const mainnet = await signL1Action(wallet, action, 0, true);
    expect(BigInt(mainnet.r)).toBe(
      BigInt("0x53749d5b30552aeb2fca34b530185976545bb22d0b3ce6f62e31be961a59298"),
    );
    expect(BigInt(mainnet.s)).toBe(
      BigInt("0x755c40ba9bf05223521753995abb2f73ab3229be8ec921f350cb447e384d8ed8"),
    );
    expect(mainnet.v).toBe(27);

    const testnet = await signL1Action(wallet, action, 0, false);
    expect(BigInt(testnet.r)).toBe(
      BigInt("0x542af61ef1f429707e3c76c5293c80d01f74ef853e34b76efffcb57e574f9510"),
    );
    expect(BigInt(testnet.s)).toBe(
      BigInt("0x17b8b32f086e8cdede991f1e2c529f5dd5297cbe8128500e00cbaf766204a613"),
    );
    expect(testnet.v).toBe(28);
  });

  it("signs as the agent, under the fixed 1337 domain", async () => {
    const agent = ethers.Wallet.createRandom();
    const action = evmUserModifyAction(true);
    const signature = await signL1Action(agent, action, 1792674289175);
    const recovered = ethers.verifyTypedData(
      L1_ACTION_DOMAIN,
      L1_ACTION_TYPES,
      { source: "a", connectionId: l1ActionHash(action, 1792674289175) },
      ethers.Signature.from(signature),
    );
    expect(recovered).toBe(agent.address);
  });
});

describe("user-signed actions", () => {
  // signing_test.py: test_sign_usd_transfer_action (testnet, 0x66eee).
  it("matches the SDK's usdSend signature", async () => {
    const wallet = new ethers.Wallet(SDK_TEST_KEY);
    const typedData = userSignedTypedData(
      "HyperliquidTransaction:UsdSend",
      [
        { name: "hyperliquidChain", type: "string" },
        { name: "destination", type: "string" },
        { name: "amount", type: "string" },
        { name: "time", type: "uint64" },
      ],
      {
        destination: "0x5e9ee1089755c3435139848e47e6635505d5a13a",
        amount: "1",
        time: 1687816341423,
        hyperliquidChain: "Testnet",
        signatureChainId: "0x66eee",
      },
      0x66eee,
    );
    const signature = splitSignature(
      await wallet.signTypedData(typedData.domain, typedData.types, typedData.message),
    );
    expect(BigInt(signature.r)).toBe(
      BigInt("0x637b37dd731507cdd24f46532ca8ba6eec616952c56218baeff04144e4a77073"),
    );
    expect(BigInt(signature.s)).toBe(
      BigInt("0x11a6a24900e6e314136d2592e2f8d502cd89b7c15b198e1bee043c9589f9fad7"),
    );
    expect(signature.v).toBe(27);
  });

  it("approves an agent under the wallet's own chain, signing only its fields", () => {
    const agent = "0x1111111111111111111111111111111111111111";
    const action = approveAgentAction(agent, "rethink-abc123", 1792674289175, 999);
    expect(action).toEqual({
      type: "approveAgent",
      signatureChainId: "0x3e7",
      hyperliquidChain: "Mainnet",
      agentAddress: agent,
      agentName: "rethink-abc123",
      nonce: 1792674289175,
    });

    const typedData = userSignedTypedData(
      APPROVE_AGENT_PRIMARY_TYPE,
      APPROVE_AGENT_FIELDS,
      { ...action },
      999,
    );
    expect(typedData.domain).toEqual({
      name: "HyperliquidSignTransaction",
      version: "1",
      chainId: 999,
      verifyingContract: ethers.ZeroAddress,
    });
    expect(Object.keys(typedData.message)).toEqual([
      "hyperliquidChain",
      "agentAddress",
      "agentName",
      "nonce",
    ]);

    // What the wallet is asked to sign hashes to the same digest.
    const request = typedDataRequest(typedData);
    expect(request.domain.chainId).toBe(999);
    expect(request.types.EIP712Domain.map(({ name }) => name)).toEqual([
      "name",
      "version",
      "chainId",
      "verifyingContract",
    ]);
    const types = { [APPROVE_AGENT_PRIMARY_TYPE]: request.types[APPROVE_AGENT_PRIMARY_TYPE] };
    expect(ethers.TypedDataEncoder.hash(request.domain, types, request.message)).toBe(
      ethers.TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message),
    );
  });
});

describe("splitSignature", () => {
  it("raises a 0/1 v to 27/28", async () => {
    const wallet = new ethers.Wallet(SDK_TEST_KEY);
    const signature = await wallet.signMessage("x");
    const v = parseInt(signature.slice(-2), 16);
    const lowV = signature.slice(0, -2) + (v - 27).toString(16).padStart(2, "0");
    expect(splitSignature(lowV)).toEqual(splitSignature(signature));
  });
});
