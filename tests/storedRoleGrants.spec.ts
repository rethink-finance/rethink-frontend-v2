import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import {
  accrueAllowance,
  replayEnabledModules,
  replayRoleMembers,
  storedAllowanceKeys,
  storedUnwrapAdapters,
  type IRoleScopeLog,
} from "../composables/permissions/roleScopeLogs";
import { buildStoredRoleViews } from "../composables/permissions/storedRoleGrants";
import { describeQueuedCalls } from "../composables/permissions/rawPermissionQueue";
import { RolesV2Operator } from "../composables/permissions/rolesV2Permissions";
import {
  buildConditionTree,
  describeConditionTree,
  describePermission,
} from "../composables/proposal/describeProposalActions";
import { summarizePermission } from "../composables/proposal/permissionSummary";

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);

const ADMIN = ethers.encodeBytes32String("adminRole");
const EXECUTOR = ethers.encodeBytes32String("defaultManagerRole");
const EXECUTOR_OLD = ethers.encodeBytes32String("defaulManagerRole");
const TRADER = ethers.encodeBytes32String("trader");

const FUND = "0xeD8f7E3ED5c37D508e8E4725d6970356B8FecE2A";
const MODIFIER = "0x5Eb928db6224f41B421E050A3689F66B0698AB8E";
const BASE_TOKEN = "0xb88339CB7199b77E23DB6E890353E22632Ba630f";
const LENDER = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const MULTISEND = "0x9641d764fc13c8B624c04430C7356C1C7C8102e2";
const ADAPTER = "0x93B7fCbc63ED8a3a24B59e1C3e6649D50B7427c0";

const ALICE = "0xE257160f654A2E3222a343FafC4a71AE45Be5d99";
const BOB = "0x2023b43B9cFc2377EBb20886DcA2603D9D7C41B0";

const TRANSFER = "0xa9059cbb";
const APPROVE = "0x095ea7b3";
const SUPPLY = "0x617ba037";
const UPDATE_SETTINGS = "0xf6c87ad5";
const MULTISEND_SELECTOR = "0x8d80ff0a";

/** Encode one modifier event as the raw log shape the folds take. */
const log = (
  blockNumber: number,
  logIndex: number,
  name: string,
  args: unknown[],
): IRoleScopeLog => {
  const encoded = rolesInterface.encodeEventLog(rolesInterface.getEvent(name)!, args);
  return { topics: encoded.topics, data: encoded.data, blockNumber, logIndex };
};

/** A calldata match whose second argument must stay within an allowance. */
const withinAllowance = (key: string) => [
  { parent: 0, paramType: 5, operator: 5, compValue: "0x" },
  { parent: 0, paramType: 1, operator: 0, compValue: "0x" },
  { parent: 0, paramType: 1, operator: 28, compValue: key },
];

describe("replayRoleMembers", () => {
  it("replays additions and removals per role, the latest write winning", () => {
    const members = replayRoleMembers([
      log(1, 0, "AssignRoles", [ALICE, [EXECUTOR, ADMIN], [true, true]]),
      log(2, 0, "AssignRoles", [BOB, [EXECUTOR], [true]]),
      log(3, 0, "AssignRoles", [ALICE, [EXECUTOR], [false]]),
    ]);
    expect(members.get(EXECUTOR.toLowerCase())).toEqual([BOB]);
    expect(members.get(ADMIN.toLowerCase())).toEqual([ALICE]);
  });

  it("orders the log itself, so a newest-first source replays the same", () => {
    const members = replayRoleMembers([
      log(9, 1, "AssignRoles", [ALICE, [EXECUTOR], [false]]),
      log(9, 0, "AssignRoles", [ALICE, [EXECUTOR], [true]]),
    ]);
    expect(members.get(EXECUTOR.toLowerCase())).toEqual([]);
  });
});

describe("storedUnwrapAdapters", () => {
  it("keeps the latest adapter per (to, selector) and drops one reset to zero", () => {
    expect(
      storedUnwrapAdapters([
        log(1, 0, "SetUnwrapAdapter", [MULTISEND, MULTISEND_SELECTOR, ADAPTER]),
        log(2, 0, "SetUnwrapAdapter", [LENDER, SUPPLY, ADAPTER]),
        log(3, 0, "SetUnwrapAdapter", [LENDER, SUPPLY, ethers.ZeroAddress]),
      ]),
    ).toEqual([{ to: MULTISEND, selector: MULTISEND_SELECTOR, adapter: ADAPTER }]);
  });
});

describe("storedAllowanceKeys", () => {
  it("lists each allowance key once, in the order it was first set", () => {
    const yieldKey = ethers.encodeBytes32String("yieldToMultisig");
    const gasKey = ethers.encodeBytes32String("gas");
    expect(
      storedAllowanceKeys([
        log(1, 0, "SetAllowance", [yieldKey, 10n, 0n, 0n, 0n, 1n]),
        log(2, 0, "SetAllowance", [gasKey, 5n, 0n, 0n, 0n, 1n]),
        log(3, 0, "SetAllowance", [yieldKey, 20n, 0n, 0n, 0n, 1n]),
      ]),
    ).toEqual([yieldKey.toLowerCase(), gasKey.toLowerCase()]);
  });
});

describe("accrueAllowance", () => {
  const allowance = {
    refill: 10n,
    maxRefill: 25n,
    period: 100n,
    balance: 3n,
    timestamp: 1000n,
  };

  it("never refills with a zero period", () => {
    expect(accrueAllowance({ ...allowance, period: 0n }, 10_000n)).toBe(3n);
  });

  it("refills nothing before a whole period has passed", () => {
    expect(accrueAllowance(allowance, 1099n)).toBe(3n);
  });

  it("adds one refill per whole period elapsed", () => {
    expect(accrueAllowance(allowance, 1100n)).toBe(13n);
    expect(accrueAllowance(allowance, 1199n)).toBe(13n);
  });

  it("caps the refilled balance at maxRefill", () => {
    expect(accrueAllowance(allowance, 1300n)).toBe(25n);
  });

  it("leaves a balance already above the cap where it is", () => {
    expect(accrueAllowance({ ...allowance, balance: 40n }, 5000n)).toBe(40n);
  });

  it("reports an allowance whose refill overflows the contract's uint128 maths as unusable", () => {
    const max = (1n << 128n) - 1n;
    expect(
      accrueAllowance({ refill: max, maxRefill: max, period: 100n, balance: 1n, timestamp: 1000n }, 1100n),
    ).toBeNull();
  });

  it("reports an allowance whose period overflows the contract's uint64 timestamp as unusable", () => {
    expect(
      accrueAllowance({ ...allowance, period: (1n << 64n) - 1n, timestamp: 1000n }, 1100n),
    ).toBeNull();
  });
});

describe("replayEnabledModules", () => {
  it("drops a module the modifier disabled and brings it back when re-enabled", () => {
    const assigned = log(1, 0, "AssignRoles", [ALICE, [EXECUTOR], [true]]);
    expect(replayEnabledModules([assigned])).toEqual(new Set([ALICE.toLowerCase()]));
    const disabled = log(2, 0, "DisabledModule", [ALICE]);
    expect(replayEnabledModules([assigned, disabled])).toEqual(new Set());
    expect(
      replayEnabledModules([assigned, disabled, log(3, 0, "EnabledModule", [ALICE])]),
    ).toEqual(new Set([ALICE.toLowerCase()]));
  });
});

describe("buildStoredRoleViews", () => {
  it("lists nothing for a modifier with no live role", () => {
    expect(buildStoredRoleViews([])).toEqual([]);
  });

  it("lists the admin, the executor and custom roles with their members and grants", () => {
    const views = buildStoredRoleViews(
      [
        // The custom role appears first in the log, but is listed last.
        log(1, 0, "AssignRoles", [BOB, [TRADER], [true]]),
        log(1, 1, "ScopeTarget", [TRADER, LENDER]),
        log(1, 2, "AllowFunction", [TRADER, LENDER, SUPPLY, 0]),
        log(2, 0, "AssignRoles", [ALICE, [EXECUTOR], [true]]),
        log(2, 1, "ScopeTarget", [EXECUTOR, BASE_TOKEN]),
        log(2, 2, "ScopeFunction", [EXECUTOR, BASE_TOKEN, TRANSFER, withinAllowance(TRADER), 0]),
        log(2, 3, "ScopeFunction", [EXECUTOR, BASE_TOKEN, APPROVE, withinAllowance(TRADER), 0]),
        log(3, 0, "ScopeTarget", [ADMIN, FUND]),
        log(3, 1, "AllowFunction", [ADMIN, FUND, UPDATE_SETTINGS, 0]),
        log(3, 2, "ScopeTarget", [ADMIN, MODIFIER]),
      ],
    );

    expect(views.map((view) => [view.kind, view.number, view.name, view.label])).toEqual([
      ["admin", 1, "Admin", "adminRole"],
      ["executor", 2, "Executor", "defaultManagerRole"],
      ["custom", 3, "trader", "trader"],
    ]);

    const [admin, executor, trader] = views;
    expect(admin.members).toEqual([]);
    expect(admin.contracts).toBe(2);
    expect(admin.functions).toBe(1);
    // The modifier is opened with nothing allowed on it.
    expect(admin.emptyTargets).toEqual([MODIFIER]);

    expect(executor.members).toEqual([ALICE]);
    expect(executor.contracts).toBe(1);
    expect(executor.functions).toBe(2);
    expect(executor.emptyTargets).toEqual([]);
    expect(executor.allowances).toEqual([{ key: TRADER.toLowerCase(), use: "amount" }]);

    expect(trader.members).toEqual([BOB]);
    expect(trader.keyBytes).toBe(TRADER.toLowerCase());
    expect(trader.functions).toBe(1);
    expect(trader.disabledMembers).toEqual([]);
  });

  it("lists both spellings of the executor's key when both are in use", () => {
    const views = buildStoredRoleViews(
      [
        log(1, 0, "AssignRoles", [ALICE, [EXECUTOR_OLD], [true]]),
        log(2, 0, "AssignRoles", [BOB, [EXECUTOR], [true]]),
      ],
    );
    expect(views.map((view) => [view.kind, view.label, view.members])).toEqual([
      ["executor", "defaulManagerRole", [ALICE]],
      ["executor", "defaultManagerRole", [BOB]],
    ]);
  });

  it("leaves out grants that let nothing through", () => {
    const views = buildStoredRoleViews(
      [
        // A role whose only state is function grants on a revoked target.
        log(1, 0, "ScopeTarget", [TRADER, LENDER]),
        log(1, 1, "AllowFunction", [TRADER, LENDER, SUPPLY, 0]),
        log(2, 0, "RevokeTarget", [TRADER, LENDER]),
        // The executor keeps a grant on a target it can no longer reach.
        log(3, 0, "ScopeTarget", [EXECUTOR, BASE_TOKEN]),
        log(3, 1, "AllowFunction", [EXECUTOR, BASE_TOKEN, TRANSFER, 0]),
        log(3, 2, "ScopeTarget", [EXECUTOR, LENDER]),
        log(3, 3, "AllowFunction", [EXECUTOR, LENDER, SUPPLY, 0]),
        log(4, 0, "RevokeTarget", [EXECUTOR, LENDER]),
      ],
    );
    expect(views.map((view) => view.label)).toEqual(["defaultManagerRole"]);
    expect(views[0].contracts).toBe(1);
    expect(views[0].functions).toBe(1);
    expect(
      describeQueuedCalls(views[0].entries).map((call) => call.description.target),
    ).toEqual([BASE_TOKEN, BASE_TOKEN]);
  });

  it("counts a contract open to any function, and ignores grants it shadows", () => {
    const [executor] = buildStoredRoleViews(
      [
        log(1, 0, "AllowTarget", [EXECUTOR, LENDER, 1]),
        log(1, 1, "AllowFunction", [EXECUTOR, LENDER, SUPPLY, 0]),
      ],
    );
    expect(executor.contracts).toBe(1);
    expect(executor.openContracts).toBe(1);
    expect(executor.functions).toBe(0);
    expect(describeQueuedCalls(executor.entries).map((call) => call.name)).toEqual([
      "allowTarget",
    ]);
  });

  it("keeps a role that is held but granted nothing", () => {
    const views = buildStoredRoleViews(
      [log(1, 0, "AssignRoles", [ALICE, [ADMIN], [true]])],
    );
    expect(views).toHaveLength(1);
    expect(views[0].members).toEqual([ALICE]);
    expect(views[0].entries).toEqual([]);
    expect(views[0].contracts).toBe(0);
  });
  it("flags members whose module the modifier disabled", () => {
    const [executor] = buildStoredRoleViews([
      log(1, 0, "AssignRoles", [ALICE, [EXECUTOR], [true]]),
      log(1, 1, "AssignRoles", [BOB, [EXECUTOR], [true]]),
      log(2, 0, "DisabledModule", [BOB]),
    ]);
    expect(executor.members).toEqual([ALICE, BOB]);
    expect(executor.disabledMembers).toEqual([BOB]);
  });

  it("never lists the zero key, which the modifier refuses to authorize", () => {
    const views = buildStoredRoleViews([
      log(1, 0, "AssignRoles", [ALICE, [ethers.ZeroHash], [true]]),
      log(1, 1, "ScopeTarget", [ethers.ZeroHash, LENDER]),
      log(1, 2, "AllowFunction", [ethers.ZeroHash, LENDER, SUPPLY, 0]),
    ]);
    expect(views).toEqual([]);
  });
});

describe("call-level budgets in a condition tree", () => {
  // sciETH's executor: plain ETH sends to the admin multisig, within an
  // ETH allowance. The budget sits beside the (absent) arguments.
  const conditions = [
    { parent: 0, paramType: 5, operator: RolesV2Operator.Matches, compValue: "0x" },
    { parent: 0, paramType: 0, operator: RolesV2Operator.EtherWithinAllowance, compValue: ethers.encodeBytes32String("yieldToMultisig") },
  ];

  it("does not name the budget after an argument", () => {
    expect(describeConditionTree(buildConditionTree(conditions), [])).toEqual([
      { depth: 0, label: "", text: "ETH sent must stay within allowance \"yieldToMultisig\"" },
    ]);
  });

  it("numbers the arguments after a budget without counting it", () => {
    const inputs = [ethers.ParamType.from("address to")];
    const lines = describeConditionTree(
      buildConditionTree([
        { parent: 0, paramType: 5, operator: RolesV2Operator.Matches, compValue: "0x" },
        { parent: 0, paramType: 1, operator: RolesV2Operator.EqualTo, compValue: ethers.zeroPadValue(ALICE, 32) },
        { parent: 0, paramType: 0, operator: RolesV2Operator.CallWithinAllowance, compValue: ethers.encodeBytes32String("calls") },
      ]),
      inputs,
    );
    expect(lines.map((line) => line.label)).toEqual(["to (address)", ""]);
  });

  it("gives no slot to any zero-width child, the way the modifier decodes it", () => {
    const inputs = [ethers.ParamType.from("address to"), ethers.ParamType.from("uint256 amount")];
    const lines = describeConditionTree(
      buildConditionTree([
        { parent: 0, paramType: 5, operator: RolesV2Operator.Matches, compValue: "0x" },
        { parent: 0, paramType: 0, operator: RolesV2Operator.Pass, compValue: "0x" },
        { parent: 0, paramType: 1, operator: RolesV2Operator.EqualTo, compValue: ethers.zeroPadValue(ALICE, 32) },
      ]),
      inputs,
    );
    expect(lines.find((line) => !line.muted)?.label).toBe("to (address)");
  });

  it("does not read a combination carrying a budget argument by argument", () => {
    const pinned = (who: string) => ethers.zeroPadValue(who, 32);
    const description = describePermission("scopeFunction", {
      roleKey: EXECUTOR,
      targetAddress: BASE_TOKEN,
      selector: TRANSFER,
      conditions: [
        { parent: 0, paramType: 0, operator: RolesV2Operator.And, compValue: "0x" },
        { parent: 0, paramType: 0, operator: RolesV2Operator.Or, compValue: "0x" },
        { parent: 1, paramType: 5, operator: RolesV2Operator.Matches, compValue: "0x" },
        { parent: 1, paramType: 5, operator: RolesV2Operator.Matches, compValue: "0x" },
        { parent: 2, paramType: 0, operator: RolesV2Operator.EtherWithinAllowance, compValue: TRADER },
        { parent: 2, paramType: 1, operator: RolesV2Operator.EqualTo, compValue: pinned(ALICE) },
        { parent: 3, paramType: 0, operator: RolesV2Operator.EtherWithinAllowance, compValue: TRADER },
        { parent: 3, paramType: 1, operator: RolesV2Operator.EqualTo, compValue: pinned(BOB) },
      ],
      options: 0,
    });
    const summary = summarizePermission(description, {
      roleName: () => "The executor",
      label: () => undefined,
      inputs: [ethers.ParamType.from("address to"), ethers.ParamType.from("uint256 amount")],
      functionName: "transfer",
    });
    expect(summary?.lines).toEqual([["Limits: see the exact rule"]]);
  });

  it("leaves the summary to the exact rule rather than drop the budget", () => {
    const description = describePermission("scopeFunction", {
      roleKey: EXECUTOR,
      targetAddress: ALICE,
      selector: "0x00000000",
      conditions,
      options: 1,
    });
    const summary = summarizePermission(description, {
      roleName: () => "The executor",
      label: () => undefined,
      inputs: [],
    });
    expect(summary?.lines).toEqual([["Limits: see the exact rule"]]);
  });
});
