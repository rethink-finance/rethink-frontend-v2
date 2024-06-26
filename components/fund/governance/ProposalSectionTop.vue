<template>
  <div class="section-top">
    <h2 class="section-top__title">
      {{ title }}
    </h2>

    <div class="section-top__meta-container">
      <div class="section-top__meta">
        <div class="section-top__meta-row">
          <FundGovernanceProposalStateChip
            :value="state"
            class="section-top__tag"
          />
          <FundGovernanceProposalStateChip
            value="Permissions"
            class="section-top__tag"
          />
          <div class="section-top__submission">
            <Icon
              :icon="icons[submission as keyof typeof icons]"
              width="0.9rem"
              class="section-top__submission-icon"
            />
            <div class="section-top__submission-text">
              {{ submission }}
            </div>
          </div>
        </div>

        <div class="section-top__meta-row">
          <div
            v-for="item in metaBottom"
            :key="item.label"
            class="section-top__meta-item"
          >
            <div class="section-top__meta-label">
              {{ item.label }} {{ item?.format?.(item.value) ?? item.value }}
            </div>

            <ui-tooltip-click tooltip-text="Copied">
              <Icon
                icon="clarity:copy-line"
                class="section-top__copy-icon"
                width="0.8rem"
                @click="copyText(item.value)"
              />
            </ui-tooltip-click>
          </div>
        </div>
      </div>

      <v-btn class="section-top__submit-button" @click="submitProposal">
        Submit Vote
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts">
// utils

// defined icons for submission
const icons = {
  Pending: "material-symbols:timer-outline",
  Missed: "material-symbols:priority-high",
  Abstained: "material-symbols:question-mark",
  Rejected: "material-symbols:close",
  Approved: "material-symbols:done",
};

interface MetaItem {
  label: string;
  value: string;
  format?: (value: string) => string;
}

export default defineComponent({
  name: "ProposalSectionTop",
  props: {
    title: {
      type: String,
      default: "",
    },
    state: {
      type: String,
      default: "",
    },
    submission: {
      type: String,
      default: "",
    },
    metaBottom: {
      type: Array as () => MetaItem[],
      default: () => [],
    },
  },
  data: () => ({
    icons,
  }),
  methods: {
    copyText(text: string) {
      navigator.clipboard.writeText(text);
    },
    submitProposal() {
      alert("Submit Vote");
    },
  },
});
</script>

<style scoped lang="scss">
.section-top {
  margin-bottom: 3rem;

  &__title {
    margin-bottom: 1.5rem;
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  &__meta-container {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 2rem;
    margin-bottom: 1.5rem;

    @include sm {
      flex-direction: row;
      gap: 1rem;
    }
  }

  &__meta {
    width: 100%;

    @include sm {
      width: 75%;
    }
  }

  &__meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__meta-item {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    color: $color-steel-blue;
  }

  &__meta-label {
    display: inline;
    font-size: 13px;
    letter-spacing: 0.03em;
  }

  &__copy-icon {
    cursor: pointer;
    rotate: 180deg;
    transform: scaleX(-1);
  }

  &__submission {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    color: $color-white;

    &-text {
      font-size: 0.8rem;
    }

    &-icon {
      width: 0.9rem;
    }
  }

  &__submit-button {
    cursor: pointer;
  }
}
</style>
