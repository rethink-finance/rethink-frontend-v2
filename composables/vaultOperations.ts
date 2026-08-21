/**
 * The operations a depositor can perform on a vault, keyed by the signature the
 * subgraph records them under.
 *
 * The subgraph stores names as full signatures — "requestDeposit(uint256)", not
 * "requestDeposit" — so these match on exactly those strings (verified against
 * the live deployments).
 *
 * Two distinctions matter and they are not the same one. **Family** is what a
 * reader sees: a pending deposit is still a deposit. **Settled** is what the
 * accounting sees: only a settled operation moves value, so counting a request
 * alongside the deposit it later becomes would book the same money twice.
 */
export type OperationFamily = "deposit" | "withdraw" | "other";

export interface VaultOperation {
  label: string;
  family: OperationFamily;
  /** Whether value actually moved, as opposed to an intent being recorded. */
  isSettled: boolean;
  /** Deposits are denominated in the base asset, redemptions in vault shares. */
  denomination: "base" | "shares";
  /** Cancels a standing request rather than completing it. */
  isRevoke?: boolean;
}

export const VAULT_OPERATIONS: Record<string, VaultOperation> = {
  "deposit()": {
    label: "Deposit",
    family: "deposit",
    isSettled: true,
    denomination: "base",
  },
  "depositAndDelegateBySig(uint256,address,bytes,uint256,uint8,bytes32,bytes32)":
    {
      label: "Deposit",
      family: "deposit",
      isSettled: true,
      denomination: "base",
    },
  "requestDeposit(uint256)": {
    label: "Request deposit",
    family: "deposit",
    isSettled: false,
    denomination: "base",
  },
  "withdraw()": {
    label: "Redeem",
    family: "withdraw",
    isSettled: true,
    denomination: "shares",
  },
  "requestWithdraw(uint256)": {
    label: "Request redemption",
    family: "withdraw",
    isSettled: false,
    denomination: "shares",
  },
  "revokeDepositWithrawal(bool)": {
    label: "Revoke request",
    family: "other",
    isSettled: false,
    denomination: "base",
    isRevoke: true,
  },
  "sweepTokens()": {
    label: "Sweep tokens",
    family: "other",
    isSettled: false,
    denomination: "base",
  },
};

export const resolveVaultOperation = (name: string): VaultOperation | undefined =>
  VAULT_OPERATIONS[name];

/**
 * The design's dot colours: money coming in, money going out, the vault
 * settling a cycle, and everything else.
 *
 * Keyed by what the operation *is*, not by whether it has settled yet. A
 * request and the deposit it becomes are the same colour, because the vault's
 * own activity table has always coloured them that way and the two tables sit
 * one click apart — the same event should not change colour on the way.
 */
export const OPERATION_DOT_DEPOSIT = "#2fd7ff";
export const OPERATION_DOT_REDEEM = "#e66a60";
export const OPERATION_DOT_SETTLEMENT = "#7b8dff";
export const OPERATION_DOT_NEUTRAL = "#8892a8";

/**
 * How the activity lists group an operation, as opposed to how the accounting
 * families it. The one difference is the revoke: it moves no money, so the
 * books file it under "other", but a reader looking at a list wants it with the
 * redemptions — which is where the vault's own table has always put it.
 */
export const operationGroup = (operation?: VaultOperation): OperationFamily => {
  if (!operation) return "other";
  return operation.isRevoke ? "withdraw" : operation.family;
};

export const operationDot = (operation?: VaultOperation): string => {
  const group = operationGroup(operation);
  if (group === "withdraw") return OPERATION_DOT_REDEEM;
  return group === "deposit" ? OPERATION_DOT_DEPOSIT : OPERATION_DOT_NEUTRAL;
};

// ---- Pairing a settlement with the request it settles -----------------------

export interface SettleableFlow {
  name: string;
  amount: bigint | null;
  timestamp: number;
  /** The bool a revoke was called with. */
  flag?: boolean | null;
}

/**
 * Fills in the amount a settled operation moved.
 *
 * The subgraph records an amount on the *request* and none at all on the
 * settlement that completes it — verified against the live mainnet and Base
 * deployments, where every `deposit()` and `withdraw()` carries a null amount
 * and every `request*` carries a real one. So a settlement is only as
 * meaningful as the request standing when it happened, and the two have to be
 * paired to say what actually moved.
 *
 * The vault holds one request per wallet per direction, so a second request
 * overwrites the first rather than queueing behind it — five identical requests
 * in one block are one deposit, not five.
 *
 * `keyOf` separates the books: requests do not carry across vaults, and on the
 * portfolio the same wallet has several in flight at once.
 */
export const resolveSettledAmounts = <T extends SettleableFlow>(
  flows: T[],
  keyOf: (flow: T) => string,
): Array<T & { resolvedAmount: bigint | null }> => {
  // Pending requests, keyed by vault and direction.
  const pending = new Map<string, bigint>();
  const slotOf = (flow: T, family: OperationFamily) =>
    `${keyOf(flow)}:${family}`;

  return [...flows]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((flow) => {
      const operation = resolveVaultOperation(flow.name);
      if (!operation) return { ...flow, resolvedAmount: flow.amount };

      if (operation.isRevoke) {
        // The bool names the direction being cancelled. True went with a
        // cancelled deposit in the one live example, so that is the reading
        // taken; with no flag at all, both books are cleared, since a revoke
        // means nothing settled from either.
        if (flow.flag === true || flow.flag == null) {
          pending.delete(slotOf(flow, "deposit"));
        }
        if (flow.flag === false || flow.flag == null) {
          pending.delete(slotOf(flow, "withdraw"));
        }
        return { ...flow, resolvedAmount: null };
      }

      if (operation.family === "other") {
        return { ...flow, resolvedAmount: flow.amount };
      }

      const slot = slotOf(flow, operation.family);

      if (!operation.isSettled) {
        if (flow.amount != null) pending.set(slot, flow.amount);
        return { ...flow, resolvedAmount: flow.amount };
      }

      // A settlement with no request behind it is one whose request predates
      // the history we hold; it stays null rather than borrowing someone
      // else's figure.
      const resolvedAmount = pending.get(slot) ?? null;
      pending.delete(slot);
      return { ...flow, resolvedAmount };
    });
};

// ---- Replaying flows into the standing request queue ------------------------

/** One depositor's outstanding request, reconstructed from the flow feeds. */
export interface OpenRequest {
  /** Lowercased depositor address. */
  depositor: string;
  kind: "deposit" | "redemption";
  /** Raw units — base token for deposits, vault shares for redemptions. */
  amount: bigint;
  /** Unix seconds of the request transaction. */
  timestamp: number;
  txHash?: string;
}

/** The slice of a flow the replay reads, common to both feeds. */
export interface QueueFlow extends SettleableFlow {
  amount: bigint | null;
  from?: string;
  txHash?: string;
}

/**
 * Replay a vault's flows oldest-first into the set of requests still open.
 *
 * The contracts only expose the two pending totals — there is no on-chain
 * enumeration of who is waiting with what — but every request, process and
 * revoke is a transaction to the vault, so its flow history replays into the
 * current queue: a depositor's request stays open until a later flow of
 * theirs closes it.
 *
 * The lifecycle mirrors resolveSettledAmounts above: a repeated request
 * overwrites the previous one per depositor and side (the vault holds one), a
 * settled operation or a revoke closes the side it names, and a revoke whose
 * argument neither feed decoded clears both sides rather than leaving open a
 * request the depositor cancelled.
 */
export const reconstructOpenRequests = (
  flows: QueueFlow[],
): OpenRequest[] => {
  const deposits = new Map<string, OpenRequest>();
  const redemptions = new Map<string, OpenRequest>();

  const sorted = [...flows].sort((a, b) => a.timestamp - b.timestamp);
  for (const flow of sorted) {
    const depositor = flow.from?.toLowerCase();
    const operation = resolveVaultOperation(flow.name);
    if (!depositor || !operation) continue;

    if (operation.isRevoke) {
      // Same reading as above: true went with a cancelled deposit.
      if (flow.flag !== false) deposits.delete(depositor);
      if (flow.flag !== true) redemptions.delete(depositor);
      continue;
    }
    if (operation.family === "other") continue;

    const book = operation.family === "deposit" ? deposits : redemptions;
    if (operation.isSettled) {
      book.delete(depositor);
    } else {
      book.set(depositor, {
        depositor,
        kind: operation.family === "deposit" ? "deposit" : "redemption",
        amount: flow.amount ?? 0n,
        timestamp: flow.timestamp,
        txHash: flow.txHash,
      });
    }
  }

  return [...deposits.values(), ...redemptions.values()];
};
