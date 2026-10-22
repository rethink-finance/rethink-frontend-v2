import { describe, expect, it, vi } from "vitest";
import {
  describeRailError,
  sendAndWait,
  useTransactionRail,
  type IRailStep,
} from "../useTransactionRail";

const states = (rail: ReturnType<typeof useTransactionRail>) =>
  rail.steps.value.map((step) => step.state);

describe("useTransactionRail", () => {
  it("runs the steps in order, each once the one before it is in", async () => {
    const rail = useTransactionRail();
    const order: string[] = [];
    const step = (label: string): IRailStep => ({
      label,
      run: (submitted) => {
        order.push(label);
        submitted();
        // The row waits on the chain once the wallet has let go of it.
        expect(rail.steps.value.find((row) => row.label === label)?.state).toBe(
          "confirming",
        );
        return Promise.resolve();
      },
    });
    rail.load([step("on"), step("send"), step("off")]);
    expect(states(rail)).toEqual(["waiting", "waiting", "waiting"]);

    expect(await rail.run()).toBe(true);
    expect(order).toEqual(["on", "send", "off"]);
    expect(states(rail)).toEqual(["done", "done", "done"]);
    expect(rail.isDone.value).toBe(true);
    expect(rail.isRunning.value).toBe(false);
  });

  it("stops at a failure and picks up there, never repeating a finished step", async () => {
    const rail = useTransactionRail();
    const first = vi.fn(() => Promise.resolve());
    let failures = 1;
    const second = vi.fn(() =>
      failures-- > 0
        ? Promise.reject(new Error("The transaction reverted."))
        : Promise.resolve(),
    );
    const third = vi.fn(() => Promise.resolve());
    rail.load([
      { label: "one", run: first },
      { label: "two", run: second },
      { label: "three", run: third },
    ]);

    expect(await rail.run()).toBe(false);
    expect(states(rail)).toEqual(["done", "failed", "waiting"]);
    expect(rail.error.value).toBe("The transaction reverted.");
    expect(rail.stepNumber.value).toBe(2);
    expect(third).not.toHaveBeenCalled();

    expect(await rail.run()).toBe(true);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);
    expect(third).toHaveBeenCalledOnce();
    expect(rail.error.value).toBe("");
  });

  it("will not run twice at once", async () => {
    const rail = useTransactionRail();
    let release!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    rail.load([{ label: "slow", run }]);

    const running = rail.run();
    expect(await rail.run()).toBe(false);
    release();
    expect(await running).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });

  it("says what the live step is waiting for", async () => {
    const rail = useTransactionRail();
    let release!: () => void;
    rail.load([
      {
        label: "switch",
        hint: { wallet: "Sign twice." },
        run: (submitted) =>
          new Promise<void>((resolve) => {
            release = () => {
              submitted();
              resolve();
            };
          }),
      },
      { label: "send", run: () => Promise.resolve() },
    ]);
    expect(rail.note.value).toBe("Confirm each step in your wallet as it opens.");

    const running = rail.run();
    expect(rail.note.value).toBe("Sign twice.");
    release();
    await running;
    expect(rail.isDone.value).toBe(true);
  });

  it("falls back to the plain wallet and chain notes", () => {
    const inWallet = useTransactionRail();
    inWallet.load([{ label: "send", run: () => new Promise<void>(() => {}) }]);
    expect(inWallet.note.value).toBe("Confirm in your wallet.");
    inWallet.run();
    expect(inWallet.note.value).toBe("Confirm in your wallet.");

    const onChain = useTransactionRail();
    onChain.load([
      {
        label: "send",
        run: (submitted) => {
          submitted();
          return new Promise<void>(() => {});
        },
      },
    ]);
    onChain.run();
    expect(onChain.note.value).toBe("Sent. Waiting for it to be confirmed.");
  });
});

describe("describeRailError", () => {
  it("names a refusal in the wallet as one", () => {
    expect(describeRailError({ code: 4001, message: "User rejected the request." })).toBe(
      "The request was rejected in the wallet.",
    );
    expect(describeRailError(new Error("Hyperliquid refused the request: x"))).toBe(
      "Hyperliquid refused the request: x",
    );
    expect(describeRailError(undefined)).toBe("The step failed.");
  });
});

describe("sendAndWait", () => {
  /** CustomContract.send's PromiEvent, settled the way `outcome` says. */
  const contractThat = (outcome: { receipt?: any; error?: Error }) => ({
    send: vi.fn(() => {
      const listeners: Record<string, (value: unknown) => void> = {};
      const settled = Promise.resolve().then(() => {
        listeners.transactionHash?.("0xhash");
        if (outcome.error) throw outcome.error;
        return outcome.receipt;
      });
      const promiEvent: any = {
        on(event: string, listener: (value: unknown) => void) {
          listeners[event] = listener;
          return promiEvent;
        },
        then: settled.then.bind(settled),
      };
      return promiEvent;
    }),
  });

  it("resolves with a successful receipt, after the hand-off", async () => {
    const contract = contractThat({ receipt: { status: 1n, blockNumber: 7n } });
    const submitted = vi.fn();
    const receipt = await sendAndWait(contract as any, "initCreateFund", { gas: 6_000_000 }, [1, 2], submitted);
    expect(receipt.blockNumber).toBe(7n);
    expect(submitted).toHaveBeenCalledOnce();
    expect(contract.send).toHaveBeenCalledWith("initCreateFund", { gas: 6_000_000 }, 1, 2);
  });

  it("rejects a reverted receipt and a failed send", async () => {
    await expect(
      sendAndWait(contractThat({ receipt: { status: 0n } }) as any, "m", {}, [], () => {}),
    ).rejects.toThrow("The transaction reverted.");
    await expect(
      sendAndWait(contractThat({ error: new Error("nope") }) as any, "m", {}, [], () => {}),
    ).rejects.toThrow("nope");
  });
});
