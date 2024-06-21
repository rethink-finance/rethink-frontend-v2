<template>
  <div class="section-top">
    <h2 class="section-top__title">
      {{ title }}
    </h2>

    <div class="section-top__meta-container">
      <div class="section-top__meta">
        <div class="section-top__meta-row">
          <UiChip
            v-for="tag in tags"
            :key="tag"
            :value="tag"
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
            class="section-top__meta-item"
            v-for="item in metaBottom"
            :key="item.label"
          >
            <div class="meta-label">
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

      <v-btn
        v-if="!isButtonHidden"
        class="section-top__submit-button"
        @click="handleButtonClick"
        v-text="buttonText"
      />

      <v-dialog
        v-model="isDialogOpen"
        scrim="black"
        opacity="0.25"
        max-width="500"
      >
        <div class="main_card di-card">
          <div class="di-card__header-container">
            <div class="di-card__header">Vote Submission</div>

            <Icon
              icon="material-symbols-light:close"
              class="di-card__close-icon"
              width="2rem"
              @click="dialogClose"
            />
          </div>

          <div
            class="di-card__subtext"
            v-for="item in metaBottom.slice(0, 1)"
            :key="item.label"
          >
            <div class="meta-label">
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

          <h2 class="di-card__title">{{ title }}</h2>

          <div class="di-card__voting-power meta-label meta-label--uppercase">
            Voting Power: {{ votingPower }}
          </div>

          <v-radio-group class="di-card__radio-group" v-model="selectedRadio">
            <v-radio
              v-for="option in radioOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
              class="di-card__radio"
            >
              <template #label>
                <Icon :icon="option.icon" width="1.4rem" />
                {{ option.label }}
              </template>
            </v-radio>
          </v-radio-group>

          <v-btn
            class="di-card__submit-button"
            @click="submitProposal(selectedRadio)"
            :disabled="!selectedRadio"
          >
            Submit Vote
          </v-btn>
        </div>
      </v-dialog>
    </div>
  </div>
</template>

<script lang="ts">
// toast
import { useToastStore } from "~/store/toast.store";

// defined icons for submission
const icons = {
  Pending: "material-symbols:timer-outline",
  Missed: "material-symbols:priority-high",
  Abstained: "material-symbols:question-mark",
  Rejected: "material-symbols:close",
  Approved: "material-symbols:done",
};

const toastStore = useToastStore();

interface MetaItem {
  label: string;
  value: string;
  format?: (value: string) => string;
}

const radioOptions: { label: string; value: string; icon: string }[] = [
  { label: "Approve", value: "approve", icon: icons.Approved },
  { label: "Reject", value: "reject", icon: icons.Rejected },
  { label: "Abstain", value: "abstain", icon: icons.Abstained },
];

export default defineComponent({
  name: "ProposalSectionTop",
  props: {
    title: {
      type: String,
      default: "",
    },
    tags: {
      type: Array as () => string[],
      default: () => [],
    },
    submission: {
      type: String,
      default: "",
    },
    metaBottom: {
      type: Array as () => MetaItem[],
      default: () => [],
    },
    votingPower: {
      type: String,
      default: "",
    },
  },
  data: () => ({
    icons,
    isDialogOpen: false,
    radioOptions,
    selectedRadio: "",
  }),
  methods: {
    copyText(text: string) {
      navigator.clipboard.writeText(text);
    },
    handleButtonClick() {
      // if proposal is approved, execute proposal
      if (this.isApproved) {
        this.executeProposal();
      }
      // if proposal is not approved, open dialog
      // for submission
      else {
        this.dialogOpen();
      }
    },
    submitProposal(selectedRadio: string) {
      const msg = {
        approve: "Voted to Approve",
        reject: "Voted to Reject",
        abstain: "Voted to Abstain",
      } as Record<string, string>;

      toastStore.successToast(msg[selectedRadio]);
      this.dialogClose();
    },
    executeProposal() {
      alert("Execute Proposal");
    },
    dialogOpen() {
      this.isDialogOpen = true;
    },
    dialogClose() {
      this.isDialogOpen = false;
    },
  },
  computed: {
    isButtonHidden() {
      // list all submission statuses that should hide the button
      const hiddenBySubmission = ["Rejected"].includes(this.submission);
      // list all tags that should hide the button
      const hiddenByTags = ["failed"].some((tag) => this.tags.includes(tag));

      return hiddenBySubmission || hiddenByTags;
    },
    isApproved() {
      return this.submission === "Approved";
    },
    buttonText() {
      return this.isApproved ? "Execute Proposal" : "Submit Vote";
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
  }

  &__copy-icon {
    cursor: pointer;
    rotate: 180deg;
    transform: scaleX(-1);
    color: $color-steel-blue;
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

.meta-label {
  display: inline;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: $color-steel-blue;

  &--uppercase {
    text-transform: uppercase;
  }
}

.di-card {
  @include borderGray;
  margin: 0 auto;
  color: white;

  &__header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__header,
  &__title {
    font-size: $text-lg;
    font-weight: 700;
  }

  &__subtext {
    display: flex;
    align-items: center;
    gap: 0.15rem;

    margin-bottom: 1rem;
    color: $color-steel-blue;
  }

  &__title {
    margin-bottom: 1rem;
  }

  &__voting-power {
    display: block;
    margin-bottom: 0.5rem;
  }

  &__close-icon {
    cursor: pointer;
    color: $color-steel-blue;
  }

  &__submit-button {
    width: 100%;
  }

  // overrides for radio group
  &__radio-group {
    margin-bottom: 1.5rem;

    :deep(.v-selection-control-group) {
      gap: 1rem;
    }
    :deep(.v-selection-control) {
      flex-direction: row-reverse;
      justify-content: space-between;

      padding: 0.25rem 0.5rem;
      color: $color-text-irrelevant;

      @include borderGray;
    }
    :deep(.v-label) {
      opacity: 1;
      width: 100%;
      gap: 0.5rem;
    }
  }
}
</style>
