import { compile, RETHINK_HYPERLIQUID_REFERRAL_CODE } from "@rethink-finance/positions-registry";
import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  API_WALLET_MAX_DAYS,
  API_WALLET_MIN_DAYS,
  CORE_WRITER,
  HYPERLIQUID_INFO_URL,
  apiWalletNameProblem,
  apiWalletSlotName,
  apiWalletValidUntil,
  daysLeft,
  fetchApiWalletOwner,
  fetchApiWallets,
  fetchHyperliquidAccount,
  fetchReferral,
  registerApiWalletCall,
  removeApiWalletCall,
  setReferrerAction,
  setRethinkReferral,
  waitForApiWallet,
  walletFromPrivateKey,
} from "~/composables/execution/hyperliquidSetup";
import { HYPERLIQUID_EXCHANGE_URL } from "~/composables/hyperevm/bigBlocks";
import {
  L1_ACTION_DOMAIN,
  L1_ACTION_TYPES,
  l1ActionHash,
} from "~/composables/hyperevm/hyperCoreSigning";
import { patternsOf } from "~/composables/permissions/coreWriterPatterns";

const SAFE = "0xb25666BC66630ad02e12E680BAe053b85389D5E9";
// The CarrotFunding Safe's live API wallet (extraAgents, 2026-10-22) and its backup key.
const AGENT = ethers.getAddress("0x67eba13692435df7f2bbdeade2f838f273b904d3");
const BACKUP = ethers.getAddress("0x772187016dac685593d04dca8a79794e6fa70824");
const STRANGER = "0x1111111111111111111111111111111111111111";
const NOW = 1792674289175;

const writer = new ethers.Interface(["function sendRawAction(bytes data)"]);
const payloadOf = (data: string): string => writer.decodeFunctionData("sendRawAction", data)[0];

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

/**
 * Hyperliquid behind fetch: `info` answers the info API by request body,
 * `exchange` the exchange; every request is recorded.
 */
const hyperliquid = (
  info: (body: any) => unknown,
  exchange: (body: any) => unknown = () => ({ status: "ok", response: { type: "default" } }),
) => {
  const requests: { url: string; body: any }[] = [];
  const fetchImpl = (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    requests.push({ url, body });
    if (url === HYPERLIQUID_INFO_URL) return Promise.resolve(json(info(body)));
    if (url === HYPERLIQUID_EXCHANGE_URL) return Promise.resolve(json(exchange(body)));
    return Promise.reject(new Error(`unexpected ${url}`));
  };
  return { fetchImpl: fetchImpl as unknown as typeof fetch, requests };
};

describe("names and expiries", () => {
  it("names a slot the way HyperCore reads its expiry", () => {
    expect(apiWalletSlotName(" main ", NOW)).toBe(`main valid_until ${NOW}`);
  });

  it("says what is wrong with a name", () => {
    expect(apiWalletNameProblem("")).toMatch(/name/);
    expect(apiWalletNameProblem("x".repeat(17))).toMatch(/at most 16/);
    expect(apiWalletNameProblem("bot valid_until 1")).toMatch(/expiry/);
    expect(apiWalletNameProblem("backup")).toBe("");
  });

  it("keeps a registration within HyperCore's 14 to 180 days", () => {
    expect([API_WALLET_MIN_DAYS, API_WALLET_MAX_DAYS]).toEqual([14, 180]);
    expect(apiWalletValidUntil(180, NOW)).toBe(NOW + 180 * 86_400_000);
    for (const days of [13, 181, 1.5, Number.NaN]) {
      expect(() => apiWalletValidUntil(days, NOW)).toThrow(RangeError);
    }
    expect(daysLeft(NOW + 2.5 * 86_400_000, NOW)).toBe(3);
    expect(daysLeft(NOW - 1, NOW)).toBe(0);
  });
});

describe("the calls the manager sends", () => {
  it("registers an address under a named, expiring slot on CoreWriter", () => {
    const call = registerApiWalletCall(AGENT.toLowerCase(), "main", NOW);
    expect(call.to).toBe(CORE_WRITER);
    const payload = payloadOf(call.data);
    expect(payload.slice(0, 10)).toBe("0x01000009"); // version 1, action 9: addApiWallet
    const [address, name] = ethers.AbiCoder.defaultAbiCoder().decode(
      ["address", "string"],
      "0x" + payload.slice(10),
    );
    expect(address).toBe(AGENT);
    expect(name).toBe(`main valid_until ${NOW}`);
  });

  it("removes by approving the zero address under the slot's name", () => {
    const [address, name] = ethers.AbiCoder.defaultAbiCoder().decode(
      ["address", "string"],
      "0x" + payloadOf(removeApiWalletCall("main").data).slice(10),
    );
    expect(address).toBe(ethers.ZeroAddress);
    expect(name).toBe("main");
  });

  /**
   * Whether the registry's own `delegate` permission, generated for
   * `params`, lets `call` through — read back through the app's own
   * byte-pattern reader.
   */
  const delegateAllows = (params: Record<string, unknown>) => {
    const { targets } = compile({
      chainId: 999,
      selections: [{ protocol: "hyperliquid", action: "delegate", params }],
    });
    const target: any = targets.find((t: any) => t.address.toLowerCase() === CORE_WRITER);
    const scope = target.functions.find(
      (fn: any) => fn.selector === writer.getFunction("sendRawAction")!.selector,
    );
    const toNode = (c: any): any => ({
      index: 0,
      parent: 0,
      paramType: c.paramType,
      operator: c.operator,
      compValue: c.compValue ?? "0x",
      children: (c.children ?? []).map(toNode),
    });
    // Matches over the call's one parameter, the instruction bytes.
    const patterns = patternsOf(toNode(scope.condition.children[0]))!;
    expect(patterns.length).toBeGreaterThan(0);
    return (call: { data: string }) => {
      const bytes = ethers.getBytes(payloadOf(call.data));
      return patterns.some((pattern) =>
        [...pattern].every(
          ([offset, { mask, value }]) => offset < bytes.length && (bytes[offset] & mask) === value,
        ),
      );
    };
  };

  // What the panel sends must pass the manager's permission for the one
  // address the vault was launched with, and nothing else.
  it("fits the manager's Hyperliquid permission, and only for its address", () => {
    const allows = delegateAllows({ agent: AGENT });
    expect(allows(registerApiWalletCall(AGENT, "main", NOW))).toBe(true);
    expect(allows(removeApiWalletCall("main"))).toBe(true);
    expect(allows(registerApiWalletCall(BACKUP, "backup", NOW))).toBe(false);
    expect(allows(registerApiWalletCall(STRANGER, "main", NOW))).toBe(false);
  });

  // With rotation — the admin's — any address the panel registers passes.
  it("fits the admin's rotation permission for any address", () => {
    const allows = delegateAllows({ rotate: true });
    for (const address of [AGENT, BACKUP, STRANGER]) {
      expect(allows(registerApiWalletCall(address, "main", NOW))).toBe(true);
    }
    expect(allows(removeApiWalletCall("main"))).toBe(true);
  });
});

describe("reads", () => {
  it("reads an account HyperCore has never seen as not activated", async () => {
    const api = hyperliquid(() => ({ role: "missing" }));
    expect(await fetchHyperliquidAccount(SAFE, api.fetchImpl)).toEqual({
      activated: false,
      spotUsdc: 0,
      perpValue: 0,
    });
    expect(api.requests).toHaveLength(1);
  });

  it("reads an active account's spot USDC and perp value", async () => {
    const api = hyperliquid((body) => {
      if (body.type === "userRole") return { role: "user" };
      if (body.type === "spotClearinghouseState") {
        return { balances: [{ coin: "HYPE", total: "3" }, { coin: "USDC", total: "12.5" }] };
      }
      return { marginSummary: { accountValue: "100.25" } };
    });
    expect(await fetchHyperliquidAccount(SAFE, api.fetchImpl)).toEqual({
      activated: true,
      spotUsdc: 12.5,
      perpValue: 100.25,
    });
  });

  it("lists the live named API wallets", async () => {
    const api = hyperliquid(() => [
      { name: "main", address: AGENT.toLowerCase(), validUntil: 1806856018911 },
      { name: "old", address: ethers.ZeroAddress, validUntil: 0 },
    ]);
    expect(await fetchApiWallets(SAFE, api.fetchImpl)).toEqual([
      { name: "main", address: AGENT, validUntil: 1806856018911 },
    ]);
    expect(api.requests[0].body).toEqual({ type: "extraAgents", user: SAFE });
  });

  it("names the account an API wallet acts for, and none for anything else", async () => {
    const owner = (role: unknown) => fetchApiWalletOwner(AGENT, hyperliquid(() => role).fetchImpl);
    expect(await owner({ role: "agent", data: { user: SAFE.toLowerCase() } })).toBe(SAFE);
    expect(await owner({ role: "missing" })).toBeNull();
    expect(await owner({ role: "user" })).toBeNull();
  });

  it("reads the referral, and whether it is RETHINK", async () => {
    const read = (answer: unknown) => fetchReferral(SAFE, hyperliquid(() => answer).fetchImpl);
    expect(await read({ referredBy: null })).toEqual({ code: null, isRethink: false });
    expect(await read({ referredBy: { referrer: STRANGER, code: RETHINK_HYPERLIQUID_REFERRAL_CODE } }))
      .toEqual({ code: "RETHINK", isRethink: true });
    expect(await read({ referredBy: { referrer: STRANGER, code: "OTHER" } }))
      .toEqual({ code: "OTHER", isRethink: false });
  });

  it("waits for a registration, or a removal, to show on Hyperliquid", async () => {
    const sequence = (...roles: unknown[]) => {
      let i = 0;
      return hyperliquid(() => roles[Math.min(i++, roles.length - 1)]).fetchImpl;
    };
    const agent = { role: "agent", data: { user: SAFE } };
    const missing = { role: "missing" };
    const fast = { intervalMs: 1, timeoutMs: 200 };

    expect(await waitForApiWallet(AGENT, SAFE, { ...fast, fetchImpl: sequence(missing, missing, agent) })).toBe(true);
    expect(await waitForApiWallet(AGENT, SAFE, { ...fast, listed: false, fetchImpl: sequence(agent, missing) })).toBe(true);
    expect(await waitForApiWallet(AGENT, SAFE, { intervalMs: 1, timeoutMs: 20, fetchImpl: sequence(missing) })).toBe(false);
  });
});

describe("the referral", () => {
  // Built independently (Python msgpack + `cast keccak`) and posted to the
  // live exchange from a throwaway key on 2026-10-22: it answered with that
  // key's own address, so it recovered the signer from this exact hash.
  it("hashes setReferrer the way the live exchange recovered a signer from", () => {
    expect(setReferrerAction("RETHINK")).toEqual({ type: "setReferrer", code: "RETHINK" });
    expect(l1ActionHash(setReferrerAction("RETHINK"), 1792687246681)).toBe(
      "0x7a78bedac237d4cc6200544460856e20e516770c00e115cd4c06f31bdf267d31",
    );
  });

  it("takes a private key with or without its 0x, and nothing else", () => {
    const wallet = ethers.Wallet.createRandom();
    expect(walletFromPrivateKey(wallet.privateKey).address).toBe(wallet.address);
    expect(walletFromPrivateKey(` ${wallet.privateKey.slice(2)} `).address).toBe(wallet.address);
    expect(() => walletFromPrivateKey(wallet.address)).toThrow(/not a private key/);
    expect(() => walletFromPrivateKey("0x" + "0".repeat(64))).toThrow(/not a private key/);
  });

  it("signs setReferrer RETHINK with the vault's API wallet and sends it", async () => {
    const apiWallet = ethers.Wallet.createRandom();
    const api = hyperliquid(() => ({ role: "agent", data: { user: SAFE } }));

    await setRethinkReferral(apiWallet.privateKey, SAFE, api.fetchImpl);

    const sent = api.requests.find((request) => request.url === HYPERLIQUID_EXCHANGE_URL)!;
    expect(sent.body.action).toEqual({ type: "setReferrer", code: "RETHINK" });
    expect(sent.body.vaultAddress).toBeNull();
    const signer = ethers.verifyTypedData(
      L1_ACTION_DOMAIN,
      L1_ACTION_TYPES,
      { source: "a", connectionId: l1ActionHash(sent.body.action, sent.body.nonce) },
      sent.body.signature,
    );
    expect(signer).toBe(apiWallet.address);
    // The key itself is never part of any request.
    expect(JSON.stringify(api.requests)).not.toContain(apiWallet.privateKey.slice(2));
  });

  it("refuses a key that is not an API wallet of this vault, before signing", async () => {
    const apiWallet = ethers.Wallet.createRandom();
    const notAnAgent = hyperliquid(() => ({ role: "missing" }));
    await expect(setRethinkReferral(apiWallet.privateKey, SAFE, notAnAgent.fetchImpl)).rejects.toThrow(
      /not an API wallet of this vault/,
    );
    const elsewhere = hyperliquid(() => ({ role: "agent", data: { user: STRANGER } }));
    await expect(setRethinkReferral(apiWallet.privateKey, SAFE, elsewhere.fetchImpl)).rejects.toThrow(
      /another account/,
    );
    for (const api of [notAnAgent, elsewhere]) {
      expect(api.requests.some((request) => request.url === HYPERLIQUID_EXCHANGE_URL)).toBe(false);
    }
  });

  it("passes on what the exchange refuses", async () => {
    const api = hyperliquid(
      () => ({ role: "agent", data: { user: SAFE } }),
      () => ({ status: "err", response: "Cannot set referrer" }),
    );
    await expect(
      setRethinkReferral(ethers.Wallet.createRandom().privateKey, SAFE, api.fetchImpl),
    ).rejects.toThrow("Hyperliquid refused the request: Cannot set referrer");
  });
});
