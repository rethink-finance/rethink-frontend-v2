<template>
  <div class="raw_form">
    <label class="raw_form__label" for="raw_form_methods">
      Raw methods JSON
    </label>
    <textarea
      id="raw_form_methods"
      v-model="rawMethods"
      class="raw_form__textarea"
      rows="14"
      spellcheck="false"
      placeholder="Paste the raw methods JSON here"
    />
    <p class="raw_form__hint">
      An array of NAV entries as exported from a vault. Every entry is added
      as a new method.
    </p>
    <div class="raw_form__actions">
      <v-btn
        color="primary"
        :disabled="!rawMethods.trim()"
        @click="load"
      >
        Load
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from "~/store/toasts/toast.store";
import { rawEntriesToNavMethods } from "~/composables/nav/rawNavEntries";
import type INAVMethod from "~/types/nav_method";

/**
 * Raw NAV entries, pasted as the JSON a vault exports and turned into
 * methods. The form owns its Load action so it can sit in any container —
 * a dialog of its own (FundNavAddRaw) or a view inside another.
 */
const toastStore = useToastStore();
const emits = defineEmits(["added-methods"]);

const props = defineProps({
  /** The methods already listed, so the new entries index after them. */
  methods: {
    type: Array as PropType<INAVMethod[]>,
    required: true,
  },
});

const rawMethods = ref("");

const load = () => {
  try {
    const newEntries = formatRawMethod();
    emits("added-methods", newEntries);

    rawMethods.value = "";
    toastStore.successToast("Raw methods added successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to add raw method. Invalid JSON format.");
  }
};

const formatRawMethod = () => {
  const parsedMethod = JSON.parse(rawMethods.value, (_, value) => {
    // check if value is a string and exactly "true" or "false" and convert it to boolean
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  });
  // The registry library and this form share one mapping, so identical
  // entries hash identically whichever way they came in.
  return rawEntriesToNavMethods(parsedMethod ?? [], props.methods.length);
};
</script>

<style scoped lang="scss">
.raw_form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__textarea {
    width: 100%;
    padding: 11px 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-dark;
    font-family: $font-mono;
    font-size: 12px;
    line-height: 1.5;
    color: $color-white;
    resize: vertical;
    transition: border-color $default-transition-time ease;

    &::placeholder {
      color: $color-steel-blue;
    }
    &:hover {
      border-color: $color-line-3;
    }
    &:focus {
      outline: none;
      border-color: $color-accent-line;
    }
  }

  &__hint {
    font-size: 12px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.75rem;
  }

  @media (prefers-reduced-motion: reduce) {
    &__textarea {
      transition: none;
    }
  }
}
</style>
