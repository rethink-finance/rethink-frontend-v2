/**
 * The plain-text message a wallet signs to manage its notification settings.
 *
 * Byte-for-byte the backend's copy (notification-auth.service.ts): the server
 * rebuilds this from the address and timestamp it receives and checks the
 * signature against its own rendering, never against text the client sends.
 * Change one, change both.
 */
export const SIGN_IN_STATEMENT =
  "Manage notification settings for this wallet. Signing costs no gas and sends no transaction.";

export const buildSignInMessage = (address: string, issuedAt: string): string =>
  `Rethink Finance wants you to sign in with your Ethereum account:\n${address}\n\n${SIGN_IN_STATEMENT}\n\nIssued At: ${issuedAt}`;
