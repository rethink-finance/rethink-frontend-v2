<template>
  <v-dialog
    :model-value="modelValue"
    scrim="black"
    opacity="0.3"
    max-width="600"
    @update:model-value="closeModal"
  >
    <div class="main_card di-card">
      <div class="di-card__header-container">
        <div class="di-card__header">
          Add a {{ type }}
        </div>
        <Icon
          icon="material-symbols:close"
          class="di-card__close-icon"
          width="1.5rem"
          @click="closeModal"
        />
      </div>

      <div class="di-card__content">
        <div class="di-card">
          <slot name="description" />
        </div>

        <div class="di-card__someone-else-container">
          <v-label class="di-card__label label_required">
            {{ type }} Address
          </v-label>
          <v-text-field
            v-model="address"
            placeholder="0x..."
            :rules="rules"
            required
          />

          <v-btn
            :disabled="!isTargetAddressValid"
            class="di-card__submit_button"
            variant="flat"
            color="rgba(210, 223, 255, 1)"
            @click="addAddress"
          >
            Add {{ type }}
          </v-btn>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  type: {
    type: String,
    default: "Target",
  },
});
const emit = defineEmits(["update:modelValue", "addressAdded"]);

const address = ref("");
const rules = [formRules.required, formRules.isValidAddress];

const isTargetAddressValid = computed(() => {
  return rules.every((rule) => {
    return rule(address.value) === true;
  });
});

const closeModal = () => {
  address.value = "";
  emit("update:modelValue", false);
};

const addAddress = () => {
  emit("addressAdded", address.value)
  closeModal();
};
</script>

<style scoped lang="scss">
.di-card {
  margin: 0 auto;
  padding: 1rem;
  margin-bottom: 2rem;
  width: 100%;
  max-width: 500px;
  color: white;
  @include borderGray;

  &__header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  &__header {
    font-size: $text-lg;
    font-weight: 700;
  }
  &__close-icon {
    cursor: pointer;
    color: $color-steel-blue;
  }
  &__content {
    margin-top: 2rem;
  }
  &__label {
    margin-bottom: 0.25rem;
  }
  &__submit_button {
    width: 100%;
    margin-top: 1rem;
  }
}
</style>
