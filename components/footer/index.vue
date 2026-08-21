<template>
  <v-footer color="transparent" class="footer">
    <div class="footer__inner">
      <div class="footer__social">
        <a
          href="https://twitter.com/RethinkProtocol"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X"
        >
          <Icon icon="ri:twitter-x-line" width="1rem" />
        </a>
        <a
          href="https://discord.gg/A7NukjjrRg"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Discord"
        >
          <Icon icon="ic:baseline-discord" width="1rem" />
        </a>
        <a
          href="https://github.com/rethink-finance"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
        >
          <Icon icon="uil:github" width="1rem" />
        </a>
      </div>

      <div class="footer__legal">
        <a
          href="https://rethink.finance/terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service
        </a>
        <span class="footer__separator">·</span>
        <a
          href="https://rethink.finance/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy
        </a>
      </div>

      <div class="footer__copyright">
        © rethink.finance, {{ currentYear }}. All rights reserved.
      </div>
    </div>
  </v-footer>
</template>

<script setup>
const currentYear = new Date().getFullYear();
</script>

<style scoped lang="scss">
.footer {
  padding: 0;
  border-top: 1px solid $color-line;

  /* Hairline spans the viewport; the row inside it sits in the shared page
     container, so the social icons start under the navbar logo. */
  &__inner {
    @include page-container;
    padding-block: 26px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;

    @include sm {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
    }
  }

  &__social {
    display: flex;
    align-items: center;
    gap: 1.375rem;

    a {
      display: flex;
      color: $color-steel-blue;
      transition: color $default-transition-time ease;

      &:hover {
        color: $color-white;
      }
    }
  }

  &__legal,
  &__copyright {
    font-size: 12.5px;
    color: $color-steel-blue;
  }

  &__legal {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    a {
      color: $color-steel-blue;
      text-decoration: none;
      transition: color $default-transition-time ease;

      &:hover {
        color: $color-white;
      }
    }
  }

  &__separator {
    opacity: 0.45;
  }
}
</style>
