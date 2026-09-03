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
  gap: 50px;
}

.dropdown {
  position: relative;
  display: inline-block;

  .v-btn{
    padding:0;
  }
}

/* Same floating panel as a v-menu — raised surface, hairline, neutral shadow.
   This one is hand-rolled rather than teleported, so it restates the treatment
   instead of inheriting it from overlays.scss. */
.dropdown-menu {
  position: absolute;
  width: 100%;
  margin-top: 0.375rem;
  padding: 0.375rem;
  background-color: $color-navy-gray-light;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  box-shadow: var(--shadow-float);
  z-index: 1;
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.dropdown-item {
  display: flex;
  flex-direction: row;
  padding: 0.625rem 0.75rem;
  border-radius: $default-border-radius;
  cursor: pointer;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
  font-size: $text-sm;
  user-select: none;
  transition: background-color $default-transition-time ease;

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.dropdown-item:not(.disabled):hover {
  background-color: $color-gray-light-transparent;

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
