<template>
  <div class="fund_details">
    <FundOverview :fund="fund" />

    <div class="main_card">
      <FundInfo :fund="fund" />
    </div>

    <div class="d-flex flex-column">
      <div class="main_card main_grid order-1 order-sm-0">
        <FundChart :fund="fund" />
        <FundCurrentCycle
          v-if="userDepositRequestExists || userRedemptionRequestExists"
          :fund="fund"
        />
        <FundSettlement
          v-else
          :fund="fund"
          :should-user-delegate="shouldUserDelegate"
        />
      </div>
    </div>
    <!-- Activity transactions (Fund Flows) -->
    <div class="main_card mt-4">
      <div class="d-flex justify-space-between align-center mb-4">
        <h3 class="mb-0">
          Activity (Fund Flows)
        </h3>
        <div class="d-flex align-center pagination_container">
          <v-btn
            size="small"
            variant="outlined"
            :disabled="page === 1 || isLoading"
            @click="prevPage"
          >
            Prev
          </v-btn>

          <template v-for="p in pagesToShow" :key="`p-${p}`">
            <v-btn
              v-if="typeof p === 'number'"
              size="small"
              :variant="p === page ? 'tonal' : 'text'"
              :disabled="isLoading || p === page"
              @click="goToPage(p as number)"
            >
              {{ p }}
            </v-btn>
            <span v-else class="mx-1">…</span>
          </template>

          <v-btn
            size="small"
            variant="outlined"
            :disabled="page >= totalPages || isLoading"
            @click="nextPage"
          >
            Next
          </v-btn>
        </div>
      </div>

      <v-progress-linear v-if="isLoading" indeterminate class="mb-2" />
      <div v-if="error" class="text-error mb-2">
        {{ error }}
      </div>

      <!-- TODO HIDE ACTIVITY FOR NOW-->
      <v-table v-if="false" density="compact">
        <thead>
          <tr>
            <th class="text-left">
              Timestamp
            </th>
            <th class="text-left">
              Transaction Address
            </th>
            <th class="text-left">
              Name
            </th>
            <th class="text-left">
              Amount
            </th>
            <th class="text-left">
              Account
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ formatTimestamp(row.timestamp) }}</td>
            <td>
              <AddressLink
                v-if="row.transaction?.id"
                :address="row.transaction.id"
                :chain-id="fund.chainId"
                truncate
              />
              <template v-else>
                N/A
              </template>
            </td>
            <td>
              <strong>{{ row.name }}</strong>
            </td>
            <td>{{ formatFlowAmount(row) }}</td>
            <td>
              <AddressLink
                v-if="row.caller?.id"
                :address="row.caller.id"
                :chain-id="fund.chainId"
              />
              <template v-else>
                N/A
              </template>
            </td>
          </tr>
          <tr v-if="!isLoading && rows.length === 0">
            <td colspan="5" class="text-center text-medium-emphasis">
              No activity yet
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
import type IFund from "~/types/fund";
import { fetchSubgraphFundFlows, type FundFlow } from "~/services/subgraph";
import { ChainId } from "~/types/enums/chain_id";
import {
  formatDateToLocaleString,
  formatTokenValue,
} from "~/composables/formatters";
import AddressLink from "~/components/common/AddressLink.vue";

const fundStore = useFundStore();
const {
  shouldUserDelegate,
  userDepositRequestExists,
  userRedemptionRequestExists,
} = storeToRefs(fundStore);

const fund = useAttrs().fund as IFund;

// Fund Flows state
const page = ref(1);
const pageSize = 10;
const isLoading = ref(false);
const error = ref("");
const rows = ref<FundFlow[]>([]);
const totalCount = ref(0);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalCount.value / pageSize)),
);
const pagesToShow = computed<(number | string)[]>(() => {
  const maxToShow = 7; // including ends and current neighbors
  const pages: (number | string)[] = [];
  const tp = totalPages.value;
  if (tp <= maxToShow) {
    for (let i = 1; i <= tp; i++) pages.push(i);
    return pages;
  }
  const cur = page.value;
  const add = (n: number | string) => pages.push(n);
  add(1);
  if (cur > 4) add("...");
  const start = Math.max(2, cur - 1);
  const end = Math.min(tp - 1, cur + 1);
  for (let i = start; i <= end; i++) add(i);
  if (cur < tp - 3) add("...");
  add(tp);
  return pages;
});

const loadFundFlows = async () => {
  error.value = "";
  if (!fund || !(fund as any)?.address || !(fund as any)?.chainId) return;
  const fundAddress = (fund as any).address as string;
  const chainId = (fund as any).chainId as ChainId;
  const skip = (page.value - 1) * pageSize;
  isLoading.value = true;
  try {
    const data = await fetchSubgraphFundFlows(chainId, {
      fundAddress,
      first: pageSize,
      skip,
    });
    console.log("FundFlows", data);
    rows.value = data.items;
    totalCount.value = data.totalCount || data.items.length;
  } catch (e: any) {
    console.error("Failed to load fund flows", e);
    error.value = e?.message || "Failed to load activity";
  } finally {
    isLoading.value = false;
  }
};

const nextPage = () => {
  if (page.value >= totalPages.value) return;
  page.value += 1;
};
const prevPage = () => {
  if (page.value === 1) return;
  page.value -= 1;
};

const goToPage = (p: number) => {
  if (p < 1 || p > totalPages.value) return;
  page.value = p;
};

watch(() => page.value, loadFundFlows);
watch(
  () => (fund as any)?.address,
  () => {
    page.value = 1;
    loadFundFlows();
  },
  { immediate: true },
);

// helpers
const formatTimestamp = (ts: string) => {
  if (!ts) return "-";
  const n = parseInt(ts, 10);
  if (Number.isNaN(n)) return ts;
  return formatDateToLocaleString(new Date(n * 1000));
};

const formatFlowAmount = (row: FundFlow) => {
  try {
    const name = (row?.name || "").toLowerCase();
    const amtStr = row?.amount;
    if (!amtStr) return "-";

    // Determine token based on flow kind
    let token = null as unknown as
      | IFund["baseToken"]
      | IFund["fundToken"]
      | null;
    if (name.includes("deposit")) {
      // Covers both "deposit" and "requestDeposit"
      token = (fund as IFund)?.baseToken || null;
    } else if (name.includes("redeem")) {
      // Covers both "redeem" and "requestRedeem"
      token = (fund as IFund)?.fundToken || null;
    }

    if (!token || typeof token.decimals !== "number") return amtStr;

    // Convert string to bigint safely
    let value: bigint;
    try {
      value = BigInt(amtStr);
    } catch {
      return amtStr;
    }

    const formatted = formatTokenValue(value, token.decimals, true, true);
    const symbol = token.symbol ? ` ${token.symbol}` : "";
    return `${formatted}${symbol}`;
  } catch (e) {
    return row?.amount || "-";
  }
};
</script>

<style scoped lang="scss">
.pagination_container {
  gap: 0.5rem;
}
</style>
