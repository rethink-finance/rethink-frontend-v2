<template>
  <div class="sni_console">
    <!-- What is waiting, first: the rewards the next claim moves. -->
    <div class="sni_summary">
      <div class="sni_summary__hero">
        <div class="sni_summary__value_row">
          <span class="sni_summary__figure">{{ state ? fmtEth(state.claimable, 4) : "…" }}</span>
          <span class="sni_summary__unit">ETH</span>
        </div>
        <div class="sni_label">
          Rewards to claim
        </div>
      </div>

      <div class="sni_summary__stats">
        <div class="sni_stat">
          <div class="sni_stat__value">
            {{ state ? fmtEth(state.safeEth, 4) : "…" }} ETH
          </div>
          <div class="sni_label">
            In the Safe, to bridge
          </div>
        </div>
        <div class="sni_stat">
          <div class="sni_stat__value">
            {{ state ? fmtEth(state.claimed, 2) : "…" }} ETH
          </div>
          <div class="sni_label">
            Claimed to date
          </div>
        </div>
        <div class="sni_stat">
          <div class="sni_stat__value">
            {{ state ? fmtEth(state.staked, 0) : "…" }} ETH
          </div>
          <div class="sni_label">
            Staked
          </div>
        </div>
      </div>

      <div class="sni_summary__tools">
        <span v-if="memberHere" class="sni_member">
          <span class="sni_dot sni_dot--ok" />
          role 1 · {{ shortAddr(account) }}
        </span>
        <span v-if="state" class="sni_mono">block {{ state.block.toLocaleString("en-US") }}</span>
        <v-btn
          variant="outlined"
          size="small"
          :loading="loading"
          @click="refresh"
        >
          Refresh
        </v-btn>
      </div>
    </div>

    <div v-if="loadError" class="sni_banner sni_banner--bad">
      Could not read the vault from Ethereum. {{ loadError }}
    </div>

    <div v-if="dest && !dest.safe" class="sni_banner sni_banner--bad">
      <b>Bridging is locked until the landing Safe is defused (step 0 below).</b>
      {{ dest.reason }}
      Moving the WETH on straight after it lands does not help: the sweep is a public call, and the attacker can top the Safe up and execute it in the same block the bridge fills.
      <div class="sni_banner__meta">
        Recipient
        <a
          class="sni_link"
          :href="`${SNI.POLYGON_EXPLORER}/address/${SNI.DEST.recipient}`"
          target="_blank"
          rel="noopener"
        >{{ shortAddr(SNI.DEST.recipient) }}</a>
        · owners {{ dest.owners.length ? dest.owners.map(shortAddr).join(", ") : "unknown" }}
        · sweep proposal {{ dest.sweepState }}.
        Claiming is still fine: rewards are not counted in the NAV, so they can wait in the Safe.
      </div>
    </div>

    <div v-if="!accountStore.isConnected" class="sni_banner sni_banner--action">
      <span>Connect a role-1 wallet to run the claim and the bridge. Balances are readable without one.</span>
      <v-btn color="primary" size="small" @click="accountStore.connectWallet()">
        Connect wallet
      </v-btn>
    </div>
    <div v-else-if="!memberHere && !polyMemberHere && !isDeployer && !isConnectedAsSafe" class="sni_banner sni_banner--bad">
      <b>{{ shortAddr(account) }} does not hold role 1 on this vault or on the Polygon Safe.</b>
      Both modifiers will refuse anything it sends. Switch to one of the role members listed below.
    </div>

    <!-- ------------------------------------------------------------------ -->
    <div class="group_title sni_section">
      Claim, bridge, move
    </div>
    <div class="brand_card sni_card">
      <!-- One-time: take the old governor off the landing Safe. -->
      <div v-if="dest && !dest.safe" class="sni_step sni_step--alert">
        <span class="sni_step__n">0</span>
        <div class="sni_step__text">
          <div class="sni_step__title">
            Defuse the landing Safe on Polygon (once)
          </div>
          <div class="sni_card__sub">
            Replaces the old governor with the deployer
            <a
              class="sni_link"
              :href="`${POLY.EXPLORER}/address/${POLY.ADDR.newOwner}`"
              target="_blank"
              rel="noopener"
            >{{ shortAddr(POLY.ADDR.newOwner) }}</a>
            as owner of
            <a
              class="sni_link"
              :href="`${POLY.EXPLORER}/address/${POLY.ADDR.oldSafe}`"
              target="_blank"
              rel="noopener"
            >{{ shortAddr(POLY.ADDR.oldSafe) }}</a>, so the passed sweep can no longer execute.
            First the deployer
            <span class="sni_mono">{{ shortAddr(POLY.ADDR.deployer) }}</span> stores the permission through the factory
            (the old vault never finalized, so no vote is needed); then a Polygon role-1 member sends the swap.
          </div>
          <div class="sni_substeps">
            <div class="sni_substep">
              <span class="sni_dot" :class="poly?.defuseScoped ? 'sni_dot--ok' : ''" />
              <span>a. Permission stored</span>
              <v-tooltip location="bottom" :disabled="!permissionBlocked">
                <template #activator="{ props: tip }">
                  <span v-bind="tip">
                    <v-btn
                      size="x-small"
                      variant="outlined"
                      :loading="isBusy('permission')"
                      :disabled="!!permissionBlocked"
                      @click="runPermission"
                    >
                      {{ poly?.defuseScoped ? "Stored" : "Store permission" }}
                    </v-btn>
                  </span>
                </template>
                {{ permissionBlocked }}
              </v-tooltip>
            </div>
            <div class="sni_substep">
              <span class="sni_dot" />
              <span>b. Owner swapped</span>
              <v-tooltip location="bottom" :disabled="!swapBlocked">
                <template #activator="{ props: tip }">
                  <span v-bind="tip">
                    <v-btn
                      size="x-small"
                      color="primary"
                      :loading="isBusy('swapOwner')"
                      :disabled="!!swapBlocked"
                      @click="runSwapOwner"
                    >
                      Swap owner
                    </v-btn>
                  </span>
                </template>
                {{ swapBlocked }}
              </v-tooltip>
            </div>
          </div>
          <div v-if="statusLine('permission')" class="sni_status" :class="`sni_status--${status.permission.phase}`">
            {{ statusLine("permission") }}
          </div>
          <div v-if="statusLine('swapOwner')" class="sni_status" :class="`sni_status--${status.swapOwner.phase}`">
            {{ statusLine("swapOwner") }}
          </div>
        </div>
      </div>

      <div class="sni_step">
        <span class="sni_step__n">1</span>
        <div class="sni_step__text">
          <div class="sni_step__title">
            Claim the validator rewards
          </div>
          <div class="sni_card__sub">
            <b>claimRewards()</b> on the W3 staking vault moves every claimable ETH into the Safe as plain ETH.
            The NAV counts staked principal only, so the share price does not move.
          </div>
          <div v-if="statusLine('claim')" class="sni_status" :class="`sni_status--${status.claim.phase}`">
            {{ statusLine("claim") }}
          </div>
        </div>
        <v-tooltip location="bottom" :disabled="!claimBlocked">
          <template #activator="{ props: tip }">
            <span v-bind="tip">
              <v-btn
                color="primary"
                size="small"
                :loading="isBusy('claim')"
                :disabled="!!claimBlocked"
                @click="runClaim"
              >
                Claim {{ state ? fmtEth(state.claimable, 4) : "" }} ETH
              </v-btn>
            </span>
          </template>
          {{ claimBlocked }}
        </v-tooltip>
      </div>

      <div class="sni_step">
        <span class="sni_step__n">2</span>
        <div class="sni_step__text">
          <div class="sni_step__title">
            Bridge to {{ SNI.DEST.chainName }}
          </div>
          <div class="sni_card__sub">
            Sends the Safe's plain ETH through Across, arriving as WETH at
            <a
              class="sni_link"
              :href="`${SNI.POLYGON_EXPLORER}/address/${SNI.DEST.recipient}`"
              target="_blank"
              rel="noopener"
            >{{ shortAddr(SNI.DEST.recipient) }}</a>
            on Polygon — the only recipient the vault's permissions allow. A fresh quote is taken when you press.
          </div>
          <div v-if="quote" class="sni_quote">
            <span>Arrives <b>{{ fmtEth(quote.outputAmount) }} WETH</b></span>
            <span>fee {{ fmtEth(quote.feeTotal) }} ETH</span>
            <span>~{{ quote.estimatedFillTimeSec || "?" }} s</span>
          </div>
          <div v-else-if="quoteError" class="sni_problem">
            {{ quoteError }}
          </div>
          <div v-if="statusLine('bridge')" class="sni_status" :class="`sni_status--${status.bridge.phase}`">
            {{ statusLine("bridge") }}
          </div>
        </div>
        <v-tooltip location="bottom" :disabled="!bridgeBlocked">
          <template #activator="{ props: tip }">
            <span v-bind="tip">
              <v-btn
                color="primary"
                size="small"
                :loading="isBusy('bridge')"
                :disabled="!!bridgeBlocked"
                @click="runBridge"
              >
                Bridge {{ state ? fmtEth(state.safeEth, 4) : "" }} ETH
              </v-btn>
            </span>
          </template>
          {{ bridgeBlocked }}
        </v-tooltip>
      </div>

      <div class="sni_step">
        <span class="sni_step__n">3</span>
        <div class="sni_step__text">
          <div class="sni_step__title">
            Move to the SYC vault
          </div>
          <div class="sni_card__sub">
            Once Across fills, sends all the WETH in
            <span class="sni_mono">{{ shortAddr(POLY.ADDR.oldSafe) }}</span> on to the Safe of the SNI Yield Claim (SYC) vault
            <a
              class="sni_link"
              :href="`${POLY.EXPLORER}/address/${POLY.ADDR.newSafe}`"
              target="_blank"
              rel="noopener"
            >{{ shortAddr(POLY.ADDR.newSafe) }}</a>,
            through the old Safe's own role 1 (WETH transfers there are allowed only to the SYC vault Safe and the team multisig). The SYC NAV counts WETH, so it shows up in the vault's value at the next NAV update.
          </div>
          <div v-if="statusLine('move')" class="sni_status" :class="`sni_status--${status.move.phase}`">
            {{ statusLine("move") }}
          </div>
        </div>
        <v-tooltip location="bottom" :disabled="!moveBlocked">
          <template #activator="{ props: tip }">
            <span v-bind="tip">
              <v-btn
                color="primary"
                size="small"
                :loading="isBusy('move')"
                :disabled="!!moveBlocked"
                @click="runMove"
              >
                Move {{ poly ? fmtEth(poly.oldSafeWeth, 4) : "" }} WETH
              </v-btn>
            </span>
          </template>
          {{ moveBlocked }}
        </v-tooltip>
      </div>
    </div>

    <template v-if="log.length">
      <div class="group_title sni_section">
        This session
      </div>
      <div class="brand_card sni_card">
        <div v-for="entry in log" :key="entry.id" class="sni_log">
          <span class="sni_dot" :class="`sni_dot--${entry.phase}`" />
          <span class="sni_log__label">{{ entry.label }}</span>
          <span class="sni_mono">{{ entry.message }}</span>
          <a
            v-if="entry.txHash"
            class="sni_link"
            :href="`${entry.explorer}/tx/${entry.txHash}`"
            target="_blank"
            rel="noopener"
          >{{ entry.txHash.slice(0, 10) }}…</a>
          <a
            v-if="entry.txHash && entry.bridge"
            class="sni_link"
            :href="`${SNI.ACROSS_EXPLORER}?search=${entry.txHash}`"
            target="_blank"
            rel="noopener"
          >Across</a>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  PERIPHERIES,
  POLY,
  SNI,
  destinationGuard,
  fetchAcrossQuote,
  fmtEth,
  isMember,
  isPolyMember,
  polyCalls,
  polyReadState,
  shortAddr,
  sniCalls,
  sniReadState,
  validateBridge,
  type AcrossQuote,
  type DestinationCheck,
  type PolyState,
  type SniState,
} from "~/composables/execution/sniEthConsole";
import {
  sendAsSafe,
  sendCuratorTransaction,
  simulateCuratorTransaction,
  useCuratorExecution,
  type ICuratorRoute,
} from "~/composables/permissions/useCuratorExecution";
import {
  RolesVersion,
  simulateDirectCall,
  simulateRoleExecution,
  type IRoleCall,
  type IRoleSimulationResult,
} from "~/composables/permissions/useRoleExecution";
import { useAccountStore } from "~/store/account/account.store";
import { useToastStore } from "~/store/toasts/toast.store";
import type { ChainId } from "~/types/enums/chain_id";

const accountStore = useAccountStore();
const toastStore = useToastStore();
const { isConnectedAsSafe } = useCuratorExecution();

// Modifier, generation and role are established facts on both chains, so the
// route is handed over instead of being resolved from membership. A session
// connected as the sniETH Safe (Pilot) still gets the mainnet calls unwrapped;
// the Polygon steps always go through the old Safe's own modifier.
const ROUTE: ICuratorRoute = {
  chainId: SNI.CHAIN,
  rolesModAddress: SNI.ADDR.roles,
  role: SNI.ROLE,
  version: RolesVersion.V1,
};
const POLY_ROUTE: ICuratorRoute = {
  chainId: POLY.CHAIN,
  rolesModAddress: POLY.ADDR.oldRoles,
  role: POLY.ROLE,
  version: RolesVersion.V1,
};

const account = computed(() => accountStore.activeAccountAddress || "");
const sameAddr = (a: string, b: string) => !!b && a.toLowerCase() === b.toLowerCase();
const memberHere = computed(() => isMember(account.value));
const polyMemberHere = computed(() => isPolyMember(account.value));
const isDeployer = computed(() => sameAddr(POLY.ADDR.deployer, account.value));

/* ------------------------------------------------------------------ state */

const state = ref<SniState | null>(null);
const poly = ref<PolyState | null>(null);
const dest = ref<DestinationCheck | null>(null);
const quote = ref<AcrossQuote | null>(null);
const quoteError = ref("");
const loading = ref(false);
const loadError = ref("");

const refreshQuote = async () => {
  const amount = state.value?.safeEth ?? 0n;
  if (amount <= 0n) {
    quote.value = null;
    quoteError.value = "";
    return;
  }
  try {
    const q = await fetchAcrossQuote(amount);
    if (q.isAmountTooLow) throw new Error("Across says the amount is too low to bridge.");
    quote.value = q;
    quoteError.value = "";
  } catch (error: any) {
    quote.value = null;
    quoteError.value = error?.message || "Across did not quote.";
  }
};

const refreshPolygon = async () => {
  const [p, d] = await Promise.all([polyReadState().catch(() => null), destinationGuard()]);
  if (p) poly.value = p;
  dest.value = d;
};

const refresh = async () => {
  loading.value = true;
  try {
    const [s] = await Promise.all([sniReadState(), refreshPolygon()]);
    state.value = s;
    loadError.value = "";
    await refreshQuote();
  } catch (error: any) {
    console.error(error);
    loadError.value = error?.message || "";
  } finally {
    loading.value = false;
  }
};

/**
 * After a deposit, watch the landing Safe every 10 s for up to five minutes,
 * so the move step lights up as soon as Across fills.
 */
let fillWatch: ReturnType<typeof setInterval> | undefined;
const watchForFill = (expected: bigint) => {
  clearInterval(fillWatch);
  const startedWith = poly.value?.oldSafeWeth ?? 0n;
  const until = Date.now() + 5 * 60_000;
  fillWatch = setInterval(async () => {
    await refreshPolygon().catch(() => {});
    const landed = (poly.value?.oldSafeWeth ?? 0n) > startedWith;
    if (landed) {
      status.bridge.message = `Filled: ${fmtEth(poly.value!.oldSafeWeth, 4)} WETH is in the Polygon Safe. Move it on (step 3).`;
      toastStore.successToast("Across filled — the WETH is on Polygon.");
    }
    if (landed || Date.now() > until) clearInterval(fillWatch);
  }, 10_000);
  status.bridge.message = `Deposited ${fmtEth(expected, 4)} ETH. Watching Polygon for the fill…`;
};

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  refresh();
  timer = setInterval(() => {
    if (!anyBusy.value) refresh();
  }, 60_000);
});
onUnmounted(() => {
  clearInterval(timer);
  clearInterval(fillWatch);
});

/* -------------------------------------------------------------- execution */

type ActionKey = "permission" | "swapOwner" | "claim" | "bridge" | "move";
type Phase = "idle" | "simulating" | "signing" | "pending" | "ok" | "failed";
const ACTIONS: ActionKey[] = ["permission", "swapOwner", "claim", "bridge", "move"];

const status = reactive(
  Object.fromEntries(ACTIONS.map((key) => [key, { phase: "idle" as Phase, message: "" }])),
) as Record<ActionKey, { phase: Phase; message: string }>;
const isBusy = (key: ActionKey) => ["simulating", "signing", "pending"].includes(status[key].phase);
const anyBusy = computed(() => ACTIONS.some(isBusy));

const statusLine = (key: ActionKey) => {
  const { phase, message } = status[key];
  switch (phase) {
    case "simulating":
      return message || "Checking the role allows it…";
    case "signing":
      return "Waiting for your wallet…";
    case "pending":
      return "Submitted, waiting for the block…";
    case "ok":
      return message || "Done.";
    case "failed":
      return message;
    default:
      return "";
  }
};

/** Why a button is off before its own conditions are looked at. */
const walletProblem = (allowed: boolean, who: string) => {
  if (!accountStore.isConnected) return "Connect a wallet first.";
  if (!allowed) return `Only ${who} can do this.`;
  if (anyBusy.value) return "Another transaction is in progress.";
  return "";
};
const mainnetWallet = () => walletProblem(memberHere.value || isConnectedAsSafe.value, "an Ethereum role-1 member");
const polygonWallet = () => walletProblem(polyMemberHere.value && !isConnectedAsSafe.value, "a Polygon role-1 member");

const permissionBlocked = computed(() => {
  if (poly.value?.defuseScoped) return "Already stored.";
  const wallet = walletProblem(isDeployer.value && !isConnectedAsSafe.value, `the deployer ${shortAddr(POLY.ADDR.deployer)}`);
  if (wallet) return wallet;
  if (!poly.value) return "Reading Polygon…";
  return "";
});

const swapBlocked = computed(() => {
  const wallet = polygonWallet();
  if (wallet) return wallet;
  if (!poly.value || !dest.value) return "Reading Polygon…";
  if (!poly.value.defuseScoped) return "Store the permission first (a).";
  if (!dest.value.ownerIsGovernor) return "Already swapped.";
  return "";
});

const claimBlocked = computed(() => {
  const wallet = mainnetWallet();
  if (wallet) return wallet;
  if (!state.value) return "Reading the vault…";
  if (state.value.claimable < SNI.MIN_CLAIM) return "Nothing to claim yet.";
  return "";
});

const bridgeBlocked = computed(() => {
  const wallet = mainnetWallet();
  if (wallet) return wallet;
  if (!state.value || !dest.value) return "Reading the vault…";
  if (!dest.value.safe) return "Defuse the landing Safe first (step 0).";
  if (state.value.safeEth <= 0n) {
    return state.value.claimable >= SNI.MIN_CLAIM ? "Claim first: the Safe holds no ETH yet." : "The Safe holds no ETH to bridge.";
  }
  if (quoteError.value) return quoteError.value;
  return "";
});

const moveBlocked = computed(() => {
  const wallet = polygonWallet();
  if (wallet) return wallet;
  if (!poly.value) return "Reading Polygon…";
  if (poly.value.oldSafeWeth <= 0n) return "No WETH has landed in the Polygon Safe yet.";
  return "";
});

interface LogEntry { id: number; label: string; phase: Phase; message: string; txHash: string; bridge: boolean; explorer: string }
const log = ref<LogEntry[]>([]);
let logId = 0;

const declined = (error: any) => {
  const message = error?.innerError?.message || error?.message || "";
  return error?.code === 4001 || error?.innerError?.code === 4001 || /user (denied|rejected)/i.test(message);
};

/** Sign and wait for one already-checked transaction. */
const sendChecked = (
  key: ActionKey,
  entry: LogEntry,
  send: () => ReturnType<typeof sendCuratorTransaction>,
): Promise<boolean> =>
  new Promise((resolve) => {
    const set = (phase: Phase, message = "") => {
      status[key] = { phase, message };
      entry.phase = phase;
      entry.message = message || statusLine(key);
    };
    set("signing");
    send()
      .on("transactionHash", (hash: any) => {
        entry.txHash = String(hash);
        set("pending");
      })
      .on("receipt", (receipt: any) => {
        const ok = !!receipt.status;
        set(ok ? "ok" : "failed", ok ? "" : "The transaction reverted on chain.");
        resolve(ok);
      })
      .catch((error: any) => {
        console.error(error);
        const message = error?.innerError?.message || error?.message || "";
        set(declined(error) ? "idle" : "failed", declined(error) ? "" : message || "There has been an error.");
        if (declined(error)) entry.message = "declined in the wallet";
        resolve(false);
      });
  });

const begin = async (key: ActionKey, label: string, chain: ChainId, bridge = false) => {
  const entry: LogEntry = reactive({
    id: ++logId,
    label,
    phase: "simulating",
    message: "checking",
    txHash: "",
    bridge,
    explorer: chain === POLY.CHAIN ? POLY.EXPLORER : SNI.EXPLORER,
  });
  log.value.unshift(entry);
  status[key] = { phase: "simulating", message: "" };
  // Every address a step touches lives on one chain; the same calldata on the
  // other would land on whatever sits at those addresses there.
  if (accountStore.connectedWalletChainId !== chain) {
    await accountStore.switchNetwork(chain);
  }
  return entry;
};

const fail = (key: ActionKey, entry: LogEntry | null, message: string) => {
  status[key] = { phase: "failed", message };
  if (entry) {
    entry.phase = "failed";
    entry.message = message;
  }
  return false;
};

/** Dry-run, then send through a role: the shape of every role step here. */
const runRoleStep = async (
  key: ActionKey,
  label: string,
  call: IRoleCall,
  route: ICuratorRoute,
  done: string,
): Promise<boolean> => {
  let entry: LogEntry | null = null;
  try {
    entry = await begin(key, label, route.chainId);
    // The Polygon modifier is not this vault's, so it is always asked about
    // directly; the mainnet one goes through the shared Safe-session logic.
    const simulation: IRoleSimulationResult = route === ROUTE
      ? await simulateCuratorTransaction(call, route)
      : await simulateRoleExecution(route.chainId, route.rolesModAddress, call, route.role!, RolesVersion.V1);
    if (!simulation.ok) {
      return fail(key, entry, simulation.reason || "The Roles modifier refused this.");
    }
    const ok = await sendChecked(key, entry, () => sendCuratorTransaction(call, route));
    if (ok) {
      toastStore.successToast(done);
      await refresh();
    }
    return ok;
  } catch (error: any) {
    console.error(error);
    return fail(key, entry, error?.message || "There has been an error.");
  }
};

/** Step 0a: the deployer stores the swapOwner permission through the factory. */
const runPermission = async () => {
  if (permissionBlocked.value) return;
  let entry: LogEntry | null = null;
  try {
    entry = await begin("permission", "Store the swapOwner permission (Polygon)", POLY.CHAIN);
    const call = polyCalls.defusePermission();
    const simulation = await simulateDirectCall(POLY.CHAIN, account.value, call);
    if (!simulation.ok) return fail("permission", entry, `The factory refused: ${simulation.reason || "reverted"}`);
    if (await sendChecked("permission", entry, () => sendAsSafe(POLY.CHAIN, call))) {
      toastStore.successToast("Permission stored. A Polygon role-1 member can swap the owner now.");
      await refresh();
    }
  } catch (error: any) {
    console.error(error);
    fail("permission", entry, error?.message || "There has been an error.");
  }
};

/** Step 0b: take the old governor off the landing Safe. */
const runSwapOwner = () =>
  !swapBlocked.value &&
  runRoleStep(
    "swapOwner",
    `Swap the Polygon Safe's owner to ${shortAddr(POLY.ADDR.newOwner)}`,
    polyCalls.swapOwner(),
    POLY_ROUTE,
    "The landing Safe is defused. Bridging is unlocked.",
  );

/** Click one: claim every claimable ETH into the Safe. */
const runClaim = () =>
  !claimBlocked.value &&
  runRoleStep(
    "claim",
    `Claim ${fmtEth(state.value!.claimable, 4)} ETH`,
    sniCalls.claim(),
    ROUTE,
    "Rewards claimed into the Safe.",
  );

/**
 * Click two: bridge the Safe's whole ETH balance. Re-reads the balance and the
 * destination, takes a fresh quote, then builds the deposit for each scoped
 * periphery in turn and sends the first one the modifier and the periphery
 * both accept in a dry run.
 */
const runBridge = async () => {
  if (bridgeBlocked.value) return;
  let entry: LogEntry | null = null;
  try {
    entry = await begin("bridge", `Bridge ${fmtEth(state.value!.safeEth, 4)} ETH to Polygon`, SNI.CHAIN, true);
    status.bridge.message = "Re-reading the Safe and the destination…";
    const [s, d] = await Promise.all([sniReadState(), destinationGuard()]);
    state.value = s;
    dest.value = d;
    if (!d.safe) return fail("bridge", entry, d.reason);
    if (s.safeEth <= 0n) return fail("bridge", entry, "The Safe holds no ETH to bridge.");

    status.bridge.message = "Getting a fresh Across quote…";
    const q = await fetchAcrossQuote(s.safeEth);
    if (q.isAmountTooLow) return fail("bridge", entry, "Across says the amount is too low to bridge.");
    quote.value = q;

    const reasons: string[] = [];
    for (const periphery of PERIPHERIES) {
      const call = sniCalls.bridge(periphery, q);
      const problems = validateBridge(call);
      if (problems.length) return fail("bridge", entry, problems.join(" "));
      status.bridge.message = `Checking the deposit through ${shortAddr(periphery.address)}…`;
      const simulation = await simulateCuratorTransaction(call, ROUTE);
      if (simulation.ok) {
        entry.label = `Bridge ${fmtEth(q.inputAmount, 4)} ETH → ${fmtEth(q.outputAmount, 4)} WETH on Polygon`;
        if (await sendChecked("bridge", entry, () => sendCuratorTransaction(call, ROUTE))) {
          toastStore.successToast("Bridge deposit sent through Across.");
          await refresh();
          watchForFill(q.inputAmount);
        }
        return;
      }
      if (simulation.noMembership) return fail("bridge", entry, simulation.reason || "The wallet does not hold role 1.");
      reasons.push(`${shortAddr(periphery.address)}: ${simulation.reason || "refused"}`);
    }
    fail("bridge", entry, `No periphery accepted the deposit. ${reasons.join(" · ")}`);
  } catch (error: any) {
    console.error(error);
    fail("bridge", entry, error?.message || "There has been an error.");
  }
};

/** Click three: everything that landed goes on to the SYC vault's Safe. */
const runMove = async () => {
  if (moveBlocked.value) return;
  // Re-read so the amount is the balance at the moment of sending.
  const fresh = await polyReadState().catch(() => null);
  if (fresh) poly.value = fresh;
  const amount = poly.value?.oldSafeWeth ?? 0n;
  if (amount <= 0n) return;
  await runRoleStep(
    "move",
    `Move ${fmtEth(amount, 4)} WETH to the SYC vault`,
    polyCalls.moveWeth(amount),
    POLY_ROUTE,
    "WETH moved to the SYC vault.",
  );
};
</script>

<style scoped lang="scss">
.sni_console {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}

.sni_section {
  margin-top: 0.75rem;
}

.sni_label {
  font-family: $font-mono;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: $color-steel-blue;
}

.sni_mono {
  font-family: $font-mono;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: $color-light-subtitle;
}

.sni_member {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-family: $font-mono;
  font-size: 11.5px;
  color: $color-light-subtitle;
}

.sni_link {
  white-space: nowrap;
  font-family: $font-mono;
  font-size: 11.5px;
  color: $color-cyan;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.sni_dot {
  display: inline-block;
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: $color-steel-blue;

  &--ok {
    background: $color-pos;
  }

  &--failed {
    background: $color-neg;
  }

  &--simulating,
  &--signing,
  &--pending {
    background: $color-warn;
  }
}

.sni_summary {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem 2rem;

  &__hero {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
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

  &__stats {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
    margin-right: auto;
  }

  &__tools {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
}

.sni_stat {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;

  &__value {
    font-family: $font-mono;
    font-size: 16px;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }
}

.sni_banner {
  padding: 0.875rem 1.125rem;
  border: 1px solid $color-warn-line;
  border-radius: $default-border-radius;
  background: $color-warn-soft;
  font-size: 13px;
  line-height: 1.55;
  color: $color-light-subtitle;

  b {
    color: $color-white;
  }

  &__meta {
    margin-top: 0.375rem;
    font-size: 12px;
    color: $color-steel-blue;
  }

  &--bad {
    border-color: $color-neg-line;
    background: $color-neg-soft;
  }

  &--action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    border-color: $color-cyan-line;
    background: $color-cyan-tint;
  }
}

.sni_card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  &__sub {
    font-size: 12.5px;
    line-height: 1.55;
    color: $color-steel-blue;

    b {
      color: $color-white;
      font-weight: 600;
    }
  }
}

.sni_step {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid $color-line;

  &:first-child {
    padding-top: 0;
    border-top: 0;
  }

  &__n {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid $color-cyan-line;
    background: $color-cyan-tint;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-cyan;
  }

  &__text {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: $color-white;
  }
}

.sni_step--alert .sni_step__n {
  border-color: $color-neg-line;
  background: $color-neg-soft;
  color: $color-neg;
}

.sni_substeps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin-top: 0.375rem;
}

.sni_substep {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12.5px;
  color: $color-light-subtitle;
}

.sni_quote {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  font-family: $font-mono;
  font-size: 12px;
  color: $color-light-subtitle;

  b {
    color: $color-white;
    font-weight: 500;
  }
}


.sni_problem {
  font-size: 12.5px;
  color: $color-neg;
}

.sni_status {
  font-size: 12.5px;
  color: $color-steel-blue;
  overflow-wrap: anywhere;

  &--ok {
    color: $color-pos;
  }

  &--failed {
    color: $color-neg;
  }
}

.sni_log {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  padding-top: 0.625rem;
  border-top: 1px solid $color-line;

  &:first-child {
    padding-top: 0;
    border-top: 0;
  }

  &__label {
    font-size: 13px;
    color: $color-white;
  }
}
</style>
