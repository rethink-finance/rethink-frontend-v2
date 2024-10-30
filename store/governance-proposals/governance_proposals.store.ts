import { ethers } from "ethers";
import { defineStore } from "pinia";
import type { AbiFunctionFragment, AbiInput, EventLog } from "web3";
import { eth, Web3 } from "web3";



import { useActionState } from "../actionState.store";
import { useToastStore } from "../toasts/toast.store";
import { fetchGovernanceProposalsAction } from "./actions/fetchGovernanceProposals.action";


import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { RethinkFundGovernor } from "~/assets/contracts/RethinkFundGovernor";
import GnosisSafeL2JSON from "~/assets/contracts/safe/GnosisSafeL2_v1_3_0.json";
import ZodiacRoles from "~/assets/contracts/zodiac/RolesFull.json";
import { cleanComplexWeb3Data } from "~/composables/utils";
import { useFundStore } from "~/store/fund/fund.store";


import { useWeb3Store } from "~/store/web3/web3.store";
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
  connectedAccountProposalsHasVoted: Record<string, Record<string, boolean>>,
}

export const useGovernanceProposalsStore = defineStore({
  id: "governanceProposalStore",
  state: (): IState => ({
    fundProposals: getLocalStorageItem("fundProposals", {}) ?? {},
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
      console.log(
        "this.fundProposals: ",
        this.fundProposals,
        typeof this.fundProposals,
      );
      if (!chainData) {
        this.fundProposals[chainId] = {};
      }
      this.fundProposals[chainId][fundAddress] = {};
      this.fundProposalsBlockFetchedRanges[chainId] = {};
      setLocalStorageItem("fundProposals", {});
      setLocalStorageItem("fundProposalsBlockFetchedRanges", {});
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
    hasAccountVoted(proposalId: string): boolean | undefined {
      const activeAccountAddress = this.fundStore.activeAccountAddress;
      if (!activeAccountAddress) return false;
      if (this.connectedAccountProposalsHasVoted?.[proposalId] === undefined) {
        // This means that we don't know, vote status was not fetched yet or had some troubles fetching it.
        return undefined;
      }
      return this.connectedAccountProposalsHasVoted?.[proposalId]?.[
        activeAccountAddress
      ];
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
      const currentRange =
        this.fundProposalsBlockFetchedRanges[chainId][fundAddress];

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
    async fetchGovernanceProposals() {
      return await useActionState(
        "fetchGovernanceProposalsAction",
        async () => await fetchGovernanceProposalsAction(),
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
      const proposal = cleanComplexWeb3Data(
        decodedEvent,
      ) as IGovernanceProposal;

      try {
        proposal.descriptionHash = ethers.keccak256(
          ethers.toUtf8Bytes(proposal.description),
        );
        const parsedDescription = JSON.parse(proposal.description);
        proposal.title = parsedDescription.title;
        proposal.description = parsedDescription.description;
      } catch {
        proposal.title = proposal.description;
      }
      console.log("event decoded");
      return proposal;
    },
    decodeProposalCallData(calldata: string): Record<any, any> | undefined {
      // Iterate over each method in ABI to find a match
      const signature = calldata.slice(0, 10);
      const encodedParameters = calldata.slice(10);
      const functionAbi = functionSignaturesMap[signature];
      // console.log("decode signature: ", signature, " ABI ", functionAbi);

      if (!functionAbi?.function?.name) {
        console.warn(
          "No existing function signature found in the GovernableFund ABI for ",
          signature,
          functionAbi,
        );
        return undefined;
      }
      const functionAbiInputs = functionAbi?.function?.inputs as AbiInput[];

      try {
        let decoded = eth.abi.decodeParameters(
          functionAbiInputs,
          encodedParameters,
        );
        decoded = cleanComplexWeb3Data(decoded);
        // console.log("decoded data: ", functionAbi.contractName, functionAbi.function.name, decoded);
        return {
          functionName: functionAbi.function.name,
          contractName: functionAbi.contractName,
          calldataDecoded: decoded,
          calldata,
        };
      } catch (error: any) {
        console.error("error while decoding signature: ", signature, error);
      }
      console.error(
        "FAILED decoding signature: ",
        signature,
        functionSignaturesMap[signature],
      );

      return undefined;
    },
    async fetchBlockProposals(blockNumber: bigint) {
      console.log("fetchBlockProposals:", blockNumber);
      const proposalCreatedEvents = await this.callWithRetry(() =>
        this.fundStore.fundGovernorContract.getPastEvents("ProposalCreated", {
          fromBlock: blockNumber,
          toBlock: blockNumber,
        }),
      );
      console.log("fetchBlockProposals events:", proposalCreatedEvents);
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
            console.log(`Fetching events from ${fromBlock} to ${toBlock}`);

            const events =
              await this.fundStore.fundGovernorContract.getPastEvents(
                "ProposalExecuted",
                {
                  fromBlock: Number(fromBlock),
                  toBlock: Number(toBlock),
                },
              );

            proposalExecutedEvents = proposalExecutedEvents.concat(events);

            console.log("proposalExecutedEvents: ", proposalExecutedEvents);

            // find the correct executed event for the proposal and break the loop
            if (proposalExecutedEvents.length > 0) {
              const executedEvent = proposalExecutedEvents.find(
                (event: any) =>
                  event.returnValues.proposalId.toString() ===
                  proposal.proposalId,
              );

              console.log("proposal executed event: ", executedEvent);

              if (executedEvent) {
                const blockExecuted = await this.fundStore.web3.eth.getBlock(
                  executedEvent.blockNumber,
                );
                console.log("blockExecuted: ", blockExecuted);
                proposal.executedTimestamp = Number(blockExecuted.timestamp);
                proposal.executedBlockNumber = executedEvent.blockNumber;
                // store proposal
                console.log("proposal with executed data:", proposal);
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

      console.log(`Current block number: ${currentBlockNumber}`);
      console.log(`Current block timestamp: ${currentBlockTimestamp}`);

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
        if (
          Math.abs(blockTimestamp - targetTimestamp) <
          oneHourInSeconds / 10
        ) {
          targetBlock = block;
          break;
        }
      }

      // if we didn't find the block, we can just use the high block
      if (!targetBlock) {
        targetBlock = await web3.eth.getBlock(high);
      }

      // calculate how many blocks are produced in the last hour
      const blocksPerHour =
        (currentBlockNumber - Number(targetBlock.number)) /
        ((currentBlockTimestamp - Number(targetBlock.timestamp)) /
          oneHourInSeconds);

      console.log(`Blocks per hour rate: ${blocksPerHour}`);
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
        console.log("chainIdMapKey: ", chainIdMapKey);
        return new Web3(
          this.web3Store.networksMap[chainIdMapKey].rpcUrl,
        ) as Web3;
      }
      // if the chainIdMapKey is not found, use the current web3
      console.log("use the current web3");
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
        console.log("currentBlock: ", currentBlock);

        // if the voteEnd is in the past, we can fetch the block number
        if (Number(proposal.voteEnd) <= currentBlockNumber) {
          console.log("fetch blockEnd");
          const blockEnd = await web3.eth.getBlock(proposal.voteEnd);
          console.log("blockEnd: ", blockEnd);
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
          console.log("fetch blockStart");
          const blockStart = await web3.eth.getBlock(proposal.voteStart);
          console.log("blockStart: ", blockStart);
          proposal.voteStartTimestamp = blockStart?.timestamp.toString();
        } else {
          // if the voteStart is in the future, we have to estimate the timestamp
          console.log("estimate blockStart");
          const estimatedStartTimestamp =
            await this.estimateTimestampFromBlockNumber(
              currentBlockNumber,
              currentBlockTimestamp,
              Number(proposal.voteStart),
            );
          console.log("estimatedStartTimestamp: ", estimatedStartTimestamp);
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

      if (!this.fundStore.fund?.governanceToken.decimals) {
        console.error("No fund governance token decimals found.");
        this.toastStore.errorToast("No fund governance token decimals found.");
        return;
      }
      if (!this.fundStore.fund.clockMode?.mode) {
        console.error("Fund clock mode is unknown.");
        this.toastStore.errorToast("Fund clock mode is unknown.");
        return;
      }
      const roleModAddress = await this.fundStore.getRoleModAddress();

      for (const event of events) {
        console.log("event");
        console.log(event);
        const proposal = this.decodeProposalCreatedEvent(event);
        if (!proposal) continue;

        const block = await this.fundStore.web3.eth.getBlock(event.blockNumber);
        proposal.createdTimestamp = Number(block.timestamp);
        proposal.createdDatetimeFormatted = formatDate(
          new Date(Number(block.timestamp) * 1000),
        );
        proposal.createdBlockNumber = event.blockNumber;

        // keep track of the proposal executed timestamp and block number if the proposal is executed
        const executedProposal =
          this.fundProposals?.[this.web3Store.chainId]?.[
            this.fundStore.fund?.address
          ]?.[proposal.proposalId];
        proposal.executedTimestamp = executedProposal?.executedTimestamp;
        proposal.executedBlockNumber = executedProposal?.executedBlockNumber;

        const proposalState = await this.callWithRetry(() =>
          this.fundStore.fundGovernorContract.methods
            .state(proposal.proposalId)
            .call(),
        );
        proposal.state = ProposalStateMapping[proposalState];

        console.log("proposal: ", proposal);

        await this.setProposalVoteStartEndTimestamp(proposal);
        console.log("proposal:", proposal);

        const votes = await this.callWithRetry(() =>
          this.fundStore.fundGovernorContract.methods
            .proposalVotes(proposal.proposalId)
            .call(),
        );
        console.log("proposal votes: ", votes);

        console.log(
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
            this.fundStore.fund?.governanceToken?.decimals,
            false,
          );
        } catch (error: any) {
          // Sometimes it happens: missing trie node
          console.error("failed fetching total supply", error);
          proposal.totalSupplyFormatted = "N/A";
        }

        console.log(
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
            this.fundStore.fund?.clockMode?.mode === ClockMode.BlockNumber
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
            this.fundStore.fund?.governanceToken?.decimals,
            false,
          );
        } catch (e: any) {
          console.error("error fetching quorumVotes: ", e);
          proposal.quorumVotesFormatted = "N/A";
        }

        console.log("parse votes", votes);
        if (votes) {
          const totalVotes =
            votes.forVotes + votes.abstainVotes + votes.againstVotes;
          proposal.totalVotes = totalVotes;
          proposal.totalVotesFormatted = formatTokenValue(
            totalVotes,
            this.fundStore.fund?.governanceToken.decimals,
            false,
          );
          proposal.forVotes = votes.forVotes;
          proposal.abstainVotes = votes.abstainVotes;
          proposal.againstVotes = votes.againstVotes;
          proposal.forVotesFormatted = formatTokenValue(
            votes.forVotes,
            this.fundStore.fund?.governanceToken.decimals,
            false,
          );
          proposal.abstainVotesFormatted = formatTokenValue(
            votes.abstainVotes,
            this.fundStore.fund?.governanceToken.decimals,
            false,
          );
          proposal.againstVotesFormatted = formatTokenValue(
            votes.againstVotes,
            this.fundStore.fund?.governanceToken.decimals,
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

        proposal.calldatas.forEach((calldata, i) => {
          const calldataDecoded = this.decodeProposalCallData(calldata);
          proposal.calldatasDecoded.push(calldataDecoded);

          if (calldataDecoded?.functionName === "updateNav") {
            proposal.calldataTypes.push(ProposalCalldataType.NAV_UPDATE);
          } else if (proposal.targets[i] === this.fundStore.fund?.safeAddress) {
            proposal.calldataTypes.push(ProposalCalldataType.DIRECT_EXECUTION);
          } else if (proposal.targets[i] === roleModAddress) {
            proposal.calldataTypes.push(ProposalCalldataType.PERMISSIONS);
          } else if (calldataDecoded?.functionName === "updateSettings") {
            proposal.calldataTypes.push(ProposalCalldataType.FUND_SETTINGS);
          } else {
            proposal.calldataTypes.push(ProposalCalldataType.UNDEFINED);
          }
        });
        proposal.calldataTags = [
          ...new Set(
            proposal.calldataTypes.filter(
              (calldataType) => calldataType !== ProposalCalldataType.UNDEFINED,
            ),
          ),
        ];

        this.storeProposal(
          this.web3Store.chainId,
          this.fundStore.fund?.address,
          proposal,
        );
      }
    },
  },
});

const proposalCreatedEventInputs = (RethinkFundGovernor.abi.find(
  (event: any) => event.name === "ProposalCreated" && event.type === "event",
) as any)?.inputs ?? [];

/**
 * Extract all function signatures from GovernableFund ABI
 * Iterate over all functions in GovernableFund ABI and generate a map of functionSignatureHash as key
 * and ABI function fragment as value. This will be used when decoding proposal call datas.
 */
const functionSignaturesMap: Record<string, any> = {};

// Iterate over different ABIs to extract function signatures that will later be used
// to decode proposal call data.
const contractsToExtractFunctionSignatures = [
  {
    abi: GovernableFund.abi,
    name: "GovernableFund",
  },
  {
    abi: GnosisSafeL2JSON.abi,
    name: "GnosisSafeL2",
  },
  {
    abi: ZodiacRoles.abi,
    name: "ZodiacRoles",
  },
];

contractsToExtractFunctionSignatures.forEach(contract => {
  contract.abi.forEach(item => {
    if (item.type === "function") {
      const functionSignatureHash = eth.abi.encodeFunctionSignature(item as AbiFunctionFragment);
      functionSignaturesMap[functionSignatureHash] = {
        function: item,
        contractName: contract.name,
      };
    }
  });
});
