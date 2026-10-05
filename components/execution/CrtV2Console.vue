<template>
  <div class="crt_console">
    <!--
      Headline balances, as the vault overview's stat strip: the total at
      display size, the places the money actually sits stepped down beside it,
      and the payout wallet on both chains it can be paid on.
    -->
    <div class="crt_summary">
      <div class="crt_summary__hero">
        <div class="crt_label crt_label--accent">
          Current NAV
        </div>
        <div class="crt_summary__value_row">
          <span class="crt_summary__figure">{{ totalNav }}</span>
          <span class="crt_summary__unit">USDC</span>
        </div>
      </div>

      <div class="crt_summary__divider" />

      <div class="crt_summary__breakdown">
        <div v-for="s in statItems" :key="s.label" class="crt_stat">
          <div class="crt_label">
            {{ s.label }}
          </div>
          <div class="crt_stat__value">
            {{ s.value }}
          </div>
        </div>
      </div>

      <v-btn
        class="crt_summary__refresh"
        variant="outlined"
        size="small"
        :loading="loadingBal"
        @click="refresh"
      >
        Refresh
      </v-btn>
    </div>

    <!--
      Where the vault stands and what every button would meet right now. The
      whitelist is dry-run from the address that will use it, so the day the
      vault is deployed this already says which permissions are live.
    -->
    <div class="brand_card crt_status">
      <div class="crt_status__head">
        <div class="crt_status__facts">
          <span class="crt_tag">Roles v2</span>
          <span class="crt_fact">
            <span class="crt_dot" :class="vault ? (vault.finalized ? 'crt_dot--on' : 'crt_dot--warn') : 'crt_dot--idle'" />
            {{ vault ? (vault.finalized ? "Vault finalized" : "Vault initialised · not finalized yet") : "Reading the vault…" }}
          </span>
          <span v-if="vault" class="crt_fact">
            <span class="crt_dot" :class="vault.ownerKind === 'safe' ? 'crt_dot--on' : 'crt_dot--warn'" />
            Modifier owned by the {{ ownerKindText }}
          </span>
          <span v-if="vault" class="crt_fact">
            <span class="crt_dot" :class="vault.activated ? 'crt_dot--on' : 'crt_dot--warn'" />
            {{ vault.activated ? "Activation done" : "Activation proposal pending" }}
          </span>
        </div>
        <div class="crt_status__you">
          <span class="crt_dot" :class="`crt_dot--${standing.tone}`" />
          {{ standing.text }}
        </div>
      </div>

      <div class="crt_ready">
        <div v-for="group in readinessGroups" :key="group.role" class="crt_ready__group">
          <div class="crt_label">
            {{ group.title }}
          </div>
          <div v-if="!readiness" class="crt_card__sub">
            checking the whitelist…
          </div>
          <div
            v-for="r in group.rows"
            :key="r.label"
            class="crt_ready__row"
            :title="r.detail"
          >
            <span class="crt_dot" :class="`crt_dot--${readyTone(r.state)}`" />
            <span class="crt_ready__label">{{ r.label }}</span>
            <span class="crt_mono_dim crt_ready__state">{{ readyText(r.state) }}</span>
          </div>
        </div>
      </div>

      <div v-if="missingRoles.length" class="crt_missing">
        <div class="crt_card__sub">
          Permissions still to store on the modifier. Until the vault is finalized the deployer wallet
          <span class="crt_mono">{{ shortAddr(CRT_V2.ADDR.executor) }}</span> stores them from the create flow's Permissions step
          (Protocol integrations → Add permission → Raw code, paste the array, Save); afterwards they need a governance proposal.
        </div>
        <div class="crt_missing__actions">
          <v-btn
            v-for="role in missingRoles"
            :key="role"
            variant="outlined"
            size="small"
            @click="copyRawPermissions(role)"
          >
            Copy {{ role }} raw permissions · {{ rawPermissions[role].entries.length }} calls
          </v-btn>
        </div>
      </div>
    </div>

    <!-- What the last press did, one line per step. -->
    <div v-if="activity" class="brand_card crt_activity">
      <div class="crt_activity__head">
        <div class="crt_activity__title">
          {{ activity.title }}
        </div>
        <button class="crt_activity__close" aria-label="Dismiss" @click="dismiss">
          <Icon icon="material-symbols:close" width="1.125rem" height="1.125rem" />
        </button>
      </div>
      <div v-if="activity.quote" class="crt_mono_dim">
        Across fee {{ fmt6(activity.quote.fee, 4) }} USDC · {{ fmt6(activity.quote.reserve, 4) }} USDC reserved for the relayer ·
        the payout wallet receives at least {{ fmt6(activity.quote.outputAmount, 2) }} USDC on Arbitrum
      </div>
      <div v-if="activity.role === 'admin'" class="crt_mono_dim">
        {{ proposeHint }}
      </div>
      <div v-for="(step, i) in activity.steps" :key="i" class="crt_activity__step">
        <span>{{ step.label }}</span>
        <span class="crt_activity__state">
          <a
            v-if="step.txStatus === 'ok'"
            :href="CRT_V2.EXPLORER + '/tx/' + step.txHash"
            target="_blank"
            rel="noopener noreferrer"
            class="crt_ok"
          >✓ mined · view</a>
          <span v-else-if="step.txStatus === 'fail'" class="crt_bad">✗ reverted on-chain</span>
          <span v-else-if="step.txStatus === 'refused'" class="crt_bad">✗ {{ step.sim?.name }} · {{ step.sim?.hint }}</span>
          <span v-else-if="step.txStatus === 'declined'" class="crt_mono_dim">declined in the wallet</span>
          <span v-else-if="step.txStatus === 'error'" class="crt_bad">✗ {{ step.error }}</span>
          <span v-else-if="step.txStatus === 'pending'" class="crt_mono_dim">{{ step.txHash ? "pending " + shortAddr(step.txHash) + "…" : "waiting for your wallet…" }}</span>
          <span v-else-if="step.txStatus === 'proposing'" class="crt_mono_dim">waiting for your signature…</span>
          <a
            v-else-if="step.proposal"
            :href="proposalUrl(step)"
            target="_blank"
            rel="noopener noreferrer"
            class="crt_ok"
          >proposed · nonce {{ step.proposal.nonce }} · {{ step.proposal.confirmations }}/{{ step.proposal.required }} signed · open in Safe{Wallet}</a>
          <span v-else-if="step.sim === 'pending'" class="crt_mono_dim">checking the whitelist…</span>
          <span v-else-if="step.sim && step.sim.ok" class="crt_mono_dim">whitelist passed</span>
          <span v-else class="crt_mono_dim">queued</span>
        </span>
      </div>
      <!--
        The admin's transaction, as Safe{Wallet}'s transaction builder takes
        it: whoever cannot sign here can still file exactly this proposal.
      -->
      <details v-if="activity.safeCall" class="crt_raw">
        <summary class="crt_raw__summary">
          Transaction for the admin Safe · to / value / data / operation
        </summary>
        <div class="crt_raw__grid">
          <span class="crt_label">to</span>
          <span class="crt_mono crt_raw__value">{{ activity.safeCall.to }}</span>
          <span class="crt_label">value</span>
          <span class="crt_mono crt_raw__value">0</span>
          <span class="crt_label">operation</span>
          <span class="crt_mono crt_raw__value">{{ activity.safeCall.operation === 1 ? "1 · delegatecall (MultiSendCallOnly batch)" : "0 · call" }}</span>
          <span class="crt_label">data</span>
          <span class="crt_mono crt_raw__value crt_raw__data">{{ activity.safeCall.data }}</span>
        </div>
        <div class="crt_raw__actions">
          <v-btn
            variant="text"
            size="small"
            class="crt_text_action"
            @click="copyText(activity.safeCall.data, 'Calldata copied')"
          >
            Copy data
          </v-btn>
          <v-btn
            variant="text"
            size="small"
            class="crt_text_action"
            @click="copyText(JSON.stringify(activity.safeCall, null, 2), 'Transaction copied as JSON')"
          >
            Copy as JSON
          </v-btn>
        </div>
      </details>
    </div>

    <div class="crt_layout">
      <div class="crt_main">
        <!-- ─── Executor ─────────────────────────────────────────────── -->
        <div class="group_title crt_section">
          Executor
          <span class="crt_tag">Role 2 · signs from its own key</span>
        </div>

        <div class="brand_card crt_card">
          <div class="crt_card__head">
            <div class="crt_card__titles">
              <div class="brand_card__eyebrow">
                EVM &#8596; HyperCore bridge
              </div>
              <div class="crt_card__sub">
                {{ bridgeDir === "toCore"
                  ? "approve → depositFor · receiver pinned to the Safe · any amount"
                  : "sendAsset from Core spot to the Safe's EVM balance · any amount" }}
              </div>
            </div>
          </div>
          <div class="crt_row">
            <v-select
              v-model="bridgeDir"
              :items="[{ title: 'EVM → Core', value: 'toCore' }, { title: 'Core → EVM', value: 'toEvm' }]"
              density="compact"
              hide-details
              class="crt_field--narrow"
            />
            <v-text-field
              v-model="bridgeAmt"
              placeholder="Amount"
              suffix="USDC"
              density="compact"
              hide-details
            />
            <v-btn
              variant="outlined"
              :disabled="!validAmt(bridgeAmt) || busy || !canExecute"
              :title="executeReason"
              @click="runBridge"
            >
              {{ bridgeDir === "toCore" ? "Deposit to Core" : "Send to EVM" }}
            </v-btn>
          </div>
        </div>

        <div class="brand_card crt_card">
          <div class="crt_card__head">
            <div class="crt_card__titles">
              <div class="brand_card__eyebrow">
                Spot &#8596; perp (usdClassTransfer)
              </div>
              <div class="crt_card__sub">
                Inside the Safe's HyperCore account · any amount, either direction
              </div>
            </div>
          </div>
          <div class="crt_row">
            <v-select
              v-model="ctDir"
              :items="[{ title: 'Spot → perp', value: 'toPerp' }, { title: 'Perp → spot', value: 'toSpot' }]"
              density="compact"
              hide-details
              class="crt_field--narrow"
            />
            <v-text-field
              v-model="ctAmt"
              placeholder="Amount"
              suffix="USDC"
              density="compact"
              hide-details
            />
            <v-btn
              variant="outlined"
              :disabled="!validAmt(ctAmt) || busy || !canExecute"
              :title="executeReason"
              @click="runClassTransfer"
            >
              Move
            </v-btn>
          </div>
        </div>

        <div class="crt_grid2">
          <div class="brand_card crt_card">
            <div class="crt_card__head">
              <div class="crt_card__titles">
                <div class="brand_card__eyebrow">
                  Felix
                </div>
              </div>
              <div class="crt_stat crt_stat--right">
                <div class="crt_label">
                  Position
                </div>
                <div class="crt_stat__value">
                  {{ bal ? fmt6(bal.felixAssets) + " USDC" : "—" }}
                </div>
                <div v-if="bal" class="crt_card__sub">
                  {{ Number(formatUnits(bal.felixShares, 18)).toFixed(4) }} {{ bal.felixSymbol }}
                </div>
              </div>
            </div>
            <div class="crt_row">
              <v-text-field
                v-model="felixDep"
                placeholder="Deposit"
                suffix="USDC"
                density="compact"
                hide-details
              />
              <v-btn
                variant="outlined"
                :disabled="!validAmt(felixDep) || busy || !canExecute"
                :title="executeReason"
                @click="runFelixDeposit"
              >
                Deposit
              </v-btn>
            </div>
            <div class="crt_row">
              <v-text-field
                v-model="felixWd"
                placeholder="Withdraw"
                suffix="USDC"
                density="compact"
                hide-details
              />
              <v-btn
                variant="outlined"
                :disabled="!validAmt(felixWd) || busy || !canExecute"
                :title="executeReason"
                @click="runFelixWithdraw"
              >
                Withdraw
              </v-btn>
            </div>
            <div class="crt_card__foot">
              <v-btn
                variant="text"
                size="small"
                class="crt_text_action"
                :disabled="busy || !canExecute"
                :title="executeReason"
                @click="runFelixRedeemAll"
              >
                Redeem all
              </v-btn>
            </div>
          </div>

          <div class="brand_card crt_card">
            <div class="crt_card__head">
              <div class="crt_card__titles">
                <div class="brand_card__eyebrow">
                  HyperLend
                </div>
              </div>
              <div class="crt_stat crt_stat--right">
                <div class="crt_label">
                  Position
                </div>
                <div class="crt_stat__value">
                  {{ bal ? fmt6(bal.hlend) + " USDC" : "—" }}
                </div>
                <div v-if="bal" class="crt_card__sub">
                  {{ Number(formatUnits(bal.hlend, 6)).toFixed(4) }} hUSDC
                </div>
              </div>
            </div>
            <div class="crt_row">
              <v-text-field
                v-model="hlSup"
                placeholder="Supply"
                suffix="USDC"
                density="compact"
                hide-details
              />
              <v-btn
                variant="outlined"
                :disabled="!validAmt(hlSup) || busy || !canExecute"
                :title="executeReason"
                @click="runHlSupply"
              >
                Supply
              </v-btn>
            </div>
            <div class="crt_row">
              <v-text-field
                v-model="hlWd"
                placeholder="Withdraw"
                suffix="USDC"
                density="compact"
                hide-details
              />
              <v-btn
                variant="outlined"
                :disabled="!validAmt(hlWd) || busy || !canExecute"
                :title="executeReason"
                @click="runHlWithdraw(false)"
              >
                Withdraw
              </v-btn>
            </div>
            <div class="crt_card__foot">
              <v-btn
                variant="text"
                size="small"
                class="crt_text_action"
                :disabled="busy || !canExecute"
                :title="executeReason"
                @click="runHlWithdraw(true)"
              >
                Withdraw all
              </v-btn>
            </div>
          </div>
        </div>

        <!-- ─── Admin ────────────────────────────────────────────────── -->
        <div class="group_title crt_section">
          Admin
          <span class="crt_tag crt_tag--danger">{{ adminTag }}</span>
        </div>

        <div class="brand_card crt_card crt_card--payout">
          <div class="crt_payout__head">
            <div class="crt_stat">
              <div class="crt_label">
                Payout destination · pinned
              </div>
              <div class="crt_stat__value">
                {{ shortAddr(CRT_V2.ADDR.payout) }}
              </div>
              <div class="crt_card__sub">
                The payout wallet. Every other address reverts, on both chains.
              </div>
            </div>
            <div class="crt_payout__balances">
              <div class="crt_stat crt_stat--right">
                <div class="crt_label">
                  Payout · HyperEVM
                </div>
                <div class="crt_stat__value">
                  {{ payoutBal ? fmt6(payoutBal.hyperEvm) + " USDC" : "—" }}
                </div>
              </div>
              <div class="crt_stat crt_stat--right">
                <div class="crt_label">
                  Payout · Arbitrum
                </div>
                <div class="crt_stat__value">
                  {{ payoutBal ? fmt6(payoutBal.arbitrum) + " USDC" : "—" }}
                </div>
              </div>
            </div>
          </div>
          <div class="crt_row">
            <UiSegmented v-model="payoutChain" :options="payoutChains" class="crt_payout__toggle" />
            <v-text-field
              v-model="payoutAmt"
              placeholder="Amount"
              suffix="USDC"
              density="compact"
              hide-details
            />
            <v-btn
              variant="outlined"
              :disabled="!validAmt(payoutAmt) || quoting || busy || adminStanding === 'none'"
              :loading="quoting"
              :title="proposeDisabledReason"
              @click="runPayout"
            >
              {{ payoutChain === "arbitrum" ? "Propose bridge" : "Propose payout" }}
            </v-btn>
          </div>
          <div class="crt_card__sub">
            {{ payoutChain === "arbitrum"
              ? "Across bridge to Arbitrum · approve + depositV3Now, one Safe transaction · recipient and chain pinned"
              : "USDC.transfer on HyperEVM · one Safe transaction" }}
          </div>
        </div>

        <div class="brand_card crt_card">
          <div class="crt_card__head">
            <div class="crt_card__titles">
              <div class="brand_card__eyebrow">
                API traders (HyperCore agents)
              </div>
              <div class="crt_card__sub">
                Any address, {{ CRT_V2.AGENT.minDays }}–{{ CRT_V2.AGENT.maxDays }} days, no proposal to governance needed.
                A registration under the name “{{ CRT_V2.AGENT.name }}” replaces whichever key holds it.
              </div>
            </div>
          </div>

          <div class="crt_slots">
            <div class="crt_label">
              Live on HyperCore for the vault Safe
            </div>
            <div v-if="!agents" class="crt_card__sub">
              {{ agentsError ? "Could not read the Safe's agents from HyperCore" : "checking…" }}
            </div>
            <template v-else>
              <div v-for="slot in liveSlots" :key="slot.key" class="crt_slot">
                <span class="crt_dot crt_dot--on" />
                <span class="crt_slot__kind">{{ slot.kind }}</span>
                <span class="crt_mono">{{ shortAddr(slot.address) }}</span>
                <span class="crt_mono_dim">{{ slot.who }}</span>
                <span class="crt_mono_dim crt_slot__until">{{ slot.until }}</span>
                <v-btn
                  variant="text"
                  size="small"
                  class="crt_text_action"
                  :disabled="busy || adminStanding === 'none'"
                  :title="proposeDisabledReason"
                  @click="runRemove(slot)"
                >
                  Propose removal
                </v-btn>
              </div>
              <div v-if="!liveSlots.length" class="crt_card__sub">
                No agent registered
              </div>
            </template>
          </div>

          <div class="crt_presets">
            <button
              v-for="p in CRT_V2.AGENT.presets"
              :key="p.addr"
              type="button"
              class="crt_preset"
              :class="{ 'crt_preset--active': sameAddr(agentAddr, p.addr) }"
              :title="p.desc"
              @click="agentAddr = p.addr"
            >
              <span class="crt_dot" :class="`crt_dot--${agentState(p.addr).tone}`" />
              {{ p.label }} <span class="crt_mono_dim">{{ shortAddr(p.addr) }} · {{ agentState(p.addr).text }}</span>
            </button>
          </div>
          <div class="crt_row">
            <v-text-field
              v-model="agentAddr"
              placeholder="Agent address 0x…"
              density="compact"
              hide-details
              class="crt_field--wide"
            />
            <v-text-field
              v-model="agentDays"
              type="number"
              :min="CRT_V2.AGENT.minDays"
              :max="CRT_V2.AGENT.maxDays"
              step="1"
              suffix="days"
              density="compact"
              hide-details
              class="crt_field--narrow"
            />
            <v-btn
              variant="outlined"
              :disabled="!validAgent || busy || adminStanding === 'none'"
              :title="proposeDisabledReason || agentReason"
              @click="runRegister"
            >
              Propose registration
            </v-btn>
          </div>
          <div class="crt_card__sub">
            {{ agentPreview }}
          </div>
        </div>

        <div class="brand_card crt_card">
          <div class="crt_card__head">
            <div class="crt_card__titles">
              <div class="brand_card__eyebrow">
                Executor members · admin role
              </div>
              <div class="crt_card__sub">
                Membership changes run as the vault Safe on its own modifier, so they take effect once the activation
                proposal has made the Safe the modifier's owner. {{ vault?.activated ? "That is done." : "Until then the dry run reports the gate, and the proposal can still be filed." }}
              </div>
            </div>
          </div>
          <div class="crt_row">
            <v-text-field
              v-model="memberAddr"
              placeholder="Executor address 0x…"
              density="compact"
              hide-details
              class="crt_field--wide"
            />
            <v-btn
              variant="outlined"
              :disabled="!isAddr(memberAddr) || busy || adminStanding === 'none'"
              :title="proposeDisabledReason"
              @click="runMember(true)"
            >
              Propose add
            </v-btn>
            <v-btn
              variant="outlined"
              :disabled="!isAddr(memberAddr) || busy || adminStanding === 'none'"
              :title="proposeDisabledReason"
              @click="runMember(false)"
            >
              Propose removal
            </v-btn>
          </div>
          <div class="crt_card__sub">
            Current executor: <span class="crt_mono">{{ shortAddr(CRT_V2.ADDR.executor) }}</span>
            <span class="crt_mono_dim">· {{ executorMembership === null ? "membership unread" : executorMembership ? "holds the executor role" : "does NOT hold the executor role" }}</span>
          </div>
          <div class="crt_row crt_row--top">
            <v-text-field
              v-model="newAdminAddr"
              placeholder="New admin address 0x… (a Safe, ideally)"
              density="compact"
              hide-details
              class="crt_field--wide"
            />
            <v-btn
              variant="outlined"
              :disabled="!isAddr(newAdminAddr) || busy || adminStanding === 'none'"
              :title="proposeDisabledReason"
              @click="runTransferAdmin(1)"
            >
              1 · Propose new admin
            </v-btn>
            <v-btn
              variant="text"
              size="small"
              class="crt_text_action crt_text_action--danger"
              :disabled="busy || adminStanding === 'none'"
              :title="proposeDisabledReason"
              @click="runTransferAdmin(2)"
            >
              2 · Remove this Safe from admin
            </v-btn>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { DEFAULT_RETURN_FORMAT } from "web3";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useAccountStore } from "~/store/account/account.store";
import { sendAsSafe } from "~/composables/permissions/useCuratorExecution";
import UiSegmented from "~/components/global/ui/Segmented.vue";
import {
  CRT_V2, crtV2Inner, crtV2Wrap, crtV2SafeBatch, crtV2Simulate, crtV2GetBalances, crtV2GetPayoutBalances, crtV2AcrossQuote,
  crtV2GetCore, crtV2GetAgents, crtV2AgentStatus, crtV2GetAdminSafe, crtV2GetVaultState, crtV2HoldsRole, crtV2Readiness,
  crtV2RawPermissions, crtV2ValidUntil, crtV2FormatDate, crtV2DaysLeft, fmt6, shortAddr, usdc6,
  type CrtV2AgentSlot, type CrtV2Readiness as ReadinessRow, type CrtV2SafeCall, type CrtV2VaultState, type CrtV2Wrapped,
} from "~/composables/execution/crtV2Console";
import type { CrtV2Role } from "~/composables/execution/crtV2Vault";
import { buildSafeTx, fetchNextSafeNonce, fetchSafeTxStatus, proposeSafeTx, safeWalletUrl, signSafeTx } from "~/composables/safe/safeTransactionService";
import { ChainId } from "~/types/enums/chain_id";

const fundStore = useFundStore();
const toastStore = useToastStore();
const accountStore = useAccountStore();
const formatUnits = ethers.formatUnits;
const isAddr = (v: string) => !!v && ethers.isAddress(v.trim());
const sameAddr = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const bal = ref<any>(null);
const core = ref<any>(null);
const payoutBal = ref<{ hyperEvm: bigint; arbitrum: bigint } | null>(null);
const loadingBal = ref(false);
const vault = ref<CrtV2VaultState | null>(null);
const readiness = ref<ReadinessRow[] | null>(null);
const adminSafe = ref<{ owners: string[]; threshold: number; nonce: number } | null>(null);
const executorMembership = ref<boolean | null>(null);
/** The action the last press started, with each step's state; the strip above the cards shows it. */
const activity = ref<any>(null);
const busy = ref(false);
/** Title of the action whose first press has been taken as "are you sure"; the second press runs it. */
const armed = ref<string | null>(null);
let armTimer: ReturnType<typeof setTimeout> | null = null;

const bridgeDir = ref("toCore"); const bridgeAmt = ref("");
const ctDir = ref("toPerp"); const ctAmt = ref("");
const felixDep = ref(""); const felixWd = ref(""); const hlSup = ref(""); const hlWd = ref("");
const payoutAmt = ref("");
const payoutChain = ref<"hyperevm" | "arbitrum">("hyperevm");
const payoutChains = [{ key: "hyperevm", label: "HyperEVM" }, { key: "arbitrum", label: "Arbitrum" }];
const quoting = ref(false);
const agentAddr = ref(CRT_V2.AGENT.presets[0].addr);
const agentDays = ref(String(CRT_V2.AGENT.defaultDays));
const memberAddr = ref(""); const newAdminAddr = ref("");

const validAmt = (v: string) => { const x = Number(v); return v !== "" && isFinite(x) && x > 0; };
const rawPermissions = crtV2RawPermissions();

// ─── Who is connected ────────────────────────────────────────────────────────

const account = computed(() => (fundStore.activeAccountAddress || "").toLowerCase());
/** The connected wallet holds the executor role (read from the modifier, any address). */
const connectedIsExecutor = ref<boolean | null>(null);
/**
 * A Zodiac Pilot session connected as the vault Safe records what the Safe
 * sends and applies the Roles route itself on submit, so executor steps are
 * open to it too, and go out unwrapped.
 */
const isVaultSafe = computed(() => sameAddr(account.value, CRT_V2.ADDR.safe));
const canExecute = computed(() => connectedIsExecutor.value === true || isVaultSafe.value);
const executeReason = computed(() => (canExecute.value ? "" : connectedIsExecutor.value === null && account.value ? "Checking the connected wallet's role…" : "Connect a wallet that holds the executor role, or the vault Safe through Zodiac Pilot"));
watch(account, async (next) => {
  connectedIsExecutor.value = null;
  if (!next) return;
  connectedIsExecutor.value = await crtV2HoldsRole(next, "executor");
}, { immediate: true });

/** What the connected wallet is to the admin Safe. */
const adminStanding = computed<"safe" | "owner" | "unknown" | "none">(() => {
  if (!account.value) return "none";
  if (sameAddr(account.value, CRT_V2.ADDR.adminSafe)) return "safe";
  if (!adminSafe.value) return "unknown";
  return adminSafe.value.owners.some((o) => sameAddr(o, account.value)) ? "owner" : "none";
});
const adminTag = computed(() => `Role 1 · Carrot Safe ${adminSafe.value ? `${adminSafe.value.threshold}-of-${adminSafe.value.owners.length}` : "2-of-4"} · proposes`);
const proposeHint = computed(() => {
  const quorum = adminSafe.value ? `${adminSafe.value.threshold} of ${adminSafe.value.owners.length}` : "2 of 4";
  switch (adminStanding.value) {
    case "safe": return "Connected as the admin Safe · proposing opens it in Safe{Wallet} for your signature";
    case "owner": return `Signing as owner ${shortAddr(fundStore.activeAccountAddress)} · ${quorum} owners must sign before it runs`;
    case "unknown": return "Owner list not loaded · the Safe service will refuse a proposal from a non-owner";
    default: return "Connect an owner of the admin Safe to propose from here, or pair Safe{Wallet} over WalletConnect";
  }
});
const proposeDisabledReason = computed(() => (adminStanding.value === "none" ? (account.value ? "The connected wallet is not an owner of the admin Safe" : "Connect an owner of the admin Safe") : ""));
const standing = computed(() => {
  if (!account.value) return { tone: "idle", text: "No wallet connected" };
  const parts: string[] = [];
  if (isVaultSafe.value) parts.push("the vault Safe (Pilot session)");
  if (connectedIsExecutor.value) parts.push("executor");
  if (adminStanding.value === "safe") parts.push("the admin Safe");
  if (adminStanding.value === "owner") parts.push("an owner of the admin Safe");
  if (!parts.length) return { tone: connectedIsExecutor.value === null || adminStanding.value === "unknown" ? "idle" : "off", text: `${shortAddr(fundStore.activeAccountAddress)} · no role here` };
  return { tone: "on", text: `${shortAddr(fundStore.activeAccountAddress)} · ${parts.join(" and ")}` };
});
const ownerKindText = computed(() => ({ factory: "factory (until the vault is finalized)", governor: "governor (activation proposal pending)", safe: "vault Safe (activated)", other: "an unexpected address" }[vault.value?.ownerKind ?? "other"]));

// ─── Readiness ───────────────────────────────────────────────────────────────

const readinessGroups = computed(() => (["executor", "admin"] as CrtV2Role[]).map((role) => ({
  role,
  title: role === "executor" ? "Executor whitelist" : "Admin whitelist",
  rows: (readiness.value ?? []).filter((r) => r.role === role),
})));
const readyTone = (state: ReadinessRow["state"]) => ({ ready: "on", soft: "on", activation: "warn", missing: "off", unknown: "idle" }[state]);
const readyText = (state: ReadinessRow["state"]) => ({ ready: "ready", soft: "whitelisted", activation: "after activation", missing: "missing", unknown: "unknown" }[state]);
/** Roles with a whitelisted action missing, offered their raw permissions. */
const missingRoles = computed(() => (["executor", "admin"] as CrtV2Role[]).filter((role) => (readiness.value ?? []).some((r) => r.role === role && r.state === "missing")));

const copyText = async (text: string, done: string) => {
  try { await navigator.clipboard.writeText(text); toastStore.successToast(done); } catch { toastStore.errorToast("Could not copy. Select the text instead."); }
};
const copyRawPermissions = (role: CrtV2Role) => copyText(rawPermissions[role].json, `${rawPermissions[role].entries.length} ${role} calls copied. Paste them into the Permissions step's Raw code input.`);

// ─── Reads ───────────────────────────────────────────────────────────────────

const statItems = computed(() => [
  { label: "Safe · EVM USDC", value: bal.value ? fmt6(bal.value.safeUsdc) : "—" },
  { label: "Fund contract", value: bal.value ? fmt6(bal.value.fundUsdc) : "—" },
  { label: "Core spot", value: core.value ? n2(core.value.spotUsdc) : "—" },
  { label: "Core perp", value: core.value ? n2(core.value.perpValue) : "—" },
  { label: "Felix", value: bal.value ? fmt6(bal.value.felixAssets) : "—" },
  { label: "HyperLend", value: bal.value ? fmt6(bal.value.hlend) : "—" },
  { label: "Payout · HyperEVM", value: payoutBal.value ? fmt6(payoutBal.value.hyperEvm) : "—" },
  { label: "Payout · Arbitrum", value: payoutBal.value ? fmt6(payoutBal.value.arbitrum) : "—" },
]);
const n2 = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const totalNav = computed(() => {
  if (!bal.value || !core.value) return "—";
  const evm = Number(ethers.formatUnits(bal.value.safeUsdc + bal.value.felixAssets + bal.value.hlend + bal.value.fundUsdc, 6));
  return n2(evm + core.value.spotUsdc + core.value.perpValue);
});

const refresh = async () => {
  loadingBal.value = true;
  await Promise.all([
    crtV2GetBalances().then((b) => (bal.value = b)).catch(() => {}),
    crtV2GetCore().then((c) => (core.value = c)).catch(() => {}),
    crtV2GetPayoutBalances().then((b) => (payoutBal.value = b)).catch(() => {}),
    crtV2GetVaultState().then((v) => (vault.value = v)).catch(() => {}),
    crtV2Readiness().then((r) => (readiness.value = r)).catch(() => {}),
    crtV2HoldsRole(CRT_V2.ADDR.executor, "executor").then((m) => (executorMembership.value = m)).catch(() => {}),
    loadAgents(),
  ]);
  loadingBal.value = false;
};

const agents = ref<{ unnamed: CrtV2AgentSlot | null; named: CrtV2AgentSlot[] } | null>(null);
const agentsError = ref(false);
const agentsStatus = reactive<Record<string, any>>({});
const loadAgents = async () => {
  agentsError.value = false;
  CRT_V2.AGENT.presets.forEach(async (p) => { agentsStatus[p.addr.toLowerCase()] = await crtV2AgentStatus(p.addr); });
  try { agents.value = await crtV2GetAgents(); } catch { agentsError.value = true; }
};
const agentWho = (address: string) => CRT_V2.AGENT.presets.find((p) => sameAddr(p.addr, address))?.label.toLowerCase() ?? "not a preset";
const untilText = (ms: number | null) => (ms ? `until ${crtV2FormatDate(ms)} · ${crtV2DaysLeft(ms)} days` : "");
const liveSlots = computed(() => {
  if (!agents.value) return [];
  const rows: { key: string; kind: string; name: string; address: string; who: string; until: string }[] = [];
  if (agents.value.unnamed) rows.push({ key: "unnamed", kind: "Unnamed", name: "", address: agents.value.unnamed.address, who: agentWho(agents.value.unnamed.address), until: untilText(agents.value.unnamed.validUntil) });
  for (const n of agents.value.named) rows.push({ key: "named-" + n.name, kind: `Named “${n.name}”`, name: n.name, address: n.address, who: agentWho(n.address), until: untilText(n.validUntil) });
  return rows;
});
const agentState = (addr: string): { tone: string; text: string } => {
  const named = agents.value?.named.find((n) => sameAddr(n.address, addr));
  if (named) return { tone: "on", text: `live ${untilText(named.validUntil) || "· named"}` };
  if (agents.value?.unnamed && sameAddr(agents.value.unnamed.address, addr)) return { tone: "on", text: `live ${untilText(agents.value.unnamed.validUntil) || "· unnamed"}` };
  const s = agentsStatus[addr.toLowerCase()];
  if (!s) return { tone: "idle", text: "checking…" };
  if (s.error) return { tone: "idle", text: "unknown" };
  if (s.live && s.ours) return { tone: "on", text: "live · agent of the Safe" };
  if (s.live) return { tone: "warn", text: "agent of another user" };
  return { tone: "off", text: "not registered" };
};
const agentDaysNum = computed(() => Number(agentDays.value));
const validAgent = computed(() => isAddr(agentAddr.value) && Number.isInteger(agentDaysNum.value) && agentDaysNum.value >= CRT_V2.AGENT.minDays && agentDaysNum.value <= CRT_V2.AGENT.maxDays);
const agentReason = computed(() => (!isAddr(agentAddr.value) ? "Enter the agent's address" : !validAgent.value ? `Validity must be a whole number of days between ${CRT_V2.AGENT.minDays} and ${CRT_V2.AGENT.maxDays}` : ""));
const agentPreview = computed(() => {
  if (!validAgent.value) return agentReason.value;
  const until = crtV2ValidUntil(agentDaysNum.value);
  return `addApiWallet(${shortAddr(agentAddr.value.trim())}, “${CRT_V2.AGENT.name} valid_until ${until}”) · valid until ${crtV2FormatDate(until)} (${agentDaysNum.value} days)`;
});

onMounted(() => {
  refresh();
  crtV2GetAdminSafe().then((s) => (adminSafe.value = s)).catch(() => {});
});

// ─── Running an action ───────────────────────────────────────────────────────

/** Clears the strip. A wallet that never answers would otherwise keep every button locked. */
const dismiss = () => { activity.value = null; busy.value = false; };

const simulateStep = async (step: any, role: CrtV2Role) => {
  step.sim = "pending";
  // The whitelist is what is being checked, so the dry run comes from the
  // address that holds the role: the executor key, or the admin Safe. On a
  // Pilot session the connected Safe will hold the batch to the same list.
  const from = role === "admin" ? CRT_V2.ADDR.adminSafe : connectedIsExecutor.value && account.value ? account.value : CRT_V2.ADDR.executor;
  step.sim = await crtV2Simulate(step.wrapped, from);
};

/**
 * One press does the whole thing. Each step is dry-run against the Roles
 * whitelist from the sender that will use it, then signed by the wallet
 * (executor) or filed with the admin Safe (admin). A refusal stops the run
 * and says why. Money leaving the Safe and anything that swaps a trading
 * key takes a second press to confirm.
 */
const run = async (action: { title: string; role: CrtV2Role; steps: any[]; warns?: string[]; confirmPhrase?: string; quote?: any; route?: string; safeCall?: CrtV2SafeCall }) => {
  if (busy.value) return;
  if (action.role === "executor" && !canExecute.value) { toastStore.errorToast(executeReason.value); return; }
  if (action.role === "admin" && adminStanding.value === "none") { toastStore.errorToast(proposeDisabledReason.value); return; }
  if (action.confirmPhrase && armed.value !== action.title) {
    armed.value = action.title;
    if (armTimer) clearTimeout(armTimer);
    armTimer = setTimeout(() => { armed.value = null; }, 12000);
    toastStore.warningToast(`Press again to confirm: ${action.confirmPhrase}`, 12000);
    return;
  }
  armed.value = null;
  action.steps = action.steps.map((s: any) => reactive({ ...s, sim: null, txStatus: null, txHash: null }));
  if (action.role === "admin") action.safeCall = crtV2SafeBatch(action.steps.map((s: any) => s.wrapped as CrtV2Wrapped));
  activity.value = action;
  busy.value = true;
  (action.warns || []).forEach((w: string) => toastStore.warningToast(w, 8000));
  try {
    for (const step of action.steps) {
      await simulateStep(step, action.role);
      const sim = step.sim;
      // Step 2 of an approve + spend pair fails the dry run until step 1 is
      // mined; a membership gate on assignRoles fails it until activation.
      // Both are the target refusing, not the whitelist: those are sent.
      if (!sim.ok && !(sim.soft && step.expectSoftFail)) {
        step.txStatus = "refused";
        toastStore.errorToast(`${sim.name}: ${sim.hint || "the whitelist refused this call."}`, 15000);
        return;
      }
    }
    if (action.role === "admin") {
      await propose(action);
    } else {
      for (const step of action.steps) {
        if (!(await exec(step))) return;
      }
    }
  } finally {
    busy.value = false;
  }
};

// ─── Executor actions ────────────────────────────────────────────────────────

const runBridge = () => bridgeDir.value === "toCore"
  ? run({
    title: `EVM → Core: deposit ${bridgeAmt.value} USDC`, role: "executor",
    steps: [
      { label: "1 · Approve CoreDepositWallet", wrapped: crtV2Wrap(crtV2Inner.approve(CRT_V2.ADDR.cdw, "CoreDepositWallet", bridgeAmt.value), "executor") },
      { label: "2 · depositFor(Safe)", wrapped: crtV2Wrap(crtV2Inner.cdwDepositFor(bridgeAmt.value), "executor"), expectSoftFail: true },
    ],
  })
  : run({ title: `Core → EVM: send ${bridgeAmt.value} USDC`, role: "executor", steps: [{ label: "sendAsset (credits the Safe on HyperEVM)", wrapped: crtV2Wrap(crtV2Inner.sendAssetToEvm(bridgeAmt.value), "executor") }] });

const runClassTransfer = () => {
  const toPerp = ctDir.value === "toPerp";
  run({ title: `Core: move ${ctAmt.value} USDC ${toPerp ? "spot → perp" : "perp → spot"}`, role: "executor", steps: [{ label: `usdClassTransfer ${ctAmt.value} USDC ${toPerp ? "→ perp" : "→ spot"}`, wrapped: crtV2Wrap(crtV2Inner.usdClassTransfer(ctAmt.value, toPerp), "executor") }] });
};
const runFelixDeposit = () => run({
  title: `Felix: deposit ${felixDep.value} USDC`, role: "executor",
  steps: [
    { label: "1 · Approve Felix vault", wrapped: crtV2Wrap(crtV2Inner.approve(CRT_V2.ADDR.felix, "Felix vault", felixDep.value), "executor") },
    { label: "2 · Deposit", wrapped: crtV2Wrap(crtV2Inner.felixDeposit(felixDep.value), "executor"), expectSoftFail: true },
  ],
});
const runFelixWithdraw = () => run({ title: `Felix: withdraw ${felixWd.value} USDC`, role: "executor", steps: [{ label: "Withdraw (exact USDC out)", wrapped: crtV2Wrap(crtV2Inner.felixWithdraw(felixWd.value), "executor") }] });
const runFelixRedeemAll = () => run({
  title: "Felix: redeem all shares", role: "executor",
  warns: !bal.value || bal.value.felixShares === 0n ? ["No Felix shares held, so this will revert."] : [],
  steps: [{ label: "Redeem full share balance", wrapped: crtV2Wrap(crtV2Inner.felixRedeem(bal.value ? bal.value.felixShares : 0n), "executor") }],
});
const runHlSupply = () => run({
  title: `HyperLend: supply ${hlSup.value} USDC`, role: "executor",
  steps: [
    { label: "1 · Approve HyperLend pool", wrapped: crtV2Wrap(crtV2Inner.approve(CRT_V2.ADDR.pool, "HyperLend pool", hlSup.value), "executor") },
    { label: "2 · Supply", wrapped: crtV2Wrap(crtV2Inner.poolSupply(hlSup.value), "executor"), expectSoftFail: true },
  ],
});
const runHlWithdraw = (max: boolean) => {
  if (!max && !validAmt(hlWd.value)) return;
  run({ title: max ? "HyperLend: withdraw all" : `HyperLend: withdraw ${hlWd.value} USDC`, role: "executor", steps: [{ label: max ? "Withdraw full position + interest" : "Withdraw", wrapped: crtV2Wrap(crtV2Inner.poolWithdraw(max ? "max" : hlWd.value), "executor") }] });
};

// ─── Admin actions ───────────────────────────────────────────────────────────

const runPayout = async () => {
  const amt = payoutAmt.value;
  const shown = Number(amt).toLocaleString("en-US", { maximumFractionDigits: 6 });
  if (payoutChain.value === "hyperevm") {
    run({
      title: `Payout ${amt} USDC on HyperEVM`, role: "admin", route: "hyperevm",
      confirmPhrase: `${shown} USDC leaves the vault Safe to the payout wallet on HyperEVM. Nothing on-chain bounds this amount.`,
      steps: [{ label: "USDC.transfer(payout wallet)", wrapped: crtV2Wrap(crtV2Inner.payout(amt), "admin") }],
    });
    return;
  }
  // Arbitrum: approve the SpokePool and deposit, filed as one Safe
  // transaction. The quote fixes the minimum the wallet receives;
  // depositV3Now stamps its own time when the Safe executes.
  quoting.value = true;
  try {
    const input = usdc6(amt);
    const quote = await crtV2AcrossQuote(input);
    const warns: string[] = [];
    if (quote.minDeposit && input < quote.minDeposit) warns.push(`Below Across's minimum of ${fmt6(quote.minDeposit)} USDC for this route; the deposit would not be filled.`);
    if (quote.maxDeposit && input > quote.maxDeposit) warns.push(`Above Across's current maximum of ${fmt6(quote.maxDeposit)} USDC for this route.`);
    if (quote.outputAmount === 0n) warns.push("The amount does not cover the relayer reserve.");
    run({
      title: `Payout ${amt} USDC to Arbitrum`, role: "admin", route: "arbitrum", warns, quote,
      confirmPhrase: `${shown} USDC leaves the vault Safe into the Across bridge; the payout wallet receives at least ${fmt6(quote.outputAmount)} USDC on Arbitrum. Nothing on-chain bounds this amount.`,
      steps: [
        { label: "1 · Approve Across SpokePool", wrapped: crtV2Wrap(crtV2Inner.approve(CRT_V2.ADDR.spokePool, "Across SpokePool", amt), "admin") },
        { label: "2 · Across depositV3Now", wrapped: crtV2Wrap(crtV2Inner.acrossDeposit(amt, quote.outputAmount), "admin"), expectSoftFail: true },
      ],
    });
  } catch (error: any) {
    toastStore.errorToast("Across could not quote this payout: " + (error?.message || error), 10000);
  } finally {
    quoting.value = false;
  }
};
const runRegister = () => {
  const agent = ethers.getAddress(agentAddr.value.trim());
  const days = agentDaysNum.value;
  const preset = CRT_V2.AGENT.presets.find((p) => sameAddr(p.addr, agent));
  const replaces = agents.value?.named.find((n) => n.name === CRT_V2.AGENT.name);
  run({
    title: `Register ${preset ? preset.label.toLowerCase() : shortAddr(agent)} as API trader for ${days} days`, role: "admin", route: "agents",
    warns: replaces && !sameAddr(replaces.address, agent) ? [`Named “${CRT_V2.AGENT.name}” registration: it replaces ${shortAddr(replaces.address)}, which stops signing trades as soon as HyperCore processes this.`] : [],
    confirmPhrase: replaces && !sameAddr(replaces.address, agent) ? `${shortAddr(agent)} becomes the Safe's trading agent and ${shortAddr(replaces.address)} stops working immediately.` : undefined,
    steps: [{ label: `addApiWallet(${shortAddr(agent)}, “${CRT_V2.AGENT.name} valid_until …”)`, wrapped: crtV2Wrap(crtV2Inner.registerAgent(agent, days), "admin") }],
  });
};
/** Empties one HyperCore agent slot the way Hyperliquid's own app does: the zero address takes it. */
const runRemove = (slot: { name: string; address: string; kind: string }) => run({
  title: `Remove the ${slot.kind.toLowerCase()} agent ${shortAddr(slot.address)}`, role: "admin", route: "agents",
  confirmPhrase: "the agent in this slot stops signing trades as soon as HyperCore processes this.",
  steps: [{ label: "addApiWallet(zero address) payload", wrapped: crtV2Wrap(crtV2Inner.removeAgent(slot.name), "admin") }],
});
const runMember = (add: boolean) => {
  const member = ethers.getAddress(memberAddr.value.trim());
  run({
    title: `${add ? "Add" : "Remove"} executor ${shortAddr(member)}`, role: "admin", route: "members",
    confirmPhrase: add ? `${shortAddr(member)} gains the executor role: every executor action on this screen.` : `${shortAddr(member)} loses the executor role.`,
    steps: [{ label: `assignRoles(${shortAddr(member)}, [executor], [${add}])`, wrapped: crtV2Wrap(crtV2Inner.assignRole(member, "executor", add), "admin"), expectSoftFail: true }],
  });
};
/**
 * Handing the admin role over is two proposals on purpose: the new admin is
 * added first and proven to work, and only then is this Safe removed. One
 * proposal doing both would leave the vault adminless if the new address
 * turned out wrong.
 */
const runTransferAdmin = (stage: 1 | 2) => {
  if (stage === 1) {
    const next = ethers.getAddress(newAdminAddr.value.trim());
    run({
      title: `Transfer admin, step 1: add ${shortAddr(next)} as admin`, role: "admin", route: "members",
      confirmPhrase: `${shortAddr(next)} gains the admin role: payouts, API traders, executor members and vault settings.`,
      steps: [{ label: `assignRoles(${shortAddr(next)}, [admin], [true])`, wrapped: crtV2Wrap(crtV2Inner.assignRole(next, "admin", true), "admin"), expectSoftFail: true }],
    });
    return;
  }
  run({
    title: "Transfer admin, step 2: remove this Safe from the admin role", role: "admin", route: "members",
    warns: ["Only file this once the new admin has been added and has proven it can propose."],
    confirmPhrase: "the Carrot Safe loses the admin role. If no other admin exists, only governance can act afterwards.",
    steps: [{ label: `assignRoles(${shortAddr(CRT_V2.ADDR.adminSafe)}, [admin], [false])`, wrapped: crtV2Wrap(crtV2Inner.assignRole(CRT_V2.ADDR.adminSafe, "admin", false), "admin"), expectSoftFail: true }],
  });
};

// ─── Proposing to the admin Safe ─────────────────────────────────────────────

const runtimeConfig = useRuntimeConfig();
const proposalOrigin = JSON.stringify({ url: `https://${runtimeConfig.public.BASE_DOMAIN || "app.rethink.finance"}`, name: "Rethink" });
const proposalUrl = (step: any) => safeWalletUrl(ChainId.HYPEREVM, CRT_V2.ADDR.adminSafe, step.proposal?.safeTxHash);

const proposalTimers = new Set<ReturnType<typeof setTimeout>>();
const stopWatchingProposals = () => { proposalTimers.forEach((t) => clearTimeout(t)); proposalTimers.clear(); };
onBeforeUnmount(stopWatchingProposals);
watch(activity, (next) => { if (!next) stopWatchingProposals(); });

/** Keep a filed proposal's signature count current until it has run. */
const watchProposal = (step: any) => {
  const tick = async () => {
    try {
      const status = await fetchSafeTxStatus(ChainId.HYPEREVM, step.proposal.safeTxHash);
      step.proposal = { ...step.proposal, nonce: status.nonce, confirmations: status.confirmations, required: status.confirmationsRequired, executed: status.isExecuted };
      if (status.isExecuted) {
        step.txStatus = status.isSuccessful === false ? "fail" : "ok";
        step.txHash = status.transactionHash;
        refresh();
        return;
      }
    } catch (error) {
      console.warn("Could not read the proposal's status", error);
    }
    const timer = setTimeout(() => { proposalTimers.delete(timer); tick(); }, 15000);
    proposalTimers.add(timer);
  };
  tick();
};

/**
 * The admin Safe cannot press Execute: its transaction is proposed, signed by
 * enough owners and then run. One of its OWNERS signs here (a gasless
 * EIP-712 signature) and the console files it with Safe's transaction
 * service, which Safe{Wallet}'s queue reads; the SAFE ITSELF may also be the
 * connected wallet (Safe{Wallet} over WalletConnect), whose provider turns a
 * plain send into the same proposal.
 *
 * As an owner, every step of the action goes into ONE Safe transaction
 * (MultiSendCallOnly); as the Safe, the provider takes one call at a time,
 * so the steps are filed one after another.
 */
const propose = async (action: any): Promise<boolean> => {
  const provider = accountStore.connectedWallet?.provider;
  const signer = fundStore.activeAccountAddress;
  if (!provider || !signer) { toastStore.errorToast("Connect your wallet."); return false; }
  if (adminStanding.value === "none") return false;
  const steps: any[] = action.steps;
  steps.forEach((s) => { s.txStatus = "proposing"; });
  try {
    if (adminStanding.value === "safe") {
      if (accountStore.connectedWalletChainId !== ChainId.HYPEREVM) {
        throw new Error("Open the admin Safe on HyperEVM in Safe{Wallet}, then connect again.");
      }
      for (const step of steps) {
        const hash = String(await provider.request({
          method: "eth_sendTransaction",
          params: [{ from: CRT_V2.ADDR.adminSafe, to: step.wrapped.to, data: step.wrapped.data, value: "0x0" }],
        }));
        let status = null;
        try { status = await fetchSafeTxStatus(ChainId.HYPEREVM, hash); } catch { /* an on-chain hash, then */ }
        if (!status) {
          step.txStatus = "ok"; step.txHash = hash;
          continue;
        }
        step.proposal = { safeTxHash: hash, nonce: status.nonce, confirmations: status.confirmations, required: status.confirmationsRequired, executed: status.isExecuted };
        step.txStatus = "proposed";
        watchProposal(step);
      }
      toastStore.successToast("Filed with the admin Safe. The other owners can now sign and execute in Safe{Wallet}.");
      refresh();
      return true;
    }
    if (accountStore.connectedWalletChainId !== ChainId.HYPEREVM) {
      await accountStore.switchNetwork(ChainId.HYPEREVM);
    }
    const safe = await crtV2GetAdminSafe();
    adminSafe.value = safe;
    const nonce = await fetchNextSafeNonce(ChainId.HYPEREVM, CRT_V2.ADDR.adminSafe, safe.nonce);
    const call: CrtV2SafeCall = action.safeCall;
    const tx = buildSafeTx({ to: call.to, data: call.data, value: call.value, operation: call.operation }, nonce);
    const signature = await signSafeTx(provider, signer, ChainId.HYPEREVM, CRT_V2.ADDR.adminSafe, tx);
    const safeTxHash = await proposeSafeTx(ChainId.HYPEREVM, CRT_V2.ADDR.adminSafe, tx, signer, signature, proposalOrigin);
    const proposal = { safeTxHash, nonce, confirmations: 1, required: safe.threshold, executed: false };
    steps.forEach((s) => { s.proposal = proposal; s.txStatus = "proposed"; });
    toastStore.successToast(`Proposed to the admin Safe as ${steps.length === 1 ? "one transaction" : `one batched transaction (${steps.length} calls)`}. The other owners can now sign and execute it in Safe{Wallet}.`);
    watchProposal(steps[0]);
    return true;
  } catch (error: any) {
    steps.filter((s) => s.txStatus === "proposing").forEach((s) => failStep(s, error));
    return false;
  }
};

/** Release the step and say why; a declined signature is not a failure, so it only clears. */
const failStep = (step: any, error: any) => {
  console.error(error);
  const message = error?.innerError?.message || error?.message || "";
  const declined = error?.code === 4001 || error?.innerError?.code === 4001 || /user (denied|rejected)/i.test(message);
  step.txStatus = declined ? "declined" : "error";
  step.error = declined ? "" : explainSendFailure(message);
  if (declined) return;
  toastStore.errorToast(step.error, 15000);
};

/**
 * `rpc.hyperliquid.xyz/evm` serves no block lookups; a wallet pointed at it
 * cannot price a transaction and reports a quota message that names neither
 * the cause nor the cure.
 */
const explainSendFailure = (message: string) => {
  if (!/archived blocks queried/i.test(message)) return message || "There has been an error.";
  return "Your wallet's HyperEVM RPC can't look up blocks, which it needs in order to price this transaction. Edit the HyperEVM network in your wallet and set its RPC URL to https://rpc.purroofgroup.com (or https://rpc.hypurrscan.io), then try again.";
};

/** The executor's own wallet signs the wrapped call (or a Pilot session gets the inner one). */
const exec = async (step: any): Promise<boolean> => {
  if (!accountStore.connectedWalletWeb3) { toastStore.errorToast("Connect your wallet."); return false; }
  try {
    step.txStatus = "pending";
    if (accountStore.connectedWalletChainId !== ChainId.HYPEREVM) {
      await accountStore.switchNetwork(ChainId.HYPEREVM);
    }
    const transaction = isVaultSafe.value
      ? sendAsSafe(ChainId.HYPEREVM, { to: step.wrapped.inner.to, data: step.wrapped.inner.data })
      : accountStore.connectedWalletWeb3.eth.sendTransaction(
        { to: step.wrapped.to, data: step.wrapped.data, from: fundStore.activeAccountAddress, value: 0 },
        DEFAULT_RETURN_FORMAT,
        // The wallet prices the transaction; web3's own EIP-1559 fill starts
        // with a block lookup the official HyperEVM RPC refuses.
        { checkRevertBeforeSending: false, ignoreGasPricing: true },
      );
    return await new Promise<boolean>((resolve) => {
      transaction
        .on("transactionHash", (hash: any) => { step.txHash = hash; toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed."); })
        .on("receipt", (receipt: any) => {
          step.txStatus = receipt.status ? "ok" : "fail";
          if (receipt.status) {
            toastStore.successToast("The transaction was successful.");
            refresh();
          } else {
            toastStore.errorToast("The transaction has failed.");
          }
          resolve(!!receipt.status);
        })
        .on("error", (error: any) => { failStep(step, error); resolve(false); });
      Promise.resolve(transaction).then(
        () => resolve(step.txStatus === "ok"),
        (error: any) => { if (step.txStatus === "pending") failStep(step, error); resolve(false); },
      );
    });
  } catch (error: any) {
    failStep(step, error);
    return false;
  }
};
</script>

<style scoped lang="scss">
.crt_console {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  margin-bottom: 2.5rem;
}

/* The mono uppercase caption the whole design system labels figures with. */
.crt_label {
  font-family: $font-mono;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: $color-steel-blue;

  &--accent {
    letter-spacing: 0.16em;
    color: $color-cyan;
  }
}

.crt_mono {
  font-family: $font-mono;
}

.crt_summary {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1.5rem 2rem;

  &__hero {
    display: flex;
    flex-direction: column;
    gap: 0.8125rem;
  }

  &__value_row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  &__figure {
    font-family: $font-mono;
    font-size: clamp(30px, 3.4vw, 42px);
    font-weight: 500;
    letter-spacing: -0.025em;
    line-height: 0.95;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }

  &__unit {
    font-family: $font-mono;
    font-size: 17px;
    color: $color-text-irrelevant;
  }

  &__divider {
    display: none;
    width: 1px;
    align-self: stretch;
    background: $color-line;

    @media (min-width: 1360px) {
      display: block;
      margin-left: auto;
    }
  }

  &__breakdown {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1rem 1.75rem;
  }

  &__refresh {
    align-self: flex-end;
  }
}

.crt_stat {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;

  &--right {
    text-align: right;
  }

  &__value {
    font-family: $font-mono;
    font-size: 15px;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }
}

/* Where the vault stands and what each button would meet. */
.crt_status {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
  }

  &__facts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1.25rem;
    font-size: 13px;
    color: $color-white;
  }

  &__you {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: $font-mono;
    font-size: 11.5px;
    letter-spacing: 0.04em;
    color: $color-steel-blue;
  }
}

.crt_fact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.crt_ready {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem 2rem;

  &__group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 13px;
    color: $color-white;
  }

  &__label {
    flex: 1;
    min-width: 0;
  }

  &__state {
    white-space: nowrap;
  }
}

.crt_missing {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.875rem;
  border-top: 1px solid $color-line;

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}

.crt_section {
  margin-top: 0.75rem;

  &:first-child {
    margin-top: 0;
  }
}

.crt_tag {
  font-family: $font-mono;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  padding: 0.1875rem 0.4375rem;
  border-radius: 3px;
  color: $color-steel-blue;
  border: 1px solid $color-line;

  &--danger {
    color: $color-neg;
    background: $color-neg-soft;
    border-color: $color-neg-line;
  }
}

.crt_card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  &--payout {
    border-color: $color-neg-line;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__titles {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__sub {
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__foot {
    display: flex;
    justify-content: flex-end;
    margin-top: -0.375rem;
  }
}

.crt_layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.75rem;
  align-items: start;
}

.crt_activity {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  &__title {
    font-weight: 600;
    color: $color-white;
  }

  &__close {
    display: flex;
    color: $color-text-irrelevant;
    background: none;
    border: 0;
    cursor: pointer;
  }

  &__step {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    font-size: 13px;
  }

  &__state {
    font-family: $font-mono;
    font-size: 12px;
    text-align: right;
  }
}

/* The admin transaction, laid out for Safe{Wallet}'s transaction builder. */
.crt_raw {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid $color-line;

  &__summary {
    cursor: pointer;
    font-family: $font-mono;
    font-size: 11.5px;
    letter-spacing: 0.04em;
    color: $color-cyan;
  }

  &__grid {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.5rem 1rem;
    align-items: baseline;
    margin-top: 0.75rem;
  }

  &__value {
    font-size: 12px;
    color: $color-white;
  }

  &__data {
    word-break: break-all;
    max-height: 9rem;
    overflow: auto;
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
}

.crt_main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.crt_row {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  flex-wrap: wrap;

  > * {
    flex: 1;
    min-width: 120px;
  }

  > .v-btn {
    flex: 0 0 auto;
    min-width: 0;
  }

  &--top {
    padding-top: 0.875rem;
    border-top: 1px solid $color-line;
  }
}

.crt_field {
  &--narrow {
    max-width: 180px;
  }

  &--wide {
    flex: 2 1 320px;
  }
}

.crt_grid2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 1rem;
}

.crt_text_action.v-btn {
  color: $color-cyan !important;
  font-weight: 600;

  &.crt_text_action--danger {
    color: $color-neg !important;
  }
}

.crt_slots {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid $color-line;
}

.crt_slot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  font-size: 13px;

  &__kind {
    font-weight: 600;
    color: $color-white;
  }

  &__until {
    margin-left: auto;
  }
}

/* Known keys, one press to fill the address field. */
.crt_presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.crt_preset {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid $color-line;
  border-radius: 4px;
  background: none;
  color: $color-white;
  font-size: 12.5px;
  cursor: pointer;

  &--active {
    border-color: $color-cyan;
  }
}

.crt_dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex: none;
  background: $color-steel-blue;

  &--on {
    background: $color-pos;
  }

  &--warn {
    background: $color-warning;
  }

  &--off {
    background: $color-neg;
  }

  &--idle {
    background: $color-inactive;
  }
}

.crt_mono_dim {
  font-family: $font-mono;
  font-size: 11px;
  color: $color-steel-blue;
  word-break: break-all;
}

.crt_ok {
  color: $color-cyan;
  font-family: $font-mono;
  font-size: 12px;

  &:hover {
    color: $color-cyan;
    text-decoration: underline;
  }
}

.crt_bad {
  color: $color-neg;
  font-family: $font-mono;
  font-size: 12px;
}

.crt_payout {
  &__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem 2rem;
    flex-wrap: wrap;
  }

  &__balances {
    display: flex;
    gap: 1.75rem;
  }

  &__toggle {
    flex: 0 0 auto;
  }
}
</style>
