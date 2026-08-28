import { describe, expect, it } from "vitest";
import {
  getAtomicBatchStatus,
  isBatchUnsupportedError,
  isUpgradeRejectionError,
  isUserRejectionError,
  isWalletCallsSuccess,
  isWalletRpcHealthError,
  normalizeCallsStatus,
  parseAtomicBatchStatus,
  sendWalletCalls,
  waitForWalletCalls,
  WalletCallsTimeoutError,
  type Eip1193Provider,
} from "../services/eip5792";

/** A provider that answers each request with the next queued value. */
const providerFrom = (
  responses: Array<any | Error>,
  log: Array<{ method: string; params?: unknown[] }> = [],
): Eip1193Provider => ({
  request: (args) => {
    log.push(args);
    const next = responses.shift();
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  },
});

describe("parseAtomicBatchStatus", () => {
  it("reads supported and ready for the asked chain", () => {
    const capabilities = {
      "0x89": { atomic: { status: "supported" } },
      "0xa4b1": { atomic: { status: "ready" } },
    };
    expect(parseAtomicBatchStatus(capabilities, "0x89")).toBe("supported");
    expect(parseAtomicBatchStatus(capabilities, "0xa4b1")).toBe("ready");
  });

  it("matches chain keys numerically, not textually", () => {
    // Wallets disagree about padding and case; 0x00A4B1 is still Arbitrum.
    const capabilities = { "0x00A4B1": { atomic: { status: "supported" } } };
    expect(parseAtomicBatchStatus(capabilities, "0xa4b1")).toBe("supported");
  });

  it("is unsupported for missing chains, odd statuses, and garbage", () => {
    expect(
      parseAtomicBatchStatus({ "0x1": { atomic: { status: "supported" } } }, "0x89"),
    ).toBe("unsupported");
    expect(
      parseAtomicBatchStatus({ "0x89": { atomic: { status: "maybe" } } }, "0x89"),
    ).toBe("unsupported");
    expect(parseAtomicBatchStatus({ "0x89": {} }, "0x89")).toBe("unsupported");
    expect(parseAtomicBatchStatus(undefined, "0x89")).toBe("unsupported");
    expect(parseAtomicBatchStatus("nonsense", "0x89")).toBe("unsupported");
    expect(parseAtomicBatchStatus({}, "not-a-chain")).toBe("unsupported");
  });
});

describe("getAtomicBatchStatus", () => {
  const account = "0x1111111111111111111111111111111111111111";

  it("answers unsupported when the wallet lacks the method", async () => {
    const provider = providerFrom([
      Object.assign(new Error("Method wallet_getCapabilities not found"), {
        code: -32601,
      }),
    ]);
    await expect(getAtomicBatchStatus(provider, account, "0xa4b1")).resolves.toBe(
      "unsupported",
    );
  });

  it("rethrows a wallet whose RPC endpoint is failing instead of calling it unsupported", async () => {
    // MetaMask's circuit breaker, observed with code -32002 on Arbitrum: the
    // endpoint is sick, not the batching capability, and "unsupported" would
    // route the caller into a per-transaction send that dies the same way.
    const provider = providerFrom([
      Object.assign(
        new Error(
          "RPC endpoint returned too many errors, retrying in 0.11 minutes. Consider using a different RPC endpoint.",
        ),
        { code: -32002 },
      ),
    ]);
    await expect(
      getAtomicBatchStatus(provider, account, "0xa4b1"),
    ).rejects.toThrow("too many errors");
  });
});

describe("normalizeCallsStatus", () => {
  it("passes final-spec numeric codes through", () => {
    expect(normalizeCallsStatus(100)).toBe(100);
    expect(normalizeCallsStatus(200)).toBe(200);
    expect(normalizeCallsStatus(500)).toBe(500);
  });

  it("maps pre-final string statuses onto the numeric scheme", () => {
    expect(normalizeCallsStatus("CONFIRMED")).toBe(200);
    expect(normalizeCallsStatus("PENDING")).toBe(100);
    expect(normalizeCallsStatus("failed")).toBe(500);
  });

  it("treats anything unrecognizable as still pending", () => {
    expect(normalizeCallsStatus("SOMETHING_NEW")).toBe(100);
    expect(normalizeCallsStatus(undefined)).toBe(100);
    expect(normalizeCallsStatus(null)).toBe(100);
  });
});

describe("isWalletCallsSuccess", () => {
  it("accepts 200 with passing or absent receipts", () => {
    expect(
      isWalletCallsSuccess({
        statusCode: 200,
        receipts: [{ status: "0x1" }],
        raw: {},
      }),
    ).toBe(true);
    expect(
      isWalletCallsSuccess({ statusCode: 200, receipts: [], raw: {} }),
    ).toBe(true);
  });

  it("rejects reverted receipts even under a 200", () => {
    expect(
      isWalletCallsSuccess({
        statusCode: 200,
        receipts: [{ status: "0x1" }, { status: "0x0" }],
        raw: {},
      }),
    ).toBe(false);
  });

  it("rejects every non-200 code", () => {
    for (const statusCode of [100, 400, 500, 600]) {
      expect(
        isWalletCallsSuccess({ statusCode, receipts: [{ status: "0x1" }], raw: {} }),
      ).toBe(false);
    }
  });
});

describe("error classification", () => {
  it("recognizes user rejections, including wrapped codes", () => {
    expect(isUserRejectionError({ code: 4001 })).toBe(true);
    expect(isUserRejectionError({ code: 100 })).toBe(true);
    expect(isUserRejectionError({ error: { code: 4001 } })).toBe(true);
    expect(isUserRejectionError({ code: 5750 })).toBe(false);
  });

  it("recognizes a refused account upgrade", () => {
    expect(isUpgradeRejectionError({ code: 5750 })).toBe(true);
    expect(isUpgradeRejectionError({ code: 4001 })).toBe(false);
  });

  it("recognizes wallets that cannot batch", () => {
    expect(isBatchUnsupportedError({ code: -32601 })).toBe(true);
    expect(isBatchUnsupportedError({ code: 5740 })).toBe(true);
    expect(
      isBatchUnsupportedError({ message: "Method wallet_sendCalls not found" }),
    ).toBe(true);
    expect(
      isBatchUnsupportedError({
        message: "The method wallet_sendCalls does not exist / is not available",
      }),
    ).toBe(true);
    expect(isBatchUnsupportedError({ code: 4001 })).toBe(false);
    expect(isBatchUnsupportedError({ message: "execution reverted" })).toBe(false);
  });

  it("recognizes the wallet's RPC circuit breaker, wherever the message sits", () => {
    // MetaMask's exact shape, observed on Arbitrum 2026-08-28.
    expect(
      isWalletRpcHealthError({
        code: -32603,
        message:
          "RPC endpoint returned too many errors, retrying in 0.31 minutes. Consider using a different RPC endpoint.",
      }),
    ).toBe(true);
    expect(
      isWalletRpcHealthError({
        code: -32603,
        data: { message: "Execution prevented because the circuit breaker is open" },
      }),
    ).toBe(true);
    // 1rpc's quota wall, observed via the wallet on Arbitrum 2026-08-28.
    expect(
      isWalletRpcHealthError({
        message:
          "Returned error: RPC 0xa4b1 Custom eth_getBlockByNumber: You've reached the usage limit for your current plan.",
      }),
    ).toBe(true);
    expect(isWalletRpcHealthError({ message: "Request is rate limited." })).toBe(
      true,
    );
    // A bare internal error is NOT an RPC-health verdict — -32603 is the
    // catch-all code and plenty of unrelated failures wear it.
    expect(
      isWalletRpcHealthError({ code: -32603, message: "Internal JSON-RPC error." }),
    ).toBe(false);
    expect(isWalletRpcHealthError({ code: 4001 })).toBe(false);
  });
});

describe("sendWalletCalls", () => {
  const batch = {
    chainId: "0xa4b1",
    from: "0x1111111111111111111111111111111111111111",
    calls: [{ to: "0x2222222222222222222222222222222222222222", data: "0x" }],
  };

  it("returns the bundle id from a final-spec { id } answer", async () => {
    const log: Array<{ method: string; params?: unknown[] }> = [];
    const provider = providerFrom([{ id: "0xbundle" }], log);
    await expect(sendWalletCalls(provider, batch)).resolves.toBe("0xbundle");

    const [request] = log;
    expect(request.method).toBe("wallet_sendCalls");
    const payload = (request.params as any[])[0];
    expect(payload.version).toBe("2.0.0");
    expect(payload.atomicRequired).toBe(true);
    expect(payload.chainId).toBe(batch.chainId);
    expect(payload.calls).toEqual(batch.calls);
  });

  it("returns the bundle id from a pre-final bare string answer", async () => {
    const provider = providerFrom(["0xbundle"]);
    await expect(sendWalletCalls(provider, batch)).resolves.toBe("0xbundle");
  });

  it("throws when the wallet answers with no id", async () => {
    const provider = providerFrom([{}]);
    await expect(sendWalletCalls(provider, batch)).rejects.toThrow(
      "no call bundle id",
    );
  });
});

describe("waitForWalletCalls", () => {
  it("polls through pending to a terminal status", async () => {
    const provider = providerFrom([
      { status: 100 },
      { status: "PENDING" },
      { status: 200, receipts: [{ status: "0x1" }] },
    ]);
    const result = await waitForWalletCalls(provider, "0xbundle", {
      pollIntervalMs: 0,
      timeoutMs: 5_000,
    });
    expect(result.statusCode).toBe(200);
    expect(result.receipts).toEqual([{ status: "0x1" }]);
  });

  it("tolerates transient status errors but not persistent ones", async () => {
    const boom = new Error("bundle not found yet");
    const okAfterTwo = providerFrom([boom, boom, { status: 200, receipts: [] }]);
    await expect(
      waitForWalletCalls(okAfterTwo, "0xbundle", {
        pollIntervalMs: 0,
        timeoutMs: 5_000,
      }),
    ).resolves.toMatchObject({ statusCode: 200 });

    const alwaysBroken = providerFrom([boom, boom, boom]);
    await expect(
      waitForWalletCalls(alwaysBroken, "0xbundle", {
        pollIntervalMs: 0,
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow("bundle not found yet");
  });

  it("times out while the wallet keeps answering pending", async () => {
    const provider: Eip1193Provider = {
      request: () => Promise.resolve({ status: 100 }),
    };
    await expect(
      waitForWalletCalls(provider, "0xbundle", {
        pollIntervalMs: 0,
        timeoutMs: 0,
      }),
    ).rejects.toBeInstanceOf(WalletCallsTimeoutError);
  });
});
