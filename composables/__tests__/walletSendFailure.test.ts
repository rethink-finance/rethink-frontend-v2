import { describe, expect, it } from "vitest";
import {
  collectErrorText,
  detectWalletRpcFailure,
  walletRpcFailureMessage,
} from "../web3/walletSendFailure";
import { ChainId } from "~/types/enums/chain_id";

/** web3's ResponseError around a JSON-RPC error object from the wallet. */
const web3ResponseError = (message: string, data?: unknown) =>
  Object.assign(new Error(`Returned error: ${message}`), { code: 101, data });

/** What MetaMask hands a dApp when its own node fails or the call reverts. */
const metaMaskInternal = (cause: string) =>
  Object.assign(new Error("Returned error: Internal JSON-RPC error."), {
    innerError: { code: -32603, message: "Internal JSON-RPC error.", data: { cause: { message: cause } } },
  });

const ctx = { appRpcOk: true };

describe("collectErrorText", () => {
  it("flattens the message and every wrapped error", () => {
    const text = collectErrorText(metaMaskInternal("Fetch failed with status '401'"));
    expect(text).toContain("Internal JSON-RPC error.");
    expect(text).toContain("Fetch failed with status '401'");
  });

  it("copes with strings, nulls and cycles", () => {
    expect(collectErrorText("plain")).toBe("plain");
    expect(collectErrorText(undefined)).toBe("");
    const loop: any = new Error("looped");
    loop.cause = loop;
    expect(collectErrorText(loop)).toContain("looped");
  });
});

describe("detectWalletRpcFailure", () => {
  it("recognises the ShineDAO vote failure", () => {
    expect(detectWalletRpcFailure(web3ResponseError("Unauthorized."), ctx)).toBe("Unauthorized.");
  });

  it("recognises dead keys, quotas and HTTP refusals however they are worded", () => {
    for (const message of [
      "message: API key disabled, reason: tenant disabled, json-rpc code: -32051, rest code: 403",
      "Must be authenticated!",
      "rate limit exceeded",
      "Request is being rate limited.",
      "Non-200 status code: '401'",
      "The network of this endpoint requires a paid subscription plan.",
    ]) {
      expect(detectWalletRpcFailure(web3ResponseError(message), ctx), message).toBeTruthy();
    }
  });

  it("recognises a node that never answered", () => {
    expect(detectWalletRpcFailure(new TypeError("Failed to fetch"), ctx)).toBe("Failed to fetch");
    expect(detectWalletRpcFailure(web3ResponseError("Gateway timeout"), ctx)).toBe("Gateway timeout");
  });

  it("sees through MetaMask's masked line only when the app's RPC vouched for the call", () => {
    const masked = metaMaskInternal("Fetch failed with status '401'");
    expect(detectWalletRpcFailure(masked, { appRpcOk: true })).toBeTruthy();
    // A revert hides behind the same line; without the app's estimate it is a coin flip.
    const bare = Object.assign(new Error("Returned error: Internal JSON-RPC error."), {
      innerError: { code: -32603, message: "Internal JSON-RPC error." },
    });
    expect(detectWalletRpcFailure(bare, { appRpcOk: false })).toBeNull();
    expect(detectWalletRpcFailure(bare, { appRpcOk: true })).toBe("Internal JSON-RPC error.");
  });

  it("leaves declines, reverts and wallet permission errors alone", () => {
    expect(detectWalletRpcFailure(Object.assign(new Error("User rejected the request."), { code: 4001 }), ctx)).toBeNull();
    expect(detectWalletRpcFailure(web3ResponseError("execution reverted: GovernorVotingSimple: vote already cast"), ctx)).toBeNull();
    expect(detectWalletRpcFailure(metaMaskInternal("execution reverted"), ctx)).toBeNull();
    expect(detectWalletRpcFailure(web3ResponseError("insufficient funds for gas * price + value"), ctx)).toBeNull();
    // EIP-1193 4100 says "unauthorized" too, and is not the RPC.
    expect(
      detectWalletRpcFailure(
        Object.assign(new Error("The requested account and/or method has not been authorized by the user."), { code: 4100 }),
        ctx,
      ),
    ).toBeNull();
    expect(detectWalletRpcFailure(Object.assign(new Error("Unrecognized chain ID"), { code: 4902 }), ctx)).toBeNull();
    expect(detectWalletRpcFailure(undefined, ctx)).toBeNull();
  });
});

describe("walletRpcFailureMessage", () => {
  it("names the wallet, the chain, what the node said and the URL to paste", () => {
    const message = walletRpcFailureMessage("Unauthorized.", {
      chainId: ChainId.POLYGON,
      appRpcOk: true,
      walletLabel: "MetaMask",
    });
    expect(message).toContain("MetaMask could not reach Polygon");
    expect(message).toContain("\"Unauthorized.\"");
    expect(message).toContain("https://polygon-bor-rpc.publicnode.com");
    expect(message).not.toContain("polygon-rpc.com,");
  });

  it("still reads when the wallet has no label", () => {
    const message = walletRpcFailureMessage("Failed to fetch", { chainId: ChainId.ARBITRUM, appRpcOk: false });
    expect(message.startsWith("Your wallet could not reach Arbitrum One")).toBe(true);
  });
});
