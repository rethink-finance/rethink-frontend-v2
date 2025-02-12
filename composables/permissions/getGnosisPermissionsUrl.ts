export const getGnosisPermissionsUrl = (chainShort: string, roleModAddress: string): string => {
  return `https://roles-v1.gnosisguild.org/#/${chainShort}:${roleModAddress}`;
}
