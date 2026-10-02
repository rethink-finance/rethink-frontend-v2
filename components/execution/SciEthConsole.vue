<template>
  <div class="sci_console">
    <!--
      The one number the vault promises, first: a share is worth one ETH. The
      figures beside it are the two sides of that promise and the yield that
      may leave without touching it.
    -->
    <div class="sci_summary">
      <div class="sci_summary__hero">
        <div class="sci_label sci_label--accent">
          Share price
        </div>
        <div class="sci_summary__value_row">
          <span class="sci_summary__figure">{{ priceText }}</span>
          <span class="sci_summary__unit">ETH</span>
        </div>
        <div class="sci_summary__note" :class="`sci_summary__note--${priceTone}`">
          <span class="sci_dot" />
          {{ priceNote }}
        </div>
      </div>

      <div class="sci_summary__tools">
        <span v-if="membership === 'member'" class="sci_executor">
          <span class="sci_dot sci_dot--ok" />
          executor {{ shortAddr(accountStore.activeAccountAddress || "") }}
        </span>
        <span v-if="state" class="sci_mono">block {{ state.block.toLocaleString("en-US") }}</span>
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

    <!--
      The two halves of the vault, side by side. Left: what the NAV counts,
      which has to equal what depositors are owed. Right: everything else,
      which is yield and leaves for the multisig.
    -->
    <div class="sci_overview">
      <div class="brand_card sci_card sci_panel">
        <div class="sci_panel__head">
          <div class="sci_panel__main">
            <div class="sci_label">
              Principal, counted in the NAV
            </div>
            <div class="sci_panel__figure">
              {{ acc ? fmtEth(acc.counted) : "…" }}<span>ETH</span>
            </div>
          </div>
          <div class="sci_panel__side">
            <div class="sci_label">
              Owed to depositors
            </div>
            <div class="sci_panel__side_value">
              {{ acc ? fmtEth(acc.owed) : "…" }} ETH
            </div>
            <span class="sci_pill" :class="`sci_pill--${gapTone}`">{{ gapText }}</span>
          </div>
        </div>

        <div class="sci_bar" :class="{ 'sci_bar--empty': !segments.length }">
          <span
            v-for="segment in segments"
            :key="segment.key"
            class="sci_bar__segment"
            :style="{ width: segment.percent + '%', opacity: segment.shade }"
          />
        </div>

        <div class="sci_rows">
          <div v-for="row in positions" :key="row.key" class="sci_row">
            <span class="sci_row__swatch" :style="{ opacity: row.shade }" />
            <div class="sci_row__names">
              <div class="sci_row__name">
                {{ row.label }}
              </div>
              <div class="sci_row__sub">
                {{ row.note }}
              </div>
            </div>
            <span class="sci_row__amount" :class="{ 'sci_row__amount--zero': row.amount === 0n }">{{ fmtEth(row.amount) }}</span>
            <span class="sci_row__unit">{{ row.unit }}</span>
          </div>
        </div>
      </div>

      <div class="brand_card sci_card sci_panel">
        <div class="sci_panel__head">
          <div class="sci_panel__main">
            <div class="sci_label">
              Yield, on its way to the multisig
            </div>
            <div class="sci_panel__figure sci_panel__figure--yield">
              {{ acc && state ? fmtEth(yieldTotal) : "…" }}<span>ETH</span>
            </div>
          </div>
          <div class="sci_panel__side">
            <div class="sci_label">
              Next transfer sends
            </div>
            <div class="sci_panel__side_value">
              {{ acc ? fmtEth(acc.settle.send) : "…" }} ETH
            </div>
          </div>
        </div>

        <div class="sci_rows">
          <div v-for="row in yieldRows" :key="row.key" class="sci_row sci_row--plain">
            <div class="sci_row__names">
              <div class="sci_row__name">
                {{ row.label }}
              </div>
              <div class="sci_row__sub">
                {{ row.note }}
              </div>
            </div>
            <span class="sci_row__amount" :class="{ 'sci_row__amount--zero': row.amount === 0n }">{{ fmtEth(row.amount) }}</span>
            <span class="sci_row__unit">ETH</span>
          </div>
        </div>

        <div class="sci_capbox">
          <div class="sci_capbox__line">
            <span class="sci_label">30-day cap</span>
            <span class="sci_mono sci_capbox__value">
              {{ state ? `${fmtEth(state.allowance.available)} of ${fmtEth(state.allowance.max)} ETH left` : "…" }}
            </span>
          </div>
          <div class="sci_cap__bar">
            <span class="sci_cap__fill" :style="{ width: capLeftPercent + '%' }" />
          </div>
          <div class="sci_capbox__line">
            <span class="sci_row__sub">{{ refillText }}</span>
            <span class="sci_row__sub">
              Multisig
              <a
                class="sci_link"
                :href="`${SCI.EXPLORER}/address/${SCI.ADDR.multisig}`"
                target="_blank"
                rel="noopener"
              >{{ shortAddr(SCI.ADDR.multisig) }}</a>
              holds {{ state ? fmtEth(state.multisigEth) : "…" }} ETH
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loadError" class="sci_banner sci_banner--bad">
      Could not read the vault from Ethereum. {{ loadError }}
    </div>

    <div v-if="state && !state.vault.finalized" class="sci_banner">
      <b>The vault is not finalized yet.</b>
      There are no deposits, so nothing is owed to anyone and whatever is in the Safe is your own test money.
      Every action below is live and goes through the executor role, including the 30-day cap on sends to the multisig.
      Before the first deposit arrives, leave nothing behind as WETH, stETH or staked ETH: the NAV counts those and the first depositor would receive shares for them.
    </div>

    <div v-if="state && !state.batching" class="sci_banner">
      <b>One-transaction staking is not switched on for this vault.</b>
      Without it, unwrapping, staking and updating the NAV are separate transactions, and between the unwrap and the NAV update the vault reads too low: a deposit that settles in that gap gets shares too cheaply.
      Save the batching setting on the Roles contract (free while the vault is not finalized, a governance vote afterwards). Until then, only unwrap principal when no deposit request is waiting.
    </div>

    <div v-if="!accountStore.isConnected" class="sci_banner sci_banner--action">
      <span>Connect a wallet that holds the executor role to run anything on this page. Balances are readable without one.</span>
      <v-btn color="primary" size="small" @click="accountStore.connectWallet()">
        Connect wallet
      </v-btn>
    </div>
    <div v-else-if="membership === 'stranger'" class="sci_banner sci_banner--bad">
      <b>{{ shortAddr(accountStore.activeAccountAddress || "") }} is not an executor of this vault.</b>
      Nothing on this page will go through from this wallet. Switch to one of the executor wallets.
    </div>

    <!-- ------------------------------------------------------------------ -->
    <div class="group_title sci_section">
      What to do now
    </div>
    <div class="brand_card sci_card">
      <div v-if="!acc" class="sci_card__sub">
        Reading the vault…
      </div>
      <div v-else-if="!acc.steps.length" class="sci_allgood">
        <span class="sci_dot sci_dot--ok" />
        <div>
          <div class="sci_allgood__title">
            Nothing to do
          </div>
          <div class="sci_card__sub">
            {{ state && state.vault.finalized
              ? "Every share is backed by one counted ETH, there is no yield waiting in the Safe, and the stored NAV is current."
              : "Nothing is waiting in the Safe or the staking vault." }}
          </div>
        </div>
      </div>
      <div
        v-for="(step, index) in acc ? acc.steps : []"
        :key="step.key"
        class="sci_step"
      >
        <span class="sci_step__n">{{ index + 1 }}</span>
        <div class="sci_step__text">
          <div class="sci_step__title">
            {{ step.title }}
          </div>
          <div class="sci_card__sub">
            {{ step.why }}
          </div>
          <ExecutionSciPlanPreview v-if="stepPlan(step)" :plan="stepPlan(step)" />
          <div v-if="statusLine(stepAction(step.key))" class="sci_status" :class="`sci_status--${status[stepAction(step.key)].phase}`">
            {{ statusLine(stepAction(step.key)) }}
          </div>
        </div>
        <v-btn
          v-if="!step.info"
          color="primary"
          variant="outlined"
          size="small"
          :loading="isBusy(stepAction(step.key))"
          :disabled="!accountStore.isConnected || anyBusy"
          @click="runStep(step)"
        >
          {{ stepButton(step.key) }}
        </v-btn>
      </div>
    </div>

    <!-- ------------------------------------------------------------------ -->
    <div class="group_title sci_section">
      Actions
    </div>
    <div class="brand_card sci_card sci_actions">
      <div class="sci_tabs" role="tablist">
        <button
          v-for="tab in ACTION_TABS"
          :key="tab.key"
          class="sci_tabs__tab"
          :class="{ 'sci_tabs__tab--on': actionTab === tab.key }"
          role="tab"
          :aria-selected="actionTab === tab.key"
          @click="actionTab = tab.key"
        >
          {{ tab.label }}
          <span v-if="tabAttention[tab.key]" class="sci_tabs__dot" />
        </button>
      </div>

      <!-- Validator staking -->
      <div v-if="actionTab === 'staking'" class="sci_pane">
        <div class="sci_pane__head">
          <div class="sci_card__sub">
            Principal earns in validators through the staking vault. Each button is one transaction that leaves a share worth exactly 1 ETH.
          </div>
          <a
            class="sci_link"
            :href="`${SCI.EXPLORER}/address/${SCI.ADDR.stakingVault}`"
            target="_blank"
            rel="noopener"
          >{{ shortAddr(SCI.ADDR.stakingVault) }}</a>
        </div>

        <div v-if="state && !state.staking.exists" class="sci_action">
          <div class="sci_action__info">
            <div class="sci_action__title">
              Create the staking vault
            </div>
            <div class="sci_card__sub">
              It does not exist yet. Creating it is free and has to happen before any ETH is staked.
            </div>
          </div>
          <div class="sci_action__controls">
            <div class="sci_form sci_form--end">
              <v-btn
                color="primary"
                size="small"
                :loading="isBusy('createVault')"
                :disabled="!accountStore.isConnected || anyBusy"
                @click="run('createVault', 'Create the staking vault', sciCalls.createStakingVault())"
              >
                Create staking vault
              </v-btn>
            </div>
            <div v-if="statusLine('createVault')" class="sci_status" :class="`sci_status--${status.createVault.phase}`">
              {{ statusLine("createVault") }}
            </div>
          </div>
        </div>

        <template v-else>
          <div class="sci_stats">
            <div class="sci_stats__tile">
              <span class="sci_label">Staked</span>
              <b>{{ state ? fmtEth(state.staking.staked) : "…" }}</b>
            </div>
            <div class="sci_stats__tile">
              <span class="sci_label">Approved to stake</span>
              <b>{{ state ? fmtEth(state.staking.quota) : "…" }}</b>
            </div>
            <div class="sci_stats__tile">
              <span class="sci_label">Rewards to claim</span>
              <b :class="{ 'sci_stats__yield': state && state.staking.claimableRewards > DUST }">{{ state ? fmtEth(state.staking.claimableRewards) : "…" }}</b>
            </div>
            <div class="sci_stats__tile">
              <span class="sci_label">Unbonded principal</span>
              <b>{{ state ? fmtEth(state.staking.withdrawable) : "…" }}</b>
            </div>
          </div>

          <div class="sci_action">
            <div class="sci_action__info">
              <div class="sci_action__title">
                <span class="sci_action__n">1</span>Request quota
              </div>
              <div class="sci_card__sub">
                The operator approves an amount before it can be staked. Whole validators only: multiples of 32 ETH. Nothing moves, so the Safe does not need to hold the ETH yet.
              </div>
            </div>
            <div class="sci_action__controls">
              <div class="sci_form">
                <span class="sci_field">
                  <input
                    v-model="amounts.quota"
                    class="sci_field__input"
                    inputmode="decimal"
                    placeholder="32"
                  >
                  <span class="sci_field__unit">ETH</span>
                </span>
                <v-btn
                  color="primary"
                  size="small"
                  :loading="isBusy('quota')"
                  :disabled="!!quotaProblem || !accountStore.isConnected || anyBusy"
                  @click="run('quota', `Request ${amounts.quota} ETH of stake quota`, sciCalls.requestStakeQuota(parseEth(amounts.quota)!))"
                >
                  Request quota
                </v-btn>
              </div>
              <div v-if="amounts.quota && quotaProblem" class="sci_problem">
                {{ quotaProblem }}
              </div>
              <div v-if="statusLine('quota')" class="sci_status" :class="`sci_status--${status.quota.phase}`">
                {{ statusLine("quota") }}
              </div>
            </div>
          </div>

          <div class="sci_action">
            <div class="sci_action__info">
              <div class="sci_action__title">
                <span class="sci_action__n">2</span>Stake
              </div>
              <div class="sci_card__sub">
                {{ state && state.batching
                  ? "Moves WETH from the Safe into validators, up to the approved quota."
                  : "Plain ETH from the Safe, up to the approved quota. Update the NAV straight afterwards." }}
              </div>
            </div>
            <div class="sci_action__controls">
              <div class="sci_form">
                <span class="sci_field">
                  <input
                    v-model="amounts.stake"
                    class="sci_field__input"
                    inputmode="decimal"
                    placeholder="32"
                  >
                  <span class="sci_field__unit">ETH</span>
                </span>
                <button class="sci_chip" :disabled="stakeMax === 0n" @click="amounts.stake = exactEth(stakeMax)">
                  Max {{ fmtEth(stakeMax, 0) }}
                </button>
                <v-btn
                  color="primary"
                  size="small"
                  :loading="isBusy('stake')"
                  :disabled="!!stakeProblem || !accountStore.isConnected || anyBusy"
                  @click="runPlan('stake', `Stake ${amounts.stake} ETH`, stakePlan)"
                >
                  Stake
                </v-btn>
              </div>
              <div v-if="amounts.stake && stakeProblem" class="sci_problem">
                {{ stakeProblem }}
              </div>
              <div v-if="statusLine('stake')" class="sci_status" :class="`sci_status--${status.stake.phase}`">
                {{ statusLine("stake") }}
              </div>
            </div>
            <ExecutionSciPlanPreview class="sci_action__plan" :plan="stakePlan" />
          </div>

          <div class="sci_action">
            <div class="sci_action__info">
              <div class="sci_action__title">
                <span class="sci_action__n">3</span>Claim rewards
              </div>
              <div class="sci_card__sub">
                Rewards stay plain ETH, which the NAV never counts, and go straight on to the multisig.
              </div>
            </div>
            <div class="sci_action__controls">
              <div class="sci_form sci_form--end">
                <v-btn
                  color="primary"
                  size="small"
                  :loading="isBusy('claim')"
                  :disabled="!claimPlan || !!claimPlan.problem || !accountStore.isConnected || anyBusy"
                  @click="runPlan('claim', 'Claim staking rewards', claimPlan)"
                >
                  Claim rewards
                </v-btn>
              </div>
              <div v-if="statusLine('claim')" class="sci_status" :class="`sci_status--${status.claim.phase}`">
                {{ statusLine("claim") }}
              </div>
            </div>
            <ExecutionSciPlanPreview class="sci_action__plan" :plan="claimPlan" />
          </div>

          <div class="sci_action">
            <div class="sci_action__info">
              <div class="sci_action__title">
                <span class="sci_action__n">4</span>Withdraw principal
              </div>
              <div class="sci_card__sub">
                Unbonded principal comes back as WETH, where the NAV counts it. Rewards waiting beside it are claimed and sent on.
              </div>
            </div>
            <div class="sci_action__controls">
              <div class="sci_form sci_form--end">
                <v-btn
                  color="primary"
                  size="small"
                  :loading="isBusy('withdrawPrincipal')"
                  :disabled="!withdrawPlan || !!withdrawPlan.problem || !accountStore.isConnected || anyBusy"
                  @click="runPlan('withdrawPrincipal', 'Withdraw unbonded principal', withdrawPlan)"
                >
                  Withdraw principal
                </v-btn>
              </div>
              <div v-if="statusLine('withdrawPrincipal')" class="sci_status" :class="`sci_status--${status.withdrawPrincipal.phase}`">
                {{ statusLine("withdrawPrincipal") }}
              </div>
            </div>
            <ExecutionSciPlanPreview class="sci_action__plan" :plan="withdrawPlan" />
          </div>
        </template>
      </div>

      <!--
        Lido. One form for both directions: flipping the toggle changes the
        token, the amounts on the chips and the button, and nothing else.
      -->
      <div v-else-if="actionTab === 'lido'" class="sci_pane">
        <div class="sci_pane__head">
          <div class="sci_card__sub">
            stETH counts in the NAV as 1 stETH = 1 ETH. The Safe holds {{ state ? fmtEth(state.safeSteth) : "…" }} stETH.
          </div>
        </div>

        <div class="sci_action">
          <div class="sci_action__info">
            <span class="sci_toggle">
              <button
                v-for="mode in (['deposit', 'sell'] as const)"
                :key="mode"
                class="sci_toggle__btn"
                :class="{ 'sci_toggle__btn--on': lidoMode === mode }"
                @click="lidoMode = mode"
              >
                {{ mode === "deposit" ? "WETH to stETH" : "stETH to WETH" }}
              </button>
            </span>
            <div class="sci_card__sub">
              {{ lidoMode === "deposit"
                ? "Deposits WETH into Lido in one transaction."
                : "Sells stETH for WETH with a CoW Protocol order. A solver fills it within a few minutes." }}
            </div>
            <div class="sci_card__sub">
              {{ lidoMode === "deposit" ? lidoSuggestedNote : sellSuggestedNote }}
            </div>
          </div>

          <div class="sci_action__controls">
            <div class="sci_form">
              <span class="sci_field">
                <input
                  v-if="lidoMode === 'deposit'"
                  v-model="amounts.lido"
                  class="sci_field__input"
                  inputmode="decimal"
                  placeholder="0.0"
                >
                <input
                  v-else
                  v-model="amounts.sell"
                  class="sci_field__input"
                  inputmode="decimal"
                  placeholder="0.0"
                  :disabled="!!sale"
                >
                <span class="sci_field__unit">{{ lidoMode === "deposit" ? "WETH" : "stETH" }}</span>
              </span>
              <v-btn
                v-if="lidoMode === 'deposit'"
                color="primary"
                size="small"
                :loading="isBusy('lido')"
                :disabled="!!lidoProblem || !accountStore.isConnected || anyBusy"
                @click="runPlan('lido', `Deposit ${amounts.lido} WETH into Lido`, lidoPlan)"
              >
                Deposit
              </v-btn>
              <v-btn
                v-else
                color="primary"
                size="small"
                :loading="quoting"
                :disabled="!!sellProblem || anyBusy || !!sale"
                @click="getQuote"
              >
                Get quote
              </v-btn>
            </div>
            <div class="sci_form">
              <button
                class="sci_chip"
                :disabled="lidoMax <= DUST || (lidoMode === 'sell' && !!sale)"
                @click="setLidoAmount(lidoMax)"
              >
                Max {{ fmtEth(lidoMax, 4) }}
              </button>
              <button
                class="sci_chip sci_chip--accent"
                :disabled="lidoSuggestion <= DUST || (lidoMode === 'sell' && !!sale)"
                @click="setLidoAmount(lidoSuggestion)"
              >
                Suggested {{ fmtEth(lidoSuggestion, 4) }}
              </button>
            </div>
            <template v-if="lidoMode === 'deposit'">
              <div v-if="amounts.lido && lidoProblem" class="sci_problem">
                {{ lidoProblem }}
              </div>
              <div v-if="statusLine('lido')" class="sci_status" :class="`sci_status--${status.lido.phase}`">
                {{ statusLine("lido") }}
              </div>
            </template>
            <template v-else>
              <div v-if="amounts.sell && sellProblem && !sale" class="sci_problem">
                {{ sellProblem }}
              </div>
              <div v-if="quoteError" class="sci_problem">
                {{ quoteError }}
              </div>
            </template>
          </div>

          <!-- Underneath: what the deposit will send, or the sale as far as it has got. -->
          <ExecutionSciPlanPreview v-if="lidoMode === 'deposit'" class="sci_action__plan" :plan="lidoPlan" />
          <template v-else>
            <div v-if="sale" class="sci_order sci_action__plan">
              <div class="sci_order__head">
                <span class="sci_dot" :class="`sci_dot--${saleTone}`" />
                <b>{{ saleTitle }}</b>
                <a
                  class="sci_link"
                  :href="`${SCI.COW_EXPLORER}/${sale.uid}`"
                  target="_blank"
                  rel="noopener"
                >view on CoW</a>
              </div>
              <div class="sci_math__row">
                <span>Selling</span><b>{{ fmtEth(BigInt(sale.sellAmount)) }} stETH</b>
              </div>
              <div class="sci_math__row">
                <span>{{ sale.status === "fulfilled" ? "Received" : "Minimum received" }}</span>
                <b>{{ fmtEth(sale.status === "fulfilled" ? BigInt(sale.executedBuy) : BigInt(sale.buyAmount)) }} WETH</b>
              </div>
              <div v-if="sale.status === 'open' || sale.status === 'presignaturePending'" class="sci_math__row">
                <span>Fillable until</span><b>{{ timeText(sale.validTo) }}</b>
              </div>
              <div class="sci_card__sub">
                {{ saleNote }}
              </div>
              <div class="sci_form">
                <v-btn
                  v-if="sale.status === 'fulfilled' && settlePlan && !settlePlan.problem"
                  color="primary"
                  size="small"
                  :loading="isBusy('settle')"
                  :disabled="!accountStore.isConnected || anyBusy"
                  @click="runPlan('settle', 'Settle', settlePlan)"
                >
                  Transfer yield
                </v-btn>
                <v-btn
                  v-if="sale.status === 'presignaturePending' && !sale.signed"
                  color="primary"
                  size="small"
                  :loading="isBusy('signCow')"
                  :disabled="!accountStore.isConnected || anyBusy"
                  @click="signSale"
                >
                  Sign the order
                </v-btn>
                <v-btn
                  v-if="sale.status === 'open' || (sale.status === 'presignaturePending' && sale.signed)"
                  variant="outlined"
                  size="small"
                  :loading="isBusy('unsignCow')"
                  :disabled="!accountStore.isConnected || anyBusy"
                  @click="cancelSale"
                >
                  Cancel order
                </v-btn>
                <v-btn
                  v-if="sale.status !== 'open' && !(sale.status === 'presignaturePending' && sale.signed)"
                  variant="text"
                  size="small"
                  :disabled="anyBusy"
                  @click="dismissSale"
                >
                  {{ sale.status === "presignaturePending" ? "Discard" : "Done" }}
                </v-btn>
              </div>
              <ExecutionSciPlanPreview v-if="sale.status === 'fulfilled' && settlePlan && !settlePlan.problem" :plan="settlePlan" />
              <div v-if="statusLine('signCow')" class="sci_status" :class="`sci_status--${status.signCow.phase}`">
                {{ statusLine("signCow") }}
              </div>
              <div v-if="statusLine('unsignCow')" class="sci_status" :class="`sci_status--${status.unsignCow.phase}`">
                {{ statusLine("unsignCow") }}
              </div>
            </div>
            <div v-else-if="quote && draft" class="sci_action__plan sci_action__body">
              <div class="sci_math">
                <div class="sci_math__row">
                  <span>You sell</span><b>{{ fmtEth(quote.sellAmount) }} stETH</b>
                </div>
                <div class="sci_math__row">
                  <span>Solvers' network cost</span><b>{{ fmtEth(quote.networkCost) }} stETH</b>
                </div>
                <div class="sci_math__row">
                  <span>Expected</span><b>{{ fmtEth(quote.buyAmount) }} WETH</b>
                </div>
                <div class="sci_math__row sci_math__row--result">
                  <span>Minimum received</span><b>{{ fmtEth(draft.buyAmount) }} WETH</b>
                </div>
              </div>
              <div class="sci_form">
                <span class="sci_label">Slippage</span>
                <button
                  v-for="bps in [10, 50, 100]"
                  :key="bps"
                  class="sci_chip"
                  :class="{ 'sci_chip--accent': slippageBps === bps }"
                  @click="slippageBps = bps"
                >
                  {{ bps / 100 }}%
                </button>
              </div>
              <div class="sci_card__sub">
                Worst case this costs <b>{{ fmtEth(saleCost.cost) }} ETH</b> ({{ (saleCost.bps / 100).toFixed(2) }}%) against 1 stETH = 1 ETH. It comes out of the vault.
              </div>
              <label v-if="saleCost.bps > 100" class="sci_accept">
                <input v-model="acceptCost" type="checkbox">
                <span>More than 1%: small sales are mostly network cost. Sell anyway.</span>
              </label>
              <div class="sci_form">
                <v-btn
                  color="primary"
                  size="small"
                  :loading="isBusy('approveCow') || isBusy('signCow') || placing"
                  :disabled="!accountStore.isConnected || anyBusy || placing || (saleCost.bps > 100 && !acceptCost) || quoteStale"
                  @click="sellSteth"
                >
                  Sell stETH
                </v-btn>
                <span v-if="quoteStale" class="sci_card__sub">The quote is over a minute old. Get a new one.</span>
              </div>
              <div class="sci_progress">
                <div :class="`sci_progress__row sci_progress__row--${progress.approve}`">
                  <span class="sci_dot" />1. Approve the stETH
                </div>
                <div :class="`sci_progress__row sci_progress__row--${progress.place}`">
                  <span class="sci_dot" />2. Place the order with CoW
                </div>
                <div :class="`sci_progress__row sci_progress__row--${progress.sign}`">
                  <span class="sci_dot" />3. Sign the order on chain
                </div>
              </div>
              <div v-if="statusLine('approveCow')" class="sci_status" :class="`sci_status--${status.approveCow.phase}`">
                {{ statusLine("approveCow") }}
              </div>
              <div v-if="placeError" class="sci_problem">
                {{ placeError }}
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Transfer yield -->
      <div v-else-if="actionTab === 'yield'" class="sci_pane">
        <div class="sci_pane__head">
          <div class="sci_card__sub">
            Sends the yield, and only the yield, to the multisig as plain ETH. Claims and withdrawals already end with this; use it for yield that built up some other way.
          </div>
          <span class="sci_badge">plain ETH only</span>
        </div>

        <div class="sci_stats">
          <div class="sci_stats__tile">
            <span class="sci_label">Yield in the Safe</span>
            <b>{{ acc ? fmtEth(acc.yieldInSafe) : "…" }}</b>
          </div>
          <div class="sci_stats__tile">
            <span class="sci_label">Yield counted in the NAV</span>
            <b>{{ acc ? fmtEth(acc.surplusCounted) : "…" }}</b>
          </div>
          <div class="sci_stats__tile">
            <span class="sci_label">30-day cap left</span>
            <b>{{ state ? fmtEth(state.allowance.available) : "…" }}</b>
          </div>
          <div class="sci_stats__tile">
            <span class="sci_label">This transfer sends</span>
            <b class="sci_stats__yield">{{ acc ? fmtEth(acc.settle.send) : "…" }}</b>
          </div>
        </div>

        <div class="sci_action">
          <div class="sci_action__info">
            <div class="sci_action__title">
              Transfer Yield to Multisig
            </div>
            <div class="sci_card__sub">
              Yield that is counted as WETH is unwrapped first and the NAV is updated, so a share is worth exactly 1 ETH afterwards. Anything over the cap waits in the Safe as plain ETH, outside the NAV.
            </div>
          </div>
          <div class="sci_action__controls">
            <div class="sci_form sci_form--end">
              <v-btn
                color="primary"
                size="small"
                :loading="isBusy('settle')"
                :disabled="!settlePlan || !!settlePlan.problem || !accountStore.isConnected || anyBusy"
                @click="runPlan('settle', 'Transfer yield to the multisig', settlePlan)"
              >
                Transfer yield
              </v-btn>
            </div>
            <div v-if="statusLine('settle')" class="sci_status" :class="`sci_status--${status.settle.phase}`">
              {{ statusLine("settle") }}
            </div>
          </div>
          <ExecutionSciPlanPreview class="sci_action__plan" :plan="settlePlan" />
        </div>
      </div>

      <!-- Vault contract -->
      <div v-else class="sci_pane">
        <div class="sci_pane__head">
          <div class="sci_card__sub">
            Housekeeping on the vault itself. Staking, Lido deposits, claims and withdrawals update the NAV inside their own transaction, so these are rarely needed.
          </div>
          <a
            class="sci_link"
            :href="`${SCI.EXPLORER}/address/${SCI.ADDR.fund}`"
            target="_blank"
            rel="noopener"
          >{{ shortAddr(SCI.ADDR.fund) }}</a>
        </div>

        <div class="sci_action">
          <div class="sci_action__info">
            <div class="sci_action__title">
              Update NAV
            </div>
            <div class="sci_card__sub">
              {{ navText }}
            </div>
            <div v-if="pendingDepositText" class="sci_card__sub">
              {{ pendingDepositText }}
            </div>
          </div>
          <div class="sci_action__controls">
            <div class="sci_form sci_form--end">
              <v-btn
                color="primary"
                size="small"
                :loading="isBusy('nav')"
                :disabled="!!navProblem || !accountStore.isConnected || anyBusy"
                @click="run('nav', 'Update NAV', sciCalls.updateNav())"
              >
                Update NAV
              </v-btn>
            </div>
            <div v-if="navProblem" class="sci_card__sub sci_action__hint">
              {{ navProblem }}
            </div>
            <div v-if="statusLine('nav')" class="sci_status" :class="`sci_status--${status.nav.phase}`">
              {{ statusLine("nav") }}
            </div>
          </div>
        </div>

        <div class="sci_action">
          <div class="sci_action__info">
            <div class="sci_action__title">
              Fund redemptions
            </div>
            <div class="sci_card__sub">
              Redemptions are paid in WETH from the vault contract. {{ redemptionText }}
            </div>
          </div>
          <div class="sci_action__controls">
            <div class="sci_form">
              <span class="sci_field">
                <input
                  v-model="amounts.fund"
                  class="sci_field__input"
                  inputmode="decimal"
                  placeholder="0.0"
                >
                <span class="sci_field__unit">WETH</span>
              </span>
              <button
                v-if="acc && acc.redemptionShortfall > DUST"
                class="sci_chip sci_chip--accent"
                @click="amounts.fund = exactEth(acc.redemptionShortfall)"
              >
                Needed {{ fmtEth(acc.redemptionShortfall, 4) }}
              </button>
              <v-btn
                color="primary"
                size="small"
                :loading="isBusy('fund')"
                :disabled="!!fundProblem || !accountStore.isConnected || anyBusy"
                @click="runPlan('fund', `Send ${amounts.fund} WETH to the vault contract`, fundPlan)"
              >
                Send to vault
              </v-btn>
            </div>
            <div v-if="amounts.fund && fundProblem" class="sci_problem">
              {{ fundProblem }}
            </div>
            <div v-if="statusLine('fund')" class="sci_status" :class="`sci_status--${status.fund.phase}`">
              {{ statusLine("fund") }}
            </div>
          </div>
          <ExecutionSciPlanPreview class="sci_action__plan" :plan="fundPlan" />
        </div>
      </div>
    </div>

    <!-- ------------------------------------------------------------------ -->
    <template v-if="log.length">
      <div class="group_title sci_section">
        This session
      </div>
      <div class="brand_card sci_card">
        <div v-for="entry in log" :key="entry.id" class="sci_log">
          <span class="sci_dot" :class="`sci_dot--${entry.phase}`" />
          <span class="sci_log__label">{{ entry.label }}</span>
          <span class="sci_mono">{{ entry.message }}</span>
          <a
            v-if="entry.txHash"
            class="sci_link"
            :href="`${SCI.EXPLORER}/tx/${entry.txHash}`"
            target="_blank"
            rel="noopener"
          >{{ entry.txHash.slice(0, 10) }}…</a>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  NOT_AN_EXECUTOR,
  SCI,
  cowBuildOrder,
  cowOrderState,
  cowPostOrder,
  cowQuote,
  cowValidDuration,
  cowWorstCaseCost,
  exactEth,
  fmtEth,
  parseEth,
  sciAccounting,
  sciCalls,
  sciExplainDenial,
  sciPlans,
  sciReadState,
  shortAddr,
  type CowOrder,
  type CowQuote,
  type CowStatus,
  type SciPlan,
  type SciState,
  type SciStep,
  type SciStepKey,
} from "~/composables/execution/sciEthConsole";
import {
  sendCuratorTransaction,
  simulateCuratorTransaction,
  type ICuratorRoute,
} from "~/composables/permissions/useCuratorExecution";
import {
  RolesVersion,
  simulateDirectCall,
  type IRoleCall,
} from "~/composables/permissions/useRoleExecution";
import { useAccountStore } from "~/store/account/account.store";
import { useToastStore } from "~/store/toasts/toast.store";

const accountStore = useAccountStore();
const toastStore = useToastStore();
const DUST = SCI.DUST;

// The modifier and the role are established facts for this vault, so the
// route is handed over rather than resolved from the wallet's membership.
// That also lets the page work before the vault is finalized, when there is
// no vault page (and no selected vault) for the shared layer to read from.
const ROUTE: ICuratorRoute = {
  chainId: SCI.CHAIN,
  rolesModAddress: SCI.ADDR.roles,
  role: SCI.ROLE,
  version: RolesVersion.V2,
};

/* ------------------------------------------------------------- membership */

/**
 * Whether the connected wallet can act here, asked the only way Roles v2
 * answers it: dry-run something harmless the role allows (wrapping zero ETH).
 * A wallet the modifier has never heard of is refused before any condition
 * is looked at, which is what tells a stranger from an executor.
 */
const membership = ref<"unknown" | "member" | "stranger">("unknown");
watch(
  () => accountStore.activeAccountAddress,
  async (account) => {
    membership.value = "unknown";
    if (!account) return;
    const probe = await simulateCuratorTransaction(sciCalls.wrap(0n), ROUTE).catch(() => null);
    if (account !== accountStore.activeAccountAddress || !probe) return;
    if (probe.ok || probe.innerRevert) membership.value = "member";
    else if (sciExplainDenial(probe.reason) === NOT_AN_EXECUTOR) membership.value = "stranger";
  },
  { immediate: true },
);

/* ------------------------------------------------------------------ state */

const state = ref<SciState | null>(null);
const loading = ref(false);
const loadError = ref("");
const acc = computed(() => (state.value ? sciAccounting(state.value) : null));

const refresh = async () => {
  loading.value = true;
  try {
    state.value = await sciReadState();
    loadError.value = "";
  } catch (error: any) {
    console.error(error);
    loadError.value = error?.message || "";
  } finally {
    loading.value = false;
  }
};

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  refresh();
  // Rewards and stETH move on their own; a minute is fine for both.
  timer = setInterval(() => {
    if (!document.hidden && !anyBusy.value) refresh();
  }, 60_000);
});
onUnmounted(() => clearInterval(timer));

/* ---------------------------------------------------------------- summary */

const priceText = computed(() => {
  const a = acc.value;
  if (!a) return "…";
  return a.price === null ? "1" : fmtEth(a.price, 6);
});

const priceTone = computed(() => {
  const a = acc.value;
  if (!a || a.price === null) return "idle";
  const off = a.price - 10n ** 18n;
  // A millionth of an ETH per share is rounding, not drift.
  return off > 10n ** 12n || off < -(10n ** 12n) ? "bad" : "ok";
});

const priceNote = computed(() => {
  const a = acc.value;
  if (!a) return "reading";
  if (a.price === null) return "no shares yet: the first deposit mints 1:1";
  if (priceTone.value === "ok") return a.navStale ? "1:1, but the stored NAV is out of date" : "1:1 with ETH";
  if (a.navStale && a.priceIfUpdated !== null) {
    return `stored NAV is out of date: ${fmtEth(a.priceIfUpdated, 6)} after an update`;
  }
  return a.price > 10n ** 18n ? "above 1:1: yield is being counted" : "below 1:1: principal is not being counted";
});

const gapText = computed(() => {
  const a = acc.value;
  if (!a) return "";
  if (a.gap > DUST) return `${fmtEth(a.gap)} more than owed`;
  if (a.gap < -DUST) return `${fmtEth(-a.gap)} short of what is owed`;
  return "matches what is owed";
});

const dateText = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const refillText = computed(() => {
  const s = state.value;
  if (!s) return "";
  if (s.allowance.max === 0n) return "No cap is set";
  if (s.allowance.nextRefillAt === null) return "The cap is full";
  return `Back to ${fmtEth(s.allowance.max)} ETH on ${dateText(s.allowance.nextRefillAt)}`;
});

const capLeftPercent = computed(() => {
  const s = state.value;
  if (!s || s.allowance.max === 0n) return 0;
  return Number((s.allowance.available * 1000n) / s.allowance.max) / 10;
});

/* -------------------------------------------------------------- positions */

/**
 * What the NAV counts, position by position. The shade ties each row to its
 * slice of the bar above it.
 */
const positions = computed(() => {
  const s = state.value;
  const zero = 0n;
  return [
    { key: "safeWeth", label: "WETH in the Safe", note: s && !s.vault.finalized ? "Counted as soon as the vault opens" : "Liquid principal", amount: s?.safeWeth ?? zero, unit: "WETH", shade: 1 },
    { key: "staked", label: "Staked in validators", note: s && !s.staking.exists ? "The staking vault is not created yet" : "Through the staking vault", amount: s?.staking.staked ?? zero, unit: "ETH", shade: 0.72 },
    { key: "steth", label: "stETH in the Safe", note: "Counted 1 stETH = 1 ETH", amount: s?.safeSteth ?? zero, unit: "stETH", shade: 0.5 },
    { key: "unbonded", label: "Unbonded, in the staking vault", note: "Principal back from validators, not withdrawn yet", amount: s?.staking.withdrawable ?? zero, unit: "ETH", shade: 0.34 },
    { key: "fundWeth", label: "WETH in the vault contract", note: "What redemptions are paid from", amount: s?.fundWeth ?? zero, unit: "WETH", shade: 0.2 },
  ];
});

/** The bar: each position's share of what is counted. Slivers stay visible. */
const segments = computed(() => {
  const rows = positions.value.filter((row) => row.amount > DUST);
  const total = rows.reduce((sum, row) => sum + row.amount, 0n);
  if (total === 0n) return [];
  return rows.map((row) => ({
    key: row.key,
    shade: row.shade,
    percent: Math.max(1.5, Number((row.amount * 10000n) / total) / 100),
  }));
});

const gapTone = computed(() => {
  const a = acc.value;
  if (!a || !state.value?.vault.finalized) return "idle";
  return a.gap > DUST || a.gap < -DUST ? "bad" : "ok";
});

/** Everything that is yield, wherever it is sitting right now. */
const yieldTotal = computed(() => {
  const a = acc.value;
  const s = state.value;
  return a && s ? a.yieldInSafe + s.staking.claimableRewards + a.surplusCounted : 0n;
});

const yieldRows = computed(() => {
  const a = acc.value;
  const s = state.value;
  const held = a && a.principalInSafeEth > DUST ? a.principalInSafeEth : 0n;
  return [
    {
      key: "safeEth",
      label: "Plain ETH in the Safe",
      note: held > 0n
        ? `Not counted in the NAV. ${fmtEth(held)} ETH more is there but is depositors' principal and stays`
        : "Not counted in the NAV. Sent from here",
      amount: a?.yieldInSafe ?? 0n,
    },
    {
      key: "rewards",
      label: "Unclaimed staking rewards",
      note: "In the staking vault, after the operator's 10% fee",
      amount: s?.staking.claimableRewards ?? 0n,
    },
    {
      key: "surplus",
      label: "Counted in the NAV for now",
      note: s && !s.vault.finalized
        ? "Your test money in WETH or stETH. Clear it out before the vault opens"
        : "Yield sitting in WETH or stETH. It lifts the share price above 1 until it is transferred",
      amount: a?.surplusCounted ?? 0n,
    },
  ];
});

/* ----------------------------------------------------------------- inputs */

const amounts = reactive({ quota: "", stake: "", fund: "", lido: "", sell: "" });
const lidoMode = ref<"deposit" | "sell">("deposit");

type ActionTab = "staking" | "lido" | "yield" | "vault";
const ACTION_TABS: { key: ActionTab; label: string }[] = [
  { key: "staking", label: "Validator staking" },
  { key: "lido", label: "Lido" },
  { key: "yield", label: "Transfer Yield to Multisig" },
  { key: "vault", label: "Vault contract" },
];
const actionTab = ref<ActionTab>("staking");

const amountProblem = (text: string, available: bigint, unit: string): string => {
  if (!text) return "Enter an amount.";
  const wei = parseEth(text);
  if (wei === null) return "That is not an amount.";
  if (wei > available) return `The Safe only holds ${fmtEth(available)} ${unit}.`;
  return "";
};

/**
 * The claim, the withdrawal and the settlement take no amount: each is worked
 * out from the state, and each ends by putting the vault back at 1:1 and
 * sending the excess on.
 */
const claimPlan = computed<SciPlan | null>(() => (state.value ? sciPlans.claimRewards(state.value) : null));
const withdrawPlan = computed<SciPlan | null>(() => (state.value ? sciPlans.withdrawPrincipal(state.value) : null));
const settlePlan = computed<SciPlan | null>(() => (state.value ? sciPlans.settle(state.value) : null));

const isValidatorMultiple = (wei: bigint) => wei % SCI.VALIDATOR === 0n;

const quotaProblem = computed(() => {
  if (!amounts.quota) return "Enter an amount.";
  const wei = parseEth(amounts.quota);
  if (wei === null) return "That is not an amount.";
  if (!isValidatorMultiple(wei)) return "Whole validators only: a multiple of 32 ETH.";
  return "";
});

/** What the Safe can put to work in one go: WETH (unwrapped in the same transaction), plus any principal that is already plain ETH. */
const spendable = computed(() => {
  const s = state.value;
  const a = acc.value;
  if (!s || !a) return 0n;
  // Yield is not spendable on a counted position once shares exist.
  const eth = s.vault.finalized ? a.principalInSafeEth : s.safeEth;
  return eth + (s.batching ? s.safeWeth : 0n);
});

const stakeMax = computed(() => {
  const s = state.value;
  if (!s) return 0n;
  const limit = spendable.value < s.staking.quota ? spendable.value : s.staking.quota;
  return (limit / SCI.VALIDATOR) * SCI.VALIDATOR;
});

const stakeProblem = computed(() => {
  const s = state.value;
  if (!s) return "Reading the vault.";
  const base = amountProblem(amounts.stake, spendable.value, s.batching ? "WETH" : "ETH");
  if (base) return base;
  const wei = parseEth(amounts.stake)!;
  if (!isValidatorMultiple(wei)) return "Whole validators only: a multiple of 32 ETH.";
  if (wei > s.staking.quota) {
    return s.staking.quota === 0n
      ? "The operator has not approved any quota yet. Request it first."
      : `The operator has approved ${fmtEth(s.staking.quota)} ETH so far.`;
  }
  return sciPlans.stake(s, wei).problem;
});

const stakePlan = computed<SciPlan | null>(() => {
  const s = state.value;
  const wei = parseEth(amounts.stake);
  return s && wei !== null && !stakeProblem.value ? sciPlans.stake(s, wei) : null;
});

const lidoPlan = computed<SciPlan | null>(() => {
  const s = state.value;
  const wei = parseEth(amounts.lido);
  return s && wei !== null && !lidoProblem.value ? sciPlans.lidoDeposit(s, wei) : null;
});

const fundProblem = computed(() =>
  state.value ? amountProblem(amounts.fund, state.value.safeWeth, "WETH") : "Reading the vault.",
);
const fundPlan = computed<SciPlan | null>(() => {
  const s = state.value;
  const wei = parseEth(amounts.fund);
  return s && wei !== null && !fundProblem.value ? sciPlans.fundRedemptions(s, wei) : null;
});

const lidoProblem = computed(() => {
  const s = state.value;
  if (!s) return "Reading the vault.";
  const base = amountProblem(amounts.lido, spendable.value, s.batching ? "WETH" : "ETH");
  return base || sciPlans.lidoDeposit(s, parseEth(amounts.lido)!).problem;
});

/**
 * What to put into Lido: principal that is sitting as plain ETH and has no
 * staking quota waiting for it. Yield is never suggested: as stETH the NAV
 * would count it.
 */
const lidoSuggested = computed(() => acc.value?.principalToPlace ?? 0n);
/** The chips of the Lido form, for whichever direction is selected. */
const lidoMax = computed(() => (lidoMode.value === "deposit" ? spendable.value : sellMax.value));
const lidoSuggestion = computed(() => (lidoMode.value === "deposit" ? lidoSuggested.value : sellSuggested.value));
const setLidoAmount = (wei: bigint) => {
  if (lidoMode.value === "deposit") amounts.lido = exactEth(wei);
  else amounts.sell = exactEth(wei);
};
const lidoSuggestedNote = computed(() => {
  const a = acc.value;
  if (!a) return "";
  if (!state.value?.vault.finalized) return "No suggestion before the vault opens.";
  return a.principalToPlace > DUST
    ? `Suggested: ${fmtEth(a.principalToPlace)} ETH of principal sitting as plain ETH.`
    : "No suggestion: nothing needs to move.";
});
/** What to sell back: yield that has built up in stETH, or what redemptions are short of. */
const sellSuggested = computed(() => acc.value?.stethToSell ?? 0n);
const sellSuggestedNote = computed(() => {
  const a = acc.value;
  const s = state.value;
  if (!a || !s) return "";
  if (a.stethToSell <= DUST) {
    return s.safeSteth > DUST
      ? "No suggestion: nothing needs to move."
      : "No suggestion: the Safe holds no stETH.";
  }
  // Same two candidates the accounting weighs; the larger one is the reason.
  const yieldInSteth = a.surplusCounted > s.safeWeth ? a.surplusCounted - s.safeWeth : 0n;
  const wethShort = a.redemptionShortfall > s.safeWeth ? a.redemptionShortfall - s.safeWeth : 0n;
  const forRedemptions = wethShort > yieldInSteth;
  return forRedemptions
    ? `Suggested: ${fmtEth(a.stethToSell)} stETH, the WETH that requested redemptions are short of.`
    : `Suggested: ${fmtEth(a.stethToSell)} stETH, the yield that has built up in stETH.`;
});

const navProblem = computed(() => {
  const s = state.value;
  if (!s) return "Reading the vault.";
  if (!s.vault.finalized) return "Available once the vault is finalized.";
  if (!s.staking.exists) return "Create the staking vault first: the NAV reads it.";
  if (acc.value?.settle.navHeld) {
    return `Held: the positions read ${fmtEth(acc.value.principalUncounted)} ETH less than depositors are owed, which is what a validator exit on its way back looks like. An update now would write that dip into the share price.`;
  }
  return "";
});

const navText = computed(() => {
  const s = state.value;
  const a = acc.value;
  if (!s || !a) return "";
  if (!s.vault.finalized) return "Deposits and redemptions settle at the value stored by the last update.";
  const when = s.vault.lastNavUpdate
    ? `Last updated ${new Date(s.vault.lastNavUpdate * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`
    : "Never updated.";
  return a.navStale
    ? `${when} The stored value is out of date. Staking, Lido deposits, claims and withdrawals update it inside their own transaction; this button is for everything else.`
    : `${when} The stored value matches the positions.`;
});

const pendingDepositText = computed(() => {
  const s = state.value;
  if (!s || !s.vault.finalized) return "";
  return s.vault.pendingDeposits > 0n
    ? `${fmtEth(s.vault.pendingDeposits)} WETH of deposit requests are waiting. Their owners settle them themselves, at the NAV of that moment.`
    : "No deposit requests are waiting.";
});

const redemptionText = computed(() => {
  const s = state.value;
  const a = acc.value;
  if (!s || !a) return "";
  if (s.vault.pendingWithdrawShares === 0n) return "None are waiting.";
  return a.redemptionShortfall > DUST
    ? `${fmtEth(s.vault.pendingWithdrawShares)} shares are waiting and it is ${fmtEth(a.redemptionShortfall)} WETH short.`
    : `${fmtEth(s.vault.pendingWithdrawShares)} shares are waiting and it holds enough.`;
});

/* -------------------------------------------------------------- execution */

type ActionKey =
  | "settle" | "wrap" | "createVault" | "quota" | "stake"
  | "claim" | "withdrawPrincipal" | "fund" | "nav" | "lido"
  | "approveCow" | "signCow" | "unsignCow";
type Phase = "idle" | "simulating" | "signing" | "pending" | "ok" | "failed";

const ACTIONS: ActionKey[] = [
  "settle", "wrap", "createVault", "quota", "stake",
  "claim", "withdrawPrincipal", "fund", "nav", "lido",
  "approveCow", "signCow", "unsignCow",
];
const status = reactive(
  Object.fromEntries(ACTIONS.map((key) => [key, { phase: "idle" as Phase, message: "" }])),
) as Record<ActionKey, { phase: Phase; message: string }>;

const isBusy = (key: ActionKey) => ["simulating", "signing", "pending"].includes(status[key].phase);
const anyBusy = computed(() => ACTIONS.some(isBusy));

const statusLine = (key: ActionKey) => {
  const { phase, message } = status[key];
  switch (phase) {
    case "simulating":
      return "Checking the role allows it…";
    case "signing":
      return "Waiting for your wallet…";
    case "pending":
      return "Submitted, waiting for the block…";
    case "ok":
      return "Done.";
    case "failed":
      return message;
    default:
      return "";
  }
};

interface LogEntry { id: number; label: string; phase: Phase; message: string; txHash: string }
const log = ref<LogEntry[]>([]);
let logId = 0;

const declined = (error: any) => {
  const message = error?.innerError?.message || error?.message || "";
  return error?.code === 4001 || error?.innerError?.code === 4001 || /user (denied|rejected)/i.test(message);
};

/**
 * Dry-run, sign, wait: one action behind one press. Unlike the rebalancing
 * consoles nothing here is staged behind an earlier transaction, so a call
 * that fails in simulation will fail on chain too and is stopped before the
 * wallet opens, with the target's own reason.
 */
const run = async (key: ActionKey, label: string, call: IRoleCall): Promise<boolean> => {
  if (!accountStore.isConnected || !accountStore.connectedWalletWeb3) {
    toastStore.errorToast("Connect your wallet.");
    return false;
  }
  const entry: LogEntry = reactive({ id: ++logId, label, phase: "simulating", message: "checking", txHash: "" });
  log.value.unshift(entry);
  const set = (phase: Phase, message = "") => {
    status[key] = { phase, message };
    entry.phase = phase;
    entry.message = message || statusLine(key);
  };

  try {
    set("simulating");
    // Every address here is an Ethereum mainnet one.
    if (accountStore.connectedWalletChainId !== SCI.CHAIN) {
      await accountStore.switchNetwork(SCI.CHAIN);
    }
    const simulation = await simulateCuratorTransaction(call, ROUTE);
    if (!simulation.ok) {
      if (simulation.innerRevert) {
        const direct = await simulateDirectCall(SCI.CHAIN, SCI.ADDR.safe, call).catch(() => null);
        const reason = direct && !direct.ok ? direct.reason : simulation.reason;
        set("failed", `The role allows this, but the call itself would fail right now${reason ? ": " + reason : "."}`);
      } else {
        set("failed", sciExplainDenial(simulation.reason));
      }
      return false;
    }

    set("signing");
    const ok = await new Promise<boolean>((resolve) => {
      sendCuratorTransaction(call, ROUTE)
        .on("transactionHash", (hash: any) => {
          entry.txHash = String(hash);
          set("pending");
        })
        .on("receipt", (receipt: any) => {
          const success = !!receipt.status;
          set(success ? "ok" : "failed", success ? "" : "The transaction reverted on chain.");
          resolve(success);
        })
        .catch((error: any) => {
          console.error(error);
          const message = error?.innerError?.message || error?.message || "";
          // A declined signature is a decision, not an error to keep on screen.
          set(declined(error) ? "idle" : "failed", declined(error) ? "" : message || "There has been an error.");
          if (declined(error)) entry.message = "declined in the wallet";
          resolve(false);
        });
    });
    if (ok) {
      toastStore.successToast(`${label}: done.`);
      await refresh();
    }
    return ok;
  } catch (error: any) {
    console.error(error);
    set("failed", error?.message || "There has been an error.");
    return false;
  }
};

/* ------------------------------------------------------- selling stETH (CoW) */

/**
 * The order that is out there, kept in the browser so a reload (or coming
 * back ten minutes later) picks it up again. Amounts as strings: bigint does
 * not survive JSON.
 */
interface Sale {
  uid: string;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  status: CowStatus;
  executedBuy: string;
  /** The pre-signature was mined from this page. CoW's API takes a moment to notice. */
  signed?: boolean;
}
const SALE_KEY = "rethink.scieth.cowOrder";
const sale = ref<Sale | null>(null);
const saleOrder = (s: Sale): CowOrder => ({
  sellAmount: BigInt(s.sellAmount),
  buyAmount: BigInt(s.buyAmount),
  validTo: s.validTo,
});
const storeSale = (value: Sale | null) => {
  sale.value = value;
  try {
    if (value) localStorage.setItem(SALE_KEY, JSON.stringify(value));
    else localStorage.removeItem(SALE_KEY);
  } catch {
    /* private mode: the order still exists, it just will not survive a reload */
  }
};

const quote = ref<CowQuote | null>(null);
const quotedAt = ref(0);
const quoting = ref(false);
const quoteError = ref("");
const slippageBps = ref(50);
const acceptCost = ref(false);
const placing = ref(false);
const placeError = ref("");
const clock = ref(Date.now());

// stETH balances move by a wei or two on transfer; selling the very last wei
// can fail on that rounding, so "max" leaves two behind.
const sellMax = computed(() => {
  const balance = state.value?.safeSteth ?? 0n;
  return balance > 2n ? balance - 2n : 0n;
});
const sellProblem = computed(() =>
  state.value ? amountProblem(amounts.sell, sellMax.value, "stETH") : "Reading the vault.",
);

/** The order the current quote and slippage turn into. validTo is set at send time. */
const draft = computed(() =>
  quote.value ? cowBuildOrder(quote.value, slippageBps.value, Math.floor(clock.value / 1000)) : null,
);
const saleCost = computed(() => (draft.value ? cowWorstCaseCost(draft.value) : { cost: 0n, bps: 0 }));
const quoteStale = computed(() => quote.value !== null && clock.value - quotedAt.value > 60_000);

watch(() => amounts.sell, () => {
  quote.value = null;
  quoteError.value = "";
  placeError.value = "";
  acceptCost.value = false;
});

const getQuote = async () => {
  const wei = parseEth(amounts.sell);
  if (wei === null) return;
  quoting.value = true;
  quoteError.value = "";
  placeError.value = "";
  try {
    quote.value = await cowQuote(wei);
    quotedAt.value = Date.now();
    clock.value = Date.now();
  } catch (error: any) {
    quote.value = null;
    quoteError.value = `CoW could not price this: ${error?.message || "no answer"}`;
  } finally {
    quoting.value = false;
  }
};

const progress = computed(() => {
  const done = (key: ActionKey) => status[key].phase === "ok";
  const active = (key: ActionKey) => isBusy(key);
  const approvalCovers = !!draft.value && (state.value?.stethCowAllowance ?? 0n) >= draft.value.sellAmount;
  return {
    approve: done("approveCow") || approvalCovers ? "ok" : active("approveCow") ? "busy" : "idle",
    place: placing.value ? "busy" : "idle",
    sign: active("signCow") ? "busy" : "idle",
  };
});

/**
 * Approve, place, sign. The order is posted to CoW BEFORE it is signed on
 * chain: if their API refuses it, or hands back an id that is not this
 * order's, nothing has been signed and no gas beyond the approval is spent.
 */
const sellSteth = async () => {
  if (!quote.value) return;
  placeError.value = "";
  const now = Math.floor(Date.now() / 1000);
  const order = cowBuildOrder(quote.value, slippageBps.value, now);

  if ((state.value?.stethCowAllowance ?? 0n) < order.sellAmount) {
    const approved = await run(
      "approveCow",
      `Approve ${fmtEth(order.sellAmount)} stETH for CoW`,
      sciCalls.approveCow(order.sellAmount),
    );
    if (!approved) return;
  }

  placing.value = true;
  let uid = "";
  try {
    uid = await cowPostOrder(order, quote.value.id);
  } catch (error: any) {
    placeError.value = `CoW did not accept the order: ${error?.message || "no answer"}`;
    return;
  } finally {
    placing.value = false;
  }

  storeSale({
    uid,
    sellAmount: order.sellAmount.toString(),
    buyAmount: order.buyAmount.toString(),
    validTo: order.validTo,
    status: "presignaturePending",
    executedBuy: "0",
  });
  quote.value = null;
  amounts.sell = "";
  await signSale();
};

const signSale = async () => {
  const current = sale.value;
  if (!current) return;
  const order = saleOrder(current);
  const now = Math.floor(Date.now() / 1000);
  if (order.validTo <= now) {
    storeSale({ ...current, status: "expired" });
    return;
  }
  const ok = await run(
    "signCow",
    `Sign the CoW order for ${fmtEth(order.sellAmount)} stETH`,
    sciCalls.signCowOrder(order, cowValidDuration(order, now)),
  );
  if (ok && sale.value?.uid === current.uid) {
    storeSale({ ...current, signed: true });
    await pollSale();
  }
};

const cancelSale = async () => {
  const current = sale.value;
  if (!current) return;
  const ok = await run("unsignCow", "Cancel the CoW order", sciCalls.unsignCowOrder(saleOrder(current)));
  if (ok) storeSale({ ...current, status: "cancelled" });
};

const dismissSale = () => {
  storeSale(null);
  status.signCow = { phase: "idle", message: "" };
  status.unsignCow = { phase: "idle", message: "" };
  status.approveCow = { phase: "idle", message: "" };
};

const pollSale = async () => {
  const current = sale.value;
  if (!current || !["presignaturePending", "open"].includes(current.status)) return;
  try {
    const live = await cowOrderState(current.uid);
    // CoW only learns of an on-chain cancellation with a delay; do not let a
    // late "open" overwrite what this page already knows.
    if (sale.value?.uid !== current.uid || sale.value.status === "cancelled") return;
    const expired = live.status === "presignaturePending" && current.validTo <= Math.floor(Date.now() / 1000);
    storeSale({
      ...current,
      signed: sale.value.signed,
      status: expired ? "expired" : live.status,
      executedBuy: live.executedBuy.toString(),
    });
    if (live.status === "fulfilled" && current.status !== "fulfilled") {
      toastStore.successToast(`Sold: ${fmtEth(live.executedBuy)} WETH received.`);
      await refresh();
    }
  } catch (error) {
    console.warn("Could not read the order from CoW", error);
  }
};

const saleTitle = computed(() => {
  switch (sale.value?.status) {
    case "presignaturePending":
      return sale.value?.signed ? "Order signed, waiting for CoW to see it" : "Order placed, not signed yet";
    case "open":
      return "Order open, waiting for a solver";
    case "fulfilled":
      return "Order filled";
    case "cancelled":
      return "Order cancelled";
    case "expired":
      return "Order expired unfilled";
    default:
      return "";
  }
});
const saleTone = computed(() => {
  switch (sale.value?.status) {
    case "fulfilled":
      return "ok";
    case "cancelled":
    case "expired":
      return "failed";
    default:
      return "pending";
  }
});
const saleNote = computed(() => {
  switch (sale.value?.status) {
    case "presignaturePending":
      return sale.value?.signed
        ? "The signature is on chain. CoW picks it up within a block or two and the order opens."
        : "CoW has the order but it means nothing until it is signed on chain. Sign it, or discard it and it lapses on its own.";
    case "open":
      return "Signed. The stETH stays in the Safe until a solver fills the order. This page checks every few seconds.";
    case "fulfilled":
      return settlePlan.value && !settlePlan.value.problem
        ? "The WETH is in the Safe, and the vault still counts the stETH it was at the last update: until it is settled the NAV reads too high. Settle now."
        : "The WETH is in the Safe and the NAV is up to date.";
    case "cancelled":
      return "The signature was withdrawn. Nothing was sold.";
    case "expired":
      return "No solver filled it in time. Nothing was sold; the stETH never left the Safe.";
    default:
      return "";
  }
});
const timeText = (unix: number) =>
  new Date(unix * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

let saleTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  try {
    const stored = localStorage.getItem(SALE_KEY);
    if (stored) {
      sale.value = JSON.parse(stored);
      lidoMode.value = "sell";
      actionTab.value = "lido";
    }
  } catch {
    /* nothing stored, or not readable */
  }
  pollSale();
  saleTimer = setInterval(() => {
    clock.value = Date.now();
    if (!document.hidden) pollSale();
  }, 8_000);
});
onUnmounted(() => clearInterval(saleTimer));

/** Run a plan (a single call, or several as one transaction), refusing one that cannot be carried out. */
const runPlan = async (key: ActionKey, label: string, plan: SciPlan | null): Promise<boolean> => {
  if (!plan) return false;
  if (plan.problem) {
    status[key] = { phase: "failed", message: plan.problem };
    return false;
  }
  return await run(key, plan.parts.length > 1 ? `${label} (${plan.parts.length} steps, one transaction)` : label, plan.call);
};

/* ------------------------------------------------------------ guided steps */

const STEP_ACTION: Record<SciStepKey, ActionKey> = {
  createStakingVault: "createVault",
  stake: "stake",
  wrap: "wrap",
  claimRewards: "claim",
  withdrawPrincipal: "withdrawPrincipal",
  settle: "settle",
  exitInFlight: "nav",
  fundRedemptions: "fund",
};
const stepAction = (key: SciStepKey) => STEP_ACTION[key];

const STEP_BUTTON: Record<SciStepKey, string> = {
  createStakingVault: "Create",
  stake: "Stake",
  wrap: "Wrap",
  claimRewards: "Claim",
  withdrawPrincipal: "Withdraw",
  settle: "Transfer",
  exitInFlight: "",
  fundRedemptions: "Send",
};
const stepButton = (key: SciStepKey) => STEP_BUTTON[key];

/** The plan behind a guided step, so the step can show what its button will send. */
const stepPlan = (step: SciStep): SciPlan | null => {
  const s = state.value;
  if (!s) return null;
  switch (step.key) {
    case "stake":
      return sciPlans.stake(s, step.amount ?? 0n);
    case "wrap":
      return sciPlans.wrap(s, step.amount ?? 0n);
    case "claimRewards":
      return claimPlan.value;
    case "withdrawPrincipal":
      return withdrawPlan.value;
    case "settle":
      return settlePlan.value;
    case "fundRedemptions":
      return sciPlans.fundRedemptions(s, step.amount ?? 0n);
    default:
      return null;
  }
};

/** A tab carries a dot when the guidance has something waiting behind it. */
const tabAttention = computed<Record<ActionTab, boolean>>(() => {
  const keys = new Set((acc.value?.steps ?? []).map((step) => step.key));
  return {
    staking: ["createStakingVault", "stake", "claimRewards", "withdrawPrincipal"].some((key) => keys.has(key as SciStepKey)),
    lido: sale.value !== null && sale.value.status !== "cancelled" && sale.value.status !== "expired",
    yield: keys.has("settle"),
    vault: keys.has("fundRedemptions"),
  };
});

/** A guided step runs with exactly the amount the accounting worked out. */
const runStep = (step: SciStep) => {
  const amount = step.amount ?? 0n;
  switch (step.key) {
    case "createStakingVault":
      return run("createVault", step.title, sciCalls.createStakingVault());
    case "stake":
      return runPlan("stake", step.title, state.value ? sciPlans.stake(state.value, amount) : null);
    case "wrap":
      return runPlan("wrap", step.title, state.value ? sciPlans.wrap(state.value, amount) : null);
    case "claimRewards":
      return runPlan("claim", step.title, claimPlan.value);
    case "withdrawPrincipal":
      return runPlan("withdrawPrincipal", step.title, withdrawPlan.value);
    case "settle":
      return runPlan("settle", step.title, settlePlan.value);
    case "exitInFlight":
      return;
    case "fundRedemptions":
      return runPlan("fund", step.title, state.value ? sciPlans.fundRedemptions(state.value, amount) : null);
  }
};
</script>

<style scoped lang="scss">
.sci_console {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}

.sci_section {
  margin-top: 0.75rem;
}

/* The mono uppercase caption the design system labels figures with. */
.sci_label {
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

.sci_mono {
  font-family: $font-mono;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: $color-light-subtitle;
}

.sci_executor {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-family: $font-mono;
  font-size: 11.5px;
  color: $color-light-subtitle;
}

.sci_link {
  flex: 0 0 auto;
  white-space: nowrap;
  font-family: $font-mono;
  font-size: 11.5px;
  color: $color-cyan;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.sci_dot {
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

/* The promise first: the share price, with the page's tools beside it. */
.sci_summary {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem 2rem;

  &__hero {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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

  &__note {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    font-size: 12.5px;
    color: $color-steel-blue;

    &--ok .sci_dot {
      background: $color-pos;
    }

    &--bad {
      color: $color-warn;

      .sci_dot {
        background: $color-warn;
      }
    }
  }

  &__tools {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
}

/* Principal on the left, yield on the right. */
.sci_overview {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: stretch;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.sci_panel {
  gap: 1rem;

  &__head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
  }

  &__main,
  &__side {
    display: flex;
    flex-direction: column;
    gap: 0.4375rem;
  }

  &__side {
    align-items: flex-end;
    text-align: right;
  }

  &__figure {
    font-family: $font-mono;
    font-size: 26px;
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 1;
    color: $color-white;
    font-variant-numeric: tabular-nums;

    span {
      margin-left: 0.4375rem;
      font-size: 13px;
      letter-spacing: 0;
      color: $color-text-irrelevant;
    }

    &--yield {
      color: $color-yield;
    }
  }

  &__side_value {
    font-family: $font-mono;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    color: $color-white;
  }
}

.sci_pill {
  padding: 0.125rem 0.5rem;
  border: 1px solid $color-line-2;
  border-radius: 999px;
  font-size: 11.5px;
  color: $color-steel-blue;
  white-space: nowrap;

  &--ok {
    color: $color-pos;
  }

  &--bad {
    border-color: $color-warn-line;
    background: $color-warn-soft;
    color: $color-warn;
  }
}

/* Where the counted ETH is, as one bar. */
.sci_bar {
  display: flex;
  gap: 2px;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;

  &--empty {
    background: $color-line-2;
  }

  &__segment {
    display: block;
    height: 100%;
    background: $color-cyan;
  }
}

.sci_rows {
  display: flex;
  flex-direction: column;
}

.sci_capbox {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.875rem;
  border-top: 1px solid $color-line;

  &__line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
  }

  &__value {
    color: $color-white;
  }
}

.sci_banner {
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

.sci_card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: $color-white;
  }

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

/* Actions: one card, a tab per area, every action laid out the same way. */
.sci_actions {
  gap: 0;
  padding-top: 0.5rem;
}

.sci_tabs {
  display: flex;
  gap: 1.75rem;
  overflow-x: auto;
  border-bottom: 1px solid $color-line;

  &__tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.4375rem;
    padding: 0.75rem 0;
    margin-bottom: -1px;
    border-bottom: 2px solid transparent;
    background: transparent;
    font-size: 13.5px;
    font-weight: 600;
    color: $color-steel-blue;
    white-space: nowrap;
    cursor: pointer;
    transition: color $default-transition-time ease, border-color $default-transition-time ease;

    &:hover {
      color: $color-white;
    }

    &--on {
      border-bottom-color: $color-cyan;
      color: $color-white;
    }
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $color-cyan;
  }
}

.sci_pane {
  display: flex;
  flex-direction: column;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem 1.5rem;
    padding: 1rem 0;

    > .sci_card__sub {
      max-width: 62ch;
    }
  }
}

.sci_stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin-bottom: 0.25rem;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-line;
  overflow: hidden;

  @media (max-width: 720px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  &__tile {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.75rem 0.875rem;
    background: $color-card-background;

    b {
      font-family: $font-mono;
      font-size: 16px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: $color-white;
    }
  }

  &__yield {
    color: $color-yield !important;
  }
}

/* One action: what it is on the left, what to press on the right, and what
   the press will send underneath, across the full width. */
.sci_action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
  gap: 0.75rem 2rem;
  align-items: start;
  padding: 1.125rem 0;
  border-top: 1px solid $color-line;

  &:last-child {
    padding-bottom: 0.25rem;
  }

  @media (max-width: 820px) {
    grid-template-columns: minmax(0, 1fr);
  }

  &__info,
  &__controls,
  &__body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  &__info > .sci_card__sub {
    max-width: 62ch;
  }

  &__body {
    gap: 0.875rem;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 14.5px;
    font-weight: 700;
    color: $color-white;
  }

  &__n {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid $color-line-2;
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    color: $color-steel-blue;
  }

  &__hint {
    text-align: right;
  }

  &__plan {
    grid-column: 1 / -1;
  }

  /* The sale's details sit under the form, no wider than they need to be. */
  &__plan.sci_order,
  &__plan.sci_action__body {
    max-width: 560px;
  }
}

.sci_badge {
  font-family: $font-mono;
  font-size: 9.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  color: $color-yield;
  background: $color-yield-soft;
  border: 1px solid $color-yield-line;
  white-space: nowrap;

  &--warn {
    color: $color-warn;
    background: $color-warn-soft;
    border-color: $color-warn-line;
  }
}

/* Guided steps */
.sci_step {
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

.sci_allgood {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;

  .sci_dot {
    margin-top: 0.4375rem;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: $color-white;
  }
}

.sci_row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto 44px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid $color-line;

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  &--plain {
    grid-template-columns: minmax(0, 1fr) auto 44px;
  }

  &__swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: $color-cyan;
  }

  &__names {
    min-width: 0;
  }

  &__name {
    font-size: 13.5px;
    color: $color-white;
  }

  &__sub {
    font-size: 12px;
    color: $color-steel-blue;
  }

  &__amount {
    font-family: $font-mono;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    color: $color-white;
    text-align: right;

    &--zero {
      color: $color-text-irrelevant;
    }
  }

  &__unit {
    font-family: $font-mono;
    font-size: 10.5px;
    color: $color-steel-blue;
  }
}

/* The sum behind "you can send" */
.sci_math {
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 12.5px;
    color: $color-steel-blue;

    b {
      font-family: $font-mono;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: $color-light-subtitle;
    }

    &--sum {
      padding-top: 0.3125rem;
      border-top: 1px solid $color-line;
    }

    &--result {
      padding-top: 0.3125rem;
      border-top: 1px solid $color-line;
      color: $color-white;

      b {
        color: $color-yield;
        font-size: 14px;
      }
    }
  }
}

.sci_cap {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  &__bar {
    flex: 1 1 auto;
    height: 4px;
    border-radius: 2px;
    background: $color-line-2;
    overflow: hidden;
  }

  &__fill {
    display: block;
    height: 100%;
    background: $color-cyan;
  }
}

.sci_form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;

  /* A button with no field beside it sits on the right, under the others. */
  &--end {
    justify-content: flex-end;
  }
}

.sci_field {
  display: inline-flex;
  align-items: center;
  flex: 1 1 130px;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-card-background;
  transition: border-color $default-transition-time ease;

  &:focus-within {
    border-color: $color-cyan-line;
  }

  /* The field draws the frame, so the input inside carries no box of its own
     (the app's global input rule would otherwise give it one). */
  &__input {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    min-height: 0;
    height: auto;
    padding: 0;
    background: transparent;
    border: 0;
    outline: none;
    font-family: $font-mono;
    font-size: 13.5px;
    font-variant-numeric: tabular-nums;
    color: $color-white;

    &::placeholder {
      color: $color-text-irrelevant;
    }
  }

  &__unit {
    font-family: $font-mono;
    font-size: 10.5px;
    color: $color-steel-blue;
  }
}

.sci_chip {
  padding: 0.3125rem 0.5625rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: transparent;
  font-family: $font-mono;
  font-size: 11px;
  color: $color-light-subtitle;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color $default-transition-time ease, color $default-transition-time ease;

  &:hover:not(:disabled) {
    border-color: $color-cyan-line;
    color: $color-white;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &--accent {
    border-color: $color-cyan-line;
    color: $color-cyan;
  }
}

.sci_toggle {
  display: inline-flex;
  align-self: flex-start;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  overflow: hidden;

  &__btn {
    padding: 0.25rem 0.625rem;
    background: transparent;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
    cursor: pointer;

    &--on {
      background: $color-cyan-tint;
      color: $color-cyan;
    }
  }
}

.sci_order {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 13.5px;
    color: $color-white;

    .sci_link {
      margin-left: auto;
    }
  }
}

.sci_progress {
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;

  &__row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 12.5px;
    color: $color-steel-blue;

    &--busy {
      color: $color-white;

      .sci_dot {
        background: $color-warn;
      }
    }

    &--ok {
      color: $color-light-subtitle;

      .sci_dot {
        background: $color-pos;
      }
    }
  }
}

.sci_accept {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 12.5px;
  line-height: 1.5;
  color: $color-warn;
  cursor: pointer;

  /* The app's global input rule sizes every bare input like a text field. */
  input {
    flex: 0 0 auto;
    width: 14px;
    min-height: 0;
    height: 14px;
    padding: 0;
    margin-top: 0.1875rem;
  }
}

.sci_problem {
  font-size: 12.5px;
  color: $color-neg;
}

.sci_warning {
  font-size: 12.5px;
  color: $color-warn;
}

.sci_status {
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

.sci_log {
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
