import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import {
  buildIntegrationsBatch,
  buildPermissionsPageBatch,
} from "../composables/permissions/integrationsBatch";
import {
  buildProtocolPermissionEntries,
  type IProtocolSelectionState,
} from "../composables/permissions/protocolPermissions";
import type { ICurrentRoleScopes } from "../composables/permissions/roleScopeLogs";

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);
const ARBITRUM = "0xa4b1" as any;
const FUND = "0x111f164d91e3f8169a7043f7094f44af87fb7ca4";
const MODIFIER = "0x583a40de5b558cc04ee50795f9425bfc141c9107";
const USDC = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
const EXECUTOR_KEY = ethers.encodeBytes32String("defaulManagerRole");
const TRADER_KEY = ethers.encodeBytes32String("Trader");

const aave = (targets: string[]): IProtocolSelectionState[] => [
  {
    protocol: "aave_v3",
    enabled: targets.length > 0,
    actions: [{ action: "deposit", enabled: targets.length > 0, params: { targets } }],
  },
];

const NOTHING: ICurrentRoleScopes = { scopes: [], targets: [], latestBlock: 0 };

const share = (roleKey: string | undefined, targets: string[], current = NOTHING) => ({
  chainId: ARBITRUM,
  protocolBuild: buildProtocolPermissionEntries({
    chainId: ARBITRUM,
    rolesModAddress: MODIFIER,
    selections: aave(targets),
    roleKey,
  }),
  current,
  fundAddress: FUND,
  baseToken: USDC,
  rolesModifier: MODIFIER,
  roleKey,
  protocols: ["aave_v3"],
});

const roleKeysOf = (entries: string[]) =>
  entries.map((data) => rolesInterface.parseTransaction({ data })!.args[0]);

/** A save of protocol cards and raw entries only. */
const buildPermissionsStepBatch = (options: {
  roles: ReturnType<typeof share>[];
  rawEntries: string[];
}) =>
  buildPermissionsPageBatch({
    prepopulated: { revokes: [], grants: [] },
    memberEntries: [],
    ...options,
  });

describe("protocol cards of several roles", () => {
  it("grants each role's selections under that role's key", () => {
    const batch = buildPermissionsStepBatch({
      roles: [share(undefined, ["DAI"]), share("Trader", ["USDC"])],
      rawEntries: [],
    });
    const keys = roleKeysOf(batch);
    expect(new Set(keys)).toEqual(new Set([EXECUTOR_KEY, TRADER_KEY]));
    // One role's calls are a block of their own, in the order given.
    expect(keys.lastIndexOf(EXECUTOR_KEY)).toBeLessThan(keys.indexOf(TRADER_KEY));
  });

  it("is the single-role batch when one role is stored", () => {
    const raw = [rolesInterface.encodeFunctionData("scopeTarget", [EXECUTOR_KEY, FUND])];
    expect(
      buildPermissionsStepBatch({ roles: [share(undefined, ["USDC"])], rawEntries: raw }),
    ).toEqual(buildIntegrationsBatch({ ...share(undefined, ["USDC"]), rawEntries: raw }));
  });

  it("sends the raw entries once, last, however many roles are stored", () => {
    const raw = [rolesInterface.encodeFunctionData("scopeTarget", [TRADER_KEY, FUND])];
    const batch = buildPermissionsStepBatch({
      roles: [share(undefined, ["DAI"]), share("Trader", ["USDC"])],
      rawEntries: raw,
    });
    expect(batch.filter((entry) => entry === raw[0])).toHaveLength(1);
    expect(batch[batch.length - 1]).toBe(raw[0]);
  });

  it("takes a role's stale grants back under its own key, sparing only its own Roles-step scopes", () => {
    const transfer = ethers.id("transfer(address,uint256)").slice(0, 10);
    const approve = ethers.id("approve(address,uint256)").slice(0, 10);
    const current: ICurrentRoleScopes = {
      scopes: [
        { target: USDC, selector: transfer },
        { target: USDC, selector: approve },
      ],
      targets: [USDC],
      latestBlock: 1,
    };
    const revoked = (roleKey: string | undefined) =>
      buildPermissionsStepBatch({
        roles: [share(roleKey, [], current)],
        rawEntries: [],
      }).map((data) => rolesInterface.parseTransaction({ data })!);

    const revokedSelectors = (calls: ethers.TransactionDescription[]) =>
      calls.filter((call) => call.name === "revokeFunction").map((call) => call.args[2]);

    // The executor's transfer grant is its "Send funds" switch: left alone,
    // and the token stays open for it.
    const executor = revoked(undefined);
    expect(executor.every((call) => call.args[0] === EXECUTOR_KEY)).toBe(true);
    expect(revokedSelectors(executor)).toContain(approve);
    expect(revokedSelectors(executor)).not.toContain(transfer);
    expect(executor.some((call) => call.name === "revokeTarget")).toBe(false);

    // A custom role has no Roles-step scopes: both go, and the token with them.
    const trader = revoked("Trader");
    expect(trader.every((call) => call.args[0] === TRADER_KEY)).toBe(true);
    expect(revokedSelectors(trader)).toEqual(expect.arrayContaining([approve, transfer]));
    expect(trader.some((call) => call.name === "revokeTarget")).toBe(true);
  });

  it("sends nothing when no role has anything to store", () => {
    expect(buildPermissionsStepBatch({ roles: [], rawEntries: [] })).toEqual([]);
  });
});

describe("buildPermissionsPageBatch", () => {
  const transfer = ethers.id("transfer(address,uint256)").slice(0, 10);
  const approve = ethers.id("approve(address,uint256)").slice(0, 10);
  const call = (name: string, args: unknown[]) => rolesInterface.encodeFunctionData(name, args);
  const names = (entries: string[]) =>
    entries.map((data) => rolesInterface.parseTransaction({ data })!.name);

  const switchRevoke = call("revokeFunction", [EXECUTOR_KEY, FUND, "0x12345678"]);
  const switchGrants = [
    call("scopeTarget", [EXECUTOR_KEY, USDC]),
    call("allowFunction", [EXECUTOR_KEY, USDC, transfer, 0]),
  ];
  const member = call("assignRoles", [FUND, [TRADER_KEY], [true]]);
  const raw = call("scopeTarget", [TRADER_KEY, FUND]);

  it("orders the save: protocol cards, switches (revokes then grants), members, raw", () => {
    const card = share("Trader", ["USDC"]);
    const batch = buildPermissionsPageBatch({
      prepopulated: { revokes: [switchRevoke], grants: switchGrants },
      memberEntries: [member],
      roles: [card],
      rawEntries: [raw],
    });
    const cardCalls = card.protocolBuild.entries.length;
    expect(cardCalls).toBeGreaterThan(0);
    expect(batch.slice(0, cardCalls)).toEqual(card.protocolBuild.entries);
    expect(batch.slice(cardCalls)).toEqual([switchRevoke, ...switchGrants, member, raw]);
  });

  it("is the switches and members alone when no card was touched", () => {
    expect(
      buildPermissionsPageBatch({
        prepopulated: { revokes: [switchRevoke], grants: switchGrants },
        memberEntries: [member],
        roles: [],
        rawEntries: [],
      }),
    ).toEqual([switchRevoke, ...switchGrants, member]);
  });

  it("never clears a token a switch in the same save grants on", () => {
    // Stored: only the protocol's approve on the base token. The card drops
    // it; on its own that would clear the token …
    const current: ICurrentRoleScopes = {
      scopes: [{ target: USDC, selector: approve }],
      targets: [USDC],
      latestBlock: 1,
    };
    const alone = buildPermissionsPageBatch({
      prepopulated: { revokes: [], grants: [] },
      memberEntries: [],
      roles: [share(undefined, [], current)],
      rawEntries: [],
    });
    expect(names(alone)).toContain("revokeTarget");

    // … but not while the same save switches "Send funds" on, and the
    // switch's grant comes after the card's revocations either way.
    const together = buildPermissionsPageBatch({
      prepopulated: { revokes: [], grants: switchGrants },
      memberEntries: [],
      roles: [share(undefined, [], current)],
      rawEntries: [],
    });
    expect(names(together)).not.toContain("revokeTarget");
    expect(together.slice(-2)).toEqual(switchGrants);
  });
});
