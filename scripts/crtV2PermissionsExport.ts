/**
 * Writes the CarrotFunding Vault's raw Roles v2 permissions
 * (composables/execution/crtV2Permissions.ts) as the files the create flow's
 * Permissions step takes — one JSON array of calldata per role — plus a
 * review sheet naming what each entry grants.
 *
 * Run with:  npm run crt-v2:export -- <output directory>
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { ethers } from "ethers";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import { CRT_V2_ADDR, CRT_V2_ROLE_KEYS } from "~/composables/execution/crtV2Vault";
import {
  buildCrtV2AdminAcrossFix,
  buildCrtV2AdminRawPermissions,
  buildCrtV2ExecutorRawPermissions,
  crtV2RawPermissionsJson,
  type ICrtV2PermissionEntry,
} from "~/composables/execution/crtV2Permissions";

const out = resolve(process.argv[2] ?? "crt-v2-permissions");
mkdirSync(out, { recursive: true });

const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);

const sheet = (title: string, entries: ICrtV2PermissionEntry[]): string => {
  const rows = entries.map((entry, i) => {
    const parsed = rolesIface.parseTransaction({ data: entry.data })!;
    const target = String(parsed.args[1]);
    const fn = parsed.name === "scopeFunction" ? ` \`${parsed.args[2]}\`` : "";
    return `| ${i + 1} | ${parsed.name}${fn} | \`${target}\` | ${entry.label} | ${entry.data.length / 2 - 1} bytes |`;
  });
  return [
    `## ${title}`,
    "",
    `Role key: \`${ethers.decodeBytes32String(CRT_V2_ROLE_KEYS[entries[0].role])}\` (${CRT_V2_ROLE_KEYS[entries[0].role]})`,
    "",
    "| # | Modifier call | Target | Grants | Size |",
    "|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
};

const admin = buildCrtV2AdminRawPermissions();
const executor = buildCrtV2ExecutorRawPermissions();

writeFileSync(join(out, "admin-raw-permissions.json"), crtV2RawPermissionsJson(admin) + "\n");
writeFileSync(join(out, "executor-raw-permissions.json"), crtV2RawPermissionsJson(executor) + "\n");
const acrossFix = buildCrtV2AdminAcrossFix();
writeFileSync(join(out, "admin-across-fix-raw-permissions.json"), crtV2RawPermissionsJson(acrossFix) + "\n");
writeFileSync(
  join(out, "PERMISSIONS.md"),
  [
    "# CarrotFunding Vault (HyperEVM, Roles v2) — raw permissions",
    "",
    `Modifier \`${CRT_V2_ADDR.roles}\` · Safe \`${CRT_V2_ADDR.safe}\` · fund \`${CRT_V2_ADDR.fund}\``,
    "",
    `Generated ${new Date().toISOString()} by scripts/crtV2PermissionsExport.ts from composables/execution/crtV2Permissions.ts.`,
    "",
    sheet("Admin — additions (adminRole)", admin),
    sheet("Executor — additions (defaultManagerRole)", executor),
    sheet("Admin — Across fix (replaces the depositV3Now scope stored on 2026-10-05)", acrossFix),
  ].join("\n"),
);
console.log(`wrote ${admin.length} admin and ${executor.length} executor entries to ${out}`);
