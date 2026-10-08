import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, effectScope, nextTick, ref } from "vue";

const fetchRolesAllowance = vi.fn();
vi.mock("~/composables/permissions/useRoleExecution", () => ({
  fetchRolesAllowance: (...args: unknown[]) => fetchRolesAllowance(...args),
}));

const { useLiveAllowances } = await import("../composables/permissions/useLiveAllowances");

const MODIFIER = "0x5Eb928db6224f41B421E050A3689F66B0698AB8E";
const allowance = (balance: bigint) => ({
  refill: 0n,
  maxRefill: 0n,
  period: 0n,
  balance,
  timestamp: 0n,
});

/** Let every pending read resolve and every watcher run. */
const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
};

afterEach(() => {
  fetchRolesAllowance.mockReset();
});

describe("useLiveAllowances", () => {
  it("reads each key once, and not again because a balance it wrote is being shown", async () => {
    fetchRolesAllowance.mockImplementation((_chain, _modifier, key: string) =>
      // A runaway loop stalls here instead of exhausting the test worker.
      fetchRolesAllowance.mock.calls.length > 10
        ? new Promise(() => undefined)
        : Promise.resolve(allowance(key === "0xa" ? 1n : 2n)),
    );
    const logs = ref<unknown[]>([]);
    const scope = effectScope();
    const shown = scope.run(() => {
      const { liveAllowance } = useLiveAllowances(() => ({
        chainId: "0x1" as any,
        rolesModAddress: MODIFIER,
        keys: ["0xa", "0xb"],
        logs: logs.value,
      }));
      // What the component renders: reading the balances makes them a
      // dependency of whatever shows them.
      return computed(() => [liveAllowance("0xa")?.balance, liveAllowance("0xb")?.balance]);
    })!;

    await settle();
    expect(shown.value).toEqual([1n, 2n]);
    await settle();
    expect(fetchRolesAllowance).toHaveBeenCalledTimes(2);
    scope.stop();
  });

  it("reads the balances again on a new log read, as a Refresh brings", async () => {
    fetchRolesAllowance.mockResolvedValueOnce(allowance(5n)).mockResolvedValueOnce(allowance(4n));
    const logs = ref<unknown[]>([]);
    const scope = effectScope();
    const live = scope.run(() =>
      useLiveAllowances(() => ({
        chainId: "0x1" as any,
        rolesModAddress: MODIFIER,
        keys: ["0xa"],
        logs: logs.value,
      })),
    )!;

    await settle();
    expect(live.liveAllowance("0xa")?.balance).toBe(5n);
    logs.value = [];
    await settle();
    expect(live.liveAllowance("0xa")?.balance).toBe(4n);
    expect(fetchRolesAllowance).toHaveBeenCalledTimes(2);
    scope.stop();
  });

  it("marks a failed read as null and keeps a slow older read from overwriting a newer one", async () => {
    let releaseFirst: (value: unknown) => void = () => undefined;
    fetchRolesAllowance
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockRejectedValueOnce(new Error("rpc down"));
    const logs = ref<unknown[]>([]);
    const scope = effectScope();
    const live = scope.run(() =>
      useLiveAllowances(() => ({
        chainId: "0x1" as any,
        rolesModAddress: MODIFIER,
        keys: ["0xa"],
        logs: logs.value,
      })),
    )!;

    await settle();
    logs.value = [];
    await settle();
    expect(live.liveAllowance("0xa")).toBeNull();
    releaseFirst(allowance(9n));
    await settle();
    expect(live.liveAllowance("0xa")).toBeNull();
    scope.stop();
  });
});
