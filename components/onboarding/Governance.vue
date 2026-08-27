<template>
  <div class="governance">
    <div class="governance__label_row">
      <span class="governance__label">Governance model</span>
    </div>
    <p class="governance__sub">
      Governance owns the vault and approves changes to vault settings.
    </p>

    <div class="governance__models">
      <div
        v-for="model in models"
        :key="model.key"
        class="governance__model"
        :class="{ 'governance__model--selected': selectedModel === model.key }"
        role="radio"
        :aria-checked="selectedModel === model.key"
        :tabindex="isDisabled ? undefined : 0"
        @click="select(model)"
        @keydown.enter.prevent="select(model)"
        @keydown.space.prevent="select(model)"
      >
        <div class="governance__model_head">
          <span class="governance__radio" :class="{ 'governance__radio--on': selectedModel === model.key }" />
          <span class="governance__model_title">
            <span
              v-for="(part, index) in model.title"
              :key="index"
              :class="{ governance__model_token: part.strong }"
            >{{ part.text }}</span>
          </span>
        </div>
        <p class="governance__model_body">
          {{ model.body }}
        </p>

        <div
          v-if="model.key === GovernanceModel.CustomToken && selectedModel === model.key && governanceTokenField"
          class="governance__model_reveal"
        >
          <OnboardingFieldControl
            v-model="governanceTokenField.value"
            :field="governanceTokenField"
            :disabled="isDisabled"
          />
        </div>
      </div>
    </div>

    <div class="governance__grid">
      <div
        v-for="field in governorFields"
        :key="field.key"
        class="governance__cell"
        :class="`governance__cell--${field.cols ?? 12}`"
      >
        <OnboardingPeriodControl
          v-if="field.type === InputType.Period"
          v-model="field.value"
          :field="field"
          :chain-id="chainId"
          :disabled="isDisabled"
        />
        <OnboardingFieldControl
          v-else
          v-model="field.value"
          :field="field"
          :disabled="isDisabled"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChainId } from "~/types/enums/chain_id";
import { InputType, type IField } from "~/types/enums/input_type";

/**
 * Who votes, and on what terms.
 *
 * The model choice is not a field of its own — it is the governance token's
 * custom-value toggle. Off means the contract is sent the zero address, which
 * it reads as "the vault token governs"; on means the address typed into the
 * card below.
 */
enum GovernanceModel {
  VaultToken = "vault-token",
  CustomToken = "custom-token",
}

const props = defineProps({
  fields: {
    type: Array as PropType<IField[]>,
    default: () => [],
  },
  /** The vault's own token symbol, for the first model's title. */
  vaultSymbol: {
    type: String,
    default: "",
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

const governanceTokenField = computed(() =>
  props.fields.find((field) => field.key === "governanceToken"),
);

const governorFields = computed(() =>
  props.fields.filter((field) => field.key !== "governanceToken"),
);

const selectedModel = computed(() =>
  governanceTokenField.value?.isCustomValueToggleOn
    ? GovernanceModel.CustomToken
    : GovernanceModel.VaultToken,
);

/** A title is a run of text parts; a `strong` part is the token name, set off. */
const models = computed(() => [
  {
    key: GovernanceModel.VaultToken,
    title: [
      { text: "Govern by depositors (via " },
      { text: props.vaultSymbol || "vault", strong: true },
      { text: " token)" },
    ],
    body: "The vault token carries the voting power.",
  },
  {
    key: GovernanceModel.CustomToken,
    title: [{ text: "Govern by custom token" }],
    body: "Any existing ERC20 token carries the voting power instead of the vault token.",
  },
]);

const select = (model: { key: GovernanceModel }) => {
  if (props.isDisabled || !governanceTokenField.value) return;
  governanceTokenField.value.isCustomValueToggleOn =
    model.key === GovernanceModel.CustomToken;
};
</script>

<style scoped lang="scss">
.governance {
  display: flex;
  flex-direction: column;

  &__label_row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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

  &__sub {
    max-width: 62ch;
    margin-top: 0.375rem;
    font-size: 13px;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__models {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1.125rem;
  }

  &__model {
    padding: 16px 18px;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
    cursor: pointer;
    transition: border-color $default-transition-time ease,
      background-color $default-transition-time ease;

    &:hover {
      border-color: $color-line-3;
    }
    &:focus-visible {
      outline: none;
      border-color: $color-accent-line;
    }
    &--selected {
      border-color: $color-cyan-line;
      background: $color-cyan-tint;
    }
  }

  &__model_head {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
  }

  &__radio {
    position: relative;
    flex: none;
    width: 14px;
    height: 14px;
    border: 1px solid $color-line-3;
    border-radius: 999px;

    &--on {
      border-color: $color-cyan;
    }
    &--on::after {
      content: "";
      position: absolute;
      inset: 3px;
      border-radius: 999px;
      background: $color-cyan;
    }
  }

  &__model_title {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  /* The title is already bold, so the token name stands out by color instead. */
  &__model_token {
    color: $color-cyan;
  }

  &__model_body {
    /* Indented past the radio, so the prose lines up with the title. */
    margin: 0.375rem 0 0 1.5rem;
    max-width: 72ch;
    font-size: 13px;
    line-height: 1.55;
    color: $color-steel-blue;
  }

  &__model_reveal {
    margin: 0.875rem 0 0 1.5rem;
    padding-top: 0.875rem;
    border-top: 1px solid $color-line;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 22px 20px;
    margin-top: 1.75rem;
  }

  &__cell {
    grid-column: span 12;
    min-width: 0;

    @include md {
      &--4 { grid-column: span 4; }
      &--6 { grid-column: span 6; }
      &--12 { grid-column: span 12; }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &__model {
      transition: none;
    }
  }
}
</style>
