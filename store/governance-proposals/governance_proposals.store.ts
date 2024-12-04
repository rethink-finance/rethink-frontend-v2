import { ethers } from "ethers";
import { defineStore } from "pinia";
import type { EventLog } from "web3";
import { eth, Web3 } from "web3";

import { useActionState } from "../actionState.store";
import { useToastStore } from "../toasts/toast.store";
import { fetchDelegatesAction } from "./actions/fetchDelegates.action";
import { fetchGovernanceProposalAction } from "./actions/fetchGovernanceProposal.action";
import { fetchGovernanceProposalsAction } from "./actions/fetchGovernanceProposals.action";

import { RethinkFundGovernor } from "~/assets/contracts/RethinkFundGovernor";
import { cleanComplexWeb3Data } from "~/composables/utils";
import { useFundStore } from "~/store/fund/fund.store";


import { decodeProposalCallData } from "~/composables/proposal/decodeProposalCallData";
import { useWeb3Store } from "~/store/web3/web3.store";
import type IDelegate from "~/types/delegate";
import { ClockMode } from "~/types/enums/clock_mode";
import { ProposalState, ProposalStateMapping } from "~/types/enums/governance_proposal";
import { ProposalCalldataType } from "~/types/enums/proposal_calldata_type";
import type IGovernanceProposal from "~/types/governance_proposal";

interface IState {
  /* Example fund proposals.
    {
      // Chain ID
      "0xa4b1": {
        // Fund ID
        0x74759a4607B97360956AbFd44cA4B2A0EC2A27C9: {
            // Proposal ID
            "12754787873337135482756554849130912527367661631787941145703427293581378830108": {}
        }
      }
    }
  */
  fundProposals: Record<string, Record<string, Record<string, IGovernanceProposal>>>;
  fundDelegates: Record<string, Record<string, Record<string, IDelegate>>>;
  /* Example from what to what range block history events were already fetched..
  {
    // Chain ID
    "0xa4b1": {
      // Fund ID
      0x74759a4607B97360956AbFd44cA4B2A0EC2A27C9: [
        5000,  // the latest block fetched
        4200   // the oldest block fetched
      ]
    }
  }
  */
  fundProposalsBlockFetchedRanges: Record<string, Record<string, number[]>>;
  connectedAccountProposalsHasVoted: Record<string, Record<string, boolean>>;
}

export const useGovernanceProposalsStore = defineStore({
  id: "governanceProposalStore",
  state: (): IState => ({
    fundProposals: getLocalStorageItem("fundProposals", {}) ?? {},
    fundDelegates: getLocalStorageItem("fundDelegates", {}) ?? {},
    fundProposalsBlockFetchedRanges:
      getLocalStorageItem("fundProposalsBlockFetchedRanges", {}) ?? {},
    connectedAccountProposalsHasVoted: {},
  }),
  getters: {
    fundStore(): any {
      return useFundStore();
    },
    toastStore(): any {
      return useToastStore();
    },
    web3Store(): any {
      return useWeb3Store();
    },
  },
  actions: {
    callWithRetry(method: any): any {
      return this.web3Store.callWithRetry(method);
    },
    resetProposals(chainId: string, fundAddress?: string): void {
      if (!fundAddress) return;

      const chainData = this.fundProposals?.[chainId];
      console.debug("this.fundProposals: ", this.fundProposals, typeof this.fundProposals)
      if (!(chainData)) {
        this.fundProposals[chainId] = {};
      }
      this.fundProposals[chainId][fundAddress] = {};
      if (!this.fundProposalsBlockFetchedRanges[chainId]) {
        this.fundProposalsBlockFetchedRanges[chainId] = {};
      }
      this.fundProposalsBlockFetchedRanges[chainId][fundAddress] = [];
      setLocalStorageItem("fundProposals", this.fundProposals);
      setLocalStorageItem("fundProposalsBlockFetchedRanges",  this.fundProposalsBlockFetchedRanges);
    },
    storeProposal(
      chainId: string,
      fundAddress: string,
      proposal: IGovernanceProposal,
    ): void {
      this.fundProposals[chainId] ??= {};
      this.fundProposals[chainId][fundAddress] ??= {};
      this.fundProposals[chainId][fundAddress][proposal.proposalId] =
        cleanComplexWeb3Data(proposal);
      setLocalStorageItem("fundProposals", this.fundProposals);
    },
    storeProposals(
      chainId: string,
      fundAddress: string,
      proposals: IGovernanceProposal[],
    ): void {
      if (!chainId) {
        console.error("Cannot store proposals: chainId is required");
        return;
      }

      if (!fundAddress) {
        console.error("Cannot store proposals: fundAddress is required");
        return;
      }

      this.fundProposals[chainId] ??= {};
      this.fundProposals[chainId][fundAddress] ??= {};

      proposals.forEach((proposal) => {
        this.fundProposals[chainId][fundAddress][proposal.proposalId] =
          cleanComplexWeb3Data(proposal);
      });

      setLocalStorageItem("fundProposals", this.fundProposals);
    },
    storeDelegates(
      chainId: string,
      fundAddress: string,
      delegates: IDelegate[],
    ): void {
      if (!chainId) {
        console.error("Cannot store delegates: chainId is required");
        return;
      }

      if (!fundAddress) {
        console.error("Cannot store delegates: fundAddress is required");
        return;
      }

      this.fundDelegates[chainId] ??= {};
      this.fundDelegates[chainId][fundAddress] ??= {};

      delegates.forEach((delegate) => {
        this.fundDelegates[chainId][fundAddress][delegate.address] =
          cleanComplexWeb3Data(delegate);
      });

      setLocalStorageItem("fundDelegates", this.fundDelegates);
    },
    getProposals(chainId: string, fundAddress?: string): IGovernanceProposal[] {
      if (!fundAddress) return [];

      const chainData = this.fundProposals?.[chainId];
      if (!chainData) return [];

      const fundData = chainData[fundAddress];
      if (!fundData) return [];

      return Object.values(this.fundProposals[chainId][fundAddress]);
    },
    getProposal(
      chainId: string,
      fundAddress?: string,
      proposalId?: string,
    ): IGovernanceProposal | undefined {
      if (!fundAddress || !proposalId) return undefined;

      const chainData = this.fundProposals?.[chainId];
      if (!chainData) return undefined;

      const fundData = chainData[fundAddress];
      if (!fundData) return undefined;

      return fundData[proposalId];
    },
    getDelegates(chainId: string, fundAddress?: string): IDelegate[] {
      if (!fundAddress) return [];

      const chainData = this.fundDelegates?.[chainId];
      if (!chainData) return [];

      const fundData = chainData[fundAddress];
      if (!fundData) return [];

      return Object.values(this.fundDelegates[chainId][fundAddress]);
    },
    getDelegate(
      chainId: string,
      fundAddress?: string,
      delegateAddress?: string,
    ): IDelegate | undefined {
      if (!fundAddress || !delegateAddress) return undefined;

      const chainData = this.fundDelegates?.[chainId];
      if (!chainData) return undefined;

      const fundData = chainData[fundAddress];
      if (!fundData) return undefined;

      return this.fundDelegates?.[chainId]?.[fundAddress]?.[delegateAddress];
    },
    hasAccountVoted(proposalId: string): boolean | undefined {
      const activeAccountAddress = this.fundStore.activeAccountAddress;
      if (!activeAccountAddress) return false;
      if (this.connectedAccountProposalsHasVoted?.[proposalId] === undefined) {
        // This means that we don't know, vote status was not fetched yet or had some troubles fetching it.
        return undefined;
      }
      return this.connectedAccountProposalsHasVoted?.[proposalId]?.[activeAccountAddress];
    },
    getFundProposalsBlockFetchedRanges(
      chainId: string,
      fundAddress?: string,
    ): number[] | undefined[] {
      if (!fundAddress) return [undefined, undefined];

      const chainData = this.fundProposalsBlockFetchedRanges?.[chainId];
      if (!chainData) return [undefined, undefined];

      const fundData = chainData[fundAddress];
      if (!fundData) return [undefined, undefined];

      return fundData;
    },
    setFundProposalsBlockFetchedRanges(
      chainId: string,
      fundAddress: string,
      latestBlock: number,
      oldestBlock: number,
    ): void {
      this.fundProposalsBlockFetchedRanges[chainId] ??= {};
      this.fundProposalsBlockFetchedRanges[chainId][fundAddress] ??= [];
      const currentRange = this.fundProposalsBlockFetchedRanges[chainId][fundAddress];

      if (currentRange.length) {
        let currentMostRecentBlock = currentRange[0];
        let currentOldestBlock = currentRange[1];

        if (latestBlock > currentMostRecentBlock) {
          currentMostRecentBlock = latestBlock;
        }
        if (oldestBlock < currentOldestBlock) {
          currentOldestBlock = oldestBlock;
        }
        this.fundProposalsBlockFetchedRanges[chainId][fundAddress] = [
          currentMostRecentBlock,
          currentOldestBlock,
        ];
      } else {
        this.fundProposalsBlockFetchedRanges[chainId][fundAddress] = [
          latestBlock,
          oldestBlock,
        ];
      }
      setLocalStorageItem(
        "fundProposalsBlockFetchedRanges",
        cleanComplexWeb3Data(this.fundProposalsBlockFetchedRanges),
      );
    },
    fetchDelegates() {
      return useActionState(
        "fetchDelegatesAction",
        () => fetchDelegatesAction(),
      );
    },
    fetchGovernanceProposals() {
      return useActionState(
        "fetchGovernanceProposalsAction",
        () => fetchGovernanceProposalsAction(),
      );
    },
    fetchGovernanceProposal(proposalId: string) {
      return useActionState(
        "fetchGovernanceProposalAction",
        () => fetchGovernanceProposalAction(proposalId),
      );
    },
    decodeProposalCreatedEvent(
      event: EventLog,
    ): IGovernanceProposal | undefined {
      if (!event.raw) return undefined;
      const topics = event.raw?.topics as string[];

      // Decode event data.
      const decodedEvent = eth.abi.decodeLog(
        proposalCreatedEventInputs ?? [],
        event.raw?.data ?? "",
        topics.slice(1),
      );
      const proposal = cleanComplexWeb3Data(decodedEvent) as IGovernanceProposal;

      try {
        proposal.descriptionHash = ethers.id(proposal.description);
        const parsedDescription = JSON.parse(proposal.description);
        proposal.title = parsedDescription.title;
        proposal.description = parsedDescription.description;
      } catch {
        proposal.title = proposal.description;
      }
      console.debug("event decoded");
      return proposal
    },
    async fetchBlockProposals(blockNumber: bigint) {
      console.debug("fetchBlockProposals:", blockNumber);
      const proposalCreatedEvents = await this.callWithRetry(() =>
        this.fundStore.fundGovernorContract.getPastEvents("ProposalCreated", {
          fromBlock: blockNumber,
          toBlock: blockNumber,
        }),
      );
      console.debug("fetchBlockProposals events:", proposalCreatedEvents);
      await this.parseProposalCreatedEvents(proposalCreatedEvents);
    },
    async proposalExecutedBlockNumber(proposal: IGovernanceProposal) {
      // fetch the proposal executed block number
      try {
        // only fetch the executed block number if the proposal is executed
        if (proposal.state === ProposalState.Executed) {
          const currentBlock = Number(
            await this.fundStore.web3.eth.getBlockNumber(),
          );
          console.log("currentBlock:", currentBlock);

          const startBlock = BigInt(proposal.createdBlockNumber);
          const endBlock = BigInt(currentBlock);
          const chunkSize = 3000n;
          let proposalExecutedEvents: any[] = [];

          for (
            let fromBlock = startBlock;
            fromBlock <= endBlock;
            fromBlock += chunkSize
          ) {
            const toBlock =
              fromBlock + chunkSize - 1n > endBlock
                ? endBlock
                : fromBlock + chunkSize - 1n;
            console.debug(`Fetching events from ${fromBlock} to ${toBlock}`);

            const events = await this.fundStore.fundGovernorContract.getPastEvents(
              "ProposalExecuted",
              {
                fromBlock: Number(fromBlock),
                toBlock: Number(toBlock),
              },
            );

            proposalExecutedEvents = proposalExecutedEvents.concat(events);

            console.debug("proposalExecutedEvents: ", proposalExecutedEvents);

            // find the correct executed event for the proposal and break the loop
            if (proposalExecutedEvents.length > 0) {
              const executedEvent = proposalExecutedEvents.find(
                (event: any) =>
                  event.returnValues.proposalId.toString() ===
                  proposal.proposalId,
              );

              console.debug("proposal executed event: ", executedEvent);

              if (executedEvent) {
                const blockExecuted = await this.fundStore.web3.eth.getBlock(
                  executedEvent.blockNumber,
                );
                console.log("blockExecuted: ", blockExecuted);
                proposal.executedTimestamp = Number(blockExecuted.timestamp);
                proposal.executedBlockNumber = executedEvent.blockNumber;
                // store proposal
                console.debug("proposal with executed data:", proposal);
                this.storeProposal(
                  this.web3Store.chainId,
                  this.fundStore.fund?.address,
                  proposal,
                );
                break;
              }
            }
          }
        }
      } catch (e) {
        console.error("error fetching ProposalExecuted: ", e);
      }
    },
    async getBlockPerHoursRate() {
      const web3 = this.getWeb3InstanceByChainId();

      const currentBlock = await web3.eth.getBlock("latest");
      const currentBlockNumber = Number(currentBlock.number);
      const currentBlockTimestamp = Number(currentBlock.timestamp);

      console.debug(`Current block number: ${currentBlockNumber}`);
      console.debug(`Current block timestamp: ${currentBlockTimestamp}`);

      const oneHourInSeconds = 3600;
      const targetTimestamp = currentBlockTimestamp - oneHourInSeconds;

      // find the block number for the target timestamp
      let low = 0;
      let high = currentBlockNumber;
      let targetBlock;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const block = await web3.eth.getBlock(mid);
        const blockTimestamp = Number(block.timestamp);

        // here we are trying to find the block that is closest to the target timestamp
        if (blockTimestamp < targetTimestamp) {
          low = mid + 1;
        } else if (blockTimestamp > targetTimestamp) {
          high = mid - 1;
        } else {
          targetBlock = block;
          break;
        }

        // check if the block is close enough to the target timestamp.
        // Target timestamp is approximately 1 hour ago from the current block timestamp.
        if (Math.abs(blockTimestamp - targetTimestamp) < oneHourInSeconds / 10) {
          targetBlock = block;
          break;
        }
      }

      // if we didn't find the block, we can just use the high block
      if (!targetBlock) {
        targetBlock = await web3.eth.getBlock(high);
      }

      // calculate how many blocks are produced in the last hour
      const blocksPerHour = (currentBlockNumber - Number(targetBlock.number)) / ((currentBlockTimestamp - Number(targetBlock.timestamp)) / oneHourInSeconds);

      console.debug(`Blocks per hour rate: ${blocksPerHour}`);
      return blocksPerHour;
    },
    async estimateTimestampFromBlockNumber(
      currentBlockNumber: number,
      currentBlockTimestamp: number,
      targetBlockNumber: number,
    ) {
      const blockPerHour = await this.getBlockPerHoursRate();
      // Calculate blocks per second instead of blocks per hour
      const blocksPerSecond = blockPerHour / 3600;
      // Calculate the number of blocks remaining
      const blocksRemaining = targetBlockNumber - currentBlockNumber;
      // Estimate how much time in seconds until the target block
      const estimatedTimeInSeconds = blocksRemaining / blocksPerSecond;
      // Estimate the target timestamp
      return currentBlockTimestamp + estimatedTimeInSeconds;
    },
    getWeb3InstanceByChainId() {
      // we can list more chainIdMap if needed
      // for now we know that arb-1 chain should use eth chain to get the block number and all the other stuff because arbi-1 saves events in eth chain
      const chainIdMap = {
        "0xa4b1": "0x1",
      };
      const chainId = this.web3Store.chainId as keyof typeof chainIdMap;
      const chainIdMapKey = chainIdMap[chainId];

      // if the chainIdMapKey is found, use the rpcUrl from the chainIdMap
      if (chainIdMapKey) {
        console.debug("chainIdMapKey: ", chainIdMapKey);
        return new Web3(this.web3Store.networksMap[chainIdMapKey].rpcUrl) as Web3;
      }
      // if the chainIdMapKey is not found, use the current web3
      console.debug("use the current web3");
      return this.fundStore.web3 as Web3;
    },
    async setProposalVoteStartEndTimestamp(proposal: IGovernanceProposal) {
      // If the clock mode is block number, we have to check a timestamp for the block number.
      if (this.fundStore.fund?.clockMode?.mode === ClockMode.Timestamp) {
        proposal.voteStartTimestamp = proposal.voteStart;
        proposal.voteEndTimestamp = proposal.voteEnd;
        return;
      }
      if (this.fundStore.fund?.clockMode?.mode !== ClockMode.BlockNumber) {
        proposal.voteEndTimestamp = undefined;
        proposal.voteStartTimestamp = undefined;
        return;
      }
      try {
        const web3 = this.getWeb3InstanceByChainId();

        // get the latest block
        const currentBlock = await web3.eth.getBlock("latest");
        const currentBlockNumber = Number(currentBlock.number);
        const currentBlockTimestamp = Number(currentBlock.timestamp);
        console.debug("currentBlock: ", currentBlock);

        // if the voteEnd is in the past, we can fetch the block number
        if (Number(proposal.voteEnd) <= currentBlockNumber) {
          console.debug("fetch blockEnd");
          const blockEnd = await web3.eth.getBlock(proposal.voteEnd);
          console.debug("blockEnd: ", blockEnd);
          proposal.voteEndTimestamp = blockEnd?.timestamp.toString();
        } else {
          // if the voteEnd is in the future, we have to estimate the timestamp
          console.log("estimate blockEnd");
          const estimatedEndTimestamp =
            await this.estimateTimestampFromBlockNumber(
              currentBlockNumber,
              currentBlockTimestamp,
              Number(proposal.voteEnd),
            );
          console.log("estimatedEndTimestamp: ", estimatedEndTimestamp);
          proposal.voteEndTimestamp = estimatedEndTimestamp.toString();
        }

        // if the voteStart is in the past, we can fetch the block number
        if (Number(proposal.voteStart) <= currentBlockNumber) {
          console.debug("fetch blockStart");
          const blockStart = await web3.eth.getBlock(proposal.voteStart);
          console.debug("blockStart: ", blockStart);
          proposal.voteStartTimestamp = blockStart?.timestamp.toString();
        } else {
          // if the voteStart is in the future, we have to estimate the timestamp
          console.debug("estimate blockStart");
          const estimatedStartTimestamp =
            await this.estimateTimestampFromBlockNumber(
              currentBlockNumber,
              currentBlockTimestamp,
              Number(proposal.voteStart),
            );
          console.debug("estimatedStartTimestamp: ", estimatedStartTimestamp);
          proposal.voteStartTimestamp = estimatedStartTimestamp.toString();
        }
      } catch (error: any) {
        console.error(
          "failed fetching proposal vote start end timestamps for ",
          proposal,
        );
      }
    },
    async parseProposalCreatedEvents(events: any[]) {
      if (!events?.length) return;
      const fund = this.fundStore.fund;

      if (!fund?.governanceToken.decimals) {
        console.error("No OIV governance token decimals found.");
        this.toastStore.errorToast("No OIV governance token decimals found.");
        return;
      }
      if (!fund.clockMode?.mode) {
        console.error("OIV clock mode is unknown.");
        this.toastStore.errorToast("OIV clock mode is unknown.");
        return;
      }

      for (const event of events) {
        console.debug("event");
        console.debug(event);
        const proposal = this.decodeProposalCreatedEvent(event);
        if (!proposal) continue;

        const block = await this.fundStore.web3.eth.getBlock(event.blockNumber);
        proposal.createdTimestamp = Number(block.timestamp);
        proposal.createdDatetimeFormatted = formatDate(
          new Date(Number(block.timestamp) * 1000),
        );
        proposal.createdBlockNumber = event.blockNumber;

        // keep track of the proposal executed timestamp and block number if the proposal is executed
        const executedProposal = this.fundProposals?.[this.web3Store.chainId]?.[
          fund?.address
        ]?.[proposal.proposalId];
        proposal.executedTimestamp = executedProposal?.executedTimestamp;
        proposal.executedBlockNumber = executedProposal?.executedBlockNumber;

        const proposalState = await this.callWithRetry(() =>
          this.fundStore.fundGovernorContract.methods
            .state(proposal.proposalId)
            .call(),
        );
        proposal.state = ProposalStateMapping[proposalState];

        console.debug("proposal: ", proposal);

        await this.setProposalVoteStartEndTimestamp(proposal);
        console.debug("proposal:" , proposal);

        const votes = await this.callWithRetry(() =>
          this.fundStore.fundGovernorContract.methods
            .proposalVotes(proposal.proposalId)
            .call(),
        );
        console.debug("proposal votes: ", votes);

        console.debug(
          "get total supply at blockNumber: ",
          proposal.createdBlockNumber,
        );
        // Get the Governance Token total supply of when the proposal was created.
        let totalSupply;
        try {
          totalSupply = await this.callWithRetry(() =>
            this.fundStore.fundGovernanceTokenContract.methods
              .totalSupply()
              .call({}, proposal.createdBlockNumber),
          );
          proposal.totalSupply = totalSupply;
          proposal.totalSupplyFormatted = formatTokenValue(
            totalSupply,
            fund?.governanceToken?.decimals,
            false,
          );
        } catch (error: any) {
          // Sometimes it happens: missing trie node
          console.error("failed fetching total supply", error);
          proposal.totalSupplyFormatted = "N/A";
        }

        console.debug(
          "proposal created blockNumber ",
          proposal.createdBlockNumber,
          " timestamp ",
          proposal.createdTimestamp,
        );
        try {
          // To get quorum in time, we have to pass the timePoint, but it depends on the clock mode.
          // If clock mode is:
          // - timestamp: use proposal created timestamp
          // - blocknumber: use proposal created block number
          const timePoint =
            fund?.clockMode?.mode === ClockMode.BlockNumber
              ? proposal.createdBlockNumber
              : proposal.createdTimestamp;

          const quorumWhenProposalCreated = await this.callWithRetry(() =>
            this.fundStore.fundGovernorContract.methods
              .quorumNumerator(timePoint)
              .call(),
          );
          proposal.quorumVotes = quorumWhenProposalCreated;
          proposal.quorumVotesFormatted = formatTokenValue(
            quorumWhenProposalCreated,
            fund?.governanceToken?.decimals,
            false,
          );
        } catch (e: any) {
          console.error("error fetching quorumVotes: ", e);
          proposal.quorumVotesFormatted = "N/A";
        }

        console.debug("parse votes", votes);
        if (votes) {
          const totalVotes = votes.forVotes + votes.abstainVotes + votes.againstVotes;
          proposal.totalVotes = totalVotes;
          proposal.totalVotesFormatted = formatTokenValue(
            totalVotes,
            fund?.governanceToken.decimals,
            false,
          );
          proposal.forVotes = votes.forVotes;
          proposal.abstainVotes = votes.abstainVotes;
          proposal.againstVotes = votes.againstVotes;
          proposal.forVotesFormatted = formatTokenValue(
            votes.forVotes,
            fund?.governanceToken.decimals,
            false,
          );
          proposal.abstainVotesFormatted = formatTokenValue(
            votes.abstainVotes,
            fund?.governanceToken.decimals,
            false,
          );
          proposal.againstVotesFormatted = formatTokenValue(
            votes.againstVotes,
            fund?.governanceToken.decimals,
            false,
          );
          console.log("proposal votes", proposal);
          if (proposal.quorumVotes === 0n && Number(votes.forVotes) > 0) {
            // If quorum is 0, it means that there should be more than 0 FOR votes for proposal to pass.
            proposal.approval = 1;
            proposal.approvalFormatted = formatPercent(
              proposal.approval,
              false,
            );
          } else if (proposal.quorumVotes) {
            let approval =
              Number(votes.forVotes) / Number(proposal.quorumVotes);
            // Limit approval percentage to 100% max.
            if (approval > 1) {
              approval = 1;
            }
            proposal.approval = approval;
            proposal.approvalFormatted = formatPercent(approval, false);
          } else {
            proposal.approvalFormatted = "N/A";
          }

          // Participation is totalVotes / totalSupply
          if (totalSupply) {
            let participation = Number(totalVotes) / Number(totalSupply);
            // Limit participation percentage to 100% max.
            if (participation > 1) {
              participation = 1;
            }
            proposal.participation = participation;
            proposal.participationFormatted = formatPercent(
              participation,
              false,
            );
          } else {
            proposal.participationFormatted = "N/A";
          }
        }

        proposal.calldatasDecoded = [];
        proposal.calldataTypes = [];
        const roleModAddress = await this.fundStore.getRoleModAddress();

        proposal.calldatas.forEach((calldata, i) => {
          const calldataDecoded = decodeProposalCallData(roleModAddress, calldata, proposal.targets[i], fund?.safeAddress);
          proposal.calldataTypes.push(calldataDecoded?.calldataType);
          proposal.calldatasDecoded.push(calldataDecoded);
        });
        proposal.calldataTags = [
          ...new Set(
            proposal.calldataTypes.filter(
              (calldataType) =>
                calldataType !== ProposalCalldataType.UNDEFINED && calldataType !== undefined,
            ),
          ),
        ];
        this.storeProposal(
          this.web3Store.chainId,
          fund?.address,
          proposal,
        );
      }
    },
  },
});

const proposalCreatedEventInputs = (RethinkFundGovernor.abi.find(
  (event: any) => event.name === "ProposalCreated" && event.type === "event",
) as any)?.inputs ?? [];

