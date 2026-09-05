<template>
  <article class="action" :class="{ 'action--flagged': !!flag }">
    <div class="action__head">
      <span class="action__index">{{ action.index + 1 }}</span>
      <div class="action__titles">
        <div class="action__tags">
          <FundGovernanceStateBadge :value="kindLabel" neutral />
          <span v-if="flag" class="action__flag">{{ flag }}</span>
        </div>
        <h3 class="action__headline">
          {{ headline }}
        </h3>
        <div class="action__target">
          <span class="action__target_label">Target</span>
          <FundGovernanceProposalAddressChip :address="action.target" />
          <template v-if="valueEth">
            <span class="action__target_sep">·</span>
            <span>sends {{ valueEth }} ETH</span>
          </template>
        </div>
      </div>
    </div>

    <div class="action__body">
      <FundGovernanceProposalActionNav
        v-if="action.type === ProposalCalldataType.NAV_UPDATE"
        :decoded="action.decoded"
      />
      <FundGovernanceProposalActionSettings
        v-else-if="action.type === ProposalCalldataType.FUND_SETTINGS"
        :decoded="action.decoded"
        :collapsed="!!action.note"
      />
      <FundGovernanceProposalActionPermission
        v-else-if="action.type === ProposalCalldataType.PERMISSIONS"
        :action="action"
      />
      <FundGovernanceProposalActionExecution
        v-else-if="action.type === ProposalCalldataType.DIRECT_EXECUTION"
        :decoded="action.decoded"
      />
      <FundGovernanceProposalActionFlows
        v-else-if="isFlowsCall"
        :decoded="action.decoded"
      />
      <div v-else class="unknown">
        <template v-if="action.functionName">
          <p v-if="explanation" class="unknown__explanation">
            {{ explanation }}
          </p>
          <p class="unknown__intro">
            Calls
            <code class="unknown__fn">{{ signature }}</code>
            <template v-if="action.contractName">
              (a {{ action.contractName }} function)
            </template>
            with these arguments:
          </p>
          <dl v-if="params.length" class="unknown__params">
            <template v-for="param in params" :key="param.name">
              <dt>{{ param.name }}</dt>
              <dd><FundGovernanceProposalParamValue :value="param.value" :type="param.type" /></dd>
            </template>
          </dl>
          <p v-else class="unknown__intro">
            It takes no arguments.
          </p>
        </template>
        <template v-else>
          <p class="unknown__intro">
            This call is not one the app recognises. Its function selector is
            <code class="unknown__fn">{{ selector }}</code>. Read the raw calldata
            carefully before voting.
          </p>
          <pre class="unknown__raw">{{ action.calldata }}</pre>
        </template>
      </div>
    </div>

    <p v-if="action.note" class="action__note">
      {{ action.note }}
    </p>
  </article>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { ProposalCalldataType } from "~/types/enums/proposal_calldata_type";
import type { IProposalAction } from "~/types/proposal/proposalAction";
import {
  decodeCallWithKnownAbis,
  decodeFlowsCall,
  describeExecution,
  describePermission,
  formatFunctionLabel,
} from "~/composables/proposal/describeProposalActions";
import { useFundStore } from "~/store/fund/fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ProposalAddressLabels } from "~/composables/proposal/useProposalAddressLabels";

/**
 * One call of the proposal: what kind it is, a one-line headline, the target,
 * and then the body that explains it in the terms of its kind. Calls that
 * deserve a second look — a permission that hands over ownership, a
 * delegatecall straight from the Safe, a function nobody can name — carry a
 * flag in the header so they cannot hide in a long list.
 */
const props = defineProps<{
  action: IProposalAction;
}>();

const fundStore = useFundStore();
const web3Store = useWeb3Store();
const labels = inject<ProposalAddressLabels | undefined>("proposalAddressLabels", undefined);

const isFlowsCall = computed(
  () =>
    props.action.functionName === "fundFlowsCall" &&
    props.action.contractName === "GovernableFund",
);

const kindLabel = computed(() => {
  switch (props.action.type) {
    case ProposalCalldataType.NAV_UPDATE:
      return "NAV update";
    case ProposalCalldataType.FUND_SETTINGS:
      return "Vault settings";
    case ProposalCalldataType.PERMISSIONS:
      return "Permissions";
    case ProposalCalldataType.DIRECT_EXECUTION:
      return "Safe execution";
    default:
      if (isFlowsCall.value) return "Vault flows";
      return props.action.functionName ? "Contract call" : "Unknown call";
  }
});

/**
 * A sentence for the generic calls a reader is likely to meet, so the
 * argument list under it has a meaning and not only a name.
 */
const EXPLANATIONS: Record<string, string> = {
  approveHash:
    "Pre-approves a Safe transaction hash. Once approved, that transaction can be executed on the Safe without any owner signature.",
  delegate: "Delegates the caller's voting power to the given address.",
  transfer: "Transfers tokens from the target contract's balance of the caller to the recipient.",
  approve: "Lets the spender move up to the given amount of the caller's tokens.",
  upgradeTo: "Replaces the contract's implementation: all of its code changes at once.",
  upgradeToAndCall: "Replaces the contract's implementation and runs a call on the new code.",
  transferOwnership: "Hands ownership of the target contract to a new address.",
  enableModule: "Adds a module that can execute from the Safe without owner signatures.",
  addOwnerWithThreshold: "Adds a Safe owner and sets how many signatures the Safe requires.",
  removeOwner: "Removes a Safe owner and sets how many signatures the Safe requires.",
  changeThreshold: "Changes how many owner signatures the Safe requires.",
  executeNAVUpdate: "Executes the vault's stored NAV methods and records a new NAV.",
  collectFees:
    "Pays the accrued fees of the given type out to their recipient. Fee types: 0 deposit, 1 redemption, 2 management, 3 performance.",
};

const explanation = computed(() =>
  props.action.functionName ? EXPLANATIONS[props.action.functionName] : undefined,
);

const decodedCall = computed(() => decodeCallWithKnownAbis(props.action.calldata));
const params = computed(() => decodedCall.value.params);
const signature = computed(() =>
  props.action.functionName
    ? formatFunctionLabel(props.action.functionName, decodedCall.value.params)
    : decodedCall.value.signature ?? "",
);
const selector = computed(() => (props.action.calldata ?? "").slice(0, 10));

const permission = computed(() =>
  props.action.type === ProposalCalldataType.PERMISSIONS
    ? describePermission(props.action.functionName, props.action.decoded)
    : undefined,
);

const execution = computed(() =>
  props.action.type === ProposalCalldataType.DIRECT_EXECUTION
    ? describeExecution(props.action.decoded)
    : undefined,
);

const sameAddress = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

const headline = computed(() => {
  const decoded = props.action.decoded;
  switch (props.action.type) {
    case ProposalCalldataType.NAV_UPDATE: {
      const count = decoded?.navUpdateData?.length ?? 0;
      return count
        ? `Set the vault's NAV methods (${count} ${count === 1 ? "method" : "methods"})`
        : "Set the vault's NAV methods";
    }
    case ProposalCalldataType.FUND_SETTINGS:
      return "Update the vault's settings";
    case ProposalCalldataType.PERMISSIONS:
      return permissionHeadline(permission.value?.action);
    case ProposalCalldataType.DIRECT_EXECUTION: {
      const count = execution.value?.calls.length ?? 0;
      const safe = sameAddress(props.action.target, fundStore.fund?.safeAddress)
        ? "the vault's Safe"
        : "a Safe";
      if (execution.value?.isBatch) {
        return `Execute ${count} ${count === 1 ? "transaction" : "transactions"} from ${safe}`;
      }
      return `Execute a transaction from ${safe}`;
    }
    default:
      if (isFlowsCall.value) return flowsHeadline.value;
      return props.action.functionName
        ? `Call ${props.action.functionName} on the target contract`
        : "Unrecognised contract call";
  }
});

const flowsHeadline = computed(() => {
  const inner = decodeFlowsCall(props.action.decoded);
  switch (inner?.functionName) {
    case "mintToMany":
      return "Mint vault shares to chosen addresses";
    case "sweepTokens":
      return "Sweep the vault's assets to its Safe address";
    case undefined:
      return "Forward an unrecognised call to the vault's flows module";
    default:
      return `Run ${inner?.functionName} through the vault's flows module`;
  }
});

const permissionHeadline = (action?: string): string => {
  switch (action) {
    case "allow-target":
    case "allow-function":
    case "unscope-parameter":
      return "Grant a permission";
    case "scope-target":
    case "scope-function":
    case "scope-parameter":
      return "Grant a restricted permission";
    case "revoke-target":
    case "revoke-function":
      return "Revoke a permission";
    case "assign-roles":
      return "Change who holds a role";
    case "set-default-role":
      return "Set a member's default role";
    case "set-allowance":
      return "Set a spending allowance";
    case "enable-module":
      return "Enable a module on the Roles modifier";
    case "disable-module":
      return "Disable a module on the Roles modifier";
    case "transfer-ownership":
      return "Transfer ownership of the permission system";
    case "renounce-ownership":
      return "Renounce ownership of the permission system";
    case "set-execution-options":
      return "Change how a permitted call may execute";
    case "rewire":
      return "Rewire the Roles modifier";
    default:
      return "Change delegated permissions";
  }
};

const valueEth = computed(() => {
  try {
    const wei = BigInt(props.action.value || "0");
    return wei === 0n ? "" : ethers.formatEther(wei);
  } catch {
    return "";
  }
});

const flag = computed((): string | undefined => {
  const target = props.action.target;
  if (permission.value?.tone === "danger") return "Needs attention";
  if (permission.value && labels?.roleModAddress.value && !sameAddress(target, labels.roleModAddress.value)) {
    return "Not this vault's Roles modifier";
  }
  if (execution.value && !sameAddress(target, fundStore.fund?.safeAddress)) {
    return "Not the vault's current Safe";
  }
  if (
    (isFlowsCall.value || props.action.type === ProposalCalldataType.FUND_SETTINGS) &&
    !sameAddress(target, fundStore.fund?.address)
  ) {
    return "Not this vault";
  }
  if (execution.value) {
    const multiSend = web3Store
      .safeMultiSendCallOnlyToAddress(fundStore.selectedFundChain)
      ?.toLowerCase();
    if (execution.value.operation === 1 && execution.value.to?.toLowerCase() !== multiSend) {
      return "Delegatecall from the Safe";
    }
    if (execution.value.calls.some((call) => call.operation === 1)) {
      return "Contains a delegatecall";
    }
  }
  if (!props.action.type || props.action.type === ProposalCalldataType.UNDEFINED) {
    if (!props.action.functionName) return "Unrecognised call";
  }
  return undefined;
});
</script>

<style scoped lang="scss">
.action {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.125rem 1.25rem;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-navy-gray-light;

  &--flagged {
    border-color: $color-warn-line;
  }

  &__head {
    display: flex;
    gap: 0.875rem;
    align-items: flex-start;
  }

  &__index {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.625rem;
    height: 1.625rem;
    border: 1px solid $color-line-2;
    border-radius: 50%;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 600;
    color: $color-steel-blue;
  }

  &__titles {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__tags {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  &__flag {
    display: inline-flex;
    align-items: center;
    padding: 0.1875rem 0.4375rem;
    border: 1px solid $color-warn-line;
    border-radius: $default-border-radius;
    background: $color-warn-soft;
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-warn;
  }

  &__headline {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  &__target {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
    font-size: 13px;
    color: $color-text-irrelevant;
  }

  &__target_label {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__target_sep {
    color: $color-steel-blue;
  }

  &__body {
    min-width: 0;
  }

  &__note {
    margin: 0;
    padding: 0.625rem 0.875rem;
    border-left: 2px solid $color-line-2;
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }
}

.unknown {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &__explanation {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: $color-white;
  }

  &__intro {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: $color-text-irrelevant;
  }

  &__fn {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-white;
  }

  &__params {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.375rem 1rem;
    margin: 0;

    dt {
      font-family: $font-mono;
      font-size: 11px;
      letter-spacing: 0.04em;
      color: $color-steel-blue;
    }

    dd {
      margin: 0;
      min-width: 0;
    }
  }

  &__raw {
    margin: 0;
    padding: 0.75rem 0.875rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-surface;
    font-family: $font-mono;
    font-size: 11.5px;
    line-height: 1.6;
    color: $color-text-irrelevant;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
