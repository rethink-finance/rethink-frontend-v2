<template>
  <div class="governance">
    <h2 class="governance__section_title">
      Governance
    </h2>
    <p class="governance__sub">
      Governance owns the vault and approves changes to vault settings.
    </p>

    <!--
      Two models, but not two equals: nearly every vault is governed by its
      own depositors, so that one is the card, recommended and chosen from the
      start, and the custom token is a quieter line under it for the few that
      want an outside token to vote.
    -->
    <div
      class="governance__models"
      role="radiogroup"
      aria-label="Governance model"
    >
      <div
        v-for="model in models"
        :key="model.key"
        class="governance__model"
        :class="{
          'governance__model--primary': model.primary,
          'governance__model--alt': !model.primary,
          'governance__model--selected': selectedModel === model.key,
        }"
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
          <span v-if="model.primary" class="governance__badge">
            Recommended
          </span>
          <span v-else class="governance__model_hint">
            {{ model.body }}
          </span>
        </div>
        <p v-if="model.primary" class="governance__model_body">
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

/**
 * A title is a run of text parts; a `strong` part is the token name, set off.
 * The `primary` model is the card; the other is the line under it.
 */
const models = computed(() => [
  {
    key: GovernanceModel.VaultToken,
    primary: true,
    title: [
      { text: "Govern by depositors (via " },
      { text: props.vaultSymbol || "vault", strong: true },
      { text: " token)" },
    ],
    body: "The vault token carries the voting power.",
  },
  {
    key: GovernanceModel.CustomToken,
    primary: false,
    title: [{ text: "Govern by custom token" }],
    body: "Any existing ERC20 token carries the voting power instead.",
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

  &__section_title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
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
    gap: 0.25rem;
    margin-top: 1.125rem;
  }

  &__model {
    cursor: pointer;

    &:focus-visible {
      outline: none;
    }
  }

  /* The card: the model most vaults want, framed and filled like every
     other panel in the flow, tinted while it is the one chosen. */
  &__model--primary {
    padding: 18px 20px;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
    transition: border-color $default-transition-time ease,
      background-color $default-transition-time ease;

    &:hover {
      border-color: $color-line-3;
    }
    &:focus-visible {
      border-color: $color-accent-line;
    }
    &.governance__model--selected {
      border-color: $color-cyan-line;
      background: $color-cyan-tint;
    }
  }

  /* The line: the alternative for the few, on the card's own left rhythm so
     the two radios stack, and no frame of its own until it is chosen. */
  &__model--alt {
    padding: 12px 20px;
    border: 1px solid transparent;
    border-radius: $default-border-radius;
    transition: border-color $default-transition-time ease,
      background-color $default-transition-time ease;

    .governance__model_title {
      font-size: 13px;
      font-weight: 600;
      color: $color-text-irrelevant;
      transition: color $default-transition-time ease;
    }

    &:hover .governance__model_title,
    &:focus-visible .governance__model_title {
      color: $color-white;
    }

    &.governance__model--selected {
      border-color: $color-line;
      background: $color-card-background;

      .governance__model_title {
        color: $color-white;
      }
    }
  }

  &__model_head {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
  }

  &__badge {
    padding: 0.1875rem 0.4375rem;
    border: 1px solid $color-cyan-line;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 9.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  /* The alternative's explanation, on the same line as its name. */
  &__model_hint {
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;
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
    font-size: 15px;
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
    &__model--primary,
    &__model--alt,
    &__model--alt .governance__model_title {
      transition: none;
    }
  }
}
</style>
