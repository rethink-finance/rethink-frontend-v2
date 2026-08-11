/**
 * Whether the four-step deposit dialog is open, held outside the cards that
 * show it.
 *
 * The vault page renders one of two cards in its rail: "Manage deposits"
 * while the depositor has no pending request, and "Pending requests" once
 * they do. Step 1 of the deposit flow *creates* that request — so the moment
 * it succeeds the page swaps the card, unmounting whichever one opened the
 * dialog. A flag owned by either card is therefore destroyed by its own
 * success, and the depositor is dropped out of the flow at step 2 with three
 * steps still to sign.
 *
 * Both cards render the dialog, so all that is needed is for them to agree on
 * whether it is open. The state is keyed by vault address rather than being a
 * bare boolean: an open dialog belongs to the vault it was opened on, and must
 * not follow the reader to a different one.
 */
const flagForVault = (
  key: string,
  fundAddress: () => string | undefined,
) => {
  const setFor = useState<string | null>(key, () => null);

  return computed<boolean>({
    get: () => {
      const address = fundAddress();
      if (!address || !setFor.value) return false;
      return setFor.value.toLowerCase() === address.toLowerCase();
    },
    set: (isSet: boolean) => {
      setFor.value = isSet ? (fundAddress() ?? null) : null;
    },
  });
};

export const useDepositFlowOpen = (fundAddress: () => string | undefined) =>
  flagForVault("deposit-flow-open-for", fundAddress);

/**
 * Whether the deposit at the end of the flow has landed.
 *
 * Shared for the mirror image of the same reason: processing the deposit
 * consumes the request, which swaps the page back to "Manage deposits" — so
 * the dialog reporting "deposit processed" was being destroyed by the very
 * event it exists to report. Nothing on chain records that a request was
 * processed (it is simply consumed), so this is the only place that memory
 * lives; it is cleared when the dialog is next opened.
 */
export const useDepositFlowProcessed = (
  fundAddress: () => string | undefined,
) => flagForVault("deposit-flow-processed-for", fundAddress);
