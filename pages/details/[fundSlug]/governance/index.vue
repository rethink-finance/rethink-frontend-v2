<template>
  <div class="page-governance">
    <UiDataRowCard title="Governance Settings" class="data_row_card">
      <template #body>
        <FundOverviewGovernance :fund="fundStore.fund" />
      </template>
    </UiDataRowCard>

    <UiMainCard
      title="Governance Activity"
      :subtitle="pendingProposalsCountText"
    >
      <template #header-right>
        <UiDropdown
          :options="createProposalDropdownOptions"
          label="Create Proposal"
          @update:selected="selectOption"
        />
      </template>
      <template #tools>
        <v-btn
          class="tools__all-activity-btn text-secondary"
          variant="outlined"
        >
          <div>All Activity</div>
          <div class="tools_all-activity-btn_subtext">
            ({{ proposalsCountText }})
          </div>
          <Icon icon="mdi:filter-variant" width="1rem" />
        </v-btn>
        <div class="tools__success-rate">
          <div class="tools__val">
            {{ proposalsSuccessRate }}
          </div>
          <div class="tools__subtext">
            Success Rate
          </div>
        </div>
      </template>
      <FundGovernanceProposalsTable
        :items="governanceProposals"
        :loading="isFetchingProposals"
        :loading-variant="loadingProposalsVariant"
      />
    </UiMainCard>

    <UiMainCard
      title="Trending Delegates"
      :subtitle="trendingDelegatesSubtitle"
    >
      <template #header-right>
        <UiTooltipClick
          :hide-after="6000"
          :show-tooltip="!accountStore.isConnected"
        >
          <template #tooltip>
            Connect your wallet to delegate your votes
          </template>

          <v-btn
            class="manage_button"
            variant="outlined"
            @click="accountStore.isConnected ? openDelegateDialog() : null"
          >
            {{ shouldUserDelegate ? "Assign Delegation" : "Manage Delegation" }}
          </v-btn>
        </UiTooltipClick>
      </template>
      <FundGovernanceTableTrendingDelegates
        :items="trendingDelegates"
        :active-account-address="fundStore.activeAccountAddress"
        :loading="isFetchingDelegates"
        @row-click="handleRowClick"
      />
    </UiMainCard>

    <FundGovernanceModalDelegateVotes
      v-model="isDelegateDialogOpen"
      @delegate-success="handleDelegateSuccess"
    />

    <UiConfirmDialog
      v-model="delegatorsDialog"
      title="Delegators"
      confirm-text=""
      cancel-text="Close"
      class="confirm_dialog"
      max-width="800px"
      @cancel="delegatorsDialog = false"
    >
      <div class="mb-10">
        <div class="title">
          Delegated Member:
        </div> {{ activeRow?.delegatedMember }}
      </div>
      <div>
        <div class="title">
          Delegators:
        </div>
        <ul>
          <li v-for="delegator in activeRow?.delegators" :key="delegator" class="delegator-item">
            {{ delegator }}
            <FundGovernanceProposalStateChip
              v-if="activeRow?.delegatedMember === delegator"
              value="Self Delegated"
              close-delegators-dialog
            />
          </li>
        </ul>
      </div>
    </UiConfirmDialog>

    <UiConfirmDialog
      v-model="confirmDialog"
      title="Heads Up!"
      confirm-text="Create a New Proposal"
      :cancel-text="
        updateSettingsProposals.length > 1 ? 'Cancel' : 'Go to existing proposal'
      "
      class="confirm_dialog"
      :max-width="updateSettingsProposals.length > 1 ? 'unset' : '600px'"
      @confirm="handleNavigateToCreateProposal"
      @cancel="
        updateSettingsProposals.length > 1 ? null : handleGoToProposal()
      "
    >
      <div class="mb-2">
        There is already an active vault settings proposal. Are you sure you want to create a new one?
      </div>
      <FundGovernanceProposalsTable
        v-if="updateSettingsProposals.length > 1"
        :items="updateSettingsProposals"
        :loading="isFetchingProposals"
        :loading-variant="loadingProposalsVariant"
        style="margin-top: 2rem"
      />
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
// components
import { useAccountStore } from "~/store/account/account.store";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance-proposals/governance_proposals.store";
import { ActionState } from "~/types/enums/action_state";
import { ProposalState } from "~/types/enums/governance_proposal";
import { ProposalCalldataType } from "~/types/enums/proposal_calldata_type";
import type IGovernanceProposal from "~/types/governance_proposal";
import { _mapDelegatesToTrendingDelegates } from "~/types/helpers/mappers";
import type ITrendingDelegate from "~/types/trending_delegate";

const router = useRouter();
const accountStore = useAccountStore();
const fundStore = useFundStore();
const actionStateStore = useActionStateStore();
const governanceProposalStore = useGovernanceProposalsStore();

const confirmDialog = ref(false);
const updateSettingsProposals = ref([]) as Ref<IGovernanceProposal[]>;
const { shouldUserDelegate } = storeToRefs(fundStore);

// dummy data governance activity
const governanceProposals = computed(() => {
  const proposals = governanceProposalStore.getProposals(
    fundStore.selectedFundChain,
    fundStore.fundAddress,
  );
  console.log("fetched proposals in view", fundStore.selectedFundChain, fundStore.fundAddress, proposals)

  // set updateSettingsProposals to proposals that have updateSettings calldata
  updateSettingsProposals.value = proposals.filter((proposal) => {
    return proposal.calldataTags?.some(
      (calldata) => calldata === ProposalCalldataType.FUND_SETTINGS,
    ) && (
      proposal.state === ProposalState.Active ||
      proposal.state === ProposalState.Pending ||
      proposal.state === ProposalState.Queued
    );
  });

  // Sort the events by createdTimestamp
  proposals.sort((a, b) => {
    const timestampA = a.createdTimestamp;
    const timestampB = b.createdTimestamp;
    return timestampB - timestampA;
  });

  return proposals;
});

const proposalsCountText = computed(() => {
  if (governanceProposals.value.length === 1) {
    return "1 Proposal";
  }
  return governanceProposals.value.length + " Proposals";
});
const pendingProposals = computed(() => {
  return governanceProposals.value.filter(
    (proposal) => proposal.state === ProposalState.Pending,
  );
});
const pendingProposalsCountText = computed(() => {
  if (pendingProposals.value.length === 1) {
    return "1 Pending Proposal";
  }
  return pendingProposals.value.length + " Pending Proposals";
});
const hasUpdateSettingsProposal = computed(() => {
  return updateSettingsProposals.value.length > 0;
});
const proposalsSuccessRate = computed(() => {
  const successProposals = governanceProposals.value.filter((proposal) =>
    [ProposalState.Succeeded, ProposalState.Executed].includes(proposal.state),
  );
  const allFinishedProposalsCount =
    governanceProposals.value.length - pendingProposals.value.length;
  let successRate = 0;
  if (allFinishedProposalsCount) {
    successRate =
      successProposals.length /
      (governanceProposals.value.length - pendingProposals.value.length);
  }
  return formatPercent(successRate, false);
});

// fetchProposals can be a super long-lasting process, so if the user changes
// page we want to stop fetching proposals.
const shouldFetchProposals = ref(false);
const shouldFetchTrendingDelegates = ref(true);

// trending delegates
const trendingDelegates = computed(() => {
  const delegates = governanceProposalStore.getDelegates(
    fundStore.selectedFundChain,
    fundStore.fundAddress,
  );
  delegates.sort((a, b) => {
    const votingPowerA = Number(a.votingPower.replace(fundStore.fund?.governanceToken.symbol || "", ""));
    const votingPowerB = Number(b.votingPower.replace(fundStore.fund?.governanceToken.symbol || "", ""));
    return votingPowerB - votingPowerA;
  });
  return _mapDelegatesToTrendingDelegates(delegates);
});

/**
const totalVotingPower = computed(() => {
  return fundStore?.fund?.fundTokenTotalSupply || 0;
});
 */

// subtitle for trending delegates
const trendingDelegatesSubtitle = computed(() => {
  if (trendingDelegates.value.length === 1) {
    return "1 Delegated Wallet";
  }

  return trendingDelegates.value.length + " Delegated Wallets";
});

// const loadingTrendingDelegate = ref(false);

/**
const fetchTrendingDelegates = async () => {
  try {
    loadingTrendingDelegate.value = true;
    const currentBlock = Number(await fundStore.web3.eth.getBlockNumber());
    console.log("currentBlock trending delegates:", currentBlock);

    let fromBlock = BigInt(currentBlock);
    const endBlock = BigInt(0);
    let chunkSize = 1000n;
    const minChunkSize = 1000n;
    let waitTimeAfterError = 100;

    // store the latest parsed delegator addresses
    const processedDelegators: Set<string> = new Set();
    const symbol = fundStore.fund?.governanceToken.symbol ?? "";

    while (fromBlock > endBlock && shouldFetchTrendingDelegates.value) {
      let toBlock = fromBlock - chunkSize + 1n;
      if (toBlock < endBlock) {
        toBlock = endBlock;
      }

      console.log("TD - chunkSize: ", chunkSize);
      console.log(`TD - Fetching events from ${fromBlock} to ${toBlock}`);

      try {
        // fetch DelegateChanged events
        const eventsDC = await fundStore.fundGovernanceTokenContract.getPastEvents(
          "DelegateChanged",
          {
            fromBlock: Number(toBlock),
            toBlock: Number(fromBlock),
          },
        );

        // process only the new chunk of events
        const newTrendingDelegates = await parseNewChunkDelegateEvents(
          eventsDC, // new events chunk
          processedDelegators, // already processed delegators
        );

        // we need to sort the trending delegates by voting power
        trendingDelegates.value = trendingDelegates.value.concat(newTrendingDelegates).sort((a, b) => {
          const votingPowerA = Number(a.votingPower.replace(symbol, ""));
          const votingPowerB = Number(b.votingPower.replace(symbol, ""));

          return votingPowerB - votingPowerA;
        });

        console.log("Fetched DelegateChanged events: ", newTrendingDelegates);


        // double the chunk size for the next iteration
        chunkSize *= 2n;
        console.log("Fetched and doubling chunkSize to: ", chunkSize);
        waitTimeAfterError = Math.max(100, waitTimeAfterError / 2);

        fromBlock = toBlock - 1n; // prepare for the next range

        await new Promise((resolve) =>
          setTimeout(resolve, waitTimeAfterError),
        );
      } catch (error: any) {
        console.error("Error fetching events: ", error);

        // if fetching failed, halve the chunk size
        chunkSize /= 2n;
        if (chunkSize < minChunkSize) {
          chunkSize = minChunkSize;
        }
        console.log("Error encountered, reducing chunkSize to: ", chunkSize);
        // Wait max 10 seconds.
        waitTimeAfterError = Math.min(10000, waitTimeAfterError * 2);

        await new Promise((resolve) =>
          setTimeout(resolve, waitTimeAfterError),
        );
      }
    }
    loadingTrendingDelegate.value = false;
    console.log("All DelegateChanged events fetched");
  } catch (error: any) {
    console.error("Error fetching trending delegates: ", error);
    loadingTrendingDelegate.value = false;
  }
};


// // process and parse only the new chunk of events
// // we want to show only the most recent events, so if the delegator already exists in the trending delegates list we skip it
const parseNewChunkDelegateEvents = async (
  newChunkEvents: any[],
  processedDelegators: Set<string>,
) => {
  try {
    const delegationsMap: Record<
      string,
      { delegator: Set<string>; event: Set<any> }
    > = {};

    // sort new events by blockNumber so we handle the most recent first
    const sortedEvents = newChunkEvents.sort(
      (a, b) => Number(b.blockNumber) - Number(a.blockNumber),
    );

    sortedEvents.forEach((event) => {
      const delegator = event.returnValues.delegator.toLowerCase();
      const delegatedMember = event.returnValues.toDelegate.toLowerCase();

      // 1. we need to ignore the DelegateChanged events where the delegator is the same as fund address
      //    because those come from our try to automatically self delegate in the BE
      // 2. skip already processed delegators as well
      if (
        delegator === fundStore.fundAddress.toLowerCase() ||
        processedDelegators.has(delegator)
      ) {
        return;
      }

      // add the delegator to the processed list to avoid reprocessing
      processedDelegators.add(delegator);

      // if the member is not yet in the map, add them
      if (!delegationsMap[delegatedMember]) {
        delegationsMap[delegatedMember] = {
          delegator: new Set(),
          event: new Set(),
        };
      }

      delegationsMap[delegatedMember].delegator.add(delegator);
      delegationsMap[delegatedMember].event.add(event);
    });

    // process and parse the new chunk of events
    const newDelegates: ITrendingDelegate[] = [];
    const symbol = fundStore.fund?.governanceToken.symbol ?? "";

    await Promise.all(
      Object.entries(delegationsMap).map(
        async ([delegatedMember, delegatorsSet]) => {
          const { votingPower, impact } =
            await getVotingPowerAndImpact(delegatedMember);

          // check if the delegate already exists in trendingDelegates.value
          const existingDelegate = trendingDelegates.value.find(
            (delegate) => delegate.delegatedMember === delegatedMember,
          );

          if (existingDelegate) {
            // if the delegate exists, merge new delegators and events
            existingDelegate.delegators = [
              ...new Set([...existingDelegate.delegators, ...Array.from(delegatorsSet.delegator)]),
            ];
            existingDelegate.delegatorsEvents = [
              ...new Set([...existingDelegate.delegatorsEvents, ...Array.from(delegatorsSet.event)]),
            ];
          } else {
            // otherwise, create a new delegate entry
            const output = {
              delegatedMember,
              delegators: Array.from(delegatorsSet.delegator),
              delegatorsEvents: Array.from(delegatorsSet.event),
              impact: impact ?? "0%",
              votingPower: votingPower ?? "0 " + symbol,
            } as ITrendingDelegate;

            if (delegatorsSet.delegator.size >= 1) {
              newDelegates.push(output);
            }
          }
        },
      ),
    );

    // return the new trending delegates
    return newDelegates;

  } catch (error: any) {
    console.error("Error parsing trending delegates: ", error);
    return [];
  }
};

async function getVotingPowerAndImpact(delegatedAddress: string) {
  try {
    // TODO add chainId to callWithRetry if you uncomment this code
    let votingPower = 0n;
    votingPower = await web3Store.callWithRetry(() =>
      fundStore.fundGovernanceTokenContract.methods.getVotes(delegatedAddress).call()
    );

    const totalFundSupply = Number(fundStore?.fund?.fundTokenTotalSupply || 0);
    // delegatedMemberVotingPower * 100 / totalFundSupply
    const impact = (Number(votingPower) * 100) / totalFundSupply;

    return {
      votingPower:
      formatTokenValue(
        votingPower,
        fundStore?.fund?.governanceToken.decimals,
        false,
        true,
      ) + " " + fundStore.fund?.governanceToken.symbol,
      impact: impact.toFixed(0) + "%",
    };
  } catch (error: any) {
    console.error("Error getting voting power and impact: ", error);
    return {
      votingPower: "0 " + fundStore.fund?.governanceToken.symbol,
      impact: "0%",
    };
  }
}
 */

const handleRowClick = (item: ITrendingDelegate) => {
  activeRow.value = item;
  delegatorsDialog.value = true;
};

const delegatorsDialog = ref(false);
const activeRow = ref<ITrendingDelegate | null>(null);
type DropdownOption = {
  click: () => void;
  disabled?: boolean;
};

const dropdownOptions: Record<string, DropdownOption> = {
  "Direct Execution": {
    click: () => {
      // change route to direct execution
      router.push(
        `/details/${fundStore.selectedFundSlug}/governance/direct-execution`,
      );
    },
  },
  "Delegated Permissions": {
    click: () => {
      // change route to delegated permissions
      router.push(
        `/details/${fundStore.selectedFundSlug}/governance/delegated-permissions`,
      );
    },
  },
  "NAV Methods": {
    click: () => {
      router.push(`/details/${fundStore.selectedFundSlug}/nav/manage`);
    },
  },
  "Vault Settings": {
    click: () => {
      // if fund settings proposal already exist, open up the dialog
      if (hasUpdateSettingsProposal.value) {
        confirmDialog.value = true;
        return;
      }

      handleNavigateToCreateProposal();
    },
  },
};

const handleNavigateToCreateProposal = () => {
  router.push(
    `/details/${fundStore.selectedFundSlug}/governance/fund-settings`,
  );
  confirmDialog.value = false;
};
const handleGoToProposal = () => {
  const { createdBlockNumber, proposalId } = updateSettingsProposals.value[0];

  if (!createdBlockNumber || !proposalId) {
    console.error("No proposalId or createdBlockNumber found");
    return;
  }

  router.push(
    `/details/${fundStore.selectedFundSlug}/governance/proposal/${createdBlockNumber}-${proposalId}`,
  );
};
const createProposalDropdownOptions = Object.keys(dropdownOptions).map(
  (key) => {
    return {
      label: key,
      disabled: dropdownOptions[key]?.disabled || false,
    };
  },
);

const selectOption = (option: string) => {
  if (dropdownOptions[option]) {
    dropdownOptions[option].click();
  } else {
    console.error("Option not found");
  }
};

const loadingProposals = ref(false);
const loadingProposalsVariant = ref("append" as "append" | "prepend");

// delegate dialog
const isDelegateDialogOpen = ref(false);

const openDelegateDialog = () => {
  console.log("openDelegateDialog");
  isDelegateDialogOpen.value = true;
};

/**
const fetchProposals = async (
  rangeStartBlock: number,
  rangeEndBlock: number,
  // show loading skeleton at the top or bottom of the table
  loadingVariant = "append" as "append" | "prepend",
) => {
  const fund = fundStore.fund;
  const fundAddress = fund?.address;
  if (!fundAddress) return;

  if (!fund?.governanceToken.decimals) {
    console.error("No fund governance token decimals found.");
    toastStore.errorToast("No fund governance token decimals found.");
    return;
  }
  if (!fund.clockMode?.mode) {
    console.error("Fund clock mode is unknown.");
    toastStore.errorToast("Fund clock mode is unknown.");
    return;
  }
  loadingProposals.value = true;
  loadingProposalsVariant.value = loadingVariant;

  // It looks like the block fetching range is arbitrary, specific to RPC, so we should try and guess it and
  // increase exponentially until they block us, and then we decrease it.
  // some RPCs can take more than 1M in arbitrum if logged in
  // let chunkSize = 1000000;
  const INITIAL_CHUNK_SIZE = 1500;
  const INITIAL_WAIT_TIME_AFTER_ERROR = 1000;
  const MAX_WAIT_TIME_AFTER_ERROR = 10000;
  let chunkSize = INITIAL_CHUNK_SIZE;
  let waitTimeAfterError = INITIAL_WAIT_TIME_AFTER_ERROR;

  // We have to fetch events in ranges, as we can't fetch all events at once because of RPC limits.
  // We fetch from the most recent to least recent block number.
  const targetDate = new Date("2024-04-01T00:00:00Z");
  const targetTimestamp = Math.floor(targetDate.getTime() / 1000);

  // From the largest number to the smallest number.
  if (rangeStartBlock > rangeEndBlock) {
    console.warn(
      "\nBIGGEST to smallest from: ",
      rangeEndBlock,
      " to: ",
      rangeStartBlock,
    );
    let toBlock = Math.max(rangeStartBlock, 0);
    let fromBlock = Math.max(toBlock - chunkSize + 1, rangeEndBlock);
    // TODO BIG PROBLEM:
    //   if I start fetching from block 1000 to 0 (by 100 chunk size) and then I stop I will save that last fetched block
    //   number is 1000 and oldest is 900 and then next time when I start, I start from most recent block
    //   number 2000 and go to 1000 and from 900 to 0... the problem is that the most recent block will be then
    //   2000 even if I stopped before the 1000 and didnt fetch all from 2000 to 1000
    //   FIX: only go from newest to oldest when there are no blocks fetched yet... otherwise go from the most recent
    //   fetched block to the current block number.
    while (true) {
      // for (let i = rangeStartBlock; i > rangeEndBlock; i -= chunkSize) {
      if (!shouldFetchProposals.value) return;
      console.log(
        "BGsm fetch ProposalCreated events from: ",
        fromBlock,
        " to ",
        toBlock,
      );

      let chunkEvents;
      while (true) {
        console.log("getPastEvents chunkSize: ", chunkSize);
        try {
          chunkEvents = await fundStore.fundGovernorContract.getPastEvents(
            "ProposalCreated",
            {
              fromBlock,
              toBlock,
            },
          );
          console.log(
            "chunkevents fetched: ",
            chunkEvents,
            " chunksize: ",
            chunkSize,
          );

          chunkSize *= 2;
          console.log("new chunkSize: ", chunkSize);
          waitTimeAfterError = Math.max(INITIAL_WAIT_TIME_AFTER_ERROR, waitTimeAfterError / 2);
          break;
        } catch (error: any) {
          // Wait max 10 seconds.
          waitTimeAfterError = Math.min(MAX_WAIT_TIME_AFTER_ERROR, waitTimeAfterError * 2);
          console.error(
            "getPastEvents",
            fromBlock,
            toBlock,
            "error, wait ",
            waitTimeAfterError,
            error,
          );

          if (chunkSize / 2 >= INITIAL_CHUNK_SIZE) {
            // We probably tried fetching a range that is too big, reduce the chunk size by half
            // and fix the fromBlock range.
            chunkSize /= 2;
            console.log("reduce chunkSize: ", chunkSize);
            fromBlock = Math.max(toBlock - chunkSize + 1, 0);
          }
          if (chunkSize <= INITIAL_CHUNK_SIZE) {
            console.log("[PROPOSAL FETCH] switch to another RPC")
            waitTimeAfterError = INITIAL_WAIT_TIME_AFTER_ERROR;
            web3Store.switchRpcUrl();
          }
          await new Promise((resolve) =>
            setTimeout(resolve, waitTimeAfterError),
          );
        }
      }

      if (chunkEvents?.length) {
        await governanceProposalStore.parseProposalCreatedEvents(chunkEvents);
      }

      console.log(
        "set BlockFetchedRanges toBlock: ",
        toBlock,
        " fromBlock ",
        fromBlock,
      );
      governanceProposalStore.setFundProposalsBlockFetchedRanges(
        fundStore.selectedFundChain,
        fundAddress,
        toBlock,
        fromBlock,
      );

      // Proposals were fetched successfully.
      // Increase from and to blocks range.
      toBlock = fromBlock - 1;
      fromBlock = Math.max(toBlock - chunkSize + 1, 0);
      console.warn("fromBlock: ", +fromBlock, "toBlock: ", toBlock);

      const lastProposal =
        governanceProposals.value[governanceProposals.value.length - 1];
      console.warn("LAST PROPOSAL", lastProposal);
      if (toBlock <= 0 || lastProposal?.createdTimestamp < targetTimestamp) {
        break;
      }
    }
  } else {
    console.warn("\nsmallest to BIGGEST", rangeStartBlock, rangeEndBlock);

    let fromBlock = Math.max(rangeStartBlock, 0);
    let toBlock = Math.min(fromBlock + chunkSize - 1, rangeEndBlock);
    while (true) {
      // let i = rangeStartBlock; i < rangeEndBlock; i += chunkSize) {
      if (!shouldFetchProposals.value) return;

      console.log("getPastEvents chunkSize: ", chunkSize);
      let chunkEvents;
      while (chunkSize > 100 && chunkSize > 0) {
        console.log(
          "smBG fetch ProposalCreated events from: ",
          fromBlock,
          " to ",
          toBlock,
        );
        try {
          chunkEvents = await fundStore.fundGovernorContract.getPastEvents(
            "ProposalCreated",
            {
              fromBlock,
              toBlock,
            },
          );

          console.log(
            "chunkevents fetched: ",
            chunkEvents,
            " chunksize: ",
            chunkSize,
          );
          // All good, we can try increasing the chunk size by 2 to fetch bigger event ranges at once.
          chunkSize *= 2;
          console.log("new chunkSize: ", chunkSize);
          waitTimeAfterError = Math.max(INITIAL_WAIT_TIME_AFTER_ERROR, waitTimeAfterError / 2);
          break;
        } catch (error: any) {
          // Wait max 10 seconds.
          waitTimeAfterError = Math.min(MAX_WAIT_TIME_AFTER_ERROR, waitTimeAfterError * 2);
          console.error(
            "getPastEvents",
            fromBlock,
            toBlock,
            "error, wait ",
            waitTimeAfterError,
            error,
          );

          if (chunkSize / 2 >= INITIAL_CHUNK_SIZE) {
            // We probably tried fetching a range that is too big, reduce the chunk size by half
            // and fix the toBlock range.
            chunkSize /= 2;
            console.log("reduce chunkSize: ", chunkSize);
            toBlock = Math.min(fromBlock + chunkSize - 1, rangeEndBlock);
          }
          if (chunkSize <= INITIAL_CHUNK_SIZE) {
            console.log("[PROPOSAL FETCH] switch to another RPC")
            waitTimeAfterError = INITIAL_WAIT_TIME_AFTER_ERROR;
            web3Store.switchRpcUrl();
          }
          await new Promise((resolve) =>
            setTimeout(resolve, waitTimeAfterError),
          );
        }
      }

      if (chunkEvents?.length) {
        await governanceProposalStore.parseProposalCreatedEvents(chunkEvents);
      }
      governanceProposalStore.setFundProposalsBlockFetchedRanges(
        fundStore.selectedFundChain,
        fundAddress,
        toBlock,
        fromBlock,
      );

      // Proposals were fetched successfully.
      // Increase from and to blocks range.
      fromBlock = toBlock + 1;
      toBlock += chunkSize - 1;
      toBlock = Math.max(fromBlock + chunkSize - 1, rangeEndBlock);

      console.warn("fromBlock: ", +fromBlock, "toBlocK: ", toBlock);

      const lastProposal =
        governanceProposals.value[governanceProposals.value.length];
      if (
        fromBlock >= rangeEndBlock ||
        lastProposal?.createdTimestamp < targetTimestamp
      ) {
        break;
      }
    }
  }

  loadingProposals.value = false;
};
 */
// TODO iterate over all already fetched proposals that are still votable and update their state (createdBlockNumber).
onMounted(async () => {
  // fetchTrendingDelegates();
  await Promise.all([
    governanceProposalStore.fetchGovernanceProposals(),
    governanceProposalStore.fetchDelegates(),
  ]);
});

onBeforeUnmount(() => {
  console.log("Component is being unmounted, stopping the fetch");
  shouldFetchProposals.value = false;
  shouldFetchTrendingDelegates.value = false;
  // loadingProposals.value = false;
  // loadingTrendingDelegate.value = false;
});

/**
const startFetchingFundProposals = async () => {
  const fundAddress = fundStore.fundAddress;
  console.warn("STAAAART governance proposal events for fund: ", fundAddress);
  if (!fundAddress) return;

  // if (shouldFetchProposals.value) {
  //   console.log("stop fetching");
  //   shouldFetchProposals.value = false;
  //   loadingProposals.value = false;
  //   return;
  // }
  console.log("\n\n__________");
  console.log("fetch governance proposal events for fund: ", fundAddress);
  shouldFetchProposals.value = true;

  loadingProposals.value = true;
  let currentBlock;
  // TODO: different RPC providers can return different block numbers, especially if they are not fully synchronized
  //   or if they have latency issues. This happens because each RPC node might be at a slightly different state of
  //   the blockchain, particularly during times of heavy network traffic or when the nodes are under maintenance.
  while (currentBlock === undefined) {
    try {
      currentBlock = Number(await fundStore.web3.eth.getBlockNumber());
      console.log("currentBlock: ", currentBlock);
    } catch (error: any) {
      console.log("failed fetching currentBlock: ", error);
    }
  }
  loadingProposals.value = false;

  const [mostRecentFetchedBlock, oldestFetchedBlock] =
    governanceProposalStore.getFundProposalsBlockFetchedRanges(
      fundStore.selectedFundChain,
      fundAddress,
    );
  console.log(
    "mostRecentFetchedBlock: ",
    mostRecentFetchedBlock,
    "oldestFetchedBlock:",
    oldestFetchedBlock,
  );

  if (
    mostRecentFetchedBlock !== undefined &&
    oldestFetchedBlock !== undefined
  ) {
    console.log(
      "fetch from last fetched block to current block",
      currentBlock,
      mostRecentFetchedBlock,
    );
    // From smallest to biggest.
    // But only if current block is bigger than most recent already fetched block.
    if (currentBlock > mostRecentFetchedBlock) {
      // show loading skeleton at the top of the table (prepend)
      // when fetching proposals from the most recent fetched block to the current block
      await fetchProposals(mostRecentFetchedBlock + 1, currentBlock, "prepend");
    }

    // fetch from the already fetched the oldest block number to hardcoded limit oldest date.
    // ---------| oldest fetched | xxxxxxxxxx <to fetch> xxxxxxxxxx | GENESIS BLOCK
    console.log(
      "fetch from already fetched oldest block to 0",
      oldestFetchedBlock,
    );
    // From biggest to smallest
    if (oldestFetchedBlock) {
      await fetchProposals(oldestFetchedBlock - 1, 0);
    }
  } else {
    // Fetch all history.
    governanceProposalStore.resetProposals(
      fundStore.selectedFundChain,
      fundStore.fundAddress,
    );
    console.log("fetch all blocks");
    await fetchProposals(currentBlock, 0);
  }
};
 */
const handleDelegateSuccess = async () => {
  // loadingTrendingDelegate.value = true;
  // await 2000ms before fetching
  await new Promise((resolve) => setTimeout(resolve, 2000));
  // fetchTrendingDelegates();
  // fundStore.fetchUserFundDelegateAddress();
};

const isFetchingProposals = computed(() => {
  const actionStates = actionStateStore.getActionState("fetchGovernanceProposalsAction");

  if (!actionStates) return false;

  const isLoadingState = actionStates.includes(ActionState.Loading);
  const hasNeverLoaded = !actionStates.includes(ActionState.Success) &&
                        !actionStates.includes(ActionState.Error);

  return isLoadingState || hasNeverLoaded;
});

const isFetchingDelegates = computed(() => {
  const actionStates = actionStateStore.getActionState("fetchDelegatesAction");

  if (!actionStates) return false;

  const isLoadingState = actionStates.includes(ActionState.Loading);
  const hasNeverLoaded = !actionStates.includes(ActionState.Success) &&
                        !actionStates.includes(ActionState.Error);

  return isLoadingState || hasNeverLoaded;
});
</script>

<style scoped lang="scss">
// overrides for expansion-panel
.data_row_card {
  margin-bottom: 2.5rem;
  overflow: unset;

  @include sm {
    margin-bottom: 1rem;
  }

  // remove outer border
  :deep(.data_row__panel) {
    border: 0;
  }
  // add more spacing to content inside
  :deep(.v-expansion-panel-text__wrapper) {
    padding-bottom: 2rem;
  }
  :deep(.v-expansion-panel-title) {
    padding: 1.5rem;
    font-size: 1rem;
  }
  // add borders to text fields inside panel
  :deep(.v-expansion-panels) {
    border-radius: 0.25rem !important;

    .data_row__panel {
      padding: 0;
    }
  }
}

.tools {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 2rem;

  &__success-rate {
    display: flex;
    flex-direction: column;
    align-items: end;
  }

  &__val {
    font-weight: 700;
    font-size: $text-md;
    color: $color-white;
  }

  &__subtext {
    font-weight: 500;
    font-size: $text-sm;
  }
}

.tools__all-activity-btn {
  @include borderGray;
  display: flex;
  flex-direction: row;

  &__subtext {
    color: $color-text-irrelevant;
    font-size: $text-sm;
    font-weight: 500;
    margin: 0 0.75rem;
  }
}
.manage_button {
  color: rgb(210, 223, 255) !important;
  padding-inline: 16px !important;
}

.confirm_dialog {
  max-width: unset;
}

.delegator-item{
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.title{
  font-weight: 700;
  color: $color-white;
  margin-bottom: 0.5rem;
}
</style>
