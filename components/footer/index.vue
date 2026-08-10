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

  /* Mirrors the navbar / <main> container so all three line up. */
  &__inner {
    width: 100%;
    margin: 0 auto;
    padding: 1.625rem 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;

    @include sm {
      width: 90%;
      padding-inline: 0;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
    }
    @include xxl {
      width: 80%;
    }
    @include xxxl {
      width: 75%;
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
