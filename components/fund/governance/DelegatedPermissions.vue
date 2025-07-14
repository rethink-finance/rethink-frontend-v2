<template>
  <div class="delegated-permission">
    <UiStepper
      :entry="delegatedEntry"
      :fields-map="fieldsMap"
      :title="title"
      :submit-label="submitLabel"
      :submit-event="onSubmit"
      :is-submit-loading="isLoading"
      :always-show-last-step="alwaysShowLastStep"
      class="delegated-permission-stepper"
      @fields-changed="fieldsChanged"
    >
      <template #title>
        <slot name="title" />
      </template>
      <template #post-steps-content>
        <slot name="post-steps-content" />
      </template>
      <template #pre-content>
        <slot name="pre-content" />
      </template>
      <template #subtitle>
        <slot name="subtitle" />
        <v-btn
          class="text-secondary me-4"
          variant="outlined"
          @click="openAddRawDialog"
        >
          Import Raw Permissions
        </v-btn>
      </template>
    </UiStepper>

    <UiConfirmDialog
      v-model="showAddRawDialog"
      title="Import Raw Permissions JSON"
      max-width="80%"
      confirm-text="Import Raw Permissions"
      cancel-text="Cancel"
      @confirm="addRawProposal"
    >
      <v-text-field
        v-model="addressInput"
        label="Address"
        outlined
        placeholder="Enter Ethereum address"
        class="me-4"
      />
      <v-text-field
        v-model="startBlocksInput"
        label="Start Blocks (comma-separated)"
        outlined
        placeholder="Enter start blocks (e.g., 1000,2000)"
        class="me-4"
      />
      <v-text-field
        v-model="endBlocksInput"
        label="End Blocks (comma-separated)"
        outlined
        placeholder="Enter end blocks (e.g., 1500,2500)"
        class="me-4"
      />
      <div class="input-group">
        <v-btn
          class="text-secondary me-4"
          variant="outlined"
          :loading="isFetchingPermissions"
          :disabled="isFetchingPermissions"
          @click="fetchAndGeneratePermissions"
        >
          Generate Permissions From Address History
        </v-btn>
        <v-progress-circular
          v-if="isFetchingPermissions"
          :value="parsingProgress"
          :size="24"
          :width="3"
          color="primary"
          class="me-4"
        >
          <span class="progress-text">{{ Math.round(parsingProgress) }}%</span>
        </v-progress-circular>
      </div>
      <v-textarea
        v-model="rawProposalInput"
        label="Raw proposal"
        outlined
        placeholder="Enter the raw permissions JSON here asd"
        rows="20"
        class="raw-method-textarea"
      />
      <v-checkbox
        v-model="keepExistingPermissions"
        label="Keep existing permissions"
        class="checkbox-keep-existing-permissions"
      />
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import Web3 from "web3";
import { formatInputToObject } from "~/composables/stepper/formatInputToObject";
import { useToastStore } from "~/store/toasts/toast.store";
import {
  DelegatedPermissionFieldsMap,
  DelegatedStep,
  proposalRoleModMethodStepsMap,
  roleModMethodChoices,
} from "~/types/enums/delegated_permission";
import { usePermissionsProposalStore } from "~/store/governance-proposals/permissions_proposal.store";
import type { IRawTrx } from "~/types/zodiac-roles/role";
import { useWeb3Store } from "~/store/web3/web3.store";
import {
  useExplorerTransactionsFetcher,
} from "~/composables/transactionsFetcher/useExplorerTransactionsFetcher";
import type { ITransaction } from "~/types/ethereum";
import type { ChainId } from "~/types/enums/chain_id";

interface ProcessedData {
  func_sig: string;
  calldata_len_sans_sig: number;
  words: string[];
  indices_of_addr: number[];
  full_calldata: string;
  contract: string;
  token_found_idx: number[];
  is_approval: boolean;
}

interface PermissionValue {
  idx: number;
  isArray: boolean;
  data: string | number | string[];
  internalType: string;
  name: string;
}

interface Permission {
  idx: number;
  value: PermissionValue[];
  valueMethodIdx: number;
}

interface Entry {
  stepName: string;
  steps: any[];
  [key: string]: any;
}

// Props
const props = defineProps<{
  modelValue: Entry[];
  chainId: ChainId,
  safeAddress: string;
  title?: string;
  fieldsMap?: typeof DelegatedPermissionFieldsMap;
  submitLabel?: string;
  isLoading?: boolean;
  tooltipTitle?: string;
  tooltipLink?: string;
  alwaysShowLastStep?: boolean;
}>();

// Emits
const emit = defineEmits<{
  (e: "update:modelValue", value: Entry[]): void;
  (e: "fieldsChanged", stepName: string, subStepIndex: number, step: any): void;
  (e: "submit"): void;
  (e: "cancel"): void;
  (e: "addRaw"): void;
  (e: "entryUpdated", value: Entry[]): void;
}>();

// Local state
const delegatedEntry = ref<Entry[]>(JSON.parse(JSON.stringify(props.modelValue)));
const showAddRawDialog = ref(false);
const rawProposalInput = ref("");
const keepExistingPermissions = ref(true);
const isMounted = ref(false);
const permissions = ref<Permission[]>([]);
const addressInput = ref("");
const startBlocksInput = ref("");
const endBlocksInput = ref("");
const isFetchingPermissions = ref(false);
const parsingProgress = ref(0); // Progress percentage (0-100)

// Stores
const toastStore = useToastStore();
const permissionsProposalStore = usePermissionsProposalStore();
const web3Store = useWeb3Store();

// Web3 initialization
const web3 = new Web3();

// Sample scope templates
const sampleScopeTarget: Permission = {
  idx: 0,
  value: [
    { idx: 0, isArray: false, data: "1", internalType: "uint16", name: "role" },
    { idx: 1, isArray: false, data: "", internalType: "address", name: "targetAddress" },
  ],
  valueMethodIdx: 24,
};

const sampleScopeAllowFunction: Permission = {
  idx: 0,
  value: [
    { idx: 0, isArray: false, data: 1, internalType: "uint16", name: "role" },
    { idx: 1, isArray: false, data: "", internalType: "address", name: "targetAddress" },
    { idx: 2, isArray: false, data: "", internalType: "bytes4", name: "functionSig" },
    { idx: 3, isArray: false, data: 1, internalType: "enum ExecutionOptions", name: "options" },
  ],
  valueMethodIdx: 18,
};

const sampleScopeParameter: Permission = {
  idx: 0,
  value: [
    { idx: 0, isArray: false, data: "1", internalType: "uint16", name: "role" },
    { idx: 1, isArray: false, data: "", internalType: "address", name: "targetAddress" },
    { idx: 2, isArray: false, data: "", internalType: "bytes4", name: "functionSig" },
    { idx: 3, isArray: false, data: "", internalType: "uint256", name: "paramIndex" },
    { idx: 4, isArray: false, data: "0", internalType: "enum ParameterType", name: "paramType" },
    { idx: 5, isArray: false, data: "0", internalType: "enum Comparison", name: "paramComp" },
    { idx: 6, isArray: false, data: "", internalType: "bytes", name: "compValue" },
  ],
  valueMethodIdx: 21,
};

const sampleScopeParameterAsOneOf: Permission = {
  idx: 0,
  value: [
    { idx: 0, isArray: false, data: "1", internalType: "uint16", name: "role" },
    { idx: 1, isArray: false, data: "", internalType: "address", name: "targetAddress" },
    { idx: 2, isArray: false, data: "", internalType: "bytes4", name: "functionSig" },
    { idx: 3, isArray: false, data: "", internalType: "uint256", name: "paramIndex" },
    { idx: 4, isArray: false, data: "", internalType: "enum ParameterType", name: "paramType" },
    { idx: 5, isArray: true, data: [], internalType: "bytes[]", name: "compValues" },
  ],
  valueMethodIdx: 22,
};

// Function to create batch request for blocks
const createBatchRequest = (blockNumbers: number[]): { jsonrpc: string; method: string; params: [string, boolean]; id: number }[] => {
  if (!blockNumbers.every(num => Number.isInteger(num) && num >= 0)) {
    throw new Error("Invalid block numbers: must be non-negative integers");
  }
  return blockNumbers.map((blockNumber: number) => ({
    jsonrpc: "2.0",
    method: "eth_getBlockByNumber",
    params: [web3.utils.toHex(blockNumber), true],
    id: blockNumber,
  }));
};

// Function to send batch request
// TODO it looks like something is wrong on ARB1, probably L1 and L2 blocks.. you can try input:
//   address: 0x6EC175951624e1E1e6367Fa3dB90a1829E032Ec3
//   start: 344556646
//   end: 357623327
const fetchBlocksInBatch = (blockNumbers: number[]): Promise<any[]> => {
  const batchRequest = createBatchRequest(blockNumbers);

  return web3Store.callWithRetry(props.chainId,  () => {
    const batch = new web3.eth.BatchRequest();
    const promises: Promise<any>[] = batchRequest.map((request) => {
      return new Promise((resolve, _reject) => {
        const promise1 = batch.add({
          jsonrpc: "2.0",
          method: request.method,
          params: request.params,
          id: request.id,
        });
        promise1.then(response => {resolve(response)});
      });
    });
    batch.execute();
    return Promise.all(promises);
  }, 8, [], 1000);
};

// Function to get transactions for address
const getTransactionsForAddress = (address: string, blocks: any[]): ITransaction[] => {
  const transactions: ITransaction[] = [];
  console.log("BLOCKS ", blocks);
  for (const block of blocks) {
    if (block.transactions) {
      for (const tx of block.transactions) {
        if (tx.from && tx.from.toLowerCase() === address.toLowerCase()) {
          console.log("tx", tx);
          transactions.push({
            blockNumber: parseInt(tx.blockNumber, 16),
            hash: tx.hash,
            from: tx.from,
            to: tx.to || "",
            input: tx.input,
            timestamp: 0, // TODO Get timestamp from block, use block.timestamp
            value: tx.value,
            gasUsed: "0",
            gasPrice: "0",
          });
        }
      }
    }
  }
  return transactions;
};
const { loading, error, fetchTransactions, fetchTokenTransfers } = useExplorerTransactionsFetcher();

// Function to fetch transactions
const getExplorerTransactions = async (
  address: string,
  blockRanges: { startBlock: number; endBlock: number }[],
): Promise<ITransaction[]> => {
  console.warn("getExplorerTransactions", address, blockRanges);
  const transactionPromises = blockRanges.map((range) => {
    return fetchTransactions(props.chainId, address, range.startBlock, range.endBlock);
  });

  const transactions = (await Promise.all(transactionPromises)).flat();
  // TODO Are token transfers even needed?
  // const tokenTransfers = await fetchTokenTransfers(props.chainId, address, startBlock, endBlock);
  console.warn("getExplorerTransactions transactions", transactions);
  return transactions as ITransaction[];
}

const getTransactionCallData = async (
  address: string,
  blockRanges: { startBlock: number; endBlock: number }[],
): Promise<ITransaction[]> => {
  const batchSize = 10;
  const allTransactions: ITransaction[] = [];

  // Calculate total blocks to process for progress
  const totalBlocks = blockRanges.reduce((sum, range) => sum + (range.endBlock - range.startBlock + 1), 0);
  let processedBlocks = 0;

  for (const range of blockRanges) {
    const blockNumbers = Array.from({ length: range.endBlock - range.startBlock + 1 }, (_, i) => range.startBlock + i);
    for (let i = 0; i < blockNumbers.length; i += batchSize) {
      console.log("range start: ", i);
      const batchBlockNumbers = blockNumbers.slice(i, i + batchSize);
      const batchResponse = await fetchBlocksInBatch(batchBlockNumbers);
      const batchTransactions = getTransactionsForAddress(address, batchResponse);
      allTransactions.push(...batchTransactions);

      // Update progress
      processedBlocks += batchBlockNumbers.length;
      parsingProgress.value = totalBlocks > 0 ? (processedBlocks / totalBlocks) * 100 : 0;
    }
  }

  // TODO is this needed? why do we need to know how much gas was used?
  // for (const tx of allTransactions) {
  //   const receipt = await web3Store.callWithRetry(
  //     props.chainId,
  //     () => web3.eth.getTransactionReceipt(tx.hash),
  //     1,
  //     [],
  //     4000,
  //   );
  //   tx.gasUsed = receipt.gasUsed;
  // }

  return allTransactions;
};

// Function to process transaction input
const processTransactionInput = (input: string, address: string, n: number = 64): ProcessedData => {
  const approvalSig = "0x095ea7b3";
  let isApproval = false;
  if (input.slice(0, 10) === approvalSig) {
    isApproval = true;
  }
  const subStr = input.slice(10);
  const words: string[] = [];
  for (let i = 0; i < subStr.length; i += n) {
    words.push(subStr.slice(i, i + n));
  }
  const indicesOfAddr = words
    .map((word, i) => (word.includes(address.slice(2).toLowerCase()) ? i : -1))
    .filter((i) => i !== -1);
  return {
    func_sig: input.slice(0, 10),
    calldata_len_sans_sig: subStr.length,
    words,
    indices_of_addr: indicesOfAddr,
    full_calldata: input,
    contract: "",
    token_found_idx: [],
    is_approval: isApproval,
  };
};

const createTokenApprovalMap = (filtApprovals: string[]): Map<string, string[]> => {
  return new Map(filtApprovals.map(addr => [addr.toLowerCase(), []]));
};

const generateTokenApprovalPermissions = (
  tokenApprovalMap: Map<string, string[]>,
): Permission[] => {
  const approvalSig = "0x095ea7b3";
  const permissions: Permission[] = [];
  let permsIdx = 0;

  for (const [contractAddr, approvedAddresses] of tokenApprovalMap) {
    let approvalPerm: Permission = structuredClone(sampleScopeParameterAsOneOf);
    const zeroPaddedContractsList = [...new Set(approvedAddresses)];

    if (zeroPaddedContractsList.length === 1) {
      approvalPerm = structuredClone(sampleScopeParameter);
      approvalPerm.value[1].data = contractAddr;
      approvalPerm.value[2].data = approvalSig;
      approvalPerm.value[3].data = "0";
      approvalPerm.value[4].data = "0";
      approvalPerm.value[5].data = "0";
      approvalPerm.value[6].data = zeroPaddedContractsList[0];
      approvalPerm.idx = permsIdx++;
    } else {
      approvalPerm.value[1].data = contractAddr;
      approvalPerm.value[2].data = approvalSig;
      approvalPerm.value[3].data = "0";
      approvalPerm.value[4].data = "0";
      approvalPerm.value[5].data = zeroPaddedContractsList;
      approvalPerm.idx = permsIdx++;
    }

    permissions.push(approvalPerm);
  }

  return permissions;
};

const updateTokenApprovalsMap = (
  tokenApprovalMap: Map<string, string[]>,
  contract: string,
  word: string | undefined,
): void => {
  if (!contract || !word) return;
  const existing = tokenApprovalMap.get(contract.toLowerCase()) || [];
  tokenApprovalMap.set(contract.toLowerCase(), [...existing, "0x" + word]);
};

const generateSimplePermissions = (transactions: ITransaction[], custodyAddress: string, matchingAddress: string): Permission[] => {
  const approvals: string[] = [];
  const contractInteractions: string[] = [];
  const processedData: ProcessedData[] = [];
  for (const tx of transactions) {
    const result = processTransactionInput(tx.input, matchingAddress);
    if (result.is_approval) {
      approvals.push(tx.to);
    }

    contractInteractions.push(tx.to);
    result.contract = tx.to;
    processedData.push(result);
  }
  const uniqueApprovals = [...new Set(approvals)];
  const tokenApprovalsMap = createTokenApprovalMap(uniqueApprovals);
  for (const p of processedData) {
    if (p.is_approval) {
      updateTokenApprovalsMap(tokenApprovalsMap, p.contract, p.words[0]);
    } else {
      const tokenFound = p.words
        .map((word, i) => (uniqueApprovals.some((addr) => word.includes(addr.slice(2).toLowerCase())) ? i : -1))
        .filter((i) => i !== -1);
      p.token_found_idx = tokenFound;
    }
  }
  const uniqueContractInteractions = [...new Set(contractInteractions)];
  const zeroPaddedTokenList = uniqueApprovals.map((addr) => "0x000000000000000000000000" + addr.slice(2));
  let permsIdx = 0;
  const permissions: Permission[] = [];
  for (const addr of [...uniqueContractInteractions, ...uniqueApprovals]) {
    const node = JSON.parse(JSON.stringify(sampleScopeTarget)) as Permission;
    node.value[1].data = addr;
    node.idx = permsIdx++;
    permissions.push(node);
  }

  const approvalPermissions = generateTokenApprovalPermissions(tokenApprovalsMap);
  permissions.push(...approvalPermissions.map(perm => ({ ...perm, idx: permsIdx++ })));

  for (const p of processedData) {
    const ioiLen = p.indices_of_addr.length;
    const tidxLen = p.token_found_idx.length;
    if (ioiLen === 0 && tidxLen === 0) {
      const perms = JSON.parse(JSON.stringify(sampleScopeAllowFunction)) as Permission;
      perms.value[1].data = p.contract;
      perms.value[2].data = p.func_sig;
      perms.idx = permsIdx++;
      permissions.push(perms);
    } else {
      if (tidxLen !== 0) {
        if (tidxLen === 1) {
          if (uniqueApprovals.length === 1) {
            const perms = JSON.parse(JSON.stringify(sampleScopeParameter)) as Permission;
            perms.value[1].data = p.contract;
            perms.value[2].data = p.func_sig;
            perms.value[3].data = String(p.token_found_idx[0]);
            perms.value[4].data = "0";
            perms.value[5].data = "0";
            perms.value[6].data = zeroPaddedTokenList[0];
            perms.idx = permsIdx++;
            permissions.push(perms);
          } else {
            const perms = JSON.parse(JSON.stringify(sampleScopeParameterAsOneOf)) as Permission;
            perms.value[1].data = p.contract;
            perms.value[2].data = p.func_sig;
            perms.value[3].data = String(p.token_found_idx[0]);
            perms.value[4].data = "0";
            perms.value[5].data = zeroPaddedTokenList;
            perms.idx = permsIdx++;
            permissions.push(perms);
          }
        } else {
          for (const tIdx of p.token_found_idx) {
            if (uniqueApprovals.length === 1) {
              const perms = JSON.parse(JSON.stringify(sampleScopeParameter)) as Permission;
              perms.value[1].data = p.contract;
              perms.value[2].data = p.func_sig;
              perms.value[3].data = String(tIdx);
              perms.value[4].data = "0";
              perms.value[5].data = "0";
              perms.value[6].data = zeroPaddedTokenList[0];
              perms.idx = permsIdx++;
              permissions.push(perms);
            } else {
              const perms = JSON.parse(JSON.stringify(sampleScopeParameterAsOneOf)) as Permission;
              perms.value[1].data = p.contract;
              perms.value[2].data = p.func_sig;
              perms.value[3].data = String(tIdx);
              perms.value[4].data = "0";
              perms.value[5].data = zeroPaddedTokenList;
              perms.idx = permsIdx++;
              permissions.push(perms);
            }
          }
        }
      }
      if (ioiLen !== 0) {
        for (const tIdx of p.indices_of_addr) {
          const perms = JSON.parse(JSON.stringify(sampleScopeParameter)) as Permission;
          perms.value[1].data = p.contract;
          perms.value[2].data = p.func_sig;
          perms.value[3].data = String(tIdx);
          perms.value[4].data = "0";
          perms.value[5].data = "0";
          perms.value[6].data = "0x000000000000000000000000" + custodyAddress.slice(2);
          perms.idx = permsIdx++;
          permissions.push(perms);
        }
      }
    }
  }
  return permissions;
};

// Fetch and generate permissions
const fetchAndGeneratePermissions = async () => {
  try {
    isFetchingPermissions.value = true;
    parsingProgress.value = 0; // Reset progress
    if (!web3.utils.isAddress(addressInput.value)) {
      throw new Error("Invalid Ethereum address");
    }

    const startBlocks = startBlocksInput.value
      .split(",")
      .map(num => parseInt(num.trim()))
      .filter(num => !isNaN(num) && num >= 0);
    const endBlocks = endBlocksInput.value
      .split(",")
      .map(num => parseInt(num.trim()))
      .filter(num => !isNaN(num) && num >= 0);

    if (startBlocks.length !== endBlocks.length || startBlocks.length === 0) {
      throw new Error("Mismatched or empty block ranges");
    }
    const blockRanges = startBlocks.map((start, i) => ({
      startBlock: start,
      endBlock: endBlocks[i],
    })).filter(range => range.startBlock <= range.endBlock);

    if (blockRanges.length === 0) {
      throw new Error("No valid block ranges");
    }
    if (!props.safeAddress) {
      throw new Error(`Bad Custody Address ${props.safeAddress}`);
    }

    // Instead of fetching everything on-chain, first try to fetch from the explorer API.
    let transactions: ITransaction[] = [];
    try {
      // First try to fetch transactions from the explorer (etherscan, arbscan...)
      transactions = await getExplorerTransactions(addressInput.value, blockRanges);
    } catch (e) {
      console.error("Failed fetching explorer transactions -> ", e);
      // Try fetching transactions directly from the chain.
      transactions = await getTransactionCallData(addressInput.value, blockRanges);
    }

    permissions.value = generateSimplePermissions(transactions, props.safeAddress, addressInput.value);
    rawProposalInput.value = JSON.stringify(permissions.value);
    keepExistingPermissions.value = false;
    // addRawProposal();
  } catch (err: unknown) {
    console.error("Error generating permissions:", err);
    toastStore.errorToast("Failed to generate permissions: " + (err as Error).message);
  } finally {
    isFetchingPermissions.value = false;
    parsingProgress.value = 0; // Reset progress on completion
  }
};

// Existing methods
const openAddRawDialog = () => (showAddRawDialog.value = true);

const addRawProposal = () => {
  try {
    const proposal = JSON.parse(rawProposalInput.value);
    if (!proposal) {
      throw new Error("Invalid JSON");
    }
    console.log("proposal:", proposal);

    const newEntries: any[] = [];
    proposal.forEach((entry: Permission) => {
      const contractMethod = roleModMethodChoices.find(
        (choice) => choice.valueMethodIdx === entry.valueMethodIdx,
      );

      if (!contractMethod?.value) {
        console.error("Contract method not found");
        return;
      }

      const defaultMethodForEntry = formatInputToObject(
        proposalRoleModMethodStepsMap[contractMethod.value],
      );
      const currentField =
        props.fieldsMap?.setup?.[defaultMethodForEntry.contractMethod];

      entry.value.forEach((value: PermissionValue) => {
        const valueName = value?.name || "";
        if (!valueName) {
          console.error("Value name not found");
          return;
        }
        defaultMethodForEntry[valueName] = value?.data ?? "";
      });

      defaultMethodForEntry.isValid = validateFields(
        defaultMethodForEntry,
        currentField,
      );

      const newEntry = JSON.parse(JSON.stringify(defaultMethodForEntry));
      newEntries.push(newEntry);
    });

    const mainStepIndex = delegatedEntry.value.findIndex(
      (entry: Entry) => entry.stepName === DelegatedStep.Setup,
    );
    if (mainStepIndex === -1) {
      console.error("Main step not found");
      return;
    }

    if (!keepExistingPermissions.value) {
      delegatedEntry.value[mainStepIndex].steps = newEntries;
    } else {
      delegatedEntry.value[mainStepIndex].steps.push(...newEntries);
    }
    showAddRawDialog.value = false;
    rawProposalInput.value = "";
    toastStore.successToast("Raw proposal added successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to add raw proposal. Invalid JSON format.");
  }
};

const validateFields = (entry: any, fields: any[]): boolean => {
  let isValid = true;

  fields.forEach((field: any) => {
    const { key, rules = [] } = field;
    const value = entry[key];

    rules.forEach((rule: any) => {
      if (Array.isArray(value)) {
        isValid = value.every((val) => rule(val) === true);
      } else {
        isValid = rule(value) === true;
      }
    });
  });

  return isValid;
};

const onSubmit = () => emit("submit");

const updateTransactionsJsonField = () => {
  if (!isMounted.value) return;

  const transactions = delegatedEntry.value.find(
    (entry: Entry) => entry.stepName === DelegatedStep.Setup,
  )?.steps ?? [];
  const detailsStep = delegatedEntry.value.find(
    (entry: Entry) => entry.stepName === DelegatedStep.Details,
  );
  if (!detailsStep) return;

  const rawTransactions: IRawTrx[] = [];
  transactions.forEach((trx: any) => {
    const trxArgs = proposalRoleModMethodStepsMap[trx.contractMethod]
      .filter((method: any) => method.key !== "contractMethod")
      .map((method: any) =>
        prepRoleModEntryInput({
          ...method,
          data: trx[method.key],
        }),
      );
    rawTransactions.push({
      funcName: trx.contractMethod,
      args: trxArgs,
    });

    permissionsProposalStore.rawTransactions = [...rawTransactions];
    detailsStep.steps[0].transactionsOverview = JSON.stringify(
      permissionsProposalStore.rawTransactions.map((trx: IRawTrx) => [trx.funcName, trx.args]),
      null,
      2,
    );
    detailsStep.steps[0].transactionsRawJSON = permissionsProposalStore.rawTransactionsJson;
  });
};

const fieldsChanged = (stepName: string, subStepIndex: number, step: any) => {
  updateTransactionsJsonField();
  const newInput = formatInputToObject(
    proposalRoleModMethodStepsMap[step.contractMethod],
  );

  const mainStepIndex = delegatedEntry.value.findIndex(
    (entry: Entry) => entry.stepName === stepName,
  );
  if (mainStepIndex === -1) {
    console.error("Main step not found");
    return;
  }

  const currentInputs = delegatedEntry?.value?.[mainStepIndex]?.steps?.[subStepIndex];
  if (!currentInputs) {
    console.error("Substep not found");
    return;
  }

  const keysToDelete = Object.keys(currentInputs).filter(
    (key) => key !== "contractMethod",
  );

  const hasSameKeys = Object.keys(newInput).every(
    (key) => key in currentInputs,
  );
  if (!Object.hasOwn(currentInputs, "isValid")) {
    currentInputs.isValid = false;
  }
  if (hasSameKeys) {
    return;
  }

  keysToDelete.forEach((key: string) => {
    delete currentInputs[key];
  });

  Object.assign(currentInputs, newInput);
};

onMounted( () => {
  if (permissionsProposalStore.rawTransactions.length) {
    keepExistingPermissions.value = false;
    rawProposalInput.value = permissionsProposalStore.rawTransactionsJson;
    console.log("mounted raw", rawProposalInput.value);
    addRawProposal();
    permissionsProposalStore.rawTransactions = [];
  }
  isMounted.value = true;
});

watch(
  () => delegatedEntry.value,
  (newValue: Entry[]) => {
    emit("entryUpdated", newValue);
  },
  { deep: true },
);
</script>

<style scoped lang="scss">
.delegated-permission-stepper {
  :deep(.main_header__title) {
    width: 100%;
  }
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 70%;
}
.tooltip {
  &__content {
    display: flex;
    gap: 40px;
  }
  &__link {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    color: $color-primary;
  }
}
.info-icon {
  cursor: pointer;
  display: flex;
  color: $color-text-irrelevant;
}
.checkbox-keep-existing-permissions {
  display: flex;
  flex-direction: row-reverse;

  :deep(.v-selection-control) {
    flex-direction: row-reverse;
  }
}
.input-group {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}
.progress-text {
  font-size: 10px;
}
</style>
