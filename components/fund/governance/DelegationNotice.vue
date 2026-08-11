<template>
  <div v-if="hasNoDelegates" class="delegation_notice">
    <div class="delegation_notice__text">
      <strong class="delegation_notice__title">
        {{ NO_DELEGATES_TITLE }}
      </strong>
      <p class="delegation_notice__body">
        {{ NO_DELEGATES_MESSAGE }}
      </p>
    </div>

    <v-btn color="primary" @click="isDelegateDialogOpen = true">
      Delegate votes
    </v-btn>

    <FundGovernanceModalDelegateVotes
      v-model="isDelegateDialogOpen"
      @delegate-success="onDelegateSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import {
  NO_DELEGATES_MESSAGE,
  NO_DELEGATES_TITLE,
  useProposalDelegation,
} from "~/composables/governance/useProposalDelegation";

/**
 * Shown above every proposal form. It only appears once we know the vault has
 * no delegated voting power at all, which is the same condition that disables
 * the submit button — the notice is there so the disabled button has a reason
 * and a way out.
 */
const { hasNoDelegates, refreshDelegation } = useProposalDelegation();

const isDelegateDialogOpen = ref(false);

const onDelegateSuccess = async () => {
  // The indexers need a moment to see the DelegateChanged event; the on-chain
  // fallback would see it right away, but this path is the common one.
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await refreshDelegation();
};
</script>

<style scoped lang="scss">
.delegation_notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding: 1rem 1.25rem;
  border: 1px solid rgba($color-warning, 0.45);
  border-radius: $default-border-radius;
  background: $color-gray-light-transparent;

  &__text {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-width: 72ch;
  }

  &__title {
    font-size: 14px;
    color: $color-white;
  }

  &__body {
    font-size: 13px;
    line-height: 1.55;
    color: $color-steel-blue;
  }
}
</style>
