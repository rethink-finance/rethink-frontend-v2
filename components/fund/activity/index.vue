<template>
  <div class="main_card mt-4">
    <div class="d-flex justify-space-between align-center mb-4">
      <h3 class="mb-0">
        Vault Activity
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
        <v-btn
          size="small"
          variant="outlined"
          :disabled="isLoading || !hasMore"
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

    <v-table density="compact">
      <thead>
        <tr>
          <th class="text-left">
            Account
          </th>
          <th class="text-left">
            Operation
          </th>
          <th class="text-left">
            Amount
          </th>
          <th class="text-left">
            Timestamp
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
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
          <td class="op-cell">
            <span :class="['op-dot', toneClass(row.name)]" />
            <strong>{{ operationLabel(row.name) }}</strong>
          </td>
          <td>{{ formatFlowAmount(row) }}</td>
          <td>
            <template v-if="row.transaction?.id">
              <AddressLink
                :address="row.transaction.id"
                :chain-id="fund.chainId"
              >
                <span class="ts-link">
                  {{ formatTimestamp(row.timestamp) }}
                  <v-icon
                    icon="mdi-open-in-new"
                    size="16"
                    class="ts-link__icon"
                  />
                </span>
              </AddressLink>
            </template>
            <template v-else>
              {{ formatTimestamp(row.timestamp) }}
            </template>
          </td>
        </tr>
        <tr v-if="!isLoading && rows.length === 0">
          <td colspan="4" class="text-center text-medium-emphasis">
            No activity yet
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import { ChainId } from "~/types/enums/chain_id";
import { fetchSubgraphFundFlows, type FundFlow } from "~/services/subgraph";
import {
  formatDateToLocaleString,
  formatTokenValue,
} from "~/composables/formatters";
import AddressLink from "~/components/common/AddressLink.vue";

const props = defineProps<{ fund: IFund }>();

// pagination & data state
const page = ref(1);
const pageSize = 10;
const isLoading = ref(false);
const error = ref("");
const rows = ref<FundFlow[]>([]);
const hasMore = ref(false);

const loadFundFlows = async () => {
  error.value = "";
  const fund = props.fund as any;
  if (!fund || !fund?.address || !fund?.chainId) return;
  const fundAddress = fund.address as string;
  const chainId = fund.chainId as ChainId;
  const skip = (page.value - 1) * pageSize;
  isLoading.value = true;
  try {
    const data = await fetchSubgraphFundFlows(chainId, {
      fundAddress,
      first: pageSize,
      skip,
    });
    rows.value = data.items;
    // We don't rely on totalCount; determine if there's another page
    hasMore.value = Array.isArray(data.items) && data.items.length === pageSize;
  } catch (e: any) {
    console.error("Failed to load fund flows", e);
    error.value = e?.message || "Failed to load activity";
  } finally {
    isLoading.value = false;
  }
};

const nextPage = () => {
  if (!hasMore.value) return;
  page.value += 1;
};
const prevPage = () => {
  if (page.value === 1) return;
  page.value -= 1;
};

watch(() => page.value, loadFundFlows);
watch(
  () => (props.fund as any)?.address,
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

    let token = null as unknown as
      | IFund["baseToken"]
      | IFund["fundToken"]
      | null;
    if (name.includes("deposit")) {
      token = (props.fund as IFund)?.baseToken || null;
    } else if (name.includes("withdraw")) {
      token = (props.fund as IFund)?.baseToken || null;
    }

    if (!token || typeof token.decimals !== "number") return amtStr;

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

// Map raw function selectors/signatures to user-friendly labels
const operationLabel = (raw?: string) => {
  if (!raw) return "Unknown";
  const s = String(raw).trim();
  const base = s.split("(")[0];
  const baseLower = base.toLowerCase();

  // Known mappings
  switch (baseLower) {
    case "deposit":
      return "Deposit";
    case "requestdeposit":
      return "Request Deposit";
    case "withdraw":
      return "Withdraw";
    case "requestwithdraw":
      return "Request Withdraw";
    case "sweeptokens":
      return "Sweep Tokens";
    case "collectfees":
      return "Collect Fees";
    case "depositanddelegatebysig":
      return "Deposit + Delegate (by Sig)";
    case "mintperformancefee":
      return "Mint Performance Fee";
    case "minttomany":
      return "Mint To Many";
    case "mintpoolperformancefeehwm":
      return "Mint Pool Performance Fee (HWM)";
    // Note: source has typo "Withrawal"; map it to a friendly spelling
    case "revokedepositwithrawal":
    case "revokedepositwithdrawal":
      return "Revoke Deposit Withdrawal";
  }

  // If it's a 4-byte selector like 0x12345678
  if (/^0x[0-9a-fA-F]{8}$/.test(s)) {
    return `Unknown (${s})`;
  }

  // Fallback: format the base name into Title Case (handle camelCase)
  const spaced = base
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  const titled = spaced
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return titled || s;
};

// Decide tone class for the colored dot
const toneClass = (raw?: string) => {
  if (!raw) return "tone-neutral";
  const s = String(raw).trim();
  const base = s.split("(")[0].toLowerCase();
  switch (base) {
    case "deposit":
      return "tone-green";
    case "requestdeposit":
      return "tone-light-green";
    case "withdraw":
      return "tone-red";
    case "requestwithdraw":
      return "tone-light-red";
    default:
      return "tone-neutral";
  }
};
</script>

<style scoped lang="scss">
.pagination_container {
  gap: 0.5rem;
}

/* Operation cell with colored dot */
.op-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.op-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  /* Subtle definition so pastels are visible on light backgrounds */
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}

/* Slightly stronger (less pastel) tones */
/* Greens */
.tone-light-green {
  background-color: #a5d6a7; /* Green 200 */
}
.tone-green {
  background-color: #5dbb62; /* Green 300 */
}
/* Reds */
.tone-light-red {
  background-color: #ef9a9a; /* Red 200 */
}
.tone-red {
  background-color: #de6666; /* Red 300 */
}
/* Neutral */
.tone-neutral {
  background-color: #b0bec5; /* Blue Grey 300 */
}

/* Timestamp link with icon */
.ts-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.ts-link__icon {
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.ts-link:hover .ts-link__icon {
  opacity: 0.9;
}
</style>
