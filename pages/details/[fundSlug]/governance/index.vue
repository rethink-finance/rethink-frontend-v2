<template>
  <div class="page-governance">
    <UiDataRowCard title="Governance Settings" class="data_row_card">
      <template #body>
        <FundOverviewGovernance :fund="fund" />
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
          @click="startFetch"
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
        :loading="loadingProposals"
      />
    </UiMainCard>

    <UiMainCard title="Trending Delegates" subtitle="4 Delegated Wallets">
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
      <FundGovernanceTableTrendingDelegates :items="trendingDelegates" />
    </UiMainCard>

    <FundGovernanceModalDelegateVotes v-model="isDelegateDialogOpen" />

    <UiConfirmDialog
      v-model="confirmDialog"
      title="Heads Up!"
      confirm-text="Continue"
      :cancel-text="
        updateSettingsProposals.length > 1 ? 'Cancel' : 'Go to Proposal'
      "
      message="You can create a new one or check the ongoing activity first!"
      class="confirm_dialog"
      :max-width="updateSettingsProposals.length > 1 ? 'unset' : '600px'"
      @confirm="handleNavigateToCreateProposal"
      @cancel="
        updateSettingsProposals.length > 1 ? null : handleGoToFProposal()
      "
    >
      <FundGovernanceProposalsTable
        v-if="updateSettingsProposals.length > 1"
        :items="updateSettingsProposals"
        :loading="loadingProposals"
        style="margin-top: 2rem"
      />
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import type ITrendingDelegates from "~/types/trending_delegates";

// components
import { useAccountStore } from "~/store/account.store";
import { useFundStore } from "~/store/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance_proposals.store";
import { useToastStore } from "~/store/toast.store";
import { useWeb3Store } from "~/store/web3.store";
import { ProposalState } from "~/types/enums/governance_proposal";
import { ProposalCalldataType } from "~/types/enums/proposal_calldata_type";
import type IGovernanceProposal from "~/types/governance_proposal";
const router = useRouter();
const accountStore = useAccountStore();
const fundStore = useFundStore();
const toastStore = useToastStore();
const web3Store = useWeb3Store();
const governanceProposalStore = useGovernanceProposalsStore();

const confirmDialog = ref(false);
const updateSettingsProposals = ref([]) as Ref<IGovernanceProposal[]>;
const { shouldUserDelegate } = toRefs(fundStore);

// dummy data governance activity
const governanceProposals = computed(() => {
  const proposals = governanceProposalStore.getProposals(
    web3Store.chainId,
    fundStore.fund?.address,
  );

  // set updateSettingsProposals to proposals that have updateSettings calldata
  updateSettingsProposals.value = proposals.filter((proposal) => {
    return proposal.calldataTags?.some(
      (calldata) => calldata === ProposalCalldataType.FUND_SETTINGS,
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

// TODO Dummy data for trending delegates
const trendingDelegates: ITrendingDelegates[] = [
  // {
  //   delegated_members: "0x1f98dgdaddasdfgF984",
  //   delegators: "16 Members",
  //   impact: "10%",
  //   voting_power: "570.000.000 SOON",
  // },
  // {
  //   delegated_members: "0xEd2026078669d1135991E850c88Cf71cdAEB4d00",
  //   delegators: "13 Members",
  //   impact: "20%",
  //   voting_power: "850.000.000 SOON",
  // },
  // {
  //   delegated_members: "0x1f98dgdaddasdfgF984",
  //   delegators: "8 Members",
  //   impact: "8%",
  //   voting_power: "440.000.000 SOON",
  // },
  // {
  //   delegated_members: "0xEd2026078669d1135991E850c88Cf71cdAEB4d00",
  //   delegators: "5 Members",
  //   impact: "16%",
  //   voting_power: "720.000.000 SOON",
  // },
];

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
  "Fund Settings": {
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
};
const handleGoToFProposal = () => {
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

const fund = useAttrs().fund as IFund;
const loadingProposals = ref(false);

// delegate dialog
const isDelegateDialogOpen = ref(false);

const openDelegateDialog = () => {
  console.log("openDelegateDialog");
  isDelegateDialogOpen.value = true;
};

const fetchProposals = async (
  rangeStartBlock: number,
  rangeEndBlock: number,
) => {
  if (!fundStore.fund?.governanceToken.decimals) {
    console.error("No fund governance token decimals found.");
    toastStore.errorToast("No fund governance token decimals found.");
    return;
  }
  if (!fundStore.fund.clockMode?.mode) {
    console.error("Fund clock mode is unknown.");
    toastStore.errorToast("Fund clock mode is unknown.");
    return;
  }
  loadingProposals.value = true;

  // TODO arbitrum1 RPCs can take ranges of more blocks, like 1M, polygon cries if we use more than 3k
  // It looks like this range is arbitrary, specific to RPC, so we should try and guess it and increase exponentially
  // until they block us, and then we decrease it.
  // some RPCs can take more than 1M in arbitrum if logged in
  // let chunkSize = 1000000;
  const INITIAL_CHUNK_SIZE = 1500;
  let chunkSize = INITIAL_CHUNK_SIZE;
  let waitTimeAfterError = 1000;

  // TODO we can do batch requests for example 10x3000
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
          waitTimeAfterError = Math.max(1000, waitTimeAfterError / 2);
          break;
        } catch (error: any) {
          // Wait max 10 seconds.
          waitTimeAfterError = Math.min(10000, waitTimeAfterError * 2);
          console.error(
            "getPastEvents",
            fromBlock,
            toBlock,
            "error, wait ",
            waitTimeAfterError,
            error,
          );

          if (chunkSize / 2 > INITIAL_CHUNK_SIZE) {
            // We probably tried fetching a range that is too big, reduce the chunk size by half
            // and fix the fromBlock range.
            chunkSize /= 2;
            console.log("reduce chunkSize: ", chunkSize);
            fromBlock = Math.max(toBlock - chunkSize + 1, 0);
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
        web3Store.chainId,
        fundStore.fund?.address,
        toBlock,
        fromBlock,
      );

      // Proposals were fetched successfully.
      // Increase from and to blocks range.
      toBlock = fromBlock - 1;
      fromBlock = Math.max(toBlock - chunkSize + 1, 0);
      console.warn("fromBlock: ", +fromBlock, "toBlocK: ", toBlock);

      const lastProposal = governanceProposals.value[governanceProposals.value.length - 1];
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
          waitTimeAfterError = Math.max(1000, waitTimeAfterError / 2);
          break;
        } catch (error: any) {
          // Wait max 10 seconds.
          waitTimeAfterError = Math.min(10000, waitTimeAfterError * 2);
          console.error(
            "getPastEvents",
            fromBlock,
            toBlock,
            "error, wait ",
            waitTimeAfterError,
            error,
          );

          if (chunkSize / 2 > INITIAL_CHUNK_SIZE) {
            // We probably tried fetching a range that is too big, reduce the chunk size by half
            // and fix the toBlock range.
            chunkSize /= 2;
            console.log("reduce chunkSize: ", chunkSize);
            toBlock = Math.min(fromBlock + chunkSize - 1, rangeEndBlock);
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
        web3Store.chainId,
        fundStore.fund?.address,
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

// TODO iterate over all already fetched proposals that are still votable and update their state (createdBlockNumber).
onMounted(() => {
  startFetch();
});
onBeforeUnmount(() => {
  console.log("Component is being unmounted, stopping the fetch");
  shouldFetchProposals.value = false;
  loadingProposals.value = false;
});

const startFetch = async () => {
  if (shouldFetchProposals.value) {
    console.log("stop fetching");
    shouldFetchProposals.value = false;
    loadingProposals.value = false;
    return;
  }
  console.log("\n\n__________");
  console.log("fetch governance proposal events for fund: ", fund.address);
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
      web3Store.chainId,
      fundStore.fund?.address,
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
      currentBlock - 1,
      mostRecentFetchedBlock,
    );
    // From smallest to biggest.
    // But only if current block is bigger than most recent already fetched block.
    if (currentBlock - 1 > mostRecentFetchedBlock) {
      await fetchProposals(mostRecentFetchedBlock + 1, currentBlock - 1);
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
      web3Store.chainId,
      fundStore.fund?.address,
    );
    console.log("fetch all blocks");
    await fetchProposals(currentBlock, 0);
  }
};
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
</style>
