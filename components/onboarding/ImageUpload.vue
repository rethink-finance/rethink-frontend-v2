<template>
  <div class="image_upload">
    <div class="image_upload__label_row">
      <span class="image_upload__label">
        {{ field.label }}<span v-if="isRequired" class="image_upload__star">*</span>
      </span>
      <OnboardingFieldChip :tag="field.tag" />
    </div>

    <div
      class="image_upload__zone"
      :class="{
        'image_upload__zone--over': isDragOver,
        'image_upload__zone--disabled': disabled,
      }"
      role="button"
      tabindex="0"
      @click="browse"
      @keydown.enter.prevent="browse"
      @keydown.space.prevent="browse"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop.prevent="onDrop"
    >
      <div class="image_upload__tile">
        <!-- A URL that does not resolve falls back to the placeholder rather
             than leaving a broken-image glyph and its alt text in the tile. -->
        <img
          v-if="previewUrl && !isPreviewBroken"
          class="image_upload__preview"
          :src="previewUrl"
          alt="Vault image"
          @error="isPreviewBroken = true"
          @load="isPreviewBroken = false"
        >
        <span v-else class="image_upload__placeholder">Logo</span>
      </div>

      <div class="image_upload__copy">
        <div class="image_upload__prompt">
          {{ isProcessing ? "Preparing image…" : "Drop an image here, or click to upload" }}
        </div>

        <p v-if="error" class="image_upload__error">
          {{ error }}
        </p>
        <p v-else-if="isPending" class="image_upload__ready">
          Ready. Uploaded when you initialize the vault.
        </p>
        <p v-else class="image_upload__hint">
          PNG, JPG or WebP. Centre-cropped to a {{ imageSize }}&#215;{{ imageSize }} square.
        </p>
      </div>
    </div>

    <input
      ref="fileInputRef"
      class="image_upload__file"
      type="file"
      :accept="acceptAttribute"
      :disabled="disabled"
      @change="onFileChosen"
    >

    <!-- Opens on its own once the field already holds a hosted URL — an
         initialized vault, or a curator who pasted one. Otherwise it is one
         click away, because a curator with an asset already online should not
         be made to re-upload it. -->
    <button
      v-if="!showUrlField"
      type="button"
      class="image_upload__url_toggle"
      :disabled="disabled"
      @click="isUrlFieldOpen = true"
    >
      Paste a URL instead
    </button>

    <div v-else class="image_upload__url">
      <label class="image_upload__url_label" for="vault-image-url">
        Image URL
      </label>
      <input
        id="vault-image-url"
        v-model="hostedUrl"
        class="image_upload__url_input"
        type="text"
        placeholder="https://"
        :disabled="disabled"
      >
    </div>

    <p class="image_upload__reserved" />
  </div>
</template>

<script setup lang="ts">
import type { IField } from "~/types/enums/input_type";

/**
 * The vault image.
 *
 * Nothing is uploaded here. The file is squared to 512 and held in the field as
 * a data URL, which the draft persists like any other value; the page swaps it
 * for a hosted URL at initialize time. That ordering is what keeps the open
 * upload endpoint from collecting the images of every draft that was never
 * launched — and it means an image survives closing the tab, which an uploaded
 * one would only have done by already existing on a server.
 */
const props = defineProps({
  field: {
    type: Object as PropType<IField>,
    required: true,
  },
  modelValue: {
    type: String as PropType<any>,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);

// Local bindings: Nuxt's auto-imports are not in scope for the template.
const acceptAttribute = VAULT_IMAGE_TYPES.join(",");
const imageSize = VAULT_IMAGE_SIZE;

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);
const isProcessing = ref(false);
const error = ref("");
const isPreviewBroken = ref(false);
const isUrlFieldOpen = ref(false);

const value = computed({
  get: () => props.modelValue ?? "",
  set: (val: string) => emit("update:modelValue", val),
});

const isRequired = computed(() =>
  (props.field.rules ?? []).includes(formRules.required),
);

const isPending = computed(() => isPendingVaultImage(value.value));

const previewUrl = computed(() => value.value || "");

// A new source deserves a fresh attempt at loading it.
watch(previewUrl, () => {
  isPreviewBroken.value = false;
});

/**
 * The URL input is bound through a guard so that a pending data URL never lands
 * in it — several hundred kilobytes of base64 in a text field is unreadable and
 * looks like corruption.
 */
const hostedUrl = computed({
  get: () => (isPending.value ? "" : value.value),
  set: (val: string) => {
    value.value = val;
  },
});

const showUrlField = computed(
  () => isUrlFieldOpen.value || (!!value.value && !isPending.value),
);

const browse = () => {
  if (props.disabled) return;
  fileInputRef.value?.click();
};

const onDrop = (event: DragEvent) => {
  isDragOver.value = false;
  if (props.disabled) return;
  const file = event.dataTransfer?.files?.[0];
  if (file) handleFile(file);
};

const onFileChosen = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) handleFile(file);
  // Lets the same file be picked again after a failure.
  input.value = "";
};

const handleFile = async (file: File) => {
  error.value = "";

  if (!VAULT_IMAGE_TYPES.includes(file.type)) {
    error.value = "Only PNG, JPG and WebP images are accepted.";
    return;
  }
  if (file.size > VAULT_IMAGE_MAX_SOURCE_BYTES) {
    error.value = "The image must be 10 MB or smaller.";
    return;
  }

  isProcessing.value = true;
  try {
    value.value = await squareVaultImage(file);
    isUrlFieldOpen.value = false;
  } catch (e: any) {
    console.error("Failed preparing the vault image", e);
    error.value =
      (e?.message || "The image could not be processed.") +
      " Paste a hosted image URL instead.";
    isUrlFieldOpen.value = true;
  } finally {
    isProcessing.value = false;
  }
};
</script>

<style scoped lang="scss">
.image_upload {
  display: flex;
  flex-direction: column;
  min-width: 0;

  &__label_row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.375rem;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    line-height: 1.4;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__star {
    margin-left: 0.25em;
    color: $color-cyan;
  }

  &__zone {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border: 1px dashed $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    cursor: pointer;
    transition: border-color $default-transition-time ease;

    &:hover,
    &:focus-visible,
    &--over {
      outline: none;
      border-color: $color-cyan-line;
    }
    &--disabled {
      cursor: default;
      pointer-events: none;
    }
  }

  &__tile {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 88px;
    height: 88px;
    border-radius: $default-border-radius;
    background: $color-cyan-tint;
    overflow: hidden;
  }

  &__preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__placeholder {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__copy {
    min-width: 0;
  }

  &__prompt {
    font-size: 13.5px;
    font-weight: 500;
    line-height: 1.4;
    color: $color-white;
  }

  &__hint,
  &__ready,
  &__error {
    margin-top: 0.375rem;
    font-size: 12px;
    line-height: 1.5;
  }
  &__hint {
    color: $color-steel-blue;
  }
  &__ready {
    color: $color-cyan;
  }
  &__error {
    color: $color-neg;
  }

  &__file {
    display: none;
  }

  &__url_toggle {
    align-self: flex-start;
    margin-top: 0.625rem;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
    cursor: pointer;
  }

  &__url {
    margin-top: 0.75rem;
  }
  &__url_label {
    display: block;
    margin-bottom: 0.375rem;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }
  &__url_input {
    width: 100%;
    padding: 11px 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.3;
    color: $color-white;

    &::placeholder {
      color: $color-steel-blue;
    }
    &:focus {
      outline: none;
      border-color: $color-accent-line;
    }
  }

  /* Keeps the image field on the same rhythm as every other one, which all
     reserve a line under themselves for an error. */
  &__reserved {
    min-height: 13px;
    margin-top: 0.3125rem;
  }

  @media (prefers-reduced-motion: reduce) {
    &__zone {
      transition: none;
    }
  }
}
</style>
