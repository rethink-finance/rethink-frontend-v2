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
    <template #[`header.pastNavValue`]>
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
      {{ value ?? 'N/A' }}
    </template>

    <template #[`item.valuationSource`]="{ value, item }">
      <Logo v-if="item.isRethinkPosition" small />
      <template v-else>
        {{ value ?? 'N/A' }}
      </template>
    </template>

    <template #[`item.positionType`]="{ value, item }">
      <UiPositionTypeBadge
        :value="value"
        :disabled="item.deleted || item.isAlreadyUsed"
      />
    </template>
    <template #[`item.pastNavValue`]="{ value, item }">
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
          {{ value ? getFormattedBaseTokenValue(value) : '-' }}
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
          {{ value ?? '-' }}
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
        :text="isBaseTokenBalanceMethod(item) ? 'Raw' : 'Details'"
        :active="isExpanded(internalItem)"
        :disabled="item.deleted || item.isAlreadyUsed"
        @click.stop="toggleExpand(internalItem)"
        @click.native="isBaseTokenBalanceMethod(item) ? null : setNavEntry(item)"
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
            <div v-if="!item.isRethinkPosition" :class="['detail_hash', {'has-changed': hasChanged()}]" @click="copyText(item.detailsHash)">
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

            <!-- form goes here -->
            <v-form
              v-if="!isBaseTokenBalanceMethod(item)"
              ref="form"
              v-model="formIsValid"
              :disabled="isMethodEditable(item) === false"
            >
              <v-row>
                <v-col cols="12" sm="6">
                  <v-label class="label_required mb-2">
                    Position Name
                  </v-label>
                  <v-text-field
                    v-model="navEntry.positionName"
                    placeholder="E.g. WETH"
                    :rules="rules"
                    required
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-label class="label_required mb-2">
                    Valuation Source
                  </v-label>
                  <v-text-field
                    v-model="navEntry.valuationSource"
                    placeholder="E.g. Uniswap ETH/USDC"
                    :rules="rules"
                    required
                  />
                </v-col>
              </v-row>

              <v-row>
                <v-col cols="12" sm="6">
                  <v-label class="mb-2">
                    Position Type
                  </v-label>
                  <div class="toggle_buttons">
                    <v-btn-toggle
                      v-model="navEntry.positionType"
                      group
                      mandatory
                      :disabled="isMethodEditable(item) === false"
                    >
                      <v-btn
                        v-for="positionType in creatablePositionTypes"
                        :key="positionType.key"
                        :value="positionType.key"
                        variant="outlined"
                        @click.native="resetMethods(true)"
                      >
                        {{ positionType.name }}
                      </v-btn>
                    </v-btn-toggle>
                  </div>
                </v-col>
                <v-col v-if="valuationTypes.length" cols="12" sm="6">
                  <v-label class="mb-2">
                    Valuation Type
                  </v-label>
                  <div class="toggle_buttons">
                    <v-btn-toggle
                      v-model="navEntry.valuationType"
                      group
                      mandatory
                      :disabled="isMethodEditable(item) === false"
                    >
                      <v-btn
                        v-for="valuationType in valuationTypes"
                        :key="valuationType.key"
                        :value="valuationType.key"
                        variant="outlined"
                        @click.native="resetMethods()"
                      >
                        {{ valuationType.name }}
                      </v-btn>
                    </v-btn-toggle>
                  </div>
                </v-col>
              </v-row>

              <v-row class="mt-10">
                <v-col>
                  <strong>Method Details</strong>
                </v-col>
              </v-row>

              <v-row>
                <template
                  v-if="navEntry.positionType === PositionType.Composable"
                >
                  <v-col>
                    <v-expansion-panels v-model="expandedPanels">
                      <v-expansion-panel
                        v-for="(method, index) in navEntry.details[
                          navEntry.positionType
                        ]"
                        :key="index"
                        eager
                      >
                        <v-expansion-panel-title static>
                          <div class="method_details_title">
                            <span>
                              <strong class="me-1">{{ index + 1 }})</strong>
                              METHOD DETAILS
                            </span>
                            <UiTextBadge
                              class="method_details_status"
                              :class="{
                                'method_details_status--valid': method.isValid,
                              }"
                            >
                              <template v-if="method.isValid">
                                Provided
                                <Icon
                                  icon="octicon:check-circle-16"
                                  height="1.2rem"
                                  width="1.2rem"
                                />
                              </template>
                              <template v-else>
                                Incomplete
                                <Icon
                                  icon="pajamas:error"
                                  height="1.2rem"
                                  width="1.2rem"
                                />
                              </template>
                            </UiTextBadge>

                            <UiDetailsButton
                              v-if="isMethodEditable(item)"
                              small
                              @click.stop="deleteEditMethod(index)"
                            >
                              <v-icon icon="mdi-delete" color="error" />
                            </UiDetailsButton>
                          </div>
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                          <FundNavMethodDetails
                            v-model="
                              navEntry.details[navEntry.positionType][index]
                            "
                            :position-type="navEntry.positionType"
                            :valuation-type="navEntry.valuationType"
                            :validate-on-mount="true"
                          />
                        </v-expansion-panel-text>
                      </v-expansion-panel>
                    </v-expansion-panels>
                  </v-col>
                </template>

                <template v-else>
                  <FundNavMethodDetails
                    v-model="navEntry.details[navEntry.positionType][0]"
                    :position-type="navEntry.positionType"
                    :valuation-type="navEntry.valuationType"
                  />
                </template>
              </v-row>

              <v-row v-if="navEntry.positionType === PositionType.Composable && isMethodEditable(item)">
                <v-col class="text-center">
                  <v-btn
                    class="text-secondary"
                    variant="outlined"
                    @click="addEditMethodDetails"
                  >
                    <template #append>
                      <Icon
                        icon="octicon:plus-circle-16"
                        height="1.2rem"
                        width="1.2rem"
                      />
                    </template>
                    Add Method Details
                  </v-btn>
                </v-col>
              </v-row>
              <v-row v-if="isMethodEditable(item)" class="mt-4">
                <v-col class="text-end">
                  <v-btn :disabled="!hasChanged()" @click="editMethod">
                    Edit Method
                  </v-btn>
                </v-col>
              </v-row>
            </v-form>

            <div v-else class="nav_entries__json">
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
import { ethers } from "ethers";
import { useRouter } from "vue-router";
import { useFundStore } from "~/store/fund/fund.store";
import { useFundsStore } from "~/store/funds/funds.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import {
  defaultInputTypeValue,
  InputType,
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
    const router = useRouter();

    const { getFormattedBaseTokenValue, selectedFundSlug } = toRefs(fundStore);
    return {
      router,
      fundStore,
      fundsStore,
      web3Store,
      toastStore,
      getFormattedBaseTokenValue,
      selectedFundSlug,
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
      expanded: [],
      selected: [],
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
      // creatablePositionTypes: PositionTypes.filter(
      //   (positionType) => positionType.key !== PositionType.NFT,
      // ),
      expandedPanels: ref([0]),
    };
  },
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
            key: "pastNavValue",
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
      // Summated NAV value of all methods & fund contract & safe contract & fees (fees are negative).
      const fund = this.fundStore.fund;

      const totalNAV =
        (this.totalNavMethodsSimulatedNAV || 0n) +
        (fund?.fundContractBaseTokenBalance || 0n) +
        (fund?.safeContractBaseTokenBalance || 0n) +
        (fund?.feeBalance || 0n);
      return this.getFormattedBaseTokenValue(totalNAV);
    },
    formattedTotalLastNAV() {
      return this.getFormattedBaseTokenValue(this.navParts?.totalNAV || 0n);
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
      return this.getFormattedBaseTokenValue(this.fundStore.fund?.fundContractBaseTokenBalance);
    },
    formattedSafeContractBaseTokenBalance() {
      return this.getFormattedBaseTokenValue(this.fundStore.fund?.safeContractBaseTokenBalance);
    },
    formattedFeeBalance() {
      return this.getFormattedBaseTokenValue(this.fundStore.fund?.feeBalance);
    },
    simulatedNavErrorCount() {
      return this.methods?.filter((method: INAVMethod) => method.isSimulatedNavError)?.length || 0
    },
    computedMethods() {
      const methods = [];

      if (this.showBaseTokenBalances) {
        methods.push({
          positionName: "OIV Balance",
          valuationSource: "Rethink",
          positionType: PositionType.Liquid,
          pastNavValue: this.navParts?.baseAssetOIVBal,
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
      if (!this.showSimulatedNav || this.isNavSimulationLoading) return;
      this.isNavSimulationLoading = true;
      console.log(`[${this.idx}] START SIMULATE:`, this.isNavSimulationLoading)
      /**
      if (!this.fundsStore.allNavMethods?.length) {
        const fundsInfoArrays = await this.fundsStore.fetchFundsInfoArrays();

        // To get pastNAVUpdateEntryFundAddress we have to search for it in the fundsStore.allNavMethods
        // and make sure it is fetched before checking here with fundsStore.fetchFundsNAVData, and then we
        // have to match by the detailsHash to extract the pastNAVUpdateEntryFundAddress
        console.log("simulate fetch all nav methods")
        await this.fundsStore.fetchFundsNAVData(fundsInfoArrays);
      }
      */
      // If useLastNavUpdateMethods props is true, take methods of the last NAV update.
      // Otherwise, take managed methods, that user can change.
      // Simulate all at once as many promises instead of one by one.
      const promises = [];
      const fundChainId = this.fundStore.fund?.chainId ?? "";
      const fundAddress = this.fundStore.fund?.address ?? "";

      for (const navEntry of this.methods) {
        promises.push(this.fundStore.fetchSimulatedNAVMethodValue(fundChainId, fundAddress, navEntry));
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
    // only alow edit if the method is not rethink position and not one of the predefined positions
    isMethodEditable(navEntry: INAVMethod) {
      const isManageNavMethodsPage = this.idx === "nav/manage/index";

      return isManageNavMethodsPage && !this.isBaseTokenBalanceMethod(navEntry);
    },
    isBaseTokenBalanceMethod(method: INAVMethod) {
      const positionName = ["OIV Balance", "Safe Balance", "Fees Balance"];
      return positionName.includes(method.positionName) && method.valuationSource === "Rethink";
    },
    deleteMethod(method: INAVMethod, toggle = true) {
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
      this.$emit("update:methods", methods);
    },
    deleteEditMethod(index: number) {
      console.log("remove0 method: ", index);
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

        if (this.hasChanged() === false) {
          return this.toastStore.warningToast("No changes detected.");
        }

        console.log("New Method: ", newNavEntry);

        // Do not include the pastNAVUpdateEntryFundAddress in the details, as when we fetch entries
        // they don't include this data and details hash would be broken if we included it.
        newNavEntry.pastNAVUpdateEntryFundAddress =
          this.fundStore.fund?.address;

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
            method.nonAssetTokenAddress =
              this.fundStore.fund?.baseToken?.address;
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

        // Add newly defined NAV entry to fund managed methods.
        this.fundStore.fundManagedNAVMethods.push(newNavEntry);
        // we need to delete the method from the navEntry


        if (this.hasChanged()) {
          // remove original method from the all methods
          this.deleteMethod(this.originalNavEntry, false);
        }

        // Redirect back to Manage methods page.
        this.router.push(`/details/${this.selectedFundSlug}/nav/manage`);
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

      // let valuationType;

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

      // let updated = false;
      fields.forEach((field: any) => {
        newDetails[field.key] = defaultInputTypeValue[field.type as InputType];
      });

      return newDetails;
    },
  },
})
</script>

<style lang="scss" scoped>
.nav_entries {
  @include borderGray;
  border-color: $color-bg-transparent;
  max-width: 1400px;
  overflow: auto;

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
    padding: 1rem 5rem;
    background-color: $color-badge-navy;
    max-width: 1400px;
    &:not(:last-of-type) {
      margin-bottom: 1.5rem;
    }
  }
  &__json{
    @include borderGray;
    background-color: $color-card-background;
    padding: 1.5rem;
    color: $color-primary;
    white-space: break-spaces;
    word-wrap: break-word;
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

  &.has-changed {
    color: $color-success;
  }
}

.item-simulated-nav {
  display: flex;
  justify-content: flex-end;

  &--error {
    color: $color-error;
  }
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
.method_details_title {
  display: flex;
  align-items: center;
  gap: 1rem;
  letter-spacing: 0.02625rem;
  font-weight: 500;
  color: $color-text-irrelevant;
}
.method_details_status {
  color: $color-warning;

  &--valid {
    color: $color-success;
  }
}
// toggle buttons
.toggle_buttons {
  .v-btn-toggle {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    height: 100%;

    .v-btn {
      opacity: 0.35;
      color: $color-text-irrelevant;
      border-radius: 4px !important;
      min-height: 48px;
      @include borderGray;
    }
    .v-btn--active {
      color: $color-white !important;
      opacity: 1;
    }
  }
}

.text-end{
  margin-bottom: 20px;
}
</style>
