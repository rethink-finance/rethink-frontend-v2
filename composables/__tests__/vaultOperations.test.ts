import { describe, expect, it } from "vitest";
import {
  OPERATION_DOT_NEUTRAL,
  operationDot,
  operationGroup,
  reconstructOpenRequests,
  resolveSettledAmounts,
  resolveVaultOperation,
} from "../vaultOperations";

const flow = (
  name: string,
  timestamp: number,
  amount: bigint | null = null,
  extra: { vault?: string; flag?: boolean | null } = {},
) => ({ name, timestamp, amount, vault: extra.vault ?? "a", flag: extra.flag });

const resolve = (flows: ReturnType<typeof flow>[]) =>
  resolveSettledAmounts(flows, (f) => f.vault);

const amounts = (flows: ReturnType<typeof flow>[]) =>
  resolve(flows).map((f) => [f.name, f.resolvedAmount] as const);

describe("resolveSettledAmounts", () => {
  it("gives a settlement the amount of the request it completes", () => {
    // The live subgraphs record no amount on deposit() at all — the figure is
    // only ever on the request.
    expect(
      amounts([
        flow("requestDeposit(uint256)", 100, 32_000n),
        flow("deposit()", 200),
      ]),
    ).toEqual([
      ["requestDeposit(uint256)", 32_000n],
      ["deposit()", 32_000n],
    ]);
  });

  it("reads flows in time order however they arrive", () => {
    // The subgraph returns newest first.
    expect(
      amounts([
        flow("deposit()", 200),
        flow("requestDeposit(uint256)", 100, 32_000n),
      ]),
    ).toEqual([
      ["requestDeposit(uint256)", 32_000n],
      ["deposit()", 32_000n],
    ]);
  });

  it("lets a second request overwrite the first rather than queue behind it", () => {
    // Five identical requests in one block are one deposit, not five: the
    // vault holds a single request per wallet per direction.
    const resolved = amounts([
      flow("requestDeposit(uint256)", 100, 20_000n),
      flow("requestDeposit(uint256)", 100, 20_000n),
      flow("requestDeposit(uint256)", 100, 20_000n),
      flow("deposit()", 200),
    ]);

    expect(resolved.at(-1)).toEqual(["deposit()", 20_000n]);
  });

  it("keeps the deposit and redemption books apart", () => {
    expect(
      amounts([
        flow("requestDeposit(uint256)", 100, 500n),
        flow("requestWithdraw(uint256)", 110, 7n),
        flow("withdraw()", 120),
        flow("deposit()", 130),
      ]),
    ).toEqual([
      ["requestDeposit(uint256)", 500n],
      ["requestWithdraw(uint256)", 7n],
      ["withdraw()", 7n],
      ["deposit()", 500n],
    ]);
  });

  it("keeps each vault's book separate", () => {
    const resolved = resolve([
      flow("requestDeposit(uint256)", 100, 500n, { vault: "a" }),
      flow("requestDeposit(uint256)", 110, 900n, { vault: "b" }),
      flow("deposit()", 120, null, { vault: "b" }),
      flow("deposit()", 130, null, { vault: "a" }),
    ]);

    expect(resolved.map((f) => [f.vault, f.resolvedAmount])).toEqual([
      ["a", 500n],
      ["b", 900n],
      ["b", 900n],
      ["a", 500n],
    ]);
  });

  it("drops a revoked request so it is never booked", () => {
    // Observed live: a request, a revoke carrying flag true, then a fresh
    // request that is the one actually settled.
    expect(
      amounts([
        flow("requestDeposit(uint256)", 100, 10_000n),
        flow("revokeDepositWithrawal(bool)", 110, null, { flag: true }),
        flow("requestDeposit(uint256)", 120, 14_500n),
        flow("deposit()", 130),
      ]),
    ).toEqual([
      ["requestDeposit(uint256)", 10_000n],
      ["revokeDepositWithrawal(bool)", null],
      ["requestDeposit(uint256)", 14_500n],
      ["deposit()", 14_500n],
    ]);
  });

  it("leaves the other direction alone when a revoke names one", () => {
    expect(
      amounts([
        flow("requestDeposit(uint256)", 100, 500n),
        flow("requestWithdraw(uint256)", 110, 7n),
        flow("revokeDepositWithrawal(bool)", 120, null, { flag: true }),
        flow("withdraw()", 130),
        flow("deposit()", 140),
      ]).slice(-2),
    ).toEqual([
      // The redemption request survived the deposit revoke.
      ["withdraw()", 7n],
      // The deposit request did not.
      ["deposit()", null],
    ]);
  });

  it("clears both books for a revoke that names neither", () => {
    expect(
      amounts([
        flow("requestDeposit(uint256)", 100, 500n),
        flow("requestWithdraw(uint256)", 110, 7n),
        flow("revokeDepositWithrawal(bool)", 120, null, { flag: null }),
        flow("withdraw()", 130),
        flow("deposit()", 140),
      ]).slice(-2),
    ).toEqual([
      ["withdraw()", null],
      ["deposit()", null],
    ]);
  });

  it("does not let one request settle twice", () => {
    expect(
      amounts([
        flow("requestDeposit(uint256)", 100, 500n),
        flow("deposit()", 110),
        flow("deposit()", 120),
      ]),
    ).toEqual([
      ["requestDeposit(uint256)", 500n],
      ["deposit()", 500n],
      // Nothing was standing for the second one.
      ["deposit()", null],
    ]);
  });

  it("leaves a settlement whose request predates the history at null", () => {
    // Rather than borrowing a figure from somewhere else.
    expect(amounts([flow("deposit()", 100)])).toEqual([["deposit()", null]]);
  });

  it("passes through an operation it does not recognise", () => {
    expect(amounts([flow("somethingNew(uint256)", 100, 42n)])).toEqual([
      ["somethingNew(uint256)", 42n],
    ]);
  });
});

describe("reconstructOpenRequests", () => {
  const queueFlow = (
    name: string,
    timestamp: number,
    from: string,
    amount: bigint | null = null,
    flag: boolean | null = null,
  ) => ({ name, timestamp, from, amount, flag, txHash: `0x${timestamp}` });

  const open = (flows: ReturnType<typeof queueFlow>[]) =>
    reconstructOpenRequests(flows).map((request) => [
      request.depositor,
      request.kind,
      request.amount,
    ]);

  it("keeps a request open until a later flow closes it", () => {
    expect(
      open([queueFlow("requestDeposit(uint256)", 100, "0xA", 500n)]),
    ).toEqual([["0xa", "deposit", 500n]]);
  });

  it("closes a request the depositor processed", () => {
    expect(
      open([
        queueFlow("requestDeposit(uint256)", 100, "0xA", 500n),
        queueFlow("deposit()", 200, "0xA"),
      ]),
    ).toEqual([]);
  });

  it("replays in time order however the feed ordered them", () => {
    // The subgraph returns newest first.
    expect(
      open([
        queueFlow("deposit()", 200, "0xA"),
        queueFlow("requestDeposit(uint256)", 100, "0xA", 500n),
      ]),
    ).toEqual([]);
  });

  it("lets a second request overwrite the first", () => {
    expect(
      open([
        queueFlow("requestDeposit(uint256)", 100, "0xA", 500n),
        queueFlow("requestDeposit(uint256)", 200, "0xA", 900n),
      ]),
    ).toEqual([["0xa", "deposit", 900n]]);
  });

  it("keeps each depositor's requests apart", () => {
    expect(
      open([
        queueFlow("requestDeposit(uint256)", 100, "0xA", 500n),
        queueFlow("requestDeposit(uint256)", 110, "0xB", 900n),
        queueFlow("deposit()", 200, "0xA"),
      ]),
    ).toEqual([["0xb", "deposit", 900n]]);
  });

  it("keeps the deposit and redemption sides apart", () => {
    expect(
      open([
        queueFlow("requestDeposit(uint256)", 100, "0xA", 500n),
        queueFlow("requestWithdraw(uint256)", 110, "0xA", 7n),
        queueFlow("withdraw()", 200, "0xA"),
      ]),
    ).toEqual([["0xa", "deposit", 500n]]);
  });

  it("clears only the side a revoke names", () => {
    expect(
      open([
        queueFlow("requestDeposit(uint256)", 100, "0xA", 500n),
        queueFlow("requestWithdraw(uint256)", 110, "0xA", 7n),
        queueFlow("revokeDepositWithrawal(bool)", 120, "0xA", null, true),
      ]),
    ).toEqual([["0xa", "redemption", 7n]]);
  });

  it("clears both sides for a revoke that names neither", () => {
    expect(
      open([
        queueFlow("requestDeposit(uint256)", 100, "0xA", 500n),
        queueFlow("requestWithdraw(uint256)", 110, "0xA", 7n),
        queueFlow("revokeDepositWithrawal(bool)", 120, "0xA", null, null),
      ]),
    ).toEqual([]);
  });
});

describe("operationDot", () => {
  const dotOf = (name: string) => operationDot(resolveVaultOperation(name));

  it("colours a request the same as the operation it becomes", () => {
    // The vault's activity table and the portfolio's sit one click apart; an
    // event that changed colour between them would read as a different event.
    expect(dotOf("requestDeposit(uint256)")).toBe(dotOf("deposit()"));
    expect(dotOf("requestWithdraw(uint256)")).toBe(dotOf("withdraw()"));
  });

  it("keeps deposits and redemptions apart", () => {
    expect(dotOf("deposit()")).not.toBe(dotOf("withdraw()"));
  });

  it("files a revoke with the redemptions", () => {
    // It moves no money, so the accounting calls it "other" — but a reader
    // looking at a list expects it beside the request it cancelled.
    expect(operationGroup(resolveVaultOperation("revokeDepositWithrawal(bool)")))
      .toBe("withdraw");
    expect(dotOf("revokeDepositWithrawal(bool)")).toBe(dotOf("withdraw()"));
  });

  it("gives an unknown operation the neutral dot", () => {
    expect(operationDot(undefined)).toBe(OPERATION_DOT_NEUTRAL);
    expect(dotOf("sweepTokens()")).toBe(OPERATION_DOT_NEUTRAL);
  });
});
