import type { Ref } from "vue";

/**
 * Seconds until the vault's next planned settlement, ticking once a second.
 *
 * The target is derived — last settlement plus the planned cycle — so a
 * successful settle resets the countdown a full cycle ahead the moment the
 * refreshed NAV data lands, without this composable being told. A vault that
 * has never settled, or whose cycle is a legacy free-text value, has no
 * target and yields undefined throughout.
 *
 * The interval only runs while the page is visible: each tick recomputes from
 * absolute time rather than decrementing, so pausing loses nothing.
 */
export const useSettlementCountdown = (
  lastSettlementMs: Ref<number | undefined>,
  cycleSeconds: Ref<number | undefined>,
) => {
  const nowMs = ref(Date.now());

  const nextSettlementMs = computed<number | undefined>(() => {
    if (!lastSettlementMs.value || !cycleSeconds.value) return undefined;
    return lastSettlementMs.value + cycleSeconds.value * 1000;
  });

  const remainingSeconds = computed<number | undefined>(() => {
    if (nextSettlementMs.value === undefined) return undefined;
    return Math.max(0, Math.floor((nextSettlementMs.value - nowMs.value) / 1000));
  });

  const isOverdue = computed(
    () =>
      nextSettlementMs.value !== undefined &&
      nextSettlementMs.value <= nowMs.value,
  );

  /** "2d 04:12:33", with the day part omitted under a day. */
  const countdownText = computed<string | undefined>(() => {
    const total = remainingSeconds.value;
    if (total === undefined) return undefined;

    const days = Math.floor(total / 86400);
    const pad = (value: number) => String(value).padStart(2, "0");
    const clock = `${pad(Math.floor((total % 86400) / 3600))}:${pad(
      Math.floor((total % 3600) / 60),
    )}:${pad(total % 60)}`;

    return days > 0 ? `${days}d ${clock}` : clock;
  });

  let interval: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    if (interval) clearInterval(interval);
    interval = undefined;
  };
  const start = () => {
    stop();
    nowMs.value = Date.now();
    interval = setInterval(() => {
      nowMs.value = Date.now();
    }, 1000);
  };

  const onVisibilityChange = () => {
    if (document.hidden) stop();
    else start();
  };

  onMounted(() => {
    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
  });
  onBeforeUnmount(() => {
    stop();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });

  return { nextSettlementMs, remainingSeconds, countdownText, isOverdue };
};
