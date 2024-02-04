<template>
  <v-footer color="transparent" class="footer">
    <v-col
      class="footer__buttons order-1 order-sm-0"
      cols="12"
      md="4"
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
      class="footer__terms_of_service"
      cols="12"
      md="4"
    >
      <nuxt-link
        to="https://docs.rethink.finance/rethink.finance/links/terms-of-service"
        class="d-flex"
      >
        Terms of Services & Privacy
      </nuxt-link>
    </v-col>
    <v-col
      class="footer__copyright d-flex align-center"
      cols="12"
      md="4"
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
  flex-direction: column;
  margin-top: 2rem;

  @include sm {
    flex-direction: row;
    padding: 0 4rem;
  }

  &__terms_of_service {
    display: flex;
    justify-content: flex-start;
    font-weight: 700;

    @include sm {
      align-items: center;
      justify-content: center;
    }
  }
  &__copyright {
    padding-top: 0;

    @include sm {
      justify-content: flex-end;
      padding-top: 0.75rem;
      padding-right: 4rem;
    }
  }
  &__buttons {
    display: flex;
    flex-direction: row;
    gap: 1.5rem;
    width: 100%;
    justify-content: space-between;

    @include sm {
      justify-content: flex-start;
      padding-left: 4rem;
    }

    a {
      min-width: 1rem;
      padding: 0 !important;

      svg {
        width: 1.25rem;
        height: 1.25rem;
      }
    }
  }
}
</style>
