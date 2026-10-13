<template>
  <button
    type="button"
    class="copy_addr"
    :class="{ 'copy_addr--done': done }"
    :title="done ? 'Copied' : `Copy ${label}`"
    :aria-label="done ? 'Copied' : `Copy ${label}`"
    @click.stop="copy"
  >
    <Icon
      :icon="done ? 'material-symbols:check-rounded' : 'clarity:copy-line'"
      width="0.8125rem"
      height="0.8125rem"
    />
  </button>
</template>

<script setup lang="ts">
import { useToastStore } from "~/store/toasts/toast.store";

/**
 * The copy glyph beside a shortened address: a control the size of the text
 * next to it, and a check mark for a moment once the full address is on the
 * clipboard. Same pattern as the vault contracts footer in the create flow.
 */
const props = defineProps<{
  /** The full value that goes on the clipboard. */
  address: string;
  /** What the tooltip calls it: "the payout address", "this trader's address". */
  what?: string;
}>();

const toastStore = useToastStore();
const label = computed(() => props.what || "the address");
const done = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * The async clipboard API first; where a browser or an embedding app denies
 * it, the selection-based copy command still works from inside a click.
 */
const writeClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    field.remove();
    return copied;
  }
};

const copy = async () => {
  if (!(await writeClipboard(props.address))) {
    toastStore.errorToast("Could not copy the address.");
    return;
  }
  done.value = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    done.value = false;
  }, 1500);
};

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<style scoped lang="scss">
.copy_addr {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  padding: 0;
  margin-left: 0.125rem;
  border: none;
  background: none;
  color: $color-steel-blue;
  cursor: pointer;
  transition: color $default-transition-time ease;

  &:hover,
  &:focus-visible {
    outline: none;
    color: $color-white;
  }

  &--done {
    color: $color-cyan;
  }
}
</style>
