<template>
  <div class="password_protect">
    <h2 class="title">
      Create OIV
    </h2>
    <div class="password_input">
      <v-label class="mb-2">
        Enter password to proceed to the OIV creation page
      </v-label>
      <v-text-field
        v-model="password"
        placeholder="Password"
        type="password"
        outlined
        dense
        @keydown.enter="checkPassword"
      />
    </div>
    <v-btn color="primary" @click="checkPassword">
      Submit
    </v-btn>
    <v-alert
      v-if="error"
      class="mt-6"
      type="error"
      variant="tonal"
      :icon="false"
    >
      {{ error }}
    </v-alert>

    <UiInfoBox
      class="mt-12"
      info="rethink.finance is currently in the closed beta stage. <br>Please contact <strong>rok@rethink.finance</strong> for access."
    />
  </div>
</template>

<script setup>

const props = defineProps({
  isPasswordCorrect: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:isPasswordCorrect"]);

const password = ref("");
const correctPasswords = ["rethinkCreate", "rethinkCreate2025"];
const error = ref("");

const checkPassword = () => {
  if (correctPasswords.includes(password.value)) {
    error.value = "";
    emit("update:isPasswordCorrect", true);
  } else {
    error.value = "Incorrect password. Please try again.";
    emit("update:isPasswordCorrect", false);
  }
};

watch(() => props.isPasswordCorrect, (newVal) => {
  if (!newVal) password.value = "";
});
</script>

<style scoped lang="scss">
.title {
    text-align: center;
    margin-bottom: 1rem;
}
.password_protect {
    display: flex;
    flex-direction: column;
    max-width: 600px;
    margin: 0 auto;
}
.password_input {
    margin-top: 60px;
    margin-bottom: 10px;
}
  </style>
