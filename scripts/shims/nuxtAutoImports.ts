/**
 * Stand-ins for Nuxt auto-imports that app modules call at load time. The
 * rehearsal scripts bundle app code into plain node with esbuild, where no
 * auto-import exists; `--inject` points free identifiers at these instead.
 * Only what module evaluation touches belongs here — nothing a script's own
 * logic depends on.
 */
export const getChainIcon = (_name: string) => "";
