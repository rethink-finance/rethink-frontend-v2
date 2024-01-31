<template>
  <v-footer color="transparent" class="footer px-16">
    <v-col
      class="footer__buttons ps-16"
      cols="12"
      sm="12"
      md="6"
    >
      <v-btn href="https://#" target="_blank" variant="plain">
        <Icon
          name="ri:twitter-x-line"
          color="white"
          size="1rem"
        />
      </v-btn>
      <v-btn href="https://#" target="_blank" variant="plain">
        <Icon
          name="ic:baseline-discord"
          color="white"
          size="1rem"
        />
      </v-btn>
      <v-btn href="https://#" target="_blank" variant="plain">
        <Icon
          name="mdi:youtube"
          color="white"
          size="1rem"
        />
      </v-btn>
      <v-btn href="https://#" target="_blank" variant="plain">
        <Icon
          name="ph:medium-logo-fill"
          color="white"
          size="1rem"
        />
      </v-btn>
      <v-btn href="https://#" target="_blank" variant="plain">
        <Icon
          name="uil:github"
          color="white"
          size="1rem"
          class="mr-3"
        />
      </v-btn>
    </v-col>

    <v-col
      class="d-flex justify-end align-center pe-16"
      cols="12"
      sm="12"
      md="6"
    >
      <Icon
        name="ic:baseline-copyright"
        color="white"
        size="1rem"
        class="me-1"
      />
      {{ currentYear }} Rethink.finance. All rights reserved
    </v-col>
  </v-footer>
</template>

<script setup>
const currentYear = new Date().getFullYear();
</script>

<style scoped lang="scss">
.footer {
  font-size: $text-sm;

  &__buttons {
    display: flex;
    flex-direction: row;
    gap: 1.5rem;

    a {
      min-width: 1rem;

      svg {
        width: 1.25rem;
        height: 1.25rem;
      }
    }
  }
}
</style>
