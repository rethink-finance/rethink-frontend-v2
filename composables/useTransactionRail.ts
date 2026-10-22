import { computed, ref } from "vue";
import type {
  ITransactionStep,
  TransactionStepState,
} from "~/components/onboarding/TransactionSteps.vue";
import { isUserRejectedRequest } from "~/composables/safe/safeTransactionService";
import type { CustomContract } from "~/store/web3/customContract";

/**
 * A run of wallet steps shown as one rail (OnboardingTransactionSteps,
 * usually inside OnboardingTransactionRailDialog): each step starts only
 * once the one before it is in, and a retry picks up at the first step that
 * is not done, so nothing that went through is sent twice. NavMethods.vue
 * runs the same loop inline for its own two transactions.
 */

type LiveState = Extract<TransactionStepState, "wallet" | "confirming">;

/** One row of the rail and the work behind it. */
export interface IRailStep {
  label: string;
  /**
   * The step's work. Call `submitted` once the wallet has let go of it — the
   * transaction is sent, the signatures are given — so the row stops asking
   * for the wallet and shows it waiting on the chain instead.
   */
  run: (submitted: () => void) => Promise<void>;
  /** What the dialog says while this step is the live one. */
  hint?: Partial<Record<LiveState, string>>;
}

const DEFAULT_HINTS: Record<LiveState, string> = {
  wallet: "Confirm in your wallet.",
  confirming: "Sent. Waiting for it to be confirmed.",
};

/** What went wrong, in a line a person can act on. */
export const describeRailError = (error: any): string => {
  if (isUserRejectedRequest(error)) return "The request was rejected in the wallet.";
  return String(error?.message ?? error ?? "") || "The step failed.";
};

/**
 * A contract write as a promise: resolves with the receipt of a successful
 * transaction, and rejects when the wallet refuses, the send fails or the
 * call reverts. `onSubmitted` fires once the wallet has handed it over.
 */
export const sendAndWait = (
  contract: CustomContract,
  method: string,
  options: Record<string, unknown>,
  args: unknown[],
  onSubmitted: () => void,
): Promise<any> =>
  new Promise((resolve, reject) => {
    contract
      .send(method, options, ...args)
      .on("transactionHash", (hash: unknown) => {
        console.log("tx hash: " + hash);
        onSubmitted();
      })
      .then((receipt: any) => {
        if (receipt?.status) resolve(receipt);
        else reject(new Error("The transaction reverted."));
      }, reject);
  });

export const useTransactionRail = () => {
  const steps = ref<ITransactionStep[]>([]);
  const error = ref("");
  const isRunning = ref(false);
  // Not reactive: replaced only together with `steps`, which is.
  let railSteps: IRailStep[] = [];

  const setState = (index: number, state: TransactionStepState) => {
    steps.value = steps.value.map((step, i) =>
      i === index ? { ...step, state } : step,
    );
  };

  /** Lays the rail out, every row waiting. */
  const load = (next: IRailStep[]) => {
    railSteps = next;
    steps.value = next.map(({ label }) => ({ label, state: "waiting" as const }));
    error.value = "";
  };

  /**
   * Runs the steps in order from the first that is not done. Resolves true
   * once every step is done, false when one fails (its row says so and
   * `error` says why).
   */
  const run = async (): Promise<boolean> => {
    if (isRunning.value) return false;
    isRunning.value = true;
    error.value = "";
    try {
      for (let index = 0; index < railSteps.length; index++) {
        if (steps.value[index].state === "done") continue;
        setState(index, "wallet");
        try {
          await railSteps[index].run(() => setState(index, "confirming"));
          setState(index, "done");
        } catch (failure) {
          console.error(`Failed: ${railSteps[index].label}`, failure);
          setState(index, "failed");
          error.value = describeRailError(failure);
          return false;
        }
      }
      return true;
    } finally {
      isRunning.value = false;
    }
  };

  const isDone = computed(
    () => steps.value.length > 0 && steps.value.every((step) => step.state === "done"),
  );

  /** The step the rail is on: the first one that is not done, or the last. */
  const stepNumber = computed(() => {
    const index = steps.value.findIndex((step) => step.state !== "done");
    return index === -1 ? steps.value.length : index + 1;
  });

  /** The live step's hint, or what to expect before anything is live. */
  const note = computed(() => {
    const live = steps.value.findIndex(
      (step) => step.state === "wallet" || step.state === "confirming",
    );
    if (live === -1) {
      return steps.value.length > 1
        ? "Confirm each step in your wallet as it opens."
        : DEFAULT_HINTS.wallet;
    }
    const state = steps.value[live].state as LiveState;
    return railSteps[live]?.hint?.[state] ?? DEFAULT_HINTS[state];
  });

  return { steps, error, isRunning, isDone, stepNumber, note, load, run };
};
