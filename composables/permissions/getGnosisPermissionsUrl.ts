/**
 * Link to the Gnosis Guild Roles app for a modifier. The v2 app lives at
 * roles.gnosisguild.org with a plain /{chainShort}:{address} path; legacy v1
 * modifiers are only readable on the old roles-v1 app with its hash route.
 */
export const getGnosisPermissionsUrl = (
  chainShort: string,
  roleModAddress: string,
  isV2: boolean = false,
): string => {
  if (isV2) {
    return `https://roles.gnosisguild.org/${chainShort}:${roleModAddress.toLowerCase()}`;
  }
  return `https://roles-v1.gnosisguild.org/#/${chainShort}:${roleModAddress}`;
};
