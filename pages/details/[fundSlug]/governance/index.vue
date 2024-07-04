<template>
  <div class="page-governance">
    <UiDataRowCard title="Governance Settings" class="data_row_card">
      <template #body>
        <FundOverviewGovernance :fund="fund" />
      </template>
    </UiDataRowCard>

    <UiMainCard title="Governance Activity" :subtitle="pendingProposalsCountText">
      <template #header-right>
        <UiDropdown :options="dropdownOptions" label="Create Proposal" @click="startFetch" />
      </template>
      <template #tools>
        <v-btn
          class="tools__all-activity-btn text-secondary"
          variant="outlined"
        >
          <div>All Activity</div>
          <div class="tools__all-activity-btn__subtext">
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
      <FundGovernanceProposalsTable :items="governanceProposals" :loading="loadingProposals" />
    </UiMainCard>

    <UiMainCard title="Trending Delegates" subtitle="4 Delegated Wallets">
      <template #header-right>
        <UiLinkExternalButton
          class="main-card__manage-button"
          title="Manage Delegation"
          :href="manageDelegateUrl"
        />
      </template>
      <TableTrendingDelegates :items="trendingDelegates" />
    </UiMainCard>
  </div>
</template>

<script setup lang="ts">
// types
import type IFund from "~/types/fund";
import type ITrendingDelegates from "~/types/trending_delegates";


// components
import TableTrendingDelegates from "~/components/fund/governance/TableTrendingDelegates.vue";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import { ProposalState, ProposalStateMapping } from "~/types/enums/governance_proposal";
import { ClockMode } from "~/types/enums/clock_mode";
import { useGovernanceProposalsStore } from "~/store/governance_proposals.store";
import { useWeb3Store } from "~/store/web3.store";
const fundStore = useFundStore();
const toastStore = useToastStore();
const web3Store = useWeb3Store();
const governanceProposalStore = useGovernanceProposalsStore();

// dummy data for manage delegate button
const manageDelegateUrl = "https://www.google.com";

// dummy data governance activity
const governanceProposals = computed(() => {
  const proposals = governanceProposalStore.getProposals(web3Store.chainId, fundStore.fund?.address)

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
  return governanceProposals.value.filter(proposal => proposal.state === ProposalState.Pending);
});
const pendingProposalsCountText = computed(() => {
  if (pendingProposals.value.length === 1) {
    return "1 Pending Proposal";
  }
  return pendingProposals.value.length + " Pending Proposals";
});
const proposalsSuccessRate = computed(() => {
  const successProposals = governanceProposals.value.filter(proposal => [ProposalState.Succeeded, ProposalState.Executed].includes(proposal.state));
  const allFinishedProposalsCount = governanceProposals.value.length - pendingProposals.value.length;
  let successRate = 0;
  if (allFinishedProposalsCount) {
    successRate = successProposals.length / (governanceProposals.value.length - pendingProposals.value.length)
  }
  return formatPercent(successRate, false)
});

// fetchProposals can be a super long-lasting process, so if the user changes
// page we want to stop fetching proposals.
const shouldFetchProposals = ref(false);

// Dummy data for trending delegates
const trendingDelegates: ITrendingDelegates[] = [
  {
    delegated_members: "0x1f98dgdaddasdfgF984",
    delegators: "16 Members",
    impact: "10%",
    voting_power: "570.000.000 SOON",
  },
  {
    delegated_members: "0xEd2026078669d1135991E850c88Cf71cdAEB4d00",
    delegators: "13 Members",
    impact: "20%",
    voting_power: "850.000.000 SOON",
  },
  {
    delegated_members: "0x1f98dgdaddasdfgF984",
    delegators: "8 Members",
    impact: "8%",
    voting_power: "440.000.000 SOON",
  },
  {
    delegated_members: "0xEd2026078669d1135991E850c88Cf71cdAEB4d00",
    delegators: "5 Members",
    impact: "16%",
    voting_power: "720.000.000 SOON",
  },
];
// Dummy data for dropdown options
const dropdownOptions = [
  "Delegated permissions",
  "Direct Execution",
  "NAV Methods",  // TODO link to NAV methods, already exists
  "Fund Settings",   // TODO disabled
];

const fund = useAttrs().fund as IFund;
const loadingProposals = ref(false);


const fetchProposals = async (rangeStartBlock: number, rangeEndBlock: number) => {
  if (!fundStore.fund?.governanceToken.decimals) {
    console.error("No fund governance token decimals found.")
    toastStore.errorToast("No fund governance token decimals found.")
    return
  }
  if (!fundStore.fund.clockMode?.mode) {
    console.error("Fund clock mode is unknown.")
    toastStore.errorToast("Fund clock mode is unknown.")
    return
  }
  loadingProposals.value = true;

  // TODO arbitrum1 RPCs can take ranges of more blocks, like 1M, polygon cries if we use more than 3k
  // It looks like this range is arbitrary, specific to RPC, so we should try and guess it and increase exponentially
  // until they block us, and then we decrease it.
  // some RPCs can take more than 1M in arbitrum if logged in
  // let chunkSize = 1000000;
  let chunkSize = 3000;
  let maxValidChunkSize;

  // TODO we can do batch requests for example 10x3000
  // We have to fetch events in ranges, as we can't fetch all events at once because of RPC limits.
  // We fetch from the most recent to least recent block number.
  const targetDate = new Date("2024-04-01T00:00:00Z");
  const targetTimestamp = Math.floor(targetDate.getTime() / 1000);

  // From the largest number to the smallest number.
  if (rangeStartBlock > rangeEndBlock) {
    console.log("BIGGEST to smallest")
    for (let i = rangeStartBlock; i > rangeEndBlock; i -= chunkSize) {
      if (!shouldFetchProposals.value) return;

      const toBlock = i;
      let fromBlock = Math.max(i - chunkSize + 1, 0);
      const block = await fundStore.web3.eth.getBlock(toBlock);
      const toBlockTimestamp = new Date(Number(block.timestamp) * 1000)
      console.log("fetch ProposalCreated events from: ", fromBlock, " to ", toBlock, " timestamp: ", toBlockTimestamp);

      let chunkEvents;
      while (chunkSize > 100 && chunkSize > 0) {
        console.log("getPastEvents chunkSize: ", chunkSize);
        try {
          chunkEvents = await fundStore.fundGovernorContract.getPastEvents("ProposalCreated", {
            fromBlock,
            toBlock,
          });
          console.log("chunkevents fetched: ", chunkEvents, " chunksize: ", chunkSize, maxValidChunkSize);

          if (!maxValidChunkSize || chunkSize * 2 <= maxValidChunkSize) {
            chunkSize *= 2;
            console.log("new chunkSize: ", chunkSize);
          }
          break
        } catch {
          chunkSize /= 2;
          maxValidChunkSize = chunkSize;
          console.log("reduce chunkSize: ", chunkSize);
          fromBlock = Math.max(i - chunkSize + 1, 0);
        }
      }

      await governanceProposalStore.parseProposalCreatedEvents(chunkEvents);

      console.log("set BlockFetchedRanges toBlock: ", toBlock, " fromBlock ", fromBlock);
      governanceProposalStore.setFundProposalsBlockFetchedRanges(
        web3Store.chainId,
        fundStore.fund?.address,
        toBlock,
        fromBlock,
      )
      await new Promise(resolve => setTimeout(resolve, 1000));

      const lastProposal = governanceProposals.value[governanceProposals.value.length];
      if (lastProposal?.createdTimestamp < targetTimestamp) {
        break;
      }
    }
  } else {
    console.log("smallest to BIGGEST")

    for (let i = rangeEndBlock; i < rangeStartBlock; i += chunkSize) {
      if (!shouldFetchProposals.value) return;
      const fromBlock = Math.max(i, 0);
      let toBlock = i + chunkSize - 1;
      const block = await fundStore.web3.eth.getBlock(toBlock);
      const toBlockTimestamp = new Date(Number(block.timestamp) * 1000)
      console.log("fetch ProposalCreated events from: ", fromBlock, " to ", toBlock, " timestamp: ", toBlockTimestamp);

      let chunkEvents;
      while (chunkSize > 100 && chunkSize > 0) {
        console.log("getPastEvents chunkSize: ", chunkSize);
        try {
          chunkEvents = await fundStore.fundGovernorContract.getPastEvents("ProposalCreated", {
            fromBlock,
            toBlock,
          });
          console.log("chunkevents fetched: ", chunkEvents, " chunksize: ", chunkSize, maxValidChunkSize);
          if (!maxValidChunkSize || chunkSize * 2 <= maxValidChunkSize) {
            chunkSize *= 2;
            console.log("new chunkSize: ", chunkSize);
          }
          break;
        } catch {
          chunkSize /= 2;
          maxValidChunkSize = chunkSize;
          console.log("reduce chunkSize: ", chunkSize);
          toBlock = Math.max(i + chunkSize - 1, 0);
        }
      }

      await governanceProposalStore.parseProposalCreatedEvents(chunkEvents);

      governanceProposalStore.setFundProposalsBlockFetchedRanges(
        web3Store.chainId,
        fundStore.fund?.address,
        toBlock,
        fromBlock,
      )
      // await new Promise(resolve => setTimeout(resolve, 1000));

      const lastProposal = governanceProposals.value[governanceProposals.value.length];
      if (lastProposal?.createdTimestamp < targetTimestamp) {
        break;
      }
    }
  }

  loadingProposals.value = false;
}

// TODO iterate over all already fetched proposals that are still votable and update their state (createdBlockNumber).
onMounted( () => {
  startFetch();
});
onBeforeUnmount(() => {
  console.log("Component is being unmounted, stopping the fetch");
  shouldFetchProposals.value = false;
  loadingProposals.value = false;
});

const startFetch = async () => {
  if (shouldFetchProposals.value) {
    console.log("stop fetching")
    shouldFetchProposals.value = false;
    loadingProposals.value = false;
    return
  }
  console.log("\n\n________________________");
  console.log("fetch governance proposal events for fund: ", fund.address);
  shouldFetchProposals.value = true;

  const currentBlock = Number(await fundStore.web3.eth.getBlockNumber());
  console.log("currentBlock: ", currentBlock);

  const [mostRecentFetchedBlock, oldestFetchedBlock] = governanceProposalStore.getFundProposalsBlockFetchedRanges(
    web3Store.chainId, fundStore.fund?.address,
  )
  console.log("mostRecentFetchedBlock: ", mostRecentFetchedBlock, "oldestFetchedBlock:", oldestFetchedBlock);


  if (mostRecentFetchedBlock !== undefined && oldestFetchedBlock !== undefined) {
    console.log("fetch from current block to most recent fetched block", currentBlock, mostRecentFetchedBlock)
    // From smallest to biggest.
    await fetchProposals(mostRecentFetchedBlock + 1, currentBlock);

    // fetch from the already fetched the oldest block number to hardcoded limit oldest date.
    // ---------| oldest fetched | xxxxxxxxxx <to fetch> xxxxxxxxxx | GENESIS BLOCK
    console.log("fetch from already fetched oldest block to 0", oldestFetchedBlock)
    // From biggest to smallest
    await fetchProposals(oldestFetchedBlock - 1, 0);
  } else {
    // Fetch all history.
    governanceProposalStore.resetProposals(web3Store.chainId, fundStore.fund?.address)
    console.log("fetch all blocks")
    await fetchProposals(currentBlock, 0);
  }
}
</script>

<style scoped lang="scss">
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

// overrides for expansion-panel
.data_row_card {
  margin-bottom: 2rem;

  // remove outer border
  :deep(.data_row__panel){
    border: 0;
    border-radius: 0.25rem !important;
    background-color: rgb(var(--v-theme-surface));
  }
    // add more spacing to content inside
    :deep(.v-expansion-panel-text__wrapper) {
      padding-bottom: 2rem;
    }
    // add borders to text fields inside panel
   :deep(.v-expansion-panels) {
      border: 1px solid $color-gray-transparent;
      border-radius: 0.25rem !important;

      .data_row__panel {
        padding: 0;
      }
    }
}
</style>
