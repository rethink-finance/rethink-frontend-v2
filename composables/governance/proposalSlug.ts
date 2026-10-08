/**
 * The proposal page's slug. The app's own links are
 * "<createdBlockNumber>-<proposalId>"; notification links (bell, email,
 * Telegram) carry the bare proposal id. Both name the same proposal, and a
 * proposal id is a decimal uint256, so it never contains a hyphen itself.
 */
export const parseProposalSlug = (slug: string): string => {
  const separator = slug.indexOf("-");
  return separator === -1 ? slug : slug.slice(separator + 1);
};

export const buildProposalSlug = (
  proposalId: string,
  createdBlockNumber?: string | number,
): string =>
  createdBlockNumber ? `${createdBlockNumber}-${proposalId}` : proposalId;
