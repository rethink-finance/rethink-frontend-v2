<template>
  <span
    class="threat_badge"
    :class="`threat_badge--${level}`"
    :title="title"
  >
    <span class="threat_badge__dot" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import type { ThreatLevel } from "~/services/backend/monitoring";

/**
 * A proposal's (or vault's) threat grade. The wording says what to do with
 * it — a "critical" grade means stop and read the flags, "clear" means the
 * rules found nothing to raise — rather than restating the severity scale.
 */
const props = defineProps<{
  level: ThreatLevel;
  title?: string;
}>();

const LABELS: Record<ThreatLevel, string> = {
  critical: "Critical",
  high: "High risk",
  medium: "Review",
  low: "Low",
  info: "Info",
  none: "Clear",
};

const label = computed(() => LABELS[props.level] ?? props.level);
</script>

<style lang="scss" scoped>
.threat_badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.1875rem 0.5rem 0.1875rem 0.4375rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  font-family: $font-mono;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  line-height: 1.2;
  text-transform: uppercase;
  white-space: nowrap;
  color: $color-steel-blue;

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  &--critical {
    color: $color-neg;
    border-color: $color-neg-line;
    background: $color-neg-soft;
  }

  &--high {
    color: $color-neg;
    border-color: $color-neg-line;
  }

  &--medium {
    color: $color-warn;
    border-color: $color-warn-line;
    background: $color-warn-soft;
  }

  &--low {
    color: $color-steel-blue;
  }

  &--info {
    color: $color-text-irrelevant;
  }

  &--none {
    color: $color-success-light;
    border-color: $color-yield-line;
    background: $color-yield-soft;
  }
}
</style>
