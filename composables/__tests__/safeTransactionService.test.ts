import { afterEach, describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";
import {
  SAFE_TX_TYPES,
  buildSafeTx,
  fetchNextSafeNonce,
  fetchSafeTxStatus,
  normalizeSignatureV,
  proposeSafeTx,
  safeTxDomain,
  safeTxHash,
  safeTxTypedDataPayload,
  safeWalletUrl,
  signSafeTx,
} from "../safe/safeTransactionService";
import { CRT, crtInner, crtWrap } from "../execution/crtConsole";
import { ChainId } from "~/types/enums/chain_id";

/**
 * The CRT payout Safe's proposal at nonce 1 — a 1 USDC payout wrapped for
 * role 2 — exactly as Safe's HyperEVM transaction service holds it (read
 * 2026-09-10). The manager EOA proposed it through Transaction Builder and
 * signed EIP-712; a second owner executed it on-chain.
 */
const LIVE = {
  safe: "0xAda3dF31614438Ec8C96470148D52Ce30A037071",
  safeTxHash: "0xbed8331cba17acd51bf5b761f53073b98756b598fccf912b007867b962b275e4",
  proposer: "0xB5d01172e73559B07ef3CD53dE84459c6BA3a054",
  signature:
    "0x82030c03eb4b9ac368882e8a0b1c0cdcd001dddbf6f4a9b9e10581f7af403a81740376c41daa69f109b4a8247718bd623a679c23b5dfa017e30a5b9cc607a6101c",
  nonce: 1,
};

const livePayout = () =>
  buildSafeTx(
    { to: CRT.ADDR.roles, data: crtWrap(crtInner.payout("1"), 2).data },
    LIVE.nonce,
  );

const jsonResponse = (body: any, status = 200) =>
  new Response(body === "" ? "" : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** A wallet behind an EIP-1193 façade, recording every request it gets. */
const providerFor = (wallet: ethers.BaseWallet, options: { typedData?: boolean } = {}) => {
  const calls: { method: string; params?: any[] }[] = [];
  return {
    calls,
    request({ method, params }: { method: string; params?: any[] }): Promise<any> {
      calls.push({ method, params });
      if (method === "eth_signTypedData_v4") {
        if (options.typedData === false) {
          const error: any = new Error("Unsupported method");
          error.code = 4200;
          return Promise.reject(error);
        }
        const payload = JSON.parse(params![1]);
        return wallet.signTypedData(
          payload.domain,
          { SafeTx: payload.types.SafeTx },
          payload.message,
        );
      }
      if (method === "personal_sign") {
        return wallet.signMessage(ethers.getBytes(params![0]));
      }
      return Promise.reject(new Error(`unexpected ${method}`));
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("safeTxHash", () => {
  it("reproduces the transaction service's hash for the live payout proposal", () => {
    expect(safeTxHash(ChainId.HYPEREVM, LIVE.safe, livePayout())).toBe(
      LIVE.safeTxHash,
    );
  });

  it("recovers the proposer from the signature the service holds", () => {
    const tx = livePayout();
    const signedBy = ethers.verifyTypedData(
      safeTxDomain(ChainId.HYPEREVM, LIVE.safe),
      SAFE_TX_TYPES,
      tx,
      LIVE.signature,
    );
    expect(signedBy).toBe(LIVE.proposer);
  });

  it("hashes the wallet payload the same way", () => {
    const tx = livePayout();
    const payload = safeTxTypedDataPayload(ChainId.HYPEREVM, LIVE.safe, tx);

    expect(payload.primaryType).toBe("SafeTx");
    expect(payload.domain).toEqual({ chainId: 999, verifyingContract: LIVE.safe });
    expect(payload.types.EIP712Domain.map((f) => f.name)).toEqual([
      "chainId",
      "verifyingContract",
    ]);
    expect(payload.message.nonce).toBe("1");
    expect(
      ethers.TypedDataEncoder.hash(
        payload.domain,
        { SafeTx: payload.types.SafeTx },
        payload.message,
      ),
    ).toBe(LIVE.safeTxHash);
  });
});

describe("buildSafeTx", () => {
  it("checksums the target and zeroes the refund fields", () => {
    const tx = buildSafeTx({ to: CRT.ADDR.roles, data: "0x1234" }, 7);

    expect(tx.to).toBe(ethers.getAddress(CRT.ADDR.roles));
    expect(tx.value).toBe("0");
    expect(tx.operation).toBe(0);
    expect(tx.safeTxGas).toBe("0");
    expect(tx.baseGas).toBe("0");
    expect(tx.gasPrice).toBe("0");
    expect(tx.gasToken).toBe(ethers.ZeroAddress);
    expect(tx.refundReceiver).toBe(ethers.ZeroAddress);
    expect(tx.nonce).toBe(7);
  });

  it("carries a value and defaults empty data to 0x", () => {
    const tx = buildSafeTx({ to: LIVE.safe, value: 5n }, 0);
    expect(tx.value).toBe("5");
    expect(tx.data).toBe("0x");
  });
});

describe("normalizeSignatureV", () => {
  const body = "ab".repeat(64);

  it("lifts a 0/1 recovery id to 27/28", () => {
    expect(normalizeSignatureV(`0x${body}00`)).toBe(`0x${body}1b`);
    expect(normalizeSignatureV(`0x${body}01`)).toBe(`0x${body}1c`);
  });

  it("leaves 27/28 alone", () => {
    expect(normalizeSignatureV(`0x${body}1c`)).toBe(`0x${body}1c`);
  });

  it("leaves anything that is not a 65-byte signature untouched", () => {
    expect(normalizeSignatureV("0x1234")).toBe("0x1234");
  });
});

describe("signSafeTx", () => {
  it("signs EIP-712 with the connected owner and verifies it", async () => {
    const wallet = ethers.Wallet.createRandom();
    const provider = providerFor(wallet);
    const tx = livePayout();

    const signature = await signSafeTx(
      provider,
      wallet.address.toLowerCase(),
      ChainId.HYPEREVM,
      LIVE.safe,
      tx,
    );

    expect(provider.calls.map((c) => c.method)).toEqual(["eth_signTypedData_v4"]);
    expect(provider.calls[0].params![0]).toBe(wallet.address);
    expect(typeof provider.calls[0].params![1]).toBe("string");
    expect(
      ethers.verifyTypedData(
        safeTxDomain(ChainId.HYPEREVM, LIVE.safe),
        SAFE_TX_TYPES,
        tx,
        signature,
      ),
    ).toBe(wallet.address);
  });

  it("falls back to the Safe's eth_sign flavour when typed data is unsupported", async () => {
    const wallet = ethers.Wallet.createRandom();
    const provider = providerFor(wallet, { typedData: false });
    const tx = livePayout();
    const hash = safeTxHash(ChainId.HYPEREVM, LIVE.safe, tx);

    const signature = await signSafeTx(
      provider,
      wallet.address,
      ChainId.HYPEREVM,
      LIVE.safe,
      tx,
    );

    expect(provider.calls.map((c) => c.method)).toEqual([
      "eth_signTypedData_v4",
      "personal_sign",
    ]);
    expect(provider.calls[1].params).toEqual([hash, wallet.address]);
    const v = parseInt(signature.slice(-2), 16);
    expect([31, 32]).toContain(v);
    const plain = signature.slice(0, -2) + (v - 4).toString(16);
    expect(ethers.verifyMessage(ethers.getBytes(hash), plain)).toBe(wallet.address);
  });

  it("does not fall back when the owner declined", async () => {
    const wallet = ethers.Wallet.createRandom();
    const provider = {
      calls: [] as string[],
      request({ method }: { method: string }): Promise<any> {
        provider.calls.push(method);
        const error: any = new Error("MetaMask Tx Signature: User denied message signature.");
        error.code = 4001;
        return Promise.reject(error);
      },
    };

    await expect(
      signSafeTx(provider, wallet.address, ChainId.HYPEREVM, LIVE.safe, livePayout()),
    ).rejects.toMatchObject({ code: 4001 });
    expect(provider.calls).toEqual(["eth_signTypedData_v4"]);
  });

  it("refuses a signature from another account", async () => {
    const wallet = ethers.Wallet.createRandom();
    const other = ethers.Wallet.createRandom();

    await expect(
      signSafeTx(
        providerFor(other),
        wallet.address,
        ChainId.HYPEREVM,
        LIVE.safe,
        livePayout(),
      ),
    ).rejects.toThrow(/signed as/);
  });
});

describe("fetchNextSafeNonce", () => {
  const stubQueue = (results: { nonce: number }[], safeNonce = 0) =>
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes("multisig-transactions/")
            ? jsonResponse({ count: results.length, results })
            : jsonResponse({ nonce: safeNonce, threshold: 2, owners: [] }),
        ),
      ),
    );

  it("goes after the last queued proposal", async () => {
    stubQueue([{ nonce: 5 }]);
    expect(await fetchNextSafeNonce(ChainId.HYPEREVM, LIVE.safe, 3)).toBe(6);
  });

  it("uses the chain's nonce when nothing is queued", async () => {
    stubQueue([]);
    expect(await fetchNextSafeNonce(ChainId.HYPEREVM, LIVE.safe, 3)).toBe(3);
  });

  it("skips superseded proposals left behind with old nonces", async () => {
    stubQueue([{ nonce: 1 }]);
    expect(await fetchNextSafeNonce(ChainId.HYPEREVM, LIVE.safe, 4)).toBe(4);
  });

  it("asks the service for the nonce when the chain's is not given", async () => {
    stubQueue([], 7);
    expect(await fetchNextSafeNonce(ChainId.HYPEREVM, LIVE.safe)).toBe(7);
  });
});

describe("proposeSafeTx", () => {
  it("files the proposal the way the service expects it", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse("", 201)));
    vi.stubGlobal("fetch", fetchMock);
    const tx = livePayout();

    const hash = await proposeSafeTx(
      ChainId.HYPEREVM,
      LIVE.safe,
      tx,
      LIVE.proposer.toLowerCase(),
      LIVE.signature,
      "{\"name\":\"Rethink\"}",
    );

    expect(hash).toBe(LIVE.safeTxHash);
    const [url, init] = fetchMock.mock.calls[0] as any as [string, RequestInit];
    expect(url).toBe(
      `https://api.safe.global/tx-service/hyper/api/v1/safes/${LIVE.safe}/multisig-transactions/`,
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      safe: LIVE.safe,
      to: tx.to,
      value: "0",
      data: tx.data,
      operation: 0,
      gasToken: ethers.ZeroAddress,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: "0",
      refundReceiver: ethers.ZeroAddress,
      nonce: 1,
      contractTransactionHash: LIVE.safeTxHash,
      sender: LIVE.proposer,
      signature: LIVE.signature,
      origin: "{\"name\":\"Rethink\"}",
    });
  });

  it("sends empty data as null", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse("", 201)));
    vi.stubGlobal("fetch", fetchMock);

    await proposeSafeTx(
      ChainId.HYPEREVM,
      LIVE.safe,
      buildSafeTx({ to: LIVE.safe }, 0),
      LIVE.proposer,
      LIVE.signature,
    );

    const [, init] = fetchMock.mock.calls[0] as any as [string, RequestInit];
    expect(JSON.parse(init.body as string).data).toBeNull();
  });

  it("surfaces the service's reason for refusing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            { nonFieldErrors: ["Signer=0x1234 is not an owner or delegate"] },
            422,
          ),
        ),
      ),
    );

    await expect(
      proposeSafeTx(ChainId.HYPEREVM, LIVE.safe, livePayout(), LIVE.proposer, LIVE.signature),
    ).rejects.toThrow("Signer=0x1234 is not an owner or delegate");
  });

  it("refuses a chain without a known service", async () => {
    await expect(
      proposeSafeTx(ChainId.LOCAL_NODE, LIVE.safe, livePayout(), LIVE.proposer, LIVE.signature),
    ).rejects.toThrow(/No Safe transaction service/);
  });
});

describe("fetchSafeTxStatus", () => {
  it("counts the signatures and carries the on-chain hash once executed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            safeTxHash: LIVE.safeTxHash,
            nonce: 1,
            confirmations: [{ owner: LIVE.proposer }, { owner: "0x808673bd15F8B941551A588b3e8bdD580EE14d9d" }],
            confirmationsRequired: 2,
            isExecuted: true,
            isSuccessful: true,
            transactionHash: "0xd51b1b0986d4c5b243b643143f689b5af3ebe99f45d42d8159408e4aafe040e6",
          }),
        ),
      ),
    );

    expect(await fetchSafeTxStatus(ChainId.HYPEREVM, LIVE.safeTxHash)).toEqual({
      safeTxHash: LIVE.safeTxHash,
      nonce: 1,
      confirmations: 2,
      confirmationsRequired: 2,
      isExecuted: true,
      isSuccessful: true,
      transactionHash: "0xd51b1b0986d4c5b243b643143f689b5af3ebe99f45d42d8159408e4aafe040e6",
    });
  });
});

describe("safeWalletUrl", () => {
  it("opens the Safe's queue with the chain prefix", () => {
    expect(safeWalletUrl(ChainId.HYPEREVM, LIVE.safe.toLowerCase())).toBe(
      `https://app.safe.global/transactions/queue?safe=hyper-evm:${LIVE.safe}`,
    );
  });

  it("opens one proposal by its Safe transaction hash", () => {
    expect(safeWalletUrl(ChainId.HYPEREVM, LIVE.safe, LIVE.safeTxHash)).toBe(
      `https://app.safe.global/transactions/tx?safe=hyper-evm:${LIVE.safe}&id=multisig_${LIVE.safe}_${LIVE.safeTxHash}`,
    );
  });
});
