<template>
  <UiHeader>
    <div class="main_header__title">
      OIV Settings Proposal

      <UiTooltipClick location="right" :hide-after="6000">
        <Icon
          icon="material-symbols:info-outline"
          :class="'main_header__info-icon'"
          width="1.5rem"
        />

        <template #tooltip>
          <div class="tooltip__content">
            Update OIV Settings on need!
            <a
              class="tooltip__link"
              href="https://docs.rethink.finance/rethink.finance"
              target="_blank"
            >
              Learn More
              <Icon icon="maki:arrow" color="primary" width="1rem" />
            </a>
          </div>
        </template>
      </UiTooltipClick>
    </div>

    <div class="buttons_container">
      <v-btn
        v-if="showPrevStep"
        variant="outlined"
        color="secondary"
        @click="prevStep"
      >
        Previous
      </v-btn>

      <v-btn
        class="button--primary"
        :type="isLastStep ? 'submit' : 'button'"
        :loading="loading"
        :disabled="isLastStep && !accountStore.isConnected"
        @click="handleButtonClick"
      >
        {{ isLastStep ? "Submit Proposal" : "Next" }}
        <v-tooltip
          v-if="isLastStep && !accountStore.isConnected"
          :model-value="true"
          activator="parent"
          location="top"
          @update:model-value="true"
        >
          Connect your wallet to create a proposal.
        </v-tooltip>
      </v-btn>
    </div>
  </UiHeader>
</template>

<script setup lang="ts">
import { useAccountStore } from "~/store/account/account.store";

const emit = defineEmits(["prev-step", "handle-click"]);

const accountStore = useAccountStore();


// Props
const props = defineProps({
  showPrevStep:{
    type: Boolean,
    default: false,
  },
  isLastStep:{
    type: Boolean,
    default: false,
  },
  loading:{
    type: Boolean,
    default: false,
  },
})

// Data

// Computeds

// Methods
const prevStep = () => {
  emit("prev-step")
}

const handleButtonClick = () => {
  emit("handle-click")
}

// Watchers

// Lifecycle Hooks
</script>

<style scoped lang="scss">
.main_header {
  flex-wrap: wrap;
  gap: 15px;

  &__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    align-content: center;
    gap: 20px;
  }
  &__info-icon {
    cursor: pointer;
    display: flex;
    color: $color-text-irrelevant;
  }
}

.buttons_container {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  margin-left: auto;
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
</style>
