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
          Add a Target
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
          Targets are the accounts that the members can interact with on behalf of the avatar.
        </div>

        <div class="di-card__someone-else-container">
          <v-label class="di-card__label label_required">
            Target Address
          </v-label>
          <v-text-field
            v-model="targetAddress"
            placeholder="0x..."
            :rules="rules"
            required
          />

          <v-btn
            :disabled="!isTargetAddressValid"
            class="di-card__submit_button"
            variant="flat"
            color="rgba(210, 223, 255, 1)"
            @click="addTarget"
          >
            Add Target
          </v-btn>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
defineProps({ modelValue: Boolean });
const emit = defineEmits(["update:modelValue", "targetAdded"]);

const targetAddress = ref("");
const rules = [formRules.required, formRules.isValidAddress];

const isTargetAddressValid = computed(() => {
  return rules.every((rule) => {
    return rule(targetAddress.value) === true;
  });
});

const closeModal = () => {
  targetAddress.value = "";
  emit("update:modelValue", false);
};

const addTarget = () => {
  emit("targetAdded", targetAddress.value)
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
