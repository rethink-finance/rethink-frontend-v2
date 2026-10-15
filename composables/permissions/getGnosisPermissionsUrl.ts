/**
 * Link to the Zodiac Roles app for a modifier. V2 modifiers open on
 * app.zodiac.eco's public route, /public/roles/{chainShort}:{address}/, fully
 * lowercased; legacy v1 modifiers are only readable on the old roles-v1 app
 * with its hash route.
 */
export const getZodiacRolesUrl = (
  chainShort: string,
  roleModAddress: string,
): string =>
  `https://app.zodiac.eco/public/roles/${chainShort.toLowerCase()}:${roleModAddress.toLowerCase()}/`;

export const getGnosisPermissionsUrl = (
  chainShort: string,
  roleModAddress: string,
  isV2: boolean = false,
): string => {
  if (isV2) {
    return getZodiacRolesUrl(chainShort, roleModAddress);
  }
  return `https://roles-v1.gnosisguild.org/#/${chainShort}:${roleModAddress}`;
};
