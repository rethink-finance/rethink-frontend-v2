<template>
  <v-btn
    class="text-secondary"
    variant="outlined"
    @click="isDialogOpen = true"
  >
    Simulate NAV
  </v-btn>
  <v-dialog
    v-model="isDialogOpen"
    scrim="black"
    opacity="0.5"
  >
    <div class="main_card di-card">
      <div class="di-card__header">
        NAV Update Simulation
      </div>
      <div class="di-card__subtext">
        Simulate NAV before updating or creating a proposal
      </div>
      <div class="d-flex mb-5">
        <div class="di-card__text-total">
          Total NAV:
        </div>
        <div class="di-card__text-value">
          $333,212,321.12
        </div>
      </div>
      <div class="di-card__table">
        <FundNavSimulationTable :methods="methods" />
      </div>
      <div class="action-buttons">
        <v-btn
          class="text-secondary"
          variant="plain"
          @click="isDialogOpen = false"
        >
          Close
        </v-btn>
        <v-btn
          class="text-secondary"
          variant="outlined"
        >
          Manage Methods
        </v-btn>
        <v-btn
          class="text-secondary"
          variant="flat"
        >
          Update NAV
        </v-btn>
      </div>
    </div>
  </v-dialog>

</template>

<script lang="ts">
import type INAVMethod from "~/types/nav_method";

export default defineComponent({
  name: "NAVSimulateDialog",
  props: {
    methods: {
      type: Array as () => INAVMethod[],
      default: () => [],
    },
  },
  data () {
    return {
      isDialogOpen: false,
    }
  },
  methods: {

  },
})
</script>

<style lang="scss" scoped>
.di-card{
    @include borderGray;
    width: 100%;
    color: white;

    &__header{
        font-size: $text-md;
        font-weight: 700;
        margin-bottom: 1rem;
    }

    &__subtext{
        font-size: $text-sm;
        font-weight: 500;
        color: $color-text-irrelevant;
        margin-bottom: 4rem
    }

    &__text-total{
        font-size: $text-md;
        font-weight: 400;
        margin-right: .5rem
    }

    &__text-value{
        font-size: $text-md;
        font-weight: 700;
    }

    &__table{
        @include borderGray;
        border-radius: .5rem;
        max-height: 21rem;
        overflow-y: auto;
        margin-bottom: 1.5rem;
    }
}

.action-buttons{
    display: flex;
    flex-direction: row;
    justify-content: end;
    gap: 1.5rem;
    margin: 1rem 0;
}

</style>
