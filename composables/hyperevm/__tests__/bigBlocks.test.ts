import { ethers } from "ethers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HYPERLIQUID_EXCHANGE_URL,
  describeExchangeError,
  exceedsStandardBlock,
  planBigBlocks,
  switchBigBlocks,
  withBigBlockSwitch,
} from "../bigBlocks";
import {
  APPROVE_AGENT_FIELDS,
  APPROVE_AGENT_PRIMARY_TYPE,
  L1_ACTION_DOMAIN,
  L1_ACTION_TYPES,
  l1ActionHash,
  userSignedDomain,
} from "../hyperCoreSigning";
import { ChainId } from "~/types/enums/chain_id";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

/** A wallet on HyperEVM behind an EIP-1193 façade, recording what it is asked. */
const providerFor = (
  wallet: ethers.BaseWallet,
  options: { declineSignature?: number } = {},
) => {
  const calls: string[] = [];
  let signatures = 0;
  return {
    calls,
    request({ method, params }: { method: string; params?: any[] }): Promise<any> {
      calls.push(method);
      if (method === "eth_chainId") return Promise.resolve("0x3e7");
      if (method === "eth_signTypedData_v4") {
        signatures++;
        if (signatures === options.declineSignature) {
          return Promise.reject(
            Object.assign(new Error("User rejected the request."), { code: 4001 }),
          );
        }
        const payload = JSON.parse(params![1]);
        return wallet.signTypedData(
          payload.domain,
          { [payload.primaryType]: payload.types[payload.primaryType] },
          payload.message,
        );
      }
      return Promise.reject(new Error(`unexpected ${method}`));
    },
  };
};

/**
 * Hyperliquid's exchange and HyperEVM's RPC behind fetch. The exchange
 * records every request and answers "ok" unless `refuse` names a reason;
 * eth_usingBigBlocks reports what the last accepted evmUserModify set, once
 * `lagPolls` polls have passed since it.
 */
const fakeNetwork = (
  options: {
    usingBigBlocks?: boolean;
    code?: string;
    statusDown?: boolean;
    lagPolls?: number;
    refuse?: (action: any) => string | undefined;
  } = {},
) => {
  let usingBigBlocks = options.usingBigBlocks ?? false;
  let pending: boolean | undefined;
  let lag = 0;
  const posted: any[] = [];

  const respond = (url: string, init: RequestInit): Response => {
    const body = JSON.parse(String(init.body));
    if (url === HYPERLIQUID_EXCHANGE_URL) {
      posted.push(body);
      const refusal = options.refuse?.(body.action);
      if (refusal) return jsonResponse({ status: "err", response: refusal });
      if (body.action.type === "evmUserModify") {
        pending = body.action.usingBigBlocks;
        lag = options.lagPolls ?? 0;
      }
      return jsonResponse({ status: "ok", response: { type: "default" } });
    }
    if (options.statusDown) throw new Error("RPC down");
    if (body.method === "eth_usingBigBlocks") {
      if (pending !== undefined && lag-- <= 0) {
        usingBigBlocks = pending;
        pending = undefined;
      }
      return jsonResponse({ jsonrpc: "2.0", id: 1, result: usingBigBlocks });
    }
    if (body.method === "eth_getCode") {
      return jsonResponse({ jsonrpc: "2.0", id: 1, result: options.code ?? "0x" });
    }
    throw new Error(`unexpected ${body.method}`);
  };
  // A throw in `respond` arrives as a rejected fetch, the way a network
  // failure does.
  const fetchImpl = (url: string, init: RequestInit) =>
    Promise.resolve().then(() => respond(url, init));

  return {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    posted,
    get usingBigBlocks() {
      return usingBigBlocks;
    },
  };
};

/** localStorage, for the record of who the app switched on. */
const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
};

const approveSigner = (request: any) =>
  ethers.verifyTypedData(
    userSignedDomain(999),
    { [APPROVE_AGENT_PRIMARY_TYPE]: APPROVE_AGENT_FIELDS },
    Object.fromEntries(APPROVE_AGENT_FIELDS.map(({ name }) => [name, request.action[name]])),
    request.signature,
  );

const l1Signer = (request: any) =>
  ethers.verifyTypedData(
    L1_ACTION_DOMAIN,
    L1_ACTION_TYPES,
    { source: "a", connectionId: l1ActionHash(request.action, request.nonce) },
    request.signature,
  );

const fast = { confirmTimeoutMs: 50, pollIntervalMs: 1 };

let wallet: ethers.HDNodeWallet;

beforeEach(() => {
  wallet = ethers.Wallet.createRandom();
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("switchBigBlocks", () => {
  it("approves a throwaway agent, switches with it, then removes it", async () => {
    const network = fakeNetwork();
    const provider = providerFor(wallet);
    const onSigned = vi.fn();

    const result = await switchBigBlocks({
      provider,
      address: wallet.address,
      usingBigBlocks: true,
      onSigned,
      fetchImpl: network.fetchImpl,
      ...fast,
    });

    expect(result).toEqual({ agentRemoved: true });
    expect(network.usingBigBlocks).toBe(true);
    expect(onSigned).toHaveBeenCalledOnce();
    expect(provider.calls).toEqual([
      "eth_chainId",
      "eth_signTypedData_v4",
      "eth_signTypedData_v4",
    ]);

    const [approve, modify, remove] = network.posted;
    expect(network.posted).toHaveLength(3);

    // 1. The wallet approves the agent, under a name of its own.
    expect(approve.action).toMatchObject({
      type: "approveAgent",
      signatureChainId: "0x3e7",
      hyperliquidChain: "Mainnet",
    });
    expect(approve.action.agentName).toMatch(/^rethink-[0-9a-f]{6}$/);
    expect(approve.nonce).toBe(approve.action.nonce);
    expect(approve.vaultAddress).toBeNull();
    expect(approveSigner(approve)).toBe(wallet.address);

    // 2. The agent, and only the agent, signs the switch.
    expect(modify.action).toEqual({ type: "evmUserModify", usingBigBlocks: true });
    expect(l1Signer(modify)).toBe(approve.action.agentAddress);
    expect(modify.nonce).toBeGreaterThan(approve.nonce);

    // 3. The wallet empties the agent's slot again.
    expect(remove.action).toMatchObject({
      type: "approveAgent",
      agentAddress: ethers.ZeroAddress,
      agentName: approve.action.agentName,
    });
    expect(remove.nonce).toBeGreaterThan(modify.nonce);
    expect(approveSigner(remove)).toBe(wallet.address);
  });

  it("uses a fresh agent every time", async () => {
    const network = fakeNetwork();
    const provider = providerFor(wallet);
    const options = { provider, address: wallet.address, fetchImpl: network.fetchImpl, ...fast };

    await switchBigBlocks({ ...options, usingBigBlocks: true });
    await switchBigBlocks({ ...options, usingBigBlocks: false });

    expect(network.usingBigBlocks).toBe(false);
    const agents = network.posted
      .filter((request) => request.action.type === "approveAgent")
      .map((request) => request.action.agentAddress)
      .filter((agent) => agent !== ethers.ZeroAddress);
    expect(new Set(agents).size).toBe(2);
  });

  it("signs nothing when the wallet is on that block size already", async () => {
    const network = fakeNetwork({ usingBigBlocks: true });
    const provider = providerFor(wallet);
    const onSigned = vi.fn();

    await switchBigBlocks({
      provider,
      address: wallet.address,
      usingBigBlocks: true,
      onSigned,
      fetchImpl: network.fetchImpl,
      ...fast,
    });

    expect(provider.calls).toEqual([]);
    expect(network.posted).toEqual([]);
    expect(onSigned).toHaveBeenCalledOnce();
  });

  it("explains an account Hyperliquid has never seen a deposit from", async () => {
    const network = fakeNetwork({
      refuse: (action) =>
        action.type === "approveAgent"
          ? `Must deposit before performing actions. User: ${wallet.address.toLowerCase()}`
          : undefined,
    });

    await expect(
      switchBigBlocks({
        provider: providerFor(wallet),
        address: wallet.address,
        usingBigBlocks: true,
        fetchImpl: network.fetchImpl,
        ...fast,
      }),
    ).rejects.toThrow(/deposited on Hyperliquid before/);
    // Refused at the first step: no switch, nothing to remove.
    expect(network.posted).toHaveLength(1);
    expect(network.usingBigBlocks).toBe(false);
  });

  it("still removes the agent when the switch itself is refused", async () => {
    const network = fakeNetwork({
      refuse: (action) => (action.type === "evmUserModify" ? "Something odd" : undefined),
    });

    await expect(
      switchBigBlocks({
        provider: providerFor(wallet),
        address: wallet.address,
        usingBigBlocks: true,
        fetchImpl: network.fetchImpl,
        ...fast,
      }),
    ).rejects.toThrow("Hyperliquid refused the request: Something odd");
    expect(network.posted.map((request) => request.action.agentAddress ?? request.action.type))
      .toEqual([expect.any(String), "evmUserModify", ethers.ZeroAddress]);
  });

  it("counts the switch as done when only the removal is declined", async () => {
    const network = fakeNetwork();
    const result = await switchBigBlocks({
      provider: providerFor(wallet, { declineSignature: 2 }),
      address: wallet.address,
      usingBigBlocks: true,
      fetchImpl: network.fetchImpl,
      ...fast,
    });

    expect(result).toEqual({ agentRemoved: false });
    expect(network.usingBigBlocks).toBe(true);
  });

  it("waits for HyperEVM to report the switch before resolving", async () => {
    const network = fakeNetwork({ lagPolls: 3 });
    await switchBigBlocks({
      provider: providerFor(wallet),
      address: wallet.address,
      usingBigBlocks: true,
      fetchImpl: network.fetchImpl,
      confirmTimeoutMs: 1_000,
      pollIntervalMs: 1,
    });
    expect(network.usingBigBlocks).toBe(true);
  });

  it("says so when HyperEVM never reports the switch", async () => {
    const network = fakeNetwork({ lagPolls: 1_000_000 });
    await expect(
      switchBigBlocks({
        provider: providerFor(wallet),
        address: wallet.address,
        usingBigBlocks: true,
        fetchImpl: network.fetchImpl,
        confirmTimeoutMs: 20,
        pollIntervalMs: 1,
      }),
    ).rejects.toThrow(/still has this wallet on standard blocks/);
  });
});

describe("planBigBlocks", () => {
  const plan = (network: ReturnType<typeof fakeNetwork>, needs = true, chainId = ChainId.HYPEREVM) =>
    planBigBlocks(chainId, wallet.address, needs, network.fetchImpl);

  it("does nothing off HyperEVM, or when everything fits a standard block", async () => {
    expect(await plan(fakeNetwork(), true, ChainId.ARBITRUM)).toBe("none");
    expect(await plan(fakeNetwork(), false)).toBe("none");
    expect(await planBigBlocks(ChainId.HYPEREVM, undefined, true)).toBe("none");
  });

  it("switches a wallet on standard blocks", async () => {
    expect(await plan(fakeNetwork())).toBe("switch");
  });

  it("leaves alone a wallet that chose big blocks itself", async () => {
    expect(await plan(fakeNetwork({ usingBigBlocks: true }))).toBe("already-on");
  });

  it("still switches back a wallet the app left on big blocks", async () => {
    const network = fakeNetwork();
    // A rail that switched on and was closed before switching back.
    await switchBigBlocks({
      provider: providerFor(wallet),
      address: wallet.address,
      usingBigBlocks: true,
      fetchImpl: network.fetchImpl,
      ...fast,
    });
    expect(await plan(network)).toBe("switch");

    await switchBigBlocks({
      provider: providerFor(wallet),
      address: wallet.address,
      usingBigBlocks: false,
      fetchImpl: network.fetchImpl,
      ...fast,
    });
    expect(await plan(fakeNetwork({ usingBigBlocks: true }))).toBe("already-on");
  });

  it("cannot switch a contract, but can an EIP-7702 account", async () => {
    expect(await plan(fakeNetwork({ code: "0x6080604052" }))).toBe("contract");
    expect(
      await plan(fakeNetwork({ code: "0xef0100" + "11".repeat(20) })),
    ).toBe("switch");
  });

  it("switches when no RPC can say: turning on what is on is harmless", async () => {
    expect(await plan(fakeNetwork({ statusDown: true }))).toBe("switch");
  });
});

describe("withBigBlockSwitch", () => {
  it("puts the transactions between a switch on and a switch back", async () => {
    const network = fakeNetwork();
    vi.stubGlobal("fetch", network.fetchImpl);
    const sent = vi.fn((submitted: () => void) => {
      expect(network.usingBigBlocks).toBe(true);
      submitted();
      return Promise.resolve();
    });

    const steps = withBigBlockSwitch(
      [{ label: "Initialize the vault", run: sent }],
      providerFor(wallet),
      wallet.address,
      () => {},
    );
    expect(steps.map(({ label }) => label)).toEqual([
      "Turn on big blocks for your wallet",
      "Initialize the vault",
      "Turn big blocks off again",
    ]);
    expect(steps[1].hint?.confirming).toMatch(/about once a minute/);

    for (const step of steps) await step.run(() => {});
    expect(sent).toHaveBeenCalledOnce();
    expect(network.usingBigBlocks).toBe(false);
  });

  it("says what a failed switch back leaves behind", async () => {
    const network = fakeNetwork({
      refuse: (action) =>
        action.type === "evmUserModify" && !action.usingBigBlocks ? "Try later" : undefined,
    });
    vi.stubGlobal("fetch", network.fetchImpl);
    const steps = withBigBlockSwitch([], providerFor(wallet), wallet.address, () => {});

    await steps[0].run(() => {});
    await expect(steps[1].run(() => {})).rejects.toThrow(
      /Try later\. Until big blocks are off, every HyperEVM transaction/,
    );
  });
});

describe("exceedsStandardBlock", () => {
  it("compares with the share of a block one transaction may take", () => {
    expect(exceedsStandardBlock(6_000_000, 3_000_000)).toBe(true);
    expect(exceedsStandardBlock(2_850_000, 3_000_000)).toBe(false);
    expect(exceedsStandardBlock(2_850_001, 3_000_000)).toBe(true);
    expect(exceedsStandardBlock(6_000_000, 30_000_000)).toBe(false);
    // Unknown block limit: HyperEVM's standard 3M.
    expect(exceedsStandardBlock(6_000_000, undefined)).toBe(true);
  });
});

describe("describeExchangeError", () => {
  it("turns the exchange's refusals into something to act on", () => {
    expect(
      describeExchangeError({
        status: "err",
        response: "Must deposit before performing actions. User: 0xabc",
      }),
    ).toMatch(/^Hyperliquid only accepts this from a wallet that has deposited/);
    expect(describeExchangeError({ status: "err", response: "Bad nonce" })).toBe(
      "Hyperliquid refused the request: Bad nonce",
    );
    expect(describeExchangeError("Failed to parse the request body as JSON")).toBe(
      "Hyperliquid refused the request: Failed to parse the request body as JSON",
    );
    expect(describeExchangeError(undefined)).toBe("Hyperliquid did not answer the request.");
  });
});
