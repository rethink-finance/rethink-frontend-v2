<template>
  <div v-if="breadcrumbItems.length === 0" class="fund_name">
    <v-avatar class="fund_name__avatar" :rounded="false" size="3.75rem">
      <img
        :src="fund.photoUrl"
        class="fund_name__avatar_img"
        alt="fund cover image"
      >
    </v-avatar>
    <div class="fund_name__title">
      <p>
        {{ fund?.title }}
      </p>
    </div>
    <div v-if="fund?.strategistName" class="fund_name__title">
      <p>
        |
      </p>
    </div>
    <div
      v-if="fund?.strategistName"
      class="fund_name__subtitle"
    >
      <span>by </span>
      <a
        :href="fund?.strategistUrl"
        target="_blank"
        class="strategist_url"
      >
        {{ fund?.strategistName }}
      </a>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type IFund from "~/types/fund";
import type BreadcrumbItem from "~/types/ui/breadcrumb";

defineProps<{
  fund: IFund;
  breadcrumbItems: BreadcrumbItem[];
}>();
</script>

<style lang="scss" scoped>
.fund_name {
  background-color: $color-bg-transparent;
  border-radius: $default-border-radius;
  padding: 0.5rem 0.62rem;
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  align-items: center;

  @include sm {
    padding: 8px;
  }

  &__avatar {
    border: 0;
  }

  &__avatar_img {
    border-radius: 50%;
    height: 100%;
    width: 100%;
    object-fit: cover;
  }

  &__title {
    font-weight: 700;
    font-size: $text-md;
  }

  &__subtitle {
    font-weight: 500;
    font-size: $text-sm;
    color: $color-light-subtitle;
  }
}

.strategist_url {
  color: $color-light-subtitle;
  text-decoration: none;
  transition: color 0.3s ease;

  &:hover {
    color: $color-primary;
  }
}
</style>
