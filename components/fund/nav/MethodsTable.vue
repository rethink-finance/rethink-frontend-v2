<template>
  <div
    class="nav_table"
    :class="{
      'nav_table--frameless': frameless,
      'nav_table--compact': compact,
      'nav_table--wide': !compact && showLastNavUpdateValue && showSimulatedNav,
    }"
  >
    <div v-if="loading" class="nav_table__placeholder">
      <v-progress-circular size="16" width="2" indeterminate />
      Loading NAV methods…
    </div>

    <div v-else class="nav_table__scroll">
      <div class="nav_table__inner" :style="{ '--nav-columns': gridColumns }">
        <div class="nav_table__row nav_table__row--head">
          <div v-if="selectable" class="nav_table__th" />
          <div v-if="!compact" class="nav_table__th">
            #
          </div>
          <div class="nav_table__th">
            Method
          </div>
          <div class="nav_table__th">
            Position
          </div>
          <div v-if="!compact" class="nav_table__th">
            Valuation source
          </div>
          <div
            v-if="showLastNavUpdateValue"
            class="nav_table__th nav_table__th--right"
          >
            Last update
          </div>
          <div
            v-if="showSimulatedNav"
            class="nav_table__th nav_table__th--right"
          >
            <span>Simulated</span>
            <!-- Re-runs every method's simulation. The values are read from
                 chain state at the moment they were asked for, so a curator
                 who just moved funds wants a way to ask again. -->
            <button
              v-if="showSimulateButton"
              type="button"
              class="nav_table__refresh"
              :class="{ 'nav_table__refresh--busy': isNavSimulationLoading }"
              title="Refresh simulated NAV"
              aria-label="Refresh simulated NAV"
              @click="fundStore.refreshSimulateNAVCounter += 1"
            >
              <Icon
                icon="material-symbols:refresh-rounded"
                width="0.9375rem"
                height="0.9375rem"
              />
            </button>
          </div>
          <div v-if="showExpand" class="nav_table__th" />
          <div v-if="deletable" class="nav_table__th" />
        </div>

        <div
          v-for="(row, index) in visibleMethods"
          :key="rowKey(row, index)"
          class="nav_table__group"
        >
          <div
            class="nav_table__row nav_table__row--method"
            :class="{
              'nav_table__row--clickable': showExpand && !row.isAlreadyUsed,
              'nav_table__row--open': isExpanded(row),
              'nav_table__row--deleted': row.deleted,
              'nav_table__row--used': row.isAlreadyUsed,
            }"
            @click="showExpand ? toggleExpand(row) : undefined"
          >
            <div
              v-if="selectable"
              class="nav_table__cell"
              @click.stop
            >
              <span v-if="row.isAlreadyUsed" class="nav_table__tag">In use</span>
              <button
                v-else
                type="button"
                role="checkbox"
                class="nav_table__check"
                :class="{ 'nav_table__check--on': isSelected(row) }"
                :aria-checked="isSelected(row)"
                :aria-label="`Select ${row.positionName || 'method'}`"
                @click="toggleSelect(row)"
              >
                <Icon
                  v-if="isSelected(row)"
                  icon="material-symbols:check-rounded"
                  width="0.75rem"
                  height="0.75rem"
                />
              </button>
            </div>

            <div
              v-if="!compact"
              class="nav_table__index"
              :class="{
                'nav_table__index--new': row.isNew && !row.deleted,
                'nav_table__index--deleted': row.deleted,
              }"
            >
              {{ index + 1 }}
            </div>

            <div class="nav_table__name">
              <span class="nav_table__name_text">{{ row.positionName || "N/A" }}</span>
              <span v-if="row.deleted" class="nav_table__tag nav_table__tag--neg">Deleted</span>
              <span v-else-if="row.isNew" class="nav_table__tag nav_table__tag--new">New</span>
              <!-- Compact has no source column; the source rides under the name. -->
              <span v-if="compact" class="nav_table__name_meta">
                {{ row.valuationSource || "N/A" }}
              </span>
            </div>

            <div
              class="nav_table__type"
              :class="`position_type_${row.displayPositionType || row.positionType}`"
            >
              {{ positionTypeName(row) }}
            </div>

            <div v-if="!compact" class="nav_table__source">
              {{ row.valuationSource || "N/A" }}
            </div>

            <div
              v-if="showLastNavUpdateValue"
              class="nav_table__figure nav_table__figure--dim"
              :class="{ 'nav_table__figure--error': row.pastNavValueError }"
            >
              <v-progress-circular
                v-if="row.pastNavValueLoading"
                size="14"
                width="2"
                indeterminate
              />
              <template v-else>
                {{ row.pastNavValue ? fundStore.getFormattedBaseTokenValue(row.pastNavValue) : "-" }}
              </template>
              <span v-if="row.pastNavValueError" class="nav_table__warn">
                <Icon icon="octicon:question-16" width="0.875rem" />
                <v-tooltip activator="parent" location="top">
                  Something went wrong while getting the last NAV value.
                </v-tooltip>
              </span>
            </div>

            <div
              v-if="showSimulatedNav"
              class="nav_table__figure"
              :class="{ 'nav_table__figure--error': row.isSimulatedNavError }"
            >
              <v-progress-circular
                v-if="isSimulationPending(row)"
                size="14"
                width="2"
                indeterminate
              />
              <template v-else>
                {{ row.simulatedNavFormatted ?? "-" }}
              </template>
              <span v-if="row.isSimulatedNavError" class="nav_table__warn">
                <Icon icon="octicon:question-16" width="0.875rem" />
                <v-tooltip activator="parent" location="top">
                  Something went wrong while simulating NAV value. Retry simulating NAV.
                </v-tooltip>
              </span>
              <v-tooltip
                v-else-if="row.pastNAVUpdateEntryFundAddress"
                activator="parent"
                location="top"
              >
                Simulated from vault {{ row.pastNAVUpdateEntryFundAddress }}
              </v-tooltip>
            </div>

            <div v-if="showExpand" class="nav_table__cell nav_table__cell--end">
              <button
                v-if="row.detailsJson"
                type="button"
                class="nav_table__action"
                :class="{ 'nav_table__action--active': isExpanded(row) }"
                :disabled="row.isAlreadyUsed"
                @click.stop="toggleExpand(row)"
              >
                {{ isBaseTokenBalanceMethod(row) ? "Raw" : "Details" }}
              </button>
            </div>

            <div v-if="deletable" class="nav_table__cell nav_table__cell--end">
              <!-- Rethink positions (fund, safe, fees) cannot be deleted. -->
              <button
                v-if="!row.isRethinkPosition"
                type="button"
                class="nav_table__action"
                :class="{ 'nav_table__action--danger': !row.deleted }"
                @click.stop="deleteMethod(row)"
              >
                {{ row.deleted ? "Undo" : "Delete" }}
              </button>
            </div>
          </div>

          <div
            v-if="isExpanded(row) && row.detailsJson"
            class="nav_table__panel"
            :class="{ 'nav_table__panel--deleted': row.deleted }"
          >
            <button
              v-if="!row.isRethinkPosition"
              type="button"
              class="nav_table__hash"
              :class="{ 'nav_table__hash--changed': hasChanged() }"
              :title="copiedHash === row.detailsHash ? 'Copied' : 'Copy details hash'"
              @click="copyHash(row.detailsHash)"
            >
              <span class="nav_table__hash_label">Details hash</span>
              <span class="nav_table__hash_value">{{ row.detailsHash }}</span>
              <Icon
                :icon="copiedHash === row.detailsHash ? 'material-symbols:check-rounded' : 'clarity:copy-line'"
                width="0.8rem"
              />
            </button>

            <v-form
              v-if="!isBaseTokenBalanceMethod(row)"
              ref="form"
              v-model="formIsValid"
              class="nav_edit"
              :disabled="!isMethodEditable(row)"
            >
              <div class="nav_edit__grid">
                <div class="nav_edit__field">
                  <span class="nav_edit__label">
                    Position name<span class="nav_edit__star">*</span>
                  </span>
                  <v-text-field
                    v-model="navEntry.positionName"
                    placeholder="E.g. WETH"
                    :rules="rules"
                    required
                  />
                </div>
                <div class="nav_edit__field">
                  <span class="nav_edit__label">
                    Valuation source<span class="nav_edit__star">*</span>
                  </span>
                  <v-text-field
                    v-model="navEntry.valuationSource"
                    placeholder="E.g. Uniswap ETH/USDC"
                    :rules="rules"
                    required
                  />
                </div>
              </div>

              <div class="nav_edit__grid">
                <div class="nav_edit__field">
                  <span class="nav_edit__label">Position type</span>
                  <UiSegmented
                    :model-value="navEntry.positionType"
                    :options="parsedPositionTypeItems"
                    :class="{ 'nav_edit__segmented--locked': !isMethodEditable(row) }"
                    @update:model-value="onPositionTypeChange"
                  />
                </div>
                <div v-if="valuationTypes.length" class="nav_edit__field">
                  <span class="nav_edit__label">Valuation type</span>
                  <UiSegmented
                    :model-value="navEntry.valuationType"
                    :options="parsedValuationTypeItems"
                    :class="{ 'nav_edit__segmented--locked': !isMethodEditable(row) }"
                    @update:model-value="onValuationTypeChange"
                  />
                </div>
              </div>

              <div class="nav_edit__section">
                Method details
              </div>

              <template v-if="navEntry.positionType === PositionType.Composable">
                <v-expansion-panels v-model="expandedPanels" class="nav_edit__panels">
                  <v-expansion-panel
                    v-for="(method, methodIndex) in navEntry.details[navEntry.positionType]"
                    :key="methodIndex"
                    eager
                  >
                    <v-expansion-panel-title static>
                      <div class="nav_edit__panel_title">
                        <span>{{ methodIndex + 1 }}) Method details</span>
                        <span
                          class="nav_edit__status"
                          :class="method.isValid ? 'nav_edit__status--valid' : 'nav_edit__status--invalid'"
                        >
                          {{ method.isValid ? "Provided" : "Incomplete" }}
                        </span>
                        <button
                          v-if="isMethodEditable(row)"
                          type="button"
                          class="nav_edit__remove"
                          aria-label="Remove method details"
                          @click.stop="deleteEditMethod(methodIndex)"
                        >
                          <Icon icon="material-symbols:delete-outline-rounded" width="1rem" />
                        </button>
                      </div>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <FundNavMethodDetails
                        v-model="navEntry.details[navEntry.positionType][methodIndex]"
                        :position-type="navEntry.positionType"
                        :valuation-type="navEntry.valuationType"
                        :validate-on-mount="true"
                      />
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </template>

              <FundNavMethodDetails
                v-else
                v-model="navEntry.details[navEntry.positionType][0]"
                :position-type="navEntry.positionType"
                :valuation-type="navEntry.valuationType"
              />

              <div v-if="isMethodEditable(row)" class="nav_edit__actions">
                <button
                  v-if="navEntry.positionType === PositionType.Composable"
                  type="button"
                  class="nav_edit__ghost"
                  @click="addEditMethodDetails"
                >
                  Add method details
                </button>
                <span v-else />
                <v-btn
                  color="primary"
                  :disabled="!hasChanged()"
                  @click="editMethod"
                >
                  Edit method
                </v-btn>
              </div>
            </v-form>

            <pre v-else class="nav_table__json">{{ row.detailsJson }}</pre>
          </div>
        </div>

        <div
          v-if="!visibleMethods.length && (search || emptyText)"
          class="nav_table__empty"
        >
          {{ search ? `No NAV method matches “${search}”.` : emptyText }}
        </div>

        <!-- Where the next method goes. A call site that adds methods in
             place fills this with its own control; it sits under the methods
             and above the base-asset lines, so a new row lands where the eye
             already is. Hero-sized while it is all the body holds. -->
        <div
          v-if="$slots.add"
          class="nav_table__add"
          :class="{ 'nav_table__add--hero': !visibleMethods.length }"
        >
          <slot name="add" :empty="!visibleMethods.length" />
        </div>

        <!-- The base asset held outside any valuation method: idle on the admin
             contract and the Safe, plus what has accrued as fees. Listed as
             summary lines under the methods rather than as methods of their
             own, which is what they are not. -->
        <div
          v-for="asset in baseAssetRows"
          :key="asset.key"
          class="nav_table__row nav_table__row--summary"
        >
          <div
            class="nav_table__summary_label"
            :style="{ gridColumn: `span ${leadingSpan}` }"
          >
            {{ asset.label }}
            <AddressLink
              v-if="asset.address"
              class="nav_table__summary_address"
              :address="asset.address"
              :chain-id="fundChainId"
              truncate
            />
          </div>
          <div
            v-if="showLastNavUpdateValue"
            class="nav_table__figure nav_table__figure--dim"
          >
            {{ asset.last }}
          </div>
          <div
            v-if="showSimulatedNav"
            class="nav_table__figure nav_table__figure--dim"
          >
            {{ asset.simulated }}
          </div>
          <div v-if="showExpand" />
          <div v-if="deletable" />
        </div>

        <div v-if="showTotalRow" class="nav_table__row nav_table__row--total">
          <div
            class="nav_table__total_label"
            :style="{ gridColumn: `span ${leadingSpan}` }"
          >
            {{ totalLabel }}
          </div>
          <div
            v-if="showLastNavUpdateValue"
            class="nav_table__total_value nav_table__total_value--dim"
          >
            {{ formattedTotalLastNAV }}
          </div>
          <div v-if="showSimulatedNav" class="nav_table__total_value">
            {{ formattedTotalSimulatedNAV }}
            <span
              v-if="simulatedNavErrorCount > 0"
              class="nav_table__warn nav_table__warn--neg"
            >
              <Icon icon="octicon:question-16" width="0.875rem" />
              <v-tooltip activator="parent" location="top">
                Total value may not include all simulated NAV method values.<br>
                Retry simulating NAV.
              </v-tooltip>
            </span>
          </div>
          <div v-if="showExpand" />
          <div v-if="deletable" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ethers } from "ethers";
import { useFundStore } from "~/store/fund/fund.store";
import { useSettingsStore } from "~/store/settings/settings.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { ChainId } from "~/types/enums/chain_id";
import { defaultInputTypeValue, InputType } from "~/types/enums/input_type";
import {
  PositionType,
  PositionTypeKeys,
  PositionTypes,
  PositionTypeToNAVEntryTypeMap,
  PositionTypeToValuationTypesMap,
  PositionTypeValuationTypeDefaultFieldsMap,
  PositionTypeValuationTypeFieldsMap,
} from "~/types/enums/position_type";
import { ValuationType, ValuationTypesMap } from "~/types/enums/valuation_type";
import type INAVMethod from "~/types/nav_method";
import type INAVParts from "~/types/nav_parts";

/**
 * A method as the table lists it: flagged when the vault already holds it,
 * and when it is one of the app's own base-asset lines rather than a method.
 */
type INAVMethodRow = INAVMethod & {
  isAlreadyUsed?: boolean;
  isRethinkPosition?: boolean;
};

/**
 * The NAV methods table, per the design's Vault NAV screen: one grid row per
 * method, the base-asset balances as summary lines under them, and the total
 * as the closing row. Shared by the vault's NAV page, the manage/proposal
 * pages, the library picker and the create flow's NAV step, which is why it
 * carries so many switches — each of those shows a different subset of the
 * same columns and controls.
 */
export default defineComponent({
  name: "FundNavMethodsTable",
  props: {
    methods: {
      type: Array as () => INAVMethod[],
      default: () => [],
    },
    // Optional prop of methods that are already being used.
    // If the "selectable" prop is true, these methods will be made unselectable and marked as "in-use".
    usedMethods: {
      type: Array as () => INAVMethod[],
      default: () => [],
    },
    navParts: {
      type: Object as () => INAVParts,
      default: () => undefined,
    },
    showBaseTokenBalances: {
      type: Boolean,
      default: false,
    },
    showSafeContractBalance: {
      type: Boolean,
      default: false,
    },
    showSummaryRow: {
      type: Boolean,
      default: false,
    },
    showLastNavUpdateValue: {
      type: Boolean,
      default: false,
    },
    showSimulatedNav: {
      type: Boolean,
      default: false,
    },
    /**
     * The refresh control in the Simulated column head. Off where the page
     * offers its own, so the same action is not on screen twice.
     */
    showSimulateButton: {
      type: Boolean,
      default: true,
    },
    /**
     * Drops the table's own hairline frame, for a table that sits inside a
     * card which already draws one.
     */
    frameless: {
      type: Boolean,
      default: false,
    },
    /**
     * A layout for a narrow container, such as the picker inside a modal:
     * no index column, the valuation source under the method name instead
     * of in a column of its own, tighter fixed tracks and no minimum width,
     * so the table fits its frame instead of scrolling sideways in it.
     */
    compact: {
      type: Boolean,
      default: false,
    },
    /**
     * What an empty table says. An empty string draws nothing, for a call
     * site that fills the `add` slot and lets that speak instead.
     */
    emptyText: {
      type: String,
      default: "No NAV methods yet.",
    },
    deletable: {
      type: Boolean,
      default: false,
    },
    selectable: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    idx: {
      type: String,
      default: "",
    },
    search: {
      type: String,
      default: "",
    },
    fundAddress: {
      type: String,
      default: "",
    },
    // Only required if we want to simulate NAV
    baseDecimals: {
      type: Number,
      default: -1,
    },
    // Only required if we want to simulate NAV
    baseSymbol: {
      type: String,
      default: "",
    },
    fundChainId: {
      type: String as PropType<ChainId>,
      default: "",
    },
    // Only required if we want to simulate NAV
    safeAddress: {
      type: String,
      default: "",
    },
    // If fund was not created yet, it means it is non init. Used
    // only when simulating NAV.
    isFundNonInit: {
      type: Boolean,
      default: false,
    },
    // Whether to use V2 fund factory contract
    fundFactoryContractV2Used: {
      type: Boolean,
      default: false,
    },
    fundContractBaseTokenBalance: {
      type: Number,
      default: 0,
    },
    safeContractBaseTokenBalance: {
      type: Number,
      default: 0,
    },
    feeBalance: {
      type: Number,
      default: 0,
    },
  },
  // `simulating` reports the simulation running or done, for a page that
  // draws its own Simulate control and wants it to say which.
  emits: ["update:methods", "selectedChanged", "simulating"],
  setup() {
    const fundStore = useFundStore();
    const toastStore = useToastStore();
    const settingsStore = useSettingsStore();

    return {
      toastStore,
      fundStore,
      settingsStore,
      creatablePositionTypes: computed(() =>
        PositionTypes.filter(
          (positionType) => positionType.key !== PositionType.NFT,
        ),
      ),
      PositionType,
    };
  },
  data() {
    return {
      // The one expanded row's details hash. One at a time: the panel holds
      // an edit form, and two open forms would share the same navEntry.
      expanded: "" as string,
      selected: [] as string[],
      copiedHash: "" as string,
      copiedTimer: undefined as ReturnType<typeof setTimeout> | undefined,
      isNavSimulationLoading: false,
      form: ref(null),
      formIsValid: ref(false),
      originalNavEntry: ref<INAVMethod>({
        positionName: "",
        valuationSource: "",
        positionType: PositionType.Liquid,
        valuationType: ValuationType.DEXPair,
        details: {
          // Init as PositionType.Liquid & ValuationType.DEXPair
          liquid: [] as Record<string, any>[],
          illiquid: [],
          nft: [],
          composable: [],
        },
        detailsJson: "{}",
      }),
      navEntry: ref<INAVMethod>({
        positionName: "",
        valuationSource: "",
        positionType: PositionType.Liquid,
        valuationType: ValuationType.DEXPair,
        details: {
          // Init as PositionType.Liquid & ValuationType.DEXPair
          liquid: [] as Record<string, any>[],
          illiquid: [],
          nft: [],
          composable: [],
        },
        detailsJson: "{}",
      }),
      rules: [formRules.required],
      expandedPanels: ref([0]),
    };
  },
  computed: {
    showExpand(): boolean {
      return this.settingsStore.isManageMode;
    },
    /**
     * The grid the header, every method row and the summary rows share, so a
     * figure sits under its column head whichever switches are on.
     */
    gridColumns(): string {
      const columns: string[] = [];
      if (this.compact) {
        if (this.selectable) columns.push("32px");
        columns.push("minmax(0, 1fr)", "88px");
        if (this.showLastNavUpdateValue) columns.push("120px");
        if (this.showSimulatedNav) columns.push("120px");
        if (this.showExpand) columns.push("64px");
        if (this.deletable) columns.push("64px");
        return columns.join(" ");
      }
      if (this.selectable) columns.push("40px");
      columns.push("44px", "minmax(0, 1.6fr)", "120px", "minmax(0, 1.7fr)");
      if (this.showLastNavUpdateValue) columns.push("150px");
      if (this.showSimulatedNav) columns.push("150px");
      if (this.showExpand) columns.push("84px");
      if (this.deletable) columns.push("72px");
      return columns.join(" ");
    },
    /** How many leading tracks a summary label spans before the figures. */
    leadingSpan(): number {
      return (this.selectable ? 1 : 0) + (this.compact ? 2 : 4);
    },
    showTotalRow(): boolean {
      return (
        this.showSummaryRow &&
        (this.showLastNavUpdateValue || this.showSimulatedNav)
      );
    },
    totalLabel(): string {
      return this.showLastNavUpdateValue ? "Total NAV" : "Total simulated NAV";
    },
    parsedPositionTypeItems() {
      return this.creatablePositionTypes.map((positionType) => ({
        key: positionType.key,
        label: positionType.name,
      }));
    },
    parsedValuationTypeItems() {
      return this.valuationTypes.map((valuationType) => ({
        key: valuationType.key,
        label: valuationType.name,
      }));
    },
    valuationTypes() {
      return (
        PositionTypeToValuationTypesMap[this.navEntry?.positionType]?.map(
          (type) => ValuationTypesMap[type],
        ) || []
      );
    },
    defaultFields() {
      return (
        PositionTypeValuationTypeDefaultFieldsMap[this.navEntry.positionType][
          this.navEntry.valuationType || "undefined"
        ] || []
      );
    },
    usedMethodHashes(): string[] {
      return this.usedMethods.map(method => method.detailsHash || "");
    },
    formattedTotalSimulatedNAV() {
      // Summated NAV value of all methods & admin contract & safe contract & fees (fees are negative).

      const totalNAV =
        (this.totalNavMethodsSimulatedNAV || 0n) +
        (BigInt(this.fundContractBaseTokenBalance) || 0n) +
        (BigInt(this.safeContractBaseTokenBalance) || 0n) +
        (BigInt(this.feeBalance) || 0n);


      return this.fundStore.getFormattedBaseTokenValue(totalNAV, true, false, this.baseSymbol, this.baseDecimals);
    },
    formattedTotalLastNAV() {
      return this.fundStore.getFormattedBaseTokenValue(this.navParts?.totalNAV || 0n, true, false, this.baseSymbol, this.baseDecimals);
    },
    totalNavMethodsSimulatedNAV() {
      // Sum simulated NAV value of all methods.
      return this.methods.reduce(
        (totalValue: bigint, method: any) => {
        // Do not count deleted methods to total simulated NAV.
          const methodSimulatedNav = method.deleted ? 0n : (method.simulatedNav || 0n);
          return totalValue + methodSimulatedNav;
        },
        0n,
      )
    },
    formattedFundContractBaseTokenBalance() {
      return this.fundStore.getFormattedBaseTokenValue(BigInt(this.fundContractBaseTokenBalance), true, false, this.baseSymbol, this.baseDecimals);
    },
    formattedSafeContractBaseTokenBalance() {
      return this.fundStore.getFormattedBaseTokenValue(BigInt(this.safeContractBaseTokenBalance), true, false, this.baseSymbol, this.baseDecimals);
    },
    formattedFeeBalance() {
      return this.fundStore.getFormattedBaseTokenValue(BigInt(this.feeBalance), true, false, this.baseSymbol, this.baseDecimals);
    },
    simulatedNavErrorCount() {
      return this.methods?.filter((method: INAVMethod) => method.isSimulatedNavError)?.length || 0
    },
    /**
     * The methods as rows: flagged when the library already holds them, and
     * narrowed to the search when there is one. The search reads every
     * column a person can see, the way the old table's did.
     */
    visibleMethods(): INAVMethodRow[] {
      const query = (this.search || "").trim().toLowerCase();

      return this.methods
        .map((method) => ({
          ...method,
          isAlreadyUsed: this.isMethodAlreadyUsed(method.detailsHash),
        }))
        .filter((method) => {
          if (!query) return true;
          const haystack = [
            method.positionName,
            method.valuationSource,
            this.positionTypeName(method),
            method.valuationType,
            method.detailsHash,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        });
    },
    baseAssetRows(): {
      key: string;
      label: string;
      address?: string;
      last: string;
      simulated: string;
    }[] {
      const admin = {
        key: "admin",
        label: "Admin contract balance",
        address: this.fundAddress,
        last: this.formatLastValue(this.navParts?.baseAssetOIVBal),
        simulated: this.formattedFundContractBaseTokenBalance,
      };
      const safe = {
        key: "safe",
        label: "Safe contract balance",
        address: this.safeAddress,
        last: this.formatLastValue(this.navParts?.baseAssetSafeBal),
        simulated: this.formattedSafeContractBaseTokenBalance,
      };
      const fees = {
        key: "fees",
        label: "Accrued fees",
        last: this.formatLastValue(this.navParts?.feeBal),
        simulated: this.formattedFeeBalance,
      };

      if (this.showBaseTokenBalances) return [admin, safe, fees];
      if (this.showSafeContractBalance) return [safe];
      return [];
    },
  },
  watch: {
    "methods.length": {
      handler(newLen: any, oldLen: any) {
        // Simulate NAV method values everytime NAV methods change.
        if (!this.methods.length || oldLen === newLen) return;
        this.simulateNAV();
      },
      deep: true,
      immediate: true,
    },
    "fundStore.refreshSimulateNAVCounter": {
      handler() {
        // Simulate NAV method values everytime Simulate NAV button is pressed and triggerSimulateNav changes.
        this.simulateNAV();
      },
    },
  },
  beforeUnmount() {
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
  },
  methods: {
    rowKey(row: INAVMethod, index: number): string {
      return row.detailsHash || `row-${index}`;
    },
    positionTypeName(method: INAVMethod): string {
      const type = (method.displayPositionType || method.positionType) as PositionType;
      return getPositionType(type)?.name || "N/A";
    },
    formatLastValue(value?: bigint): string {
      if (!value) return "-";
      return this.fundStore.getFormattedBaseTokenValue(
        value,
        true,
        false,
        this.baseSymbol || undefined,
        this.baseDecimals > 0 ? this.baseDecimals : undefined,
      );
    },
    /**
     * A row still waiting on its first simulated value. The action writes
     * "N/A" before it calls the chain, so that placeholder counts as pending
     * while a simulation is in flight.
     */
    isSimulationPending(row: INAVMethod): boolean {
      if (!this.isNavSimulationLoading) return false;
      return row.simulatedNavFormatted == null || row.simulatedNavFormatted === "N/A";
    },
    isExpanded(row: INAVMethod): boolean {
      return !!row.detailsHash && this.expanded === row.detailsHash;
    },
    /**
     * Ensures only one row is expanded at a time. Opening a row also loads
     * it into the edit form, the way clicking a row always has.
     */
    toggleExpand(row: INAVMethodRow) {
      if (row.isAlreadyUsed || !row.detailsJson || !row.detailsHash) return;

      if (this.isExpanded(row)) {
        this.expanded = "";
        return;
      }
      if (!this.isBaseTokenBalanceMethod(row)) {
        this.setNavEntry(row);
      }
      this.expanded = row.detailsHash;
    },
    isSelected(row: INAVMethod): boolean {
      return !!row.detailsHash && this.selected.includes(row.detailsHash);
    },
    toggleSelect(row: INAVMethodRow) {
      if (!row.detailsHash || row.isAlreadyUsed) return;

      this.selected = this.isSelected(row)
        ? this.selected.filter((hash) => hash !== row.detailsHash)
        : [...this.selected, row.detailsHash];
      this.onSelectionChanged();
    },
    copyHash(hash: string | undefined) {
      if (!hash) return;
      navigator.clipboard.writeText(hash);

      this.copiedHash = hash;
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => {
        this.copiedHash = "";
      }, 1500);
    },
    onPositionTypeChange(positionType: string) {
      this.navEntry.positionType = positionType as PositionType;
      this.resetMethods(true);
    },
    onValuationTypeChange(valuationType: string) {
      this.navEntry.valuationType = valuationType as ValuationType;
      this.resetMethods();
    },
    async simulateNAV() {
      const fundChainId = this.fundChainId as ChainId;
      const fundAddress = this.fundAddress;
      if (
        !this.showSimulatedNav || this.isNavSimulationLoading || !fundChainId || !fundAddress
      ) {
        return;
      }
      this.isNavSimulationLoading = true;
      this.$emit("simulating", true);

      // Simulate all methods at once as many promises.
      const promises = [];

      for (const navEntry of this.methods) {
        promises.push(this.fundStore.fetchSimulatedNAVMethodValue(
          fundChainId,
          fundAddress,
          this.safeAddress,
          this.baseDecimals,
          this.baseSymbol,
          navEntry,
          this.isFundNonInit,
          this.fundFactoryContractV2Used,
        ));
      }
      await Promise.allSettled(promises);
      this.isNavSimulationLoading = false;
      this.$emit("simulating", false);
    },
    // only allow edit if the method is not rethink position and not one of the predefined positions
    isMethodEditable(navEntry: INAVMethod) {
      const isManageNavMethodsPage = this.idx === "nav/manage/index" || this.idx === "nav/onboarding";

      return isManageNavMethodsPage && !this.isBaseTokenBalanceMethod(navEntry);
    },
    isBaseTokenBalanceMethod(method: INAVMethod) {
      const positionName = ["Admin Contract Balance", "Safe Balance", "Fees Balance"];
      return positionName.includes(method.positionName) && method.valuationSource === "Rethink";
    },
    deleteMethod(method: INAVMethod, toggle = true, newNavEntry?: INAVMethod) {
      // If method is new, we can just remove it from the methods array.
      // If it is not new, we will mark it as deleted.
      const methods = [...this.methods]; // Create a shallow copy of the array
      for (let i = 0; i < methods.length; i++) {
        const m = methods[i];
        if (m.detailsHash === method.detailsHash) {
          if (m.isNew) {
            m.isNew = false;
            m.deleted = false;
            // Remove the new method from the array
            methods.splice(i, 1);
            // Adjust the index to account for the removed item
            i--;
          } else {
            methods[i].deleted = toggle ? !m.deleted : true;
          }
        }
      }

      if (newNavEntry) {
        this.$emit("update:methods", [...methods, newNavEntry]);
      } else {
        this.$emit("update:methods", methods);
      }
    },
    deleteEditMethod(index: number) {
      this.navEntry.details[this.navEntry.positionType].splice(index, 1);
    },
    addEditMethodDetails() {
      this.navEntry.details[this.navEntry.positionType].push(
        this.getNewMethodDetails(
          this.navEntry?.positionType,
          this.navEntry?.valuationType,
        ),
      );
    },
    resetMethods(isPositionTypeChange = false) {
      let valuationType = this.navEntry?.valuationType;

      if (isPositionTypeChange) {
        valuationType = this.defineValuationType(this.navEntry) as ValuationType;
      }

      if(valuationType === this.originalNavEntry?.valuationType){
        this.setNavEntry(this.originalNavEntry);
        return;
      }

      const tmpNavEntry = {
        positionName: this.navEntry?.positionName,
        valuationSource: this.navEntry?.valuationSource,
        positionType: this.navEntry?.positionType,
        valuationType,
        details: {},
        detailsJson: "{}",
      } as INAVMethod;
      for (const positionTypeKey of PositionTypeKeys) {
        tmpNavEntry.details[positionTypeKey] = [];
      }

      // Init empty details for the selected position type (liquid, illiquid, nft, composable).
      tmpNavEntry.details[this.navEntry.positionType].push(
        this.getNewMethodDetails(
          this.navEntry?.positionType,
          valuationType,
        ),
      );

      tmpNavEntry.detailsJson = formatJson(tmpNavEntry.details);

      this.navEntry = tmpNavEntry;
    },
    editMethod() {
      try {
        if (!this.formIsValid) {
          return this.toastStore.warningToast(
            "Some form fields are not valid.",
          );
        }

        const newNavEntry = JSON.parse(
          JSON.stringify(this.navEntry, stringifyBigInt),
          parseBigInt,
        );

        if (!this.hasChanged()) {
          return this.toastStore.warningToast("No changes detected.");
        }

        // Do not include the pastNAVUpdateEntryFundAddress in the details, as when we fetch entries
        // they don't include this data and details hash would be broken if we included it.
        newNavEntry.pastNAVUpdateEntryFundAddress = 0;

        // Set default fields that are required for each entry.
        // All methods details have this data.
        newNavEntry.details.isPastNAVUpdate = false;
        newNavEntry.details.pastNAVUpdateIndex = 0;
        newNavEntry.details.pastNAVUpdateEntryIndex = 0;
        newNavEntry.details.entryType =
          PositionTypeToNAVEntryTypeMap[this.navEntry.positionType];
        newNavEntry.details.valuationType = this.navEntry.valuationType;
        newNavEntry.details.description = JSON.stringify({
          positionName: this.navEntry.positionName,
          valuationSource: this.navEntry.valuationSource,
        });

        // TODO add additional check that all methods have the same pastNAVUpdateIndex
        // Iterate over all NAV entry methods.
        // In most cases methods will be only one method, only if the PositionType is Composable, there can be
        // more than 1 method, and we will create a new NAV entry for each of them, with the same position name...
        // - NFT (composable) can have more than 1 method, so take all methods in details.
        // - All other Position Types can only have 1 method, so take the first one (there should only be one).
        for (const method of newNavEntry.details[newNavEntry.positionType]) {
          // Set default data for each entry's method's position & valuation type.
          this.defaultFields.forEach((field) => {
            if (!(field.key in method)) {
              method[field.key] = field.value;
            }
          });

          if ("pastNAVUpdateIndex" in method) {
            newNavEntry.details.pastNAVUpdateIndex = method.pastNAVUpdateIndex;
          }

          if ("otcTxHashes" in method) {
            try {
              method.otcTxHashes =
                method.otcTxHashes
                  .split(",")
                  .map(
                    // Remove leading and trailing whitespace
                    (hash: any) => hash.trim(),
                  )
                  .filter(
                    // Remove empty strings;
                    (hash: any) => hash !== "",
                  ) || [];
            } catch (error: any) {
              return this.toastStore.errorToast(
                "Something went wrong parsing the comma-separated list of TX hashes.",
              );
            }
          }

          // Set other misc dynamic fields related to the current fund, specific for each position & valuation type.
          if (
            newNavEntry.positionType === PositionType.Liquid &&
            newNavEntry.valuationType === ValuationType.DEXPair
          ) {
            method.nonAssetTokenAddress = ""
          }

          // Remove unwanted properties that we don't need when submitting the proposal.
          delete method.isValid;
          delete method.valuationType;
        }

        // Mark entry as new, so that it will be green in the table.
        newNavEntry.isNew = true;
        delete newNavEntry.details.valuationType;
        delete newNavEntry.deleted;

        // JSONIFY method details:
        newNavEntry.detailsJson = formatJson(newNavEntry.details);
        newNavEntry.detailsHash = ethers.keccak256(
          ethers.toUtf8Bytes(newNavEntry.detailsJson),
        );


        if (this.hasChanged()) {
          // remove original method from the all methods
          this.deleteMethod(this.originalNavEntry, false, newNavEntry);
        }

        this.toastStore.addToast("Method added successfully.");
      } catch (error: any) {
        console.error("Error editing method: ", error);
        this.toastStore.errorToast("Error editing method.");
      }
    },
    setNavEntry(method: INAVMethod) {
      const valuationType = this.defineValuationType(method);

      // make deep copy of method to avoid changing the original method
      this.navEntry = JSON.parse(
        JSON.stringify(method, stringifyBigInt),
        parseBigInt,
      );
      this.navEntry.detailsJson = JSON.stringify(
        this.navEntry.details,
        null,
        2,
      );

      this.originalNavEntry = JSON.parse(
        JSON.stringify(method, stringifyBigInt),
        parseBigInt,
      );
      this.originalNavEntry.detailsJson = JSON.stringify(
        this.originalNavEntry.details,
        null,
        2,
      );

      // only set the valuation type if it's not undefined
      if (valuationType) {
        this.navEntry.valuationType = valuationType;
        this.originalNavEntry.valuationType = valuationType;
      }

    },
    hasChanged() {
      const editedNavDeepCopy = JSON.parse(JSON.stringify(this.navEntry,stringifyBigInt), parseBigInt);
      // delete isValid from details
      for (const method of editedNavDeepCopy.details[editedNavDeepCopy.positionType]) {
        delete method.isValid;
      }

      const originalNavStringify = JSON.stringify(this.originalNavEntry, stringifyBigInt);
      const editedNavStringify = JSON.stringify(editedNavDeepCopy, stringifyBigInt);

      return originalNavStringify !== editedNavStringify;
    },
    defineValuationType(method: INAVMethod) {
      // we need to figure out which valuation type is used based on some unique keys used in details
      // 1. Liquid
      //   1.1. DEXPair - it needs to have (details.liquid[0].tokenPair)
      //   1.2. Aggregator - it needs to have (details.liquid[0].aggregatorAddress && !details.liquid[0].tokenPair)
      // 2. Illiquid
      //   2.1. ERC-20
      //   2.2. ERC-721
      //   2.3. ERC-1155

      switch (method.positionType) {
        case PositionType.Liquid: {
          const tokenPair = method?.details?.liquid?.[0]?.tokenPair;
          const aggregatorAddress = method?.details?.liquid?.[0]?.aggregatorAddress;

          if (tokenPair) {
            return ValuationType.DEXPair;
          }
          if (aggregatorAddress) {
            return ValuationType.Aggregator;
          }
          return ValuationType.DEXPair;
        }
        case PositionType.Illiquid: {
          const nftType = method?.details?.illiquid[0]?.nftType;

          if (nftType === "ERC-721") {
            return ValuationType.ERC721;
          }
          if (nftType === "ERC-1155") {
            return ValuationType.ERC1155;
          }
          return ValuationType.ERC20;
        }
        default:
          return undefined;
      }
    },
    onSelectionChanged() {
      // Exclude already used.
      this.$emit("selectedChanged", this.selected.filter(detailsHash => !this.isMethodAlreadyUsed(detailsHash)))
    },
    isMethodAlreadyUsed(detailsHash?: string) {
      return this.usedMethodHashes.includes(detailsHash || "")
    },
    getNewMethodDetails(
      positionType: PositionType,
      valuationType: ValuationType | undefined,
    ) {
      const newDetails: Record<string, any> = {
        isValid: false,
      };
      const fields =
        PositionTypeValuationTypeFieldsMap[positionType][
          valuationType || "undefined"
        ] || [];

      fields.forEach((field: any) => {
        newDetails[field.key] = defaultInputTypeValue[field.type as InputType];
      });

      return newDetails;
    },
  },
})
</script>

<style lang="scss" scoped>
/**
 * Layout, per the design: a 40px mono column head, 13px rows on hairlines,
 * base-asset summary lines under the methods and an accent-tinted total to
 * close. `--nav-columns` is set from the script, since which tracks exist
 * depends on the switches; `--nav-pad-x` is the row inset, 20px inside the
 * table's own frame and 24px when a card supplies the frame instead.
 */
.nav_table {
  --nav-pad-x: 20px;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  overflow: hidden;

  &--frameless {
    --nav-pad-x: 24px;
    border: none;
    border-radius: 0;
  }

  &__placeholder {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem var(--nav-pad-x);
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
  }

  &__scroll {
    overflow-x: auto;
    @include customScrollbar(0);
  }

  /* Six columns of figures and names need this much before they crowd;
     below it the frame scrolls rather than wrapping a number. */
  &__inner {
    min-width: 860px;
  }

  &--wide &__inner {
    min-width: 960px;
  }

  /* Compact drops two columns and tightens the rest so the frame is the
     width it is given — its container is the narrow thing here. */
  &--compact &__inner {
    min-width: 0;
  }

  &__row {
    display: grid;
    grid-template-columns: var(--nav-columns);
    align-items: center;
    column-gap: 0.75rem;
    padding: 13px var(--nav-pad-x);
    border-bottom: 1px solid $color-line;

    &--head {
      height: 40px;
      padding-top: 0;
      padding-bottom: 0;
    }

    &--clickable {
      cursor: pointer;
      transition: background-color $default-transition-time ease;

      &:hover {
        background: $color-hover;
      }
    }

    &--open {
      background: $color-card-background;
    }

    /* Marked for removal on the next store; the line stays readable so the
       Undo beside it still has something to describe. */
    &--deleted {
      opacity: 0.5;
    }

    &--used {
      opacity: 0.45;
    }

    &--summary {
      padding-top: 12px;
      padding-bottom: 12px;
    }

    &--total {
      padding-top: 14px;
      padding-bottom: 14px;
      border-bottom: none;
      background: $color-accent-soft;
    }
  }

  /* The frame closes the table; a hairline right above it would read as a
     double rule. */
  &__inner > &__row:last-child,
  &__inner > &__empty:last-child,
  &__inner > &__add:last-child,
  &__group:last-child > &__row:last-child,
  &__group:last-child > &__panel:last-child {
    border-bottom: none;
  }

  &__th {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    white-space: nowrap;

    &--right {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.375rem;
      text-align: right;
    }
  }

  &__refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: none;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-white;
    }

    &--busy {
      color: $color-cyan;
      animation: nav_table_spin 1s linear infinite;
    }
  }

  &__cell {
    min-width: 0;

    &--end {
      justify-self: end;
    }
  }

  &__index {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;

    &--new {
      color: $color-yield;
    }
    &--deleted {
      color: $color-neg;
    }
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.3;
    color: $color-white;
  }

  &__name_text {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  &__row--deleted &__name_text {
    text-decoration: line-through;
  }

  &--compact &__name {
    flex-wrap: wrap;
    gap: 0.125rem 0.5rem;
  }

  /* The valuation source, on its own line under the name where compact
     has no column for it. */
  &__name_meta {
    flex-basis: 100%;
    min-width: 0;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.4;
    color: $color-steel-blue;
    overflow-wrap: anywhere;
  }

  /* Coloured by the global .position_type_<type> classes. */
  &__type {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  &__source {
    min-width: 0;
    font-size: 12.5px;
    line-height: 1.4;
    color: $color-steel-blue;
    overflow-wrap: anywhere;
  }

  &__figure {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
    font-family: $font-mono;
    font-size: 13px;
    text-align: right;
    color: $color-white;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;

    &--dim {
      color: $color-text-irrelevant;
    }
    &--error {
      color: $color-neg;
    }
  }

  &__warn {
    display: inline-flex;
    align-items: center;
    color: $color-warn;
    cursor: help;

    &--neg {
      color: $color-neg;
    }
  }

  &__tag {
    flex: none;
    padding: 0.125rem 0.375rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 9.5px;
    font-weight: 500;
    line-height: 1.4;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
    color: $color-steel-blue;

    &--new {
      border-color: $color-yield-line;
      color: $color-yield;
    }
    &--neg {
      border-color: $color-neg-line;
      color: $color-neg;
    }
  }

  /* Text rather than an icon, the way the design writes Delete: a word the
     row can be scanned for. */
  &__action {
    padding: 0;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.04em;
    white-space: nowrap;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-white;
    }
    &--danger:hover {
      color: $color-neg;
    }
    &--active {
      color: $color-cyan;
    }
    &:disabled {
      cursor: default;
      opacity: 0.5;
    }
  }

  &__check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 1px solid $color-line-3;
    border-radius: 3px;
    background: transparent;
    color: $color-cyan;
    cursor: pointer;
    transition: border-color $default-transition-time ease,
      background-color $default-transition-time ease;

    &:hover {
      border-color: $color-cyan-line;
    }
    &--on {
      border-color: $color-cyan;
      background: $color-cyan-tint;
    }
  }

  &__empty {
    padding: 40px var(--nav-pad-x);
    border-bottom: 1px solid $color-line;
    text-align: center;
    font-size: 13px;
    color: $color-steel-blue;
  }

  /* The `add` slot's cell: a row's inset, closed by the same hairline the
     rows use so the summary lines sit under it the way they sit under a
     method. */
  &__add {
    padding: 12px var(--nav-pad-x) 16px;
    border-bottom: 1px solid $color-line;

    &--hero {
      padding: 16px var(--nav-pad-x);
    }
  }

  &__summary_label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  /* The address behind the balance, letterspaced back to normal so a hash
     does not read as a heading. */
  &__summary_address {
    font-size: 11px;
    letter-spacing: 0;
    text-transform: none;
  }

  &__total_label {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__total_value {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
    font-family: $font-mono;
    font-size: 15px;
    font-weight: 500;
    text-align: right;
    color: $color-white;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;

    &--dim {
      font-size: 13px;
      color: $color-text-irrelevant;
    }
  }

  /* The opened row's details, indented past the index column so the form
     reads as belonging to the line above it. */
  &__panel {
    padding: 0.25rem var(--nav-pad-x) 1.25rem calc(var(--nav-pad-x) + 44px + 0.75rem);
    border-bottom: 1px solid $color-line;
    background: $color-card-background;

    /* No index column to indent past. */
    .nav_table--compact & {
      padding-left: var(--nav-pad-x);
    }

    &--deleted {
      opacity: 0.5;
    }
  }

  &__hash {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    max-width: 100%;
    margin: 0.5rem 0 1rem;
    padding: 0;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 11px;
    text-align: left;
    color: $color-steel-blue;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-white;
    }

    /* The form below no longer matches the hash: what is stored will be a
       new method under a new hash. */
    &--changed {
      color: $color-yield;
    }
  }

  &__hash_label {
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  &__hash_value {
    overflow-wrap: anywhere;
  }

  &__json {
    margin: 0.5rem 0 0;
    padding: 1rem 1.125rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-dark;
    font-family: $font-mono;
    font-size: 11.5px;
    line-height: 1.5;
    color: $color-cyan-soft;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

/**
 * The in-row edit form. Mono uppercase labels over the app's own fields, the
 * two-column rhythm the create flow's forms use, and a details block under a
 * section eyebrow.
 */
.nav_edit {
  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem 1.25rem;

    @include md {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    & + & {
      margin-top: 1rem;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    line-height: 1.4;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__star {
    margin-left: 0.25em;
    color: $color-cyan;
  }

  &__segmented--locked {
    pointer-events: none;
    opacity: 0.6;
  }

  &__section {
    margin: 1.5rem 0 0.75rem;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-white;
  }

  &__panels {
    :deep(.v-expansion-panel-title) {
      min-height: 0;
      padding: 0.75rem 1rem;
    }
    :deep(.v-expansion-panel-text__wrapper) {
      padding: 0 1rem 1rem;
    }
  }

  &__panel_title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__status {
    margin-left: auto;

    &--valid {
      color: $color-yield;
    }
    &--invalid {
      color: $color-warn;
    }
  }

  &__remove {
    display: inline-flex;
    padding: 0;
    border: none;
    background: none;
    color: $color-steel-blue;
    cursor: pointer;

    &:hover {
      color: $color-neg;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1.25rem;
  }

  &__ghost {
    padding: 9px 14px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-sans;
    font-size: 13px;
    font-weight: 600;
    color: $color-text-irrelevant;
    cursor: pointer;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover {
      color: $color-white;
      border-color: $color-line-3;
    }
  }
}

@keyframes nav_table_spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav_table__row--clickable,
  .nav_table__refresh,
  .nav_table__action,
  .nav_table__check,
  .nav_table__hash,
  .nav_edit__ghost {
    transition: none;
  }
  .nav_table__refresh--busy {
    animation: none;
  }
}
</style>
