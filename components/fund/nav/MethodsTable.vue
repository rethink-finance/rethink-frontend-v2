<template>
  <v-skeleton-loader v-if="loading" type="table" />
  <v-data-table
    v-else-if="computedMethods.length"
    v-model="selected"
    v-model:expanded="expanded"
    :headers="headers"
    :items="computedMethods"
    :cell-props="methodProps"
    class="main_table nav_entries"
    show-expand
    :search="search"
    expand-on-click
    item-value="detailsHash"
    :show-select="selectable"
    items-per-page="-1"
    @input="onSelectionChanged"
  >

    <!-- template for header simulated  -->
    <template #[`header.pastNavValueFormatted`]>
      Last NAV Update
      <div v-if="showSummaryRow && showLastNavUpdateValue" class="text-right">
        {{ formattedTotalLastNAV }}
      </div>
    </template>
    <template #[`header.simulatedNavFormatted`]>
      <th>
        <div class="d-flex">
          Simulated NAV
          <FundNavSimulateButton class="ms-1" />
        </div>
        <div v-if="showSummaryRow && showSimulatedNav" class="bottom">
          <div class="text-right">
            {{ formattedTotalSimulatedNAV }}
            <div
              v-if="simulatedNavErrorCount > 0"
              class="ms-2 justify-center align-center d-flex"
            >
              <Icon
                icon="octicon:question-16"
                width="1rem"
                font-bold
                color="var(--color-danger)"
              />
              <v-tooltip activator="parent" location="bottom">
                Total value may not include all simulated NAV method values.<br>
                Retry simulating NAV.
              </v-tooltip>
            </div>
          </div>
        </div>
      </th>
    </template>
    <template #[`item.index`]="{ index }">
      <strong class="td_index">{{ index + 1 }}</strong>
    </template>

    <template #[`item.positionName`]="{ value }">
      {{ value ?? "N/A" }}
    </template>

    <template #[`item.valuationSource`]="{ value, item }">
      <Logo v-if="item.isRethinkPosition" small />
      <template v-else>
        {{ value ?? "N/A" }}
      </template>
    </template>

    <template #[`item.positionType`]="{ value, item }">
      <UiPositionTypeBadge
        :value="value"
        :disabled="item.deleted || item.isAlreadyUsed"
      />
    </template>
    <template #[`item.pastNavValueFormatted`]="{ value, item }">
      <div :class="`item-simulated-nav ${item.pastNavValueError ? 'item-simulated-nav--error' : ''}`">
        <div v-if="item.pastNavValueLoading">
          <v-progress-circular
            indeterminate
            color="gray"
            size="16"
            width="2"
          />
        </div>
        <div v-else>
          {{ value ?? "-" }}
        </div>
        <div
          v-if="item.pastNavValueError"
          class="ms-2 justify-center align-center d-flex"
        >
          <Icon icon="octicon:question-16" width="1rem" />
          <v-tooltip activator="parent" location="right">
            Something went wrong while getting the last NAV value.
          </v-tooltip>
        </div>
      </div>
    </template>

    <template #[`item.simulatedNavFormatted`]="{ value, item }">
      <div :class="`item-simulated-nav ${item.isSimulatedNavError ? 'item-simulated-nav--error' : ''}`">
        <div v-if="item.isNavSimulationLoading">
          <v-progress-circular
            indeterminate
            color="gray"
            size="16"
            width="2"
          />
        </div>
        <div v-else>
          {{ value ?? "-" }}
        </div>
        <div
          v-if="item.pastNAVUpdateEntryFundAddress || item.isSimulatedNavError"
          class="ms-2 justify-center align-center d-flex"
        >
          <v-tooltip activator="parent" location="right">
            <template v-if="item.isSimulatedNavError">
              Something went wrong while simulating NAV value. Retry simulating NAV.
            </template>
            <template v-else>
              pastNAVUpdateEntryFundAddress: <br> <strong>{{ item.pastNAVUpdateEntryFundAddress }}</strong>
            </template>
          </v-tooltip>
        </div>
      </div>
    </template>

    <template #[`item.data-table-expand`]="{ item, internalItem, isExpanded, toggleExpand }">
      <UiDetailsButton
        v-if="item.detailsJson"
        text="Raw"
        :active="isExpanded(internalItem)"
        :disabled="item.deleted || item.isAlreadyUsed"
        @click.stop="toggleExpand(internalItem)"
      />
    </template>

    <template #[`item.data-table-select`]="{ item, internalItem, isSelected, toggleSelect }">
      <div v-if="item.isAlreadyUsed">
        <UiTextBadge value="In Use" :disabled="item.isAlreadyUsed" />
      </div>
      <v-checkbox-btn
        v-else
        :model-value="isSelected(internalItem)"
        @click.stop="toggleSelect(internalItem)"
      />
    </template>

    <template #[`item.delete`]="{ item }">
      <!-- Rethink Position such as fund, safe, fees cannot be deleted -->
      <UiDetailsButton
        v-if="!item.isRethinkPosition"
        small
        @click.stop="deleteMethod(item)"
      >
        <v-tooltip v-if="item.deleted" activator="parent" location="bottom">
          <template #default>
            Undo Delete
          </template>
          <template #activator="{ props }">
            <v-icon
              icon="mdi-arrow-u-left-top"
              color="secondary"
              v-bind="props"
            />
          </template>
        </v-tooltip>

        <v-tooltip v-else activator="parent" location="bottom">
          <template #default>
            Delete NAV Method
          </template>
          <template #activator="{ props }">
            <v-icon
              icon="mdi-delete-outline"
              color="error"
              v-bind="props"
            />
          </template>
        </v-tooltip>
      </UiDetailsButton>
    </template>

    <template #expanded-row="{ columns, item }">
      <tr v-if="item.detailsJson" class="tr_row_expanded" :class="{'tr_delete_method': item.deleted }">
        <td :colspan="columns.length" class="pa-0">
          <div class="nav_entries__details">
            <div v-if="!item.isRethinkPosition" class="detail_hash" @click="copyText(item.detailsHash)">
              <ui-tooltip-click>
                Details Hash: {{ item.detailsHash }}
                <Icon
                  icon="clarity:copy-line"
                  class="section-top__copy-icon"
                  width="0.8rem"
                />

                <template #tooltip>
                  Copied!
                </template>
              </ui-tooltip-click>
            </div>
            <div class="nav_entries__json">
              {{ item.detailsJson }}
            </div>
          </div>
        </td>
      </tr>
    </template>

    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>
  <div v-else class="nav_entries__no_data">
    No NAV details available.
  </div>
</template>

<script lang="ts">
import { useFundStore } from "~/store/fund.store";
import { useFundsStore } from "~/store/funds.store";
import { useToastStore } from "~/store/toast.store";
import { useWeb3Store } from "~/store/web3.store";
import { PositionType } from "~/types/enums/position_type";
import type { INAVParts } from "~/types/fund";
import type INAVMethod from "~/types/nav_method";


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
  },
  emits: ["update:methods", "selectedChanged"],
  setup() {
    const fundStore = useFundStore();
    const fundsStore = useFundsStore();
    const web3Store = useWeb3Store();
    const toastStore = useToastStore();
    const { formatBaseTokenValue } = toRefs(fundStore);
    return { fundStore, fundsStore, web3Store, toastStore, formatBaseTokenValue }
  },
  data: () => ({
    expanded: [],
    selected: [],
    isNavSimulationLoading: false,
  }),
  computed: {
    headers() {
      // Check:
      // https://vuetifyjs.com/en/api/v-data-table/#props-header-props
      const headers: any[] = [
        { title: "#", key: "index", sortable: false },
        { title: "Position Name", key: "positionName", sortable: false },
        { title: "Valuation Source", key: "valuationSource", sortable: false },
        { title: "Position Type", key: "positionType", sortable: false },
      ];
      // Simulated NAV value.
      if (this.showLastNavUpdateValue) {
        headers.push(
          {
            title: "Last NAV Update Value",
            key: "pastNavValueFormatted",
            align: "end",
            sortable: false,
            width: "160px",
          },
        )
      }
      if (this.showSimulatedNav) {
        headers.push(
          {
            title: "Simulated NAV",
            key: "simulatedNavFormatted",
            align: "end",
            sortable: false,
            width: "160px",
          },
        )
      }

      // Expand details button
      headers.push({ key: "data-table-expand", sortable: false, align: "center" });
      if (this.deletable) {
        headers.push({ key: "delete", sortable: false, align: "center", width: "40px" })
      }
      if (this.selectable) {
        headers.push({ key: "data-table-select", sortable: false, align: "center", width: "40px" })
      }

      return headers;
    },
    usedMethodHashes(): string[] {
      return this.usedMethods.map(method => method.detailsHash || "");
    },
    formattedTotalSimulatedNAV() {
      // Summated NAV value of all methods & fund contract & safe contract & fees (fees are negative).
      const fund = this.fundStore.fund;

      const totalNAV =
        (this.totalNavMethodsSimulatedNAV || 0n) +
        (fund?.fundContractBaseTokenBalance || 0n) +
        (fund?.safeContractBaseTokenBalance || 0n) +
        (fund?.feeBalance || 0n);
      return this.formatBaseTokenValue(totalNAV);
    },
    formattedTotalLastNAV() {
      return this.formatBaseTokenValue(this.navParts?.totalNAV || 0n);
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
      return this.formatBaseTokenValue(this.fundStore.fund?.fundContractBaseTokenBalance);
    },
    formattedSafeContractBaseTokenBalance() {
      return this.formatBaseTokenValue(this.fundStore.fund?.safeContractBaseTokenBalance);
    },
    formattedFeeBalance() {
      return this.formatBaseTokenValue(this.fundStore.fund?.feeBalance);
    },
    simulatedNavErrorCount() {
      return this.methods?.filter((method: INAVMethod) => method.isSimulatedNavError)?.length || 0
    },
    computedMethods() {
      const methods = [];

      if (this.showBaseTokenBalances) {
        methods.push({
          positionName: "Fund Balance",
          valuationSource: "Rethink",
          positionType: PositionType.Liquid,
          pastNavValue: this.navParts?.baseAssetOIVBal,
          pastNavValueFormatted: this.formatBaseTokenValue(this.navParts?.baseAssetOIVBal),
          simulatedNavFormatted: this.formattedFundContractBaseTokenBalance,
          isRethinkPosition: true,
          detailsHash: "-1",
          detailsJson: {
            "fundContractAddress": this.fundStore.fund?.address,
          },
        } as any)
        methods.push({
          positionName: "Safe Balance",
          valuationSource: "Rethink",
          positionType: PositionType.Liquid,
          pastNavValue: this.navParts?.baseAssetSafeBal,
          pastNavValueFormatted: this.formatBaseTokenValue(this.navParts?.baseAssetSafeBal),
          simulatedNavFormatted: this.formattedSafeContractBaseTokenBalance,
          isRethinkPosition: true,
          detailsHash: "-2",
          detailsJson: {
            "safeContractAddress": this.fundStore.fund?.safeAddress,
          },
        } as any)
        methods.push({
          positionName: "Fees Balance",
          valuationSource: "Rethink",
          positionType: PositionType.Liquid,
          pastNavValue: this.navParts?.feeBal,
          pastNavValueFormatted: this.formatBaseTokenValue(this.navParts?.feeBal),
          simulatedNavFormatted: this.formattedFeeBalance,
          isRethinkPosition: true,
          detailsHash: "-3",
        } as any)
      }
      return [
        ...methods,
        ...this.methods.map(method => ({
          ...method,
          isAlreadyUsed: this.isMethodAlreadyUsed(method.detailsHash),
        })),
      ];
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
        console.log("fundStore.refreshSimulateNAVCounter:")
        this.simulateNAV();
      },
    },
  },
  methods: {
    copyText(text: string | undefined) {
      const data = text as string;
      navigator.clipboard.writeText(data);
    },
    async simulateNAV() {
      if (!this.showSimulatedNav || !this.web3Store.web3 || this.isNavSimulationLoading) return;
      this.isNavSimulationLoading = true;
      console.log(`[${this.idx}] START SIMULATE:`, this.isNavSimulationLoading)
      if (!this.fundsStore.allNavMethods?.length) {
        const fundsInfoArrays = await this.fundsStore.fetchFundsInfoArrays();

        // To get pastNAVUpdateEntryFundAddress we have to search for it in the fundsStore.allNavMethods
        // and make sure it is fetched before checking here with fundsStore.fetchAllNavMethods, and then we
        // have to match by the detailsHash to extract the pastNAVUpdateEntryFundAddress
        console.log("simulate fetch all nav methods")
        await this.fundsStore.fetchAllNavMethods(fundsInfoArrays);
      }

      // If useLastNavUpdateMethods props is true, take methods of the last NAV update.
      // Otherwise, take managed methods, that user can change.
      // Simulate all at once as many promises instead of one by one.
      const promises = [];

      for (const navEntry of this.methods) {
        promises.push(this.fundStore.simulateNAVMethodValue(navEntry));
      }
      const settled = await Promise.allSettled(promises);
      this.isNavSimulationLoading = false;
      console.log("SIMULATE DONE:", this.isNavSimulationLoading, settled)
    },
    simulatedNAVIconColor(method: INAVMethod) {
      if (!method.foundMatchingPastNAVUpdateEntryFundAddress) {
        return "var(--color-warning)";
      }

      return "";
    },
    deleteMethod(method: INAVMethod) {
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
            methods[i] = { ...m, deleted: !m.deleted }; // Toggle the deleted property
          }
        }
      }
      this.$emit("update:methods", methods);
    },
    methodProps(internalItem: any) {
      const props = {
        class: "",
      };
      // Parameter internalItem comes from vuetify data table.
      // And item is an actual INAVMethod.
      if (internalItem.item.deleted) {
        props.class +=  " tr_delete_method";
      } else if (internalItem.item.isNew) {
        props.class +=  " tr_is_new_method";
      }
      if (this.isMethodAlreadyUsed(internalItem.item?.detailsHash)) {
        props.class +=  " tr_method_already_used";
      }
      return props;
    },
    onSelectionChanged() {
      // Exclude already used.
      this.$emit("selectedChanged", this.selected.filter(detailsHash => !this.isMethodAlreadyUsed(detailsHash)))
    },
    isMethodAlreadyUsed(detailsHash?: string) {
      return this.usedMethodHashes.includes(detailsHash || "")
    },
  },
})
</script>

<style lang="scss" scoped>
.nav_entries {
  @include borderGray;
  border-color: $color-bg-transparent;

  :deep(.v-table__wrapper) {
    @include customScrollbar;
  }

  :deep(.v-data-table__tr) {
    height: 72px;
  }
  :deep(.v-data-table__td) {
    border-color: $color-bg-transparent !important;
  }

  &__summary_row {
    background: $color-badge-navy;
  }
  &__details {
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: $text-sm;
    padding: 1rem 5rem;
    background-color: $color-badge-navy;
    &:not(:last-of-type) {
      margin-bottom: 1.5rem;
    }
  }
  &__json{
    @include borderGray;
    background-color: $color-card-background;
    padding: 1.5rem;
    color: $color-primary;
  }
  &__no_data {
    text-align: center;
    padding: 1.5rem;
    background: $color-badge-navy;
  }
  :deep(.tr_method_already_used) {
    color: $color-disabled;
  }
  :deep(.tr_is_new_method) {
    .td_index {
      color: $color-success;
    }
  }
  :deep(.tr_delete_method) {
    color: $color-disabled;

    .nav_entries__json{
      color: $color-disabled;
    }
    .td_index {
      color: $color-error;
    }
  }
}

.detail_hash{
  cursor: pointer;
  margin-bottom: 30px;
}

.item-simulated-nav {
  display: flex;
  justify-content: flex-end;

  &--error {
    color: $color-error;
  }
}
</style>
