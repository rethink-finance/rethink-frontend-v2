<template>
  <div class="dropdown">
    <v-btn class="text-secondary" variant="outlined" @click="toggleDropdown">
      <div class="create_proposal_btn">
        <div>
          {{ label }}
        </div>
        <Icon
          :icon="isOpen ? `octicon:triangle-up-16` : `octicon:triangle-down-16`"
          width="1rem"
        />
      </div>
    </v-btn>
    <transition name="fade-slide">
      <div v-if="isOpen" class="dropdown-menu">
        <div
          v-for="option in options"
          :key="option.label"
          :class="`dropdown-item` + (option.disabled ? ` disabled` : ``)"
          @click="!option.disabled ? selectOption(option.label) : null"
        >
          <div>
            {{ option.label }}
          </div>
          <Icon class="arrow-icon" icon="mdi:arrow-right" />
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref } from "vue";

export default {
  name: "Dropdown",
  props: {
    label: {
      type: String,
      default: "",
    },
    options: {
      type: Array,
      required: true,
    },
  },
  setup(props, { emit }) {
    const isOpen = ref(false);
    const selectedOption = ref(null);

    const toggleDropdown = () => {
      isOpen.value = !isOpen.value;
    };

    const selectOption = (option) => {
      selectedOption.value = option;
      isOpen.value = false;
      emit("update:selected", option);
    };

    return {
      isOpen,
      selectedOption,
      toggleDropdown,
      selectOption,
    };
  },
};
</script>

<style scoped lang="scss">
.create_proposal_btn {
  padding: 0.5rem 1rem;
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 1.5rem;
}

.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-menu {
  @include borderGray;
  border-color: $color-light-border;
  position: absolute;
  width: 100%;
  background-color: $color-dark;
  box-shadow: 0px 0px 16px 0px $color-box-shadow;
  z-index: 1;
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.dropdown-item {
  display: flex;
  flex-direction: row;
  padding: 1rem;
  cursor: pointer;
  justify-content: space-between;
  align-items: baseline;
  font-weight: 500;
  font-size: $text-sm;
  border-top: 1px solid $color-border-dark;
  user-select: none;

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.dropdown-item:not(.disabled):hover {
  background-color: $color-background-button;

  .arrow-icon {
    opacity: 1;
  }
}

.arrow-icon {
  opacity: 0;
  transition: opacity 0.3s ease;
  color: $color-primary;
}

/* Fade and Slide transition classes */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
.fade-slide-enter-to,
.fade-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
