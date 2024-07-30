<template>
  <div class="proposal-roadmap">
    <v-card
      v-for="item in parsedRoadmap"
      :key="item.title"
      :class="classes(item)"
      flat
    >
      <div class="proposal-roadmap__date">
        {{ item.date }}
      </div>

      <div class="proposal-roadmap__container">
        <div class="proposal-roadmap__icon">
          <Icon :icon="item.icon" width="1.4rem" />
        </div>

        <div class="proposal-roadmap__details">
          <div class="proposal-roadmap__title">
            {{ item.title }}
          </div>
          <div class="proposal-roadmap__subtitle">
            {{ item.subtitle }}
          </div>
        </div>
      </div>
    </v-card>
  </div>
</template>

<script lang="ts">
import { formatDateLong } from "~/composables/formatters";
import type IGovernanceProposal from "~/types/governance_proposal";

export default {
  props: {
    proposal: {
      type: Object as () => Partial<IGovernanceProposal>,
      default: () => ({}),
    },
  },
  computed: {
    parsedRoadmap() {
      const voteStart = this.proposal?.voteStart
        ? new Date(Number(this.proposal.voteStart) * 1000)
        : null;
      const voteEnd = this.proposal?.voteEnd
        ? new Date(Number(this.proposal.voteEnd) * 1000)
        : null;

        const executionDate = this.proposal?.executedTimestamp
        ? new Date(Number(this.proposal.executedTimestamp) * 1000)
        : null;

      return [
        {
          title: "Proposal on Chain",
          subtitle: "Start of Voting Period",
          icon: "material-symbols:how-to-vote-outline",
          date: voteStart ? formatDateLong(voteStart) : "",
          hasStarted: voteStart && new Date() > voteStart,
        },
        {
          title: "Proposal Results",
          subtitle: "End of Voting Period",
          icon: "material-symbols:ballot-outline",
          date: voteEnd ? formatDateLong(voteEnd) : "",
          hasStarted: voteEnd && new Date() > voteEnd,
        },
        {
          title: "Proposal Execution",
          subtitle: "Enactment on Chain",
          icon: "material-symbols:rocket-launch-outline-rounded",
          date: executionDate ? formatDateLong(executionDate) : "",
          hasStarted: executionDate && new Date() > executionDate,
        },
      ];
    },
  },

  methods: {
    classes(item: any) {
      return [
        "proposal-roadmap__item",
        { "proposal-roadmap__item--inactive": !item.hasStarted },
      ];
    },
  },
};
</script>

<style lang="scss" scoped>
.proposal-roadmap {
  &__item {
    padding-bottom: 1rem;

    &--inactive {
      opacity: 0.5;
      .proposal-roadmap__details {
        box-shadow: 0px 0px 16px 0px $color-box-shadow;
      }
    }

    // remove border from last item
    &:nth-child(3) {
      padding-bottom: 0;

      .proposal-roadmap__icon:after {
        display: none;
      }
    }
  }

  &__date {
    font-size: 14px;
    margin-left: 2rem;
    margin-bottom: 0.25rem;
  }

  &__container {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  &__icon {
    position: relative;
    width: min-content;

    color: $color-text-irrelevant;

    &:after {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 0;
      transform: translateY(100%);

      height: 100%;
      border-left: 0.5px dashed $color-steel-blue;
      opacity: 0.4;
    }
  }

  &__details {
    width: 100%;
    padding: 0.75rem;
    background-color: $color-gray-light-transparent;
    @include borderGray;
  }

  &__title {
    padding: 0;
    margin-bottom: 0.8rem;

    font-size: 14px;
    line-height: 1;
    font-weight: 500;
    color: $color-white;
  }
  &__subtitle {
    font-weight: 500;
    font-size: 13px;
    line-height: 1;
    letter-spacing: 0.03em;
    color: $color-steel-blue;
  }
}
</style>
