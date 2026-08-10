<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    @update:model-value="closeModal"
  >
    <div class="brand_modal">
      <div class="brand_modal__head">
        <div class="brand_modal__heading">
          <div class="brand_modal__eyebrow">
            Permissions
          </div>
          <h2 class="brand_modal__title">
            Add a {{ type }}
          </h2>
        </div>

        <button
          type="button"
          class="brand_modal__close"
          aria-label="Close"
          @click="closeModal"
        >
          <Icon icon="material-symbols:close" width="1.125rem" />
        </button>
      </div>

      <div class="brand_modal__body">
        <div v-if="$slots.description" class="add_address__description">
          <slot name="description" />
        </div>

        <div class="brand_modal__form">
          <v-label class="brand_modal__label label_required">
            {{ type }} Address
          </v-label>
          <v-text-field
            v-model="address"
            placeholder="0x..."
            :rules="rules"
            required
          />
        </div>
      </div>

      <div class="brand_modal__footer brand_modal__footer--stacked">
        <v-btn
          :disabled="!isTargetAddressValid"
          color="primary"
          @click="addAddress"
        >
          Add {{ type }}
        </v-btn>
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
/* Prose above the field, when the caller supplies any — separated from the
   input so the explanation does not read as the field's own label. */
.add_address__description {
  margin-bottom: 1.25rem;
  font-size: $text-sm;
  line-height: 1.55;
  color: $color-light-subtitle;
}
</style>
