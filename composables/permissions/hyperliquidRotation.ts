import { compile, deriveReplaceCalls } from "@rethink-finance/positions-registry";
import { CORE_WRITER } from "~/composables/contracts/contractNames";
import { toRoleKeyBytes32 } from "~/composables/nav/generateNAVPermission";
import { coreWriterAgents } from "~/composables/permissions/coreWriterPatterns";
import type { IPermissionScope } from "~/composables/permissions/revokePermissions";
import type { IConditionNode } from "~/composables/proposal/describeProposalActions";
import { ChainId } from "~/types/enums/chain_id";

/**
 * The admin's "Rotate Hyperliquid API" vault operation, on HyperEVM vaults
 * only: the registry's Hyperliquid `delegate` permission with `rotate` on,
 * which lets the role register ANY address as the vault's Hyperliquid API
 * wallet, and take any off, without a permissions update (reviewer
 * decision 2026-10-23: a prepopulated admin switch, not a field on the
 * protocol card). Whoever holds the admin role can then put any trader on
 * the vault's Hyperliquid account; a trader can never withdraw, but can
 * lose money on purpose, which is why it is the admin's and never the
 * manager's.
 *
 * It owns the admin's whole CoreWriter.sendRawAction scope: the switch
 * grants and revokes it, and the protocol card never offers the admin
 * Hyperliquid's delegate action, so the two cannot write over each other.
 */

export const HYPERLIQUID_ROTATION_KEY = "rotateHyperliquidApi";
export const HYPERLIQUID_ROTATION_LABEL = "Rotate Hyperliquid API";

/** CoreWriter.sendRawAction(bytes): the one function every HyperCore action goes through. */
export const SEND_RAW_ACTION_SELECTOR = "0x17938e13";

/** The registry's id for HyperEVM. */
const HYPEREVM_REGISTRY_CHAIN_ID = 999;

export const isHyperEvm = (chainId?: ChainId | string): boolean =>
  (chainId ?? "").toLowerCase() === ChainId.HYPEREVM;

/** The grant the switch owns, as a scope the stored grants are matched on. */
export const hyperliquidRotationScope = (): IPermissionScope => ({
  target: CORE_WRITER,
  selector: SEND_RAW_ACTION_SELECTOR,
});

/**
 * The Roles calls that grant `roleKey` rotation: the registry's own
 * generator (`delegate` with `rotate`), so the switch stores exactly what
 * the registry would.
 */
export const buildHyperliquidRotationGrant = (rolesModifier: string, roleKey: string): string[] => {
  const { targets } = compile({
    chainId: HYPEREVM_REGISTRY_CHAIN_ID,
    selections: [{ protocol: "hyperliquid", action: "delegate", params: { rotate: true } }],
  });
  return deriveReplaceCalls({
    rolesMod: rolesModifier.toLowerCase(),
    roleKey: toRoleKeyBytes32(roleKey),
    targets,
  }).calls.map((call) => call.data);
};

/**
 * Whether a stored sendRawAction rule is the rotation grant — any address
 * may be registered — rather than one pinned to particular agents.
 */
export const isHyperliquidRotationGrant = (conditions: IConditionNode | undefined): boolean =>
  !!coreWriterAgents(conditions)?.includes("any");
