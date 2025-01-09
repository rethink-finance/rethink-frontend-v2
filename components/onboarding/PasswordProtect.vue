<template>
  <div class="password-protect">
    <h2 class="title">
      Password Protected
    </h2>
    <UiInfoBox
      info="This page is password protected. Please enter the password to continue."
    />

    <div class="password-field">
      <v-label class="label_required mb-2">
        Enter password
      </v-label>
      <v-text-field
        v-model="password"
        placeholder="Password"
        type="password"
        outlined
        dense
        :error="!!error"
        :error-messages="error"
        @keydown.enter="checkPassword"
      />
    </div>
    <v-btn color="primary" @click="checkPassword">
      Submit
    </v-btn>
  </div>
</template>

<script setup>

const props = defineProps({
  authenticated: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:authenticated"]);

const password = ref("");
// TODO: Replace with actual password
const correctPassword = "createOIV";
const error = ref("");

const checkPassword = () => {
  if (password.value === correctPassword) {
    error.value = "";
    emit("update:authenticated", true); // notify parent that user is authenticated
  } else {
    error.value = "Incorrect password. Please try again.";
  }
};

watch(() => props.authenticated, (newVal) => {
  if (!newVal) password.value = "";
});
</script>

<style scoped lang="scss">
.title{
    text-align: center;
    margin-bottom: 20px;
}
.password-protect {
    display: flex;
    flex-direction: column;
    max-width: 600px;
    margin: 0 auto;
}
.password-field {
    margin-top: 60px;
    margin-bottom: 10px;
}
.error {
    color: var(--color-error);

}
  </style>
