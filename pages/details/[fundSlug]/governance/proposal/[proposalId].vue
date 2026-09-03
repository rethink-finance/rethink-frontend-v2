<template>
  <div v-if="proposal?.proposalId" class="proposal_detail">
    <NuxtLink :to="governanceRoute" class="proposal_detail__back">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
      All proposals
    </NuxtLink>

    <!-- 2. Header -->
    <div class="proposal_detail__header">
      <h2 class="proposal_detail__title">
        {{ proposal.title }}
        <FundGovernanceStateBadge :value="proposal.state" />
        <FundGovernanceStateBadge
          v-for="(calldataTag, index) of proposal.calldataTags ?? []"
          :key="index"
          :value="calldataTag"
          neutral
        />
      </h2>
      <div class="proposal_detail__meta">
        <span class="proposal_detail__meta_label">Proposed by</span>
        <AddressLink
          class="proposal_detail__meta_link"
          :address="proposal.proposer"
          :chain-id="fundStore.selectedFundChain"
          :title="truncateAddressEllipsis(proposal.proposer)"
        />
        <span>·</span>
        <span>ID</span>
        <a
          v-if="proposalOriginUrl"
          class="proposal_detail__meta_link"
          :href="proposalOriginUrl"
          target="_blank"
          rel="noopener noreferrer"
          :title="proposalOriginTitle"
        >{{ shortProposalId }}</a>
        <span v-else>{{ shortProposalId }}</span>
      </div>
    </div>

    <!-- 3. Lifecycle -->
    <div class="brand_card lifecycle">
      <div class="lifecycle__steps">
        <div
          v-for="(step, index) in lifecycleSteps"
          :key="step.label"
          class="lifecycle__step"
        >
          <div class="lifecycle__track">
            <span
              class="lifecycle__dot"
              :class="{
                'lifecycle__dot--done': step.reached,
                'lifecycle__dot--failed': step.failed,
              }"
            />
            <span
              v-if="index < lifecycleSteps.length - 1"
              class="lifecycle__line"
              :class="{
                'lifecycle__line--done': lifecycleSteps[index + 1].reached,
                'lifecycle__line--failed': lifecycleSteps[index + 1].failed,
              }"
            />
          </div>
          <div
            class="lifecycle__label"
            :class="{ 'lifecycle__label--future': !step.reached }"
          >
            {{ step.label }}
          </div>
          <div
            class="lifecycle__date"
            :class="{ 'lifecycle__date--future': !step.reached }"
          >
            {{ step.unscheduled ? "PENDING" : step.date }}
          </div>
        </div>

        <!-- Rides along the row but takes no dot: it is a rule over the
             deadline, not a stage the proposal passes through. -->
        <div
          v-if="hasLateQuorum"
          class="lifecycle__step lifecycle__step--late"
          :title="lateQuorumNote.explainer"
        >
          <div class="lifecycle__track" />
          <div class="lifecycle__label">
            Late quorum
          </div>
          <div class="lifecycle__date">
            {{ lateQuorumNote.extension }} ·
            <span :class="`lifecycle__late--${lateQuorumNote.tone}`">
              {{ lateQuorumNote.status }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Two columns: what the proposal says on the left, what the vault
         has decided about it on the right. -->
    <div class="proposal_detail__columns">
      <div class="proposal_detail__col">
        <!-- Description -->
        <div class="brand_card">
          <div class="brand_card__eyebrow">
            Description
          </div>
          <p class="proposal_detail__description">
            {{ proposal.description || "No description was published with this proposal." }}
          </p>
        </div>

        <!-- Vote submissions -->
        <div class="brand_card submissions">
          <div class="submissions__head">
            <div class="brand_card__eyebrow">
              Vote submissions
            </div>
          </div>

          <div class="submissions__scroll">
            <div class="submissions__grid">
              <div class="submissions__row submissions__row--head">
                <div class="submissions__th">
                  Member
                </div>
                <div class="submissions__th">
                  Vote
                </div>
                <div class="submissions__th submissions__th--right">
                  Voting power
                </div>
                <div class="submissions__th submissions__th--right">
                  Date
                </div>
              </div>

              <div
                v-for="(submission, index) in orderedVoteSubmissions"
                :key="`${submission.proposer}-${index}`"
                class="submissions__row"
              >
                <div class="submissions__member">
                  <AddressLink
                    class="submissions__address"
                    :address="submission.proposer"
                    :chain-id="fundStore.selectedFundChain"
                    :title="truncateAddressEllipsis(submission.proposer)"
                  />
                  <span v-if="submission.my_vote" class="submissions__you">
                    You
                  </span>
                </div>
                <div
                  class="submissions__vote"
                  :class="`submissions__vote--${VoteTypeClass[submission.submission_status]}`"
                >
                  {{ voteLabel(submission.submission_status) }}
                </div>
                <div class="submissions__number">
                  {{ submission.quorumVotes }}
                </div>
                <div class="submissions__number">
                  <AddressLink
                    v-if="submission.txHash"
                    class="submissions__date_link"
                    :address="submission.txHash"
                    :chain-id="fundStore.selectedFundChain"
                    :title="submission.date"
                  />
                  <template v-else>
                    {{ submission.date }}
                  </template>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="!orderedVoteSubmissions.length"
            class="submissions__empty"
          >
            <v-progress-circular
              v-if="isLoadingProposal"
              size="16"
              width="2"
              indeterminate
            />
            <template v-else>
              No votes have been cast yet.
            </template>
          </div>
        </div>

        <!-- Executable code -->
        <div class="brand_card">
          <div class="brand_card__eyebrow">
            Executable code
          </div>
          <pre class="proposal_detail__code">{{ executableCode }}</pre>
        </div>
      </div>

      <div class="proposal_detail__col">
        <!-- Votes -->
        <div class="brand_card votes">
          <div class="brand_card__eyebrow">
            Votes
          </div>

          <div class="votes__bars">
            <div v-for="bar in voteBars" :key="bar.label" class="votes__bar">
              <div class="votes__bar_head">
                <span class="votes__bar_label" :class="`votes__bar_label--${bar.tone}`">
                  {{ bar.label }}
                </span>
                <span class="votes__bar_value">
                  {{ bar.amount }} · {{ bar.percent }}
                </span>
              </div>
              <div class="votes__track">
                <div
                  class="votes__fill"
                  :class="`votes__fill--${bar.tone}`"
                  :style="{ width: bar.width }"
                />
              </div>
            </div>
          </div>

          <div class="votes__quorum">
            QUORUM {{ fundStore.fund?.quorumPercentage || "N/A" }} OF SUPPLY -
            {{ isQuorumReached ? "REACHED" : "NOT REACHED" }}
          </div>

          <div v-if="showVoteActions || hasVotedOnProposal" class="votes__actions">
            <template v-if="hasVotedOnProposal">
              <span class="votes__voted_dot" />
              <span class="votes__voted_text">
                You voted {{ castVoteLabel }}
                <template v-if="yourPowerFormatted">with {{ yourPowerFormatted }}</template>
              </span>
            </template>

            <template v-else>
              <v-btn
                class="bg-primary text-secondary votes__button"
                :loading="loadingVoteOption === VoteTypeNumberMapping[VoteType.For]"
                :disabled="isVoteDisabled"
                @click="castVote(VoteTypeNumberMapping[VoteType.For])"
              >
                Vote for
              </v-btn>
              <button
                type="button"
                class="votes__ghost votes__ghost--against"
                :disabled="isVoteDisabled"
                @click="castVote(VoteTypeNumberMapping[VoteType.Against])"
              >
                Against
              </button>
              <button
                type="button"
                class="votes__ghost"
                :disabled="isVoteDisabled"
                @click="castVote(VoteTypeNumberMapping[VoteType.Abstain])"
              >
                Abstain
              </button>
              <span v-if="yourPowerFormatted" class="votes__power">
                YOUR POWER · {{ yourPowerFormatted }}
              </span>
            </template>
          </div>

          <!-- Passing is not enacting: a succeeded proposal sits there until
               somebody calls execute. These governors have no timelock to
               queue through, so it can be done the moment voting closes, and
               by anyone — the proposer holds no special right here. -->
          <div v-if="canExecuteProposal" class="votes__actions">
            <v-btn
              class="bg-primary text-secondary votes__button"
              :loading="isExecutingProposal"
              :disabled="!accountStore.isConnected"
              @click="executeProposal"
            >
              Execute proposal
            </v-btn>
            <span class="votes__power">
              {{
                accountStore.isConnected
                  ? "PASSED · ANYONE CAN EXECUTE"
                  : "CONNECT A WALLET TO EXECUTE"
              }}
            </span>
          </div>
        </div>

        <!-- Insights -->
        <div class="brand_card insights">
          <div class="brand_card__eyebrow">
            Insights
          </div>

          <div v-for="metric in insightMetrics" :key="metric.label" class="insights__metric">
            <div class="insights__metric_head">
              <span class="insights__metric_label">{{ metric.label }}</span>
              <span class="insights__metric_value">{{ metric.value }}</span>
            </div>
            <div class="insights__track">
              <div
                class="insights__fill"
                :class="`insights__fill--${metric.tone}`"
                :style="{ width: metric.width }"
              />
            </div>
            <div class="insights__metric_caption">
              {{ metric.caption }}
            </div>
          </div>

          <div class="insights__list">
            <div class="insights__row">
              <span class="insights__row_label">Total supply</span>
              <span class="insights__row_value">{{ proposal.totalSupplyFormatted }}</span>
            </div>
            <div class="insights__row">
              <span class="insights__row_label">Cast votes</span>
              <span class="insights__row_value">{{ totalVotesFormatted }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <v-progress-circular
    v-else-if="isLoadingProposal"
    class="loading_spinner"
    size="50"
    width="3"
    indeterminate
  />
  <div v-else class="text-center mt-6 align-center">
    Oops, proposal data is not available.
  </div>
</template>

<script setup lang="ts">
import AddressLink from "~/components/common/AddressLink.vue";
import { useActionStateStore } from "~/store/actionState.store";
import { formatDateToLocaleString, formatTokenValue } from "~/composables/formatters";
import { truncateAddressEllipsis } from "~/composables/addressUtils";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance-proposals/governance_proposals.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ActionState } from "~/types/enums/action_state";
import { getExplorerUrl, getExplorerBlockUrl } from "~/types/enums/chain_id";
import { ClockMode } from "~/types/enums/clock_mode";
import {
  ProposalState,
  VoteType,
  VoteTypeClass,
  VoteTypeMapping,
  VoteTypeNumberMapping,
} from "~/types/enums/governance_proposal";
import type IGovernanceProposal from "~/types/governance_proposal";

/**
 * The shell swaps the vault's identity block for a breadcrumb trail as soon as
 * a page hands it crumbs. This page wants the identity block — the vault name,
 * its section and the way back to the overview, the same header every other
 * governance page carries — so it hands over none, and the trail its own back
 * link already covers does not appear twice.
 */
const emit = defineEmits(["updateBreadcrumbs"]);

const fundStore = useFundStore();
const web3Store = useWeb3Store();
const accountStore = useAccountStore();
const toastStore = useToastStore();
const governanceProposalStore = useGovernanceProposalsStore();
const blockTimeStore = useBlockTimeStore();
const actionStateStore = useActionStateStore();

const route = useRoute();
const proposalSlug = route.params.proposalId as string;
// The slug is "<createdBlockNumber>-<proposalId>"; only the id is read here.
const [, proposalId] = proposalSlug.split("-") as [string, string];

const { selectedFundSlug } = storeToRefs(fundStore);
const governanceRoute = computed(
  () => `/details/${selectedFundSlug.value}/governance`,
);

const proposal = computed((): IGovernanceProposal | undefined =>
  governanceProposalStore.getProposal(
    fundStore.selectedFundChain,
    fundStore.fundAddress,
    proposalId,
  ),
);

/**
 * The governor keys proposals by a uint256, which the store carries as a
 * 77-digit decimal string. Hex is how it is written everywhere else it appears
 * — explorers, the contract's own logs — and truncating it is only readable at
 * all in that base.
 */
const shortProposalId = computed(() => {
  const id = proposal.value?.proposalId;
  if (!id) return "N/A";
  try {
    const hex = BigInt(id).toString(16);
    return hex.length <= 12 ? `0x${hex}` : `0x${hex.slice(0, 8)}…${hex.slice(-4)}`;
  } catch {
    return truncateAddressEllipsis(id);
  }
});

/**
 * Where the id sends you. A proposal id has no page of its own on an explorer,
 * so the link goes to where the proposal came from: the ProposalCreated
 * transaction, or — for proposals cached before that hash was recorded — the
 * block that transaction sits in.
 */
const proposalOriginUrl = computed(() => {
  const chainId = fundStore.selectedFundChain;
  const txHash = proposal.value?.createdTxHash;
  if (txHash) return getExplorerUrl(chainId, txHash);
  return getExplorerBlockUrl(chainId, proposal.value?.createdBlockNumber);
});

const proposalOriginTitle = computed(() =>
  proposal.value?.createdTxHash
    ? "View the transaction that created this proposal"
    : `View block ${proposal.value?.createdBlockNumber}, where this proposal was created`,
);

/* ---- The wallet's own vote -------------------------------------------- */

/**
 * A vote just cast, held until the chain catches up.
 *
 * The submissions and tallies are refetched a couple of seconds after the
 * receipt lands, and until they do the bars would still read as they did
 * before the vote — so the weight is added here and the card switches to its
 * "you voted" state immediately.
 */
const optimisticVote = ref<{ support: number; weight: bigint } | undefined>();

const activeUserVoteSubmission = computed(() => {
  const activeAddress = fundStore.activeAccountAddress?.toLowerCase();
  if (!activeAddress) return undefined;
  return proposal.value?.voteSubmissions?.find(
    (submission) => submission.proposer.toLowerCase() === activeAddress,
  );
});

const hasVotedOnProposal = computed(
  () =>
    Boolean(optimisticVote.value) ||
    Boolean(activeUserVoteSubmission.value) ||
    (governanceProposalStore.hasAccountVoted(proposalId) ?? false),
);

/**
 * What the wallet holds of the governance token. Voting power proper is the
 * delegated weight the governor counts, which can differ where a wallet has
 * delegated away — but the balance is what the app already has in hand, and
 * asking the chain for the other figure is a call this screen does not make.
 */
const yourPower = computed(
  () => fundStore.fundUserData?.governanceTokenBalance ?? 0n,
);

const yourPowerFormatted = computed(() => {
  if (!yourPower.value) return "";
  const symbol = fundStore.fund?.governanceToken?.symbol ?? "";
  const amount = formatTokenValue(
    yourPower.value,
    fundStore.fund?.governanceToken?.decimals,
    false,
    true,
  );
  return `${amount} ${symbol}`.trim();
});

const castVoteLabel = computed(() => {
  const support =
    optimisticVote.value?.support ??
    (activeUserVoteSubmission.value
      ? VoteTypeNumberMapping[activeUserVoteSubmission.value.submission_status]
      : undefined);
  if (support === undefined) return "";
  return voteLabel(VoteTypeMapping[support]);
});

/* ---- Tallies ------------------------------------------------------------ */

/**
 * The tallies are typed as bigint but do not always arrive as one: a proposal
 * restored from local storage has been through JSON, which has no bigint, so
 * the same field can come back a string. Everything below does arithmetic on
 * these, and bigint will not mix with anything else.
 */
const toBigInt = (value?: bigint | string | number) => {
  if (value === undefined || value === null || value === "") return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const voteWeight = (base: bigint, support: number) => {
  if (optimisticVote.value?.support !== support) return base;
  return base + optimisticVote.value.weight;
};

const forVotes = computed(() =>
  voteWeight(toBigInt(proposal.value?.forVotes), VoteTypeNumberMapping[VoteType.For]),
);
const againstVotes = computed(() =>
  voteWeight(
    toBigInt(proposal.value?.againstVotes),
    VoteTypeNumberMapping[VoteType.Against],
  ),
);
const abstainVotes = computed(() =>
  voteWeight(
    toBigInt(proposal.value?.abstainVotes),
    VoteTypeNumberMapping[VoteType.Abstain],
  ),
);
const totalVotes = computed(
  () => forVotes.value + againstVotes.value + abstainVotes.value,
);

const tokenAmount = (value: bigint) =>
  formatTokenValue(
    value,
    fundStore.fund?.governanceToken?.decimals,
    false,
    true,
  );

const totalVotesFormatted = computed(() => tokenAmount(totalVotes.value));

const share = (value: bigint, of: bigint) =>
  of > 0n ? Number((value * 10_000n) / of) / 10_000 : 0;

/** Whole numbers here: the bars are read at a glance, not compared closely. */
const asWholePercent = (value: number) => `${Math.round(value * 100)}%`;

const voteBars = computed(() => [
  {
    label: "For",
    tone: "for",
    votes: forVotes.value,
  },
  {
    label: "Against",
    tone: "against",
    votes: againstVotes.value,
  },
  {
    label: "Abstain",
    tone: "abstain",
    votes: abstainVotes.value,
  },
].map((bar) => {
  const fraction = share(bar.votes, totalVotes.value);
  return {
    ...bar,
    amount: tokenAmount(bar.votes),
    percent: asWholePercent(fraction),
    width: `${fraction * 100}%`,
  };
}));

const isQuorumReached = computed(() => {
  const quorum = toBigInt(proposal.value?.quorumVotes);
  return quorum > 0n && totalVotes.value >= quorum;
});

const insightMetrics = computed(() => {
  const approval = share(forVotes.value, totalVotes.value);
  const participation = share(totalVotes.value, toBigInt(proposal.value?.totalSupply));

  return [
    {
      label: "Approval",
      value: asWholePercent(approval),
      width: `${approval * 100}%`,
      tone: "accent",
      caption: "VOTES FOR / TOTAL CAST",
    },
    {
      label: "Participation",
      value: asWholePercent(participation),
      width: `${participation * 100}%`,
      tone: "blue",
      caption: "TOTAL VOTES / TOTAL SUPPLY",
    },
  ];
});

/* ---- Lifecycle ---------------------------------------------------------- */

const toDate = (timestamp?: string | number) => {
  const seconds = Number(timestamp ?? 0);
  if (!seconds) return undefined;
  return new Date(seconds * 1000);
};

const stampOf = (date?: Date) =>
  date ? formatDateToLocaleString(date, false) : "—";

/**
 * Times still in the future are read off the clock the governor votes on. A
 * timestamp clock names the moment outright; a block-number clock only names
 * a block, whose arrival time is estimated from the recent block rate — so
 * only the latter gets hedged.
 */
const approximatePrefix = computed(() =>
  fundStore.fund?.clockMode?.mode === ClockMode.BlockNumber ? "≈ " : "",
);

/**
 * The deadline the governor is actually holding for this proposal, which is
 * not always the one the ProposalCreated event announced — see lateQuorum.
 */
const deadlineClockValue = ref<number | undefined>();
const extendedVoteEnd = ref<Date | undefined>();

/**
 * Whether the vault runs `GovernorPreventLateQuorum` at all. Vaults that set
 * no extension have nothing to say about it, and the row is left out entirely.
 */
const hasLateQuorum = computed(() => {
  const lateQuorum = fundStore.fund?.lateQuorum ?? "";
  return Boolean(lateQuorum) && lateQuorum !== "N/A" && !/^0\b/.test(lateQuorum);
});

/**
 * The extension fires or it does not, and the chain says which: the governor's
 * `proposalDeadline` is pushed past the deadline the creation event announced
 * the moment quorum is reached late. Comparing the two is the whole test.
 */
const isLateQuorumTriggered = computed(() => {
  const announced = Number(proposal.value?.voteEnd ?? 0);
  const current = deadlineClockValue.value;
  return Boolean(announced && current && current > announced);
});

/**
 * When the extension has fired the real close is the extended one, so that is
 * what the roadmap and the late-quorum row both date.
 */
const effectiveVoteEnd = computed(() =>
  isLateQuorumTriggered.value && extendedVoteEnd.value
    ? extendedVoteEnd.value
    : toDate(proposal.value?.voteEndTimestamp),
);

const isVotingClosed = computed(() => {
  const voteEnd = effectiveVoteEnd.value;
  return Boolean(voteEnd) && Date.now() >= voteEnd!.getTime();
});

/**
 * Late quorum is not a stage every proposal passes through, so it is a note on
 * the roadmap rather than a stop on it: a rule that is always armed, fires only
 * when quorum lands near the deadline, and most of the time never fires at all.
 */
const lateQuorumNote = computed(() => {
  const extension = fundStore.fund?.lateQuorum ?? "";
  const triggered = isLateQuorumTriggered.value;

  return {
    extension,
    status: triggered ? "Triggered" : "Not triggered",
    tone: triggered ? "on" : "off",
    // The mechanic itself, kept to the hover: the row only has to answer
    // whether the deadline moved.
    explainer: triggered
      ? `Quorum was reached late, so voting was held open ${extension} longer - until ${stampOf(effectiveVoteEnd.value)}.`
      : `Voting stays open at least ${extension} after quorum is reached. The deadline has not been extended.`,
  };
});

/**
 * The path this proposal is on, following the governor's own state machine
 * rather than one fixed row of stages.
 *
 * Every proposal is created, opens for voting and closes again. What comes
 * after that is the state: a canceled one never reached a close, a defeated or
 * expired one ends where it stopped, and a proposal that passed goes on to be
 * executed. Listing stages a proposal can no longer reach would read as though
 * it were still waiting for them.
 *
 * Queuing is one of those stages: it exists only on a governor deployed behind
 * a timelock, and these are not — `timelock()` is not even on the contract. So
 * the queue is shown where the chain reports one (a proposal sitting in Queued,
 * or an Expired one that must have passed through it) and nowhere else.
 */
const lifecycleSteps = computed(() => {
  const state = proposal.value?.state;
  const now = Date.now();

  const created = toDate(proposal.value?.createdTimestamp);
  const voteStart = toDate(proposal.value?.voteStartTimestamp);
  const voteEnd = effectiveVoteEnd.value;
  const executed = toDate(proposal.value?.executedTimestamp);
  const votingClosed = isVotingClosed.value;

  /**
   * A stage still ahead usually has a time worth showing: the governor fixes
   * the whole vote window when the proposal is created, so "when does voting
   * open" is already answered and printing PENDING throws that away. It is
   * marked approximate on a block-number clock, where the time is arithmetic
   * over an average block rate rather than something the contract promises.
   *
   * Only a stage with no time to give stays unscheduled — execution waits on
   * somebody calling it, and no clock can say when that will be.
   */
  const step = (
    label: string,
    date: string,
    reached: boolean,
    failed = false,
  ) => {
    const hasTime = date !== "—";
    return {
      label,
      reached,
      failed,
      date:
        reached || !hasTime ? date : `${approximatePrefix.value}${date}`,
      unscheduled: !reached && !hasTime,
    };
  };

  const steps = [
    step("Created", stampOf(created), Boolean(created)),
    step(
      "Voting starts",
      stampOf(voteStart),
      Boolean(voteStart) && now >= voteStart!.getTime(),
    ),
  ];

  // Canceled proposals stop wherever they were; voting never closed.
  if (state === ProposalState.Canceled) {
    steps.push(step("Canceled", "—", true, true));
    return steps;
  }

  steps.push(step("Voting ends", stampOf(voteEnd), votingClosed));

  // Defeated at the ballot: there is nothing after the count.
  if (state === ProposalState.Defeated) {
    steps.push(step("Defeated", stampOf(voteEnd), true, true));
    return steps;
  }

  // Expired means it passed and was queued, then went unexecuted in time — so
  // the queue is part of its history even though the end is a failure.
  if (state === ProposalState.Expired) {
    steps.push(step("Queued", "—", true), step("Expired", "—", true, true));
    return steps;
  }

  if (state === ProposalState.Queued) {
    steps.push(step("Queued", "—", true));
  }

  steps.push(
    step("Executed", stampOf(executed), state === ProposalState.Executed),
  );

  return steps;
});

/**
 * Reads the live deadline and, when it has moved, resolves what time the
 * extended one lands at. Both are chain reads rather than stored values: the
 * extension can fire at any point during an open vote, and a cached proposal
 * would carry the deadline as it stood when it was cached.
 */
const fetchLateQuorumDeadline = async () => {
  if (!hasLateQuorum.value || !proposal.value?.proposalId) return;

  const chainId = fundStore.selectedFundChain;

  try {
    const deadline = Number(
      await web3Store.callWithRetry(chainId, () =>
        fundStore.fundGovernorContract.methods
          .proposalDeadline(proposal.value!.proposalId)
          .call(),
      ),
    );
    deadlineClockValue.value = deadline;

    if (!isLateQuorumTriggered.value) return;

    // In timestamp clock mode the deadline is already the answer; in block
    // number mode it has to be dated the same way the store dates vote ends.
    if (fundStore.fund?.clockMode?.mode === ClockMode.Timestamp) {
      extendedVoteEnd.value = toDate(deadline);
      return;
    }

    const context = await blockTimeStore.initializeBlockTimeContext(chainId);
    const timestamp = await blockTimeStore.getTimestampForBlock(
      deadline,
      context,
    );
    extendedVoteEnd.value = toDate(timestamp);
  } catch (error) {
    console.error("failed reading the proposal deadline", error);
  }
};

/* ---- Vote submissions --------------------------------------------------- */

const voteLabel = (voteType?: VoteType) => {
  if (voteType === VoteType.For) return "FOR";
  if (voteType === VoteType.Against) return "AGAINST";
  if (voteType === VoteType.Abstain) return "ABSTAIN";
  return "";
};

/** The reader's own vote first — it is the row they came to check. */
const orderedVoteSubmissions = computed(() => {
  const submissions = proposal.value?.voteSubmissions ?? [];
  const mine = submissions.filter((submission) => submission.my_vote);
  const others = submissions.filter((submission) => !submission.my_vote);
  return [...mine, ...others];
});

/* ---- Executable code ---------------------------------------------------- */

const executableCode = computed(() =>
  JSON.stringify(
    {
      targets: proposal.value?.targets ?? [],
      values: proposal.value?.values ?? [],
      signatures: proposal.value?.signatures ?? [],
      calldatas: proposal.value?.calldatas ?? [],
    },
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);

/* ---- Voting ------------------------------------------------------------- */

const loadingVoteOption = ref<number | undefined>();

const showVoteActions = computed(
  () => proposal.value?.state === ProposalState.Active,
);

const isVoteDisabled = computed(
  () => !accountStore.isConnected || loadingVoteOption.value !== undefined,
);

const castVote = async (support: number) => {
  if (!proposal.value?.proposalId) return;
  loadingVoteOption.value = support;

  try {
    await fundStore.fundGovernorContract
      .send("castVote", {}, proposal.value.proposalId, support)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "Your vote has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        if (receipt.status) {
          toastStore.successToast("Vote successful.");
          optimisticVote.value = { support, weight: yourPower.value };

          if (fundStore.activeAccountAddress) {
            governanceProposalStore.connectedAccountProposalsHasVoted[
              proposal.value!.proposalId
            ] ??= {};
            governanceProposalStore.connectedAccountProposalsHasVoted[
              proposal.value!.proposalId
            ][fundStore.activeAccountAddress] = true;
          }

          handleVoteSuccess();
        } else {
          toastStore.errorToast(
            "The vote transaction has failed. Please contact the Rethink Finance support.",
          );
        }
        loadingVoteOption.value = undefined;
      })
      .on("error", (error: any) => {
        console.error(error);
        loadingVoteOption.value = undefined;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch {
    loadingVoteOption.value = undefined;
  }
};

/* ---- Execution ---------------------------------------------------------- */

/**
 * Succeeded is the only state that is executable here. Queued exists on
 * governors deployed behind a timelock, where execution has to wait out the
 * delay — these are not, so a proposal never passes through it, and offering
 * the button there would only produce a revert after a signature.
 */
const canExecuteProposal = computed(
  () => proposal.value?.state === ProposalState.Succeeded,
);

const isExecutingProposal = ref(false);

const executeProposal = async () => {
  const current = proposal.value;
  if (!current) return;
  isExecutingProposal.value = true;

  try {
    await fundStore.fundGovernorContract
      .send(
        "execute",
        {},
        // The governor re-hashes these to find the proposal, so they must be
        // exactly what was proposed — they come from the proposal itself,
        // never rebuilt here.
        current.targets,
        current.values,
        current.calldatas,
        current.descriptionHash,
      )
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "Proposal execution has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        if (receipt.status) {
          toastStore.successToast("Proposal executed.");
          handleVoteSuccess();
        } else {
          toastStore.errorToast(
            "The execution transaction has failed. Please contact the Rethink Finance support.",
          );
        }
        isExecutingProposal.value = false;
      })
      .on("error", (error: any) => {
        console.error(error);
        isExecutingProposal.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error) {
    console.error("Failed executing proposal", error);
    isExecutingProposal.value = false;
  }
};

// when the user votes or executes, refetch the proposal so the state and
// tallies come from the chain rather than from what we hoped happened
const handleVoteSuccess = async () => {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await governanceProposalStore.fetchGovernanceProposal(proposalId);
};

const fetchHasVoted = () => {
  const activeAccountAddress = fundStore.activeAccountAddress;
  if (!activeAccountAddress || !proposalId) return;

  governanceProposalStore.connectedAccountProposalsHasVoted[proposalId] ??= {};

  web3Store
    .callWithRetry(fundStore.selectedFundChain, () =>
      fundStore.fundGovernorContract.methods
        .hasVoted(proposalId, activeAccountAddress)
        .call(),
    )
    .then((hasVoted: boolean) => {
      governanceProposalStore.connectedAccountProposalsHasVoted[proposalId][
        activeAccountAddress
      ] = hasVoted;
    });
};

watch(() => fundStore.activeAccountAddress, fetchHasVoted);

onMounted(async () => {
  window.scrollTo({ top: 0 });
  // Empty rather than absent: a page navigated away from leaves its crumbs
  // behind otherwise, and this one is reached from pages that set them.
  emit("updateBreadcrumbs", []);

  try {
    await governanceProposalStore.fetchGovernanceProposal(proposalId);
  } catch {}

  fetchHasVoted();
  fetchLateQuorumDeadline();
});

onBeforeUnmount(() => {
  emit("updateBreadcrumbs", []);
});

const isLoadingProposal = computed(() => {
  const actionStates = actionStateStore.getActionState(
    "fetchGovernanceProposalAction",
  );

  if (!actionStates) return false;

  const isLoadingState = actionStates.includes(ActionState.Loading);
  const hasNeverLoaded = !actionStates.includes(ActionState.Success) &&
                        !actionStates.includes(ActionState.Error);

  return isLoadingState || hasNeverLoaded;
});
</script>

<style scoped lang="scss">
.proposal_detail {
  display: flex;
  flex-direction: column;
  gap: 1.375rem;

  &__back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    align-self: flex-start;
    font-family: $font-mono;
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-white;
      text-decoration: none;
    }
  }

  &__header {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  &__title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: $color-white;
  }

  &__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.3125rem;
    font-family: $font-mono;
    font-size: 11.5px;
    letter-spacing: 0.06em;
    color: $color-steel-blue;
  }

  /* Caps come from the stylesheet, as for every other microlabel — the
     template writes sentence case. */
  &__meta_label {
    text-transform: uppercase;
  }

  /**
   * Written past AddressLink's own rule, which sets a smaller size of its own —
   * here the hex is part of a line of running text and has to sit on it.
   */
  &__meta &__meta_link {
    font-size: inherit;
    color: $color-text-irrelevant;
    text-decoration: none;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-cyan;
      text-decoration: underline;
    }
  }

  &__description {
    max-width: 76ch;
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: $color-text-irrelevant;
    text-wrap: pretty;
    white-space: pre-line;
  }

  /**
   * The proposal on the left, the vote on the right. The left column carries
   * the long content — description, submissions, calldata — so the right one
   * ends up shorter than it; start-aligned rather than stretched, or the
   * insights card would grow a foot of empty space under its last row.
   */
  &__columns {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.375rem;
    align-items: start;

    @include md {
      /* 380px is the deposit rail's width on the vault overview — the same
         page furniture in the same place, so the two sections line up when you
         move between them. Everything left over goes to the proposal. */
      grid-template-columns: minmax(0, 1fr) 380px;
    }
  }

  &__col {
    display: flex;
    flex-direction: column;
    gap: 1.375rem;
    /* Without this the submissions table's own min-width would widen the
       column instead of scrolling inside it. */
    min-width: 0;
  }

  &__code {
    margin: 0;
    padding: 1rem 1.125rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-navy-gray-light;
    font-family: $font-mono;
    font-size: 12px;
    line-height: 1.6;
    color: $color-text-irrelevant;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

/* The steps share the width equally so the row reads as a timeline rather than
   as a list of differently important stages. */
.lifecycle {
  &__steps {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem 0.75rem;
  }

  /* A basis rather than 0, so narrow screens wrap the row instead of crushing
     every stage to a few pixels and overlapping the labels. */
  &__step {
    flex: 1 1 150px;

    /* Sized to its own text and ruled off, so it reads as an aside to the row
       rather than the stage that follows Executed. */
    &--late {
      flex: 0 0 auto;

      /* The rule only separates it while it is beside the row; once the row
         wraps it would just be a line hanging in the card. */
      @include md {
        padding-left: 1.25rem;
        border-left: 1px solid $color-line;
      }
    }
  }

  /* Held open by the dot even where there is no dot, so every label lines up. */
  &__track {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 9px;
    margin-bottom: 0.625rem;
  }

  &__dot {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: $color-moonlight-light;

    &--done {
      background: $color-cyan-raw;
    }

    &--failed {
      background: $color-error;
    }
  }

  &__line {
    flex: 1 1 auto;
    height: 1px;
    background: $color-line;

    &--done {
      background: rgba(22, 200, 255, 0.35);
    }

    &--failed {
      background: rgba(230, 106, 96, 0.35);
    }
  }

  &__label {
    font-size: 12.5px;
    font-weight: 600;
    color: $color-white;

    &--future {
      color: $color-steel-blue;
    }
  }

  &__date {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;

    /* A projection rather than a record. The dot and the label already say
       the stage is ahead; dimming the time keeps it from being read as
       something that has already happened. */
    &--future {
      opacity: 0.65;
    }
  }

  /* Fired — the deadline this proposal closed on is not the announced one. */
  &__late--on {
    color: $color-cyan;
  }

  &__late--off {
    color: $color-steel-blue;
  }
}

.votes {
  &__bars {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    margin-bottom: 1rem;
  }

  &__bar_head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.4375rem;
  }

  &__bar_label {
    font-size: 13px;
    font-weight: 600;

    &--for {
      color: $color-cyan;
    }

    &--against {
      color: $color-error;
    }

    &--abstain {
      color: $color-steel-blue;
    }
  }

  &__bar_value {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-text-irrelevant;
    overflow-wrap: anywhere;
  }

  &__track {
    height: 5px;
    border-radius: 999px;
    background: $color-moonlight-light;
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: 999px;

    &--for {
      background: $color-cyan-raw;
    }

    &--against {
      background: $color-error;
    }

    &--abstain {
      background: $color-steel-blue;
    }
  }

  &__quorum {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: $color-steel-blue;
  }

  &__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.625rem;
    margin-top: 1.125rem;
    padding-top: 1.125rem;
    border-top: 1px solid $color-line;
  }

  &__ghost {
    padding: 0.4375rem 0.875rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-size: 13px;
    font-weight: 600;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover:not(:disabled) {
      color: $color-white;
      border-color: $color-line-3;
    }

    &--against {
      color: $color-error;
      border-color: rgba(230, 106, 96, 0.32);

      &:hover:not(:disabled) {
        color: $color-error;
        border-color: $color-error;
      }
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  &__power {
    margin-left: auto;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: $color-steel-blue;
  }

  &__voted_dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: $color-cyan-raw;
  }

  &__voted_text {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-white;
  }
}

.insights {
  &__metric {
    margin-bottom: 1.125rem;
  }

  &__metric_head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.4375rem;
  }

  &__metric_label {
    font-size: 13px;
    font-weight: 600;
    color: $color-white;
  }

  &__metric_value {
    font-family: $font-mono;
    font-size: 13px;
    color: $color-white;
  }

  &__track {
    height: 5px;
    border-radius: 999px;
    background: $color-moonlight-light;
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: 999px;

    &--accent {
      background: $color-cyan-raw;
    }

    &--blue {
      background: $color-primary;
    }
  }

  &__metric_caption {
    margin-top: 0.4375rem;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    color: $color-steel-blue;
  }

  &__list {
    padding-top: 0.875rem;
    border-top: 1px solid $color-line;
  }

  &__row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.3125rem 0;
  }

  &__row_label {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__row_value {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
    overflow-wrap: anywhere;
  }
}

.submissions {
  padding: 0;

  &__head {
    padding: 1.25rem 1.5rem 0.875rem;
  }

  &__scroll {
    overflow-x: auto;
  }

  &__grid {
    min-width: 620px;
  }

  /**
   * Every track has a floor wide enough for its own content and a share of
   * whatever is left over — the member column used to take all the slack while
   * the date, on a fixed track, wrapped onto two lines beside it.
   */
  &__row {
    display: grid;
    grid-template-columns:
      minmax(170px, 1.1fr) minmax(90px, 0.7fr)
      minmax(110px, 0.8fr) minmax(155px, 0.9fr);
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid $color-line;

    &--head {
      height: 38px;
      padding-top: 0;
      padding-bottom: 0;
      border-top: 1px solid $color-line;
    }
  }

  &__th {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--right {
      text-align: right;
    }
  }

  &__member {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  /* Written past AddressLink's own rule, which sets a size of its own. */
  &__member &__address {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
    text-decoration: none;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-cyan;
      text-decoration: underline;
    }
  }

  &__you {
    padding: 0.125rem 0.375rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    background: $color-accent-soft;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__vote {
    font-family: $font-mono;
    font-size: 11.5px;
    letter-spacing: 0.08em;

    &--for {
      color: $color-cyan;
    }

    &--against {
      color: $color-error;
    }

    &--abstain {
      color: $color-steel-blue;
    }
  }

  &__number {
    font-family: $font-mono;
    font-size: 12px;
    text-align: right;
    color: $color-text-irrelevant;
    font-variant-numeric: tabular-nums;
  }

  /* Written past AddressLink's own rule, which sets a size of its own. */
  &__number &__date_link {
    font-size: 12px;
    color: inherit;
    white-space: nowrap;
    text-decoration: none;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-cyan;
      text-decoration: underline;
    }
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.5rem;
    font-size: $text-sm;
    color: $color-steel-blue;
  }
}

.loading_spinner {
  display: flex;
  margin: 50px auto 0;
}

@media (prefers-reduced-motion: reduce) {
  .proposal_detail__back,
  .votes__ghost {
    transition: none;
  }
}
</style>
