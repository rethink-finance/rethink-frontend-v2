<template>
  <div class="deposit_redeem_notification">
    <div>
      <Icon name="ExclamationMarkCircleIcon" size="1.5rem" />
    </div>

    <p>
      The deposit and redeem requests are settled within the planned Settlement Cycle
      of <span class="text-primary">14 days</span>.
      You can learn more about how settlements work <a href="bebe">here</a>.
    </p>
  </div>
</template>

<style lang="scss" scoped>
.deposit_redeem_notification {
  display: flex;
  margin: 1.75rem 0;
  padding: 1rem;
  gap: 1.5rem;

  border-radius: 0.25rem;
  border: 1px solid rgba(246, 249, 255, 0.08);
  background: rgba(246, 249, 255, 0.04);
}
</style>
