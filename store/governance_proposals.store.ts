import { defineStore } from "pinia";
import type { AbiFunctionFragment, AbiInput, EventLog } from "web3";
import { eth } from "web3";
import type IGovernanceProposal from "~/types/governance_proposal";
import { cleanComplexWeb3Data } from "~/composables/utils";
import RethinkFundGovernor from "~/assets/contracts/RethinkFundGovernor.json";
import GnosisSafeL2JSON from "~/assets/contracts/safe/GnosisSafeL2_v1_3_0.json";
import ZodiacRoles from "~/assets/contracts/zodiac/RolesFull.json";
import GovernableFund from "assets/contracts/GovernableFund.json";
import { useFundStore } from "~/store/fund.store";

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
}


export const useGovernanceProposalsStore = defineStore({
  id: "governanceProposalStore",
  state: (): IState => ({
    fundProposals: {},
    fundProposalsBlockFetchedRanges: {},
  }),
  getters: {
    fundStore(): any {
      return useFundStore();
    },
  },
  actions: {
    resetProposals(chainId: string, fundAddress?: string): void {
      if (!fundAddress) return;

      if (!(chainId in this.fundProposals)) {
        this.fundProposals[chainId] = {};
      }
      this.fundProposals[chainId][fundAddress] = {};
    },
    getProposals(chainId: string, fundAddress?: string): IGovernanceProposal[] {
      if (!fundAddress || !(chainId in this.fundProposals) || !(fundAddress in this.fundProposals[chainId])) return [];
      return Object.values(this.fundProposals[chainId][fundAddress]);
    },
    getFundProposalsBlockFetchedRanges(chainId: string, fundAddress?: string): number[] | undefined[] {
      if (
        !fundAddress || !(chainId in this.fundProposalsBlockFetchedRanges) ||
        !(fundAddress in this.fundProposalsBlockFetchedRanges[chainId])
      ) {
        return [undefined, undefined];
      }
      return this.fundProposalsBlockFetchedRanges[chainId][fundAddress];
    },
    storeProposal(chainId: string, fundAddress: string, proposal: IGovernanceProposal): void {
      this.fundProposals[chainId] ??= {};
      this.fundProposals[chainId][fundAddress] ??= {};
      this.fundProposals[chainId][fundAddress][proposal.proposalId] = proposal;
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
        console.log("new range setup: ", currentMostRecentBlock, currentOldestBlock)
        this.fundProposalsBlockFetchedRanges[chainId][fundAddress] = [currentMostRecentBlock, currentOldestBlock];
      } else {
        console.log("initial range setup: ", latestBlock, oldestBlock)
        this.fundProposalsBlockFetchedRanges[chainId][fundAddress] = [latestBlock, oldestBlock];
      }
    },
    decodeProposalCreatedEvent(event: EventLog): IGovernanceProposal | undefined {
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
        const parsedDescription = JSON.parse(proposal.description);
        proposal.title = parsedDescription.title;
        proposal.description = parsedDescription.description;
      } catch {
        proposal.title = proposal.description;
      }
      console.log("event decoded");
      return proposal
    },
    decodeProposalCallData(calldata: string): Record<any, any> | undefined{
      // Iterate over each method in ABI to find a match
      const signature = calldata.slice(0, 10);
      const encodedParameters = calldata.slice(10);
      const functionAbi = functionSignaturesMap[signature];
      // console.log("decode signature: ", signature, " ABI ", functionAbi);

      if (!functionAbi?.function?.name) {
        console.warn("No existing function signature found in the GovernableFund ABI for ", signature, functionAbi)
        return undefined;
      }
      const functionAbiInputs = functionAbi?.function?.inputs as AbiInput[]

      try {
        let decoded = this.fundStore.web3.eth.abi.decodeParameters(functionAbiInputs, encodedParameters);
        decoded = cleanComplexWeb3Data(decoded);
        // console.log("decoded data: ", functionAbi.contractName, functionAbi.function.name, decoded);
        return {
          functionName: functionAbi.function.name,
          contractName: functionAbi.contractName,
          decodedCalldata: decoded,
          calldata,
        };
      } catch (error: any) {
        console.error("error while decoding signature: ", signature, error);
      }
      console.error("FAILED decoding signature: ", signature, functionSignaturesMap[signature]);

      return undefined;
    },
  },
});

const proposalCreatedEventInputs = RethinkFundGovernor.abi.find(
  event => event.name === "ProposalCreated" && event.type === "event",
)?.inputs ?? [];

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
