<template>
  <div class="basics">
    <section class="basics__section">
      <h2 class="basics__section_title">
        Setup
      </h2>

      <div class="basics__grid">
        <div class="basics__cell basics__cell--6">
          <div class="basics__label_row">
            <span class="basics__label">Chain<span class="basics__star">*</span></span>
            <OnboardingFieldChip :tag="FieldTag.Fixed" />
          </div>
          <OnboardingSelectMenu
            :model-value="chainId"
            :options="chainOptions"
            :disabled="isDisabled"
            placeholder="Select a chain"
            @update:model-value="(value: any) => emit('update:chainId', value)"
          >
            <template #trigger="{ option }">
              <IconChain v-if="option" :chain-id="(option.value as ChainId)" :size="20" />
              <span>{{ option?.label ?? "Select a chain" }}</span>
            </template>
            <template #option="{ option }">
              <IconChain :chain-id="(option.value as ChainId)" :size="20" />
              <span class="basics__option_label">{{ option.label }}</span>
            </template>
          </OnboardingSelectMenu>
          <p class="basics__helper">
            To request a new chain please send an email to
            <a class="basics__link" href="mailto:admin@rethink.finance">admin@rethink.finance</a>.
          </p>
        </div>

        <div class="basics__cell basics__cell--6">
          <div class="basics__label_row">
            <span class="basics__label">
              {{ baseTokenField?.label }}<span class="basics__star">*</span>
            </span>
            <OnboardingFieldChip :tag="FieldTag.Fixed" />
          </div>
          <OnboardingSelectMenu
            v-model="assetChoice"
            :options="assetOptions"
            :disabled="isDisabled"
            placeholder="Select an asset"
          >
            <template #trigger="{ option }">
              <IconBaseAsset
                v-if="option && option.value !== CUSTOM_ASSET"
                :chain-id="chainId"
                :token-address="String(option.value)"
                :size="20"
              />
              <span>{{ option?.label ?? "Select an asset" }}</span>
            </template>
            <template #option="{ option }">
              <IconBaseAsset
                v-if="option.value !== CUSTOM_ASSET"
                :chain-id="chainId"
                :token-address="String(option.value)"
                :size="20"
              />
              <span class="basics__option_label">{{ option.label }}</span>
              <span class="basics__option_meta">{{ option.meta }}</span>
            </template>
          </OnboardingSelectMenu>
          <p class="basics__reserved" />
        </div>

        <!-- Only a custom asset needs its address typed out; a listed one is
             already identified by the row the curator picked. -->
        <div v-if="isCustomAsset" class="basics__cell basics__cell--12 basics__asset_row">
          <OnboardingFieldControl
            v-if="baseTokenField"
            v-model="baseTokenField.value"
            :field="baseTokenField"
            :disabled="isDisabled"
            :error-message="baseTokenError"
          />
          <div class="basics__readonly">
            <span class="basics__label">Symbol</span>
            <div class="basics__readonly_box">
              {{ baseTokenSymbol }}
            </div>
          </div>
          <div class="basics__readonly">
            <span class="basics__label">Decimals</span>
            <div class="basics__readonly_box">
              {{ baseTokenDecimals }}
            </div>
          </div>
        </div>

        <div
          v-for="field in setupFields"
          :key="field.key"
          class="basics__cell"
          :class="`basics__cell--${field.cols ?? 12}`"
        >
          <OnboardingFieldControl
            v-model="field.value"
            :field="field"
            :disabled="isDisabled"
          />
        </div>
      </div>
    </section>

    <hr class="basics__rule">

    <section class="basics__section">
      <h2 class="basics__section_title">
        Vault profile
      </h2>

      <div class="basics__grid">
        <div class="basics__cell basics__cell--12">
          <OnboardingImageUpload
            v-if="photoField"
            v-model="photoField.value"
            :field="photoField"
            :disabled="isDisabled"
          />
        </div>

        <div
          v-for="field in profileFields"
          :key="field.key"
          class="basics__cell"
          :class="`basics__cell--${field.cols ?? 12}`"
        >
          <OnboardingPeriodControl
            v-if="field.type === InputType.Period"
            v-model="field.value"
            :field="field"
            :chain-id="chainId"
            :disabled="isDisabled"
            wide
          />
          <OnboardingFieldControl
            v-else
            v-model="field.value"
            :field="field"
            :disabled="isDisabled"
          />
        </div>

        <div
          v-for="field in customFields"
          :key="field.key"
          class="basics__cell basics__cell--6"
        >
          <OnboardingFieldControl
            v-model="field.value"
            :field="field"
            :disabled="isDisabled"
          />
          <button
            v-if="!isDisabled"
            type="button"
            class="basics__remove"
            @click="emit('deleteRow', field)"
          >
            Remove
          </button>
        </div>

        <div v-if="!isDisabled" class="basics__cell basics__cell--12 basics__add">
          <OnboardingAddNewField @add-custom-field="(e: IField) => emit('addCustomField', e)" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import debounce from "lodash.debounce";
import { fetchBaseTokenDetails } from "~/store/create-fund/actions/fetchFundInitCache.action";
import { networks, getTokenSymbolByAddress } from "~/store/web3/networksMap";
import { ChainId } from "~/types/enums/chain_id";
import { InputType, type IField } from "~/types/enums/input_type";
import { FieldTag, OnboardingBaseAssets } from "~/types/enums/stepper_onboarding";

/**
 * Step one: the chain and the asset the vault is denominated in, then how the
 * vault presents itself. These used to be two steps; they are one decision —
 * the chain is what the asset list, the draft and the deployed contracts all
 * hang off, and nothing on the second half means anything without it.
 */
const props = defineProps({
  fields: {
    type: Array as PropType<IField[]>,
    default: () => [],
  },
  chainId: {
    type: String as PropType<ChainId>,
    default: "",
  },
  isDisabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:chainId", "deleteRow", "addCustomField"]);

const CUSTOM_ASSET = "custom";

const baseTokenSymbol = ref("—");
const baseTokenDecimals = ref("—");
const baseTokenError = ref("");

const fieldByKey = (key: string) => props.fields.find((f) => f.key === key);

const baseTokenField = computed(() => fieldByKey("baseToken"));
const photoField = computed(() => fieldByKey("photoUrl"));

/** Named on the setup half, next to the chain and the asset they belong to. */
const SETUP_FIELD_KEYS = ["fundName", "fundSymbol"];

const setupFields = computed(() =>
  SETUP_FIELD_KEYS.map((key) => fieldByKey(key)).filter(
    (field): field is IField => !!field,
  ),
);

/**
 * Everything on the profile half bar the image, which has its own control, and
 * the fields the setup section renders itself.
 */
const profileFields = computed(() =>
  props.fields.filter(
    (field) =>
      !field.isFieldByUser &&
      !["baseToken", "photoUrl", ...SETUP_FIELD_KEYS].includes(field.key),
  ),
);

const customFields = computed(() =>
  props.fields.filter((field) => field.isFieldByUser),
);

const chainOptions = computed(() =>
  networks.map((network) => ({
    value: network.chainId,
    label: network.chainName,
  })),
);

const knownAssets = computed(
  () => OnboardingBaseAssets[props.chainId as ChainId] ?? [],
);

const assetOptions = computed(() => [
  ...knownAssets.value.map((address) => ({
    value: address,
    label: getTokenSymbolByAddress(props.chainId, address) ?? "Token",
    meta: truncateAddress(address),
  })),
  { value: CUSTOM_ASSET, label: "Custom address" },
]);

/**
 * Which row the picker shows. An address that is not one of the listed assets
 * — a loaded draft, or an initialized vault — resolves to "Custom address", so
 * the address input stays open on the value it already holds.
 */
const assetChoice = computed<string>({
  get: () => {
    const address = String(baseTokenField.value?.value ?? "");
    if (!address) return "";
    const match = knownAssets.value.find(
      (known) => known.toLowerCase() === address.toLowerCase(),
    );
    return match ?? CUSTOM_ASSET;
  },
  set: (choice: string) => {
    if (!baseTokenField.value) return;
    // Custom keeps whatever is already typed; picking a listed asset writes
    // its address and lets the on-chain read fill in symbol and decimals.
    baseTokenField.value.value = choice === CUSTOM_ASSET ? "" : choice;
  },
});

const isCustomAsset = computed(() => assetChoice.value === CUSTOM_ASSET);

const loadBaseTokenDetails = debounce(async (address?: string) => {
  baseTokenError.value = "";

  if (!address) {
    baseTokenSymbol.value = "—";
    baseTokenDecimals.value = "—";
    return;
  }

  try {
    const [decimals, symbol] = await fetchBaseTokenDetails(
      props.chainId as ChainId,
      address,
    );
    baseTokenDecimals.value = decimals;
    baseTokenSymbol.value = symbol;
  } catch (error: any) {
    console.error("Failed fetching base token symbol & decimals", error);
    baseTokenSymbol.value = "—";
    baseTokenDecimals.value = "—";
    baseTokenError.value = `Failed reading this token on ${chainName.value}. Is it a valid ERC20 address?`;
  }
}, 300);

const chainName = computed(
  () => networks.find((n) => n.chainId === props.chainId)?.chainName ?? "this chain",
);

watch(
  () => baseTokenField.value?.value,
  (address) => loadBaseTokenDetails(address as string | undefined),
  { immediate: true },
);
</script>

<style scoped lang="scss">
.basics {
  display: flex;
  flex-direction: column;

  &__rule {
    margin: 1.75rem 0;
    border: none;
    border-top: 1px solid $color-line;
  }

  &__section_title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  &__section_sub {
    max-width: 62ch;
    margin-top: 0.375rem;
    font-size: 13px;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 22px 20px;
    margin-top: 1.375rem;
  }

  &__cell {
    position: relative;
    grid-column: span 12;
    min-width: 0;

    @include md {
      &--4 { grid-column: span 4; }
      &--6 { grid-column: span 6; }
      &--8 { grid-column: span 8; }
      &--12 { grid-column: span 12; }
    }
  }

  &__label_row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.375rem;
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

  &__option_label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__option_meta {
    flex: none;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: $color-steel-blue;
  }

  &__helper {
    margin-top: 0.4375rem;
    font-size: 12px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__link {
    color: $color-cyan;

    &:visited,
    &:hover,
    &:active {
      color: $color-cyan;
    }
  }

  /* Matches the error line every field control reserves, so the two dropdowns
     sit on the same baseline as the inputs beside them. */
  &__reserved {
    min-height: 13px;
    margin-top: 0.3125rem;
  }

  &__asset_row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;

    @include md {
      grid-template-columns: minmax(0, 1fr) 140px 120px;
    }
  }

  &__readonly_box {
    padding: 11px 12px;
    margin-top: 0.375rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.3;
    color: $color-steel-blue;
  }

  &__remove {
    position: absolute;
    top: 0;
    right: 0;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-neg;
    cursor: pointer;
  }

  &__add {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
