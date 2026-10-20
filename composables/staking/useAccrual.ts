/**
 * A figure that keeps growing at `perSecond` from `base`, for counters that
 * accrue per block. Repaints on animation frames, so it pauses with the tab.
 */
export const useAccrual = (
  base: MaybeRefOrGetter<number | null>,
  perSecond: MaybeRefOrGetter<number>,
) => {
  const value = ref<number | null>(toValue(base));
  let start = 0;
  let frame = 0;

  const tick = (now: number) => {
    const from = toValue(base);
    value.value = from === null ? null : from + ((now - start) / 1000) * toValue(perSecond);
    frame = requestAnimationFrame(tick);
  };

  onMounted(() => {
    start = performance.now();
    frame = requestAnimationFrame(tick);
  });
  onUnmounted(() => cancelAnimationFrame(frame));

  return value;
};
