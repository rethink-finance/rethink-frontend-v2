import { describe, expect, it } from "vitest";
import { recommendWallet, type WalletSignal } from "../walletRecommendation";

const ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

const walletConnect: WalletSignal = { label: "WalletConnect", installed: false, alwaysAvailable: true };
const ledger: WalletSignal = { label: "Ledger", installed: false, alwaysAvailable: true };
const metamask: WalletSignal = { label: "MetaMask", installed: true };
const rabby: WalletSignal = { label: "Rabby Wallet", installed: true };
const enkryptMissing: WalletSignal = { label: "Enkrypt", installed: false };

describe("recommendWallet", () => {
  it("takes the Safe when the app is open inside one", () => {
    const pick = recommendWallet(
      [{ ...metamask, authorizedAccount: ADDRESS }, { label: "Safe", installed: false, alwaysAvailable: true }],
      "MetaMask",
    );
    expect(pick).toEqual({ label: "Safe", reason: "This app is open inside your Safe" });
  });

  it("does not mistake the Safe-through-WalletConnect row for the Safe app", () => {
    const pick = recommendWallet(
      [metamask, walletConnect, { label: "Safe", installed: false, alwaysAvailable: true, via: "WalletConnect" }],
    );
    expect(pick?.label).toBe("MetaMask");
  });

  it("prefers a wallet already approved for the site, over a more popular one", () => {
    const pick = recommendWallet(
      [metamask, walletConnect, { ...rabby, authorizedAccount: ADDRESS }],
      "MetaMask",
    );
    expect(pick).toEqual({
      label: "Rabby Wallet",
      reason: "Already approved for this site as 0x1234...5678",
    });
  });

  it("among approved wallets, takes the last-used one", () => {
    const pick = recommendWallet(
      [{ ...metamask, authorizedAccount: ADDRESS }, { ...rabby, authorizedAccount: ADDRESS }],
      "Rabby Wallet",
    );
    expect(pick?.label).toBe("Rabby Wallet");
  });

  it("falls back to the last-used wallet while it can still connect", () => {
    expect(recommendWallet([metamask, walletConnect, ledger], "Ledger")).toEqual({
      label: "Ledger",
      reason: "The wallet you used last time",
    });
  });

  it("skips a last-used extension that is no longer installed", () => {
    expect(recommendWallet([metamask, walletConnect, enkryptMissing], "Enkrypt")).toEqual({
      label: "MetaMask",
      reason: "Installed in this browser",
    });
  });

  it("takes the first installed extension in list order", () => {
    expect(recommendWallet([walletConnect, rabby, metamask])?.label).toBe("Rabby Wallet");
  });

  it("sends a browser with no wallet to WalletConnect", () => {
    expect(recommendWallet([walletConnect, ledger, enkryptMissing])).toEqual({
      label: "WalletConnect",
      reason: "No browser wallet found. Scan with your phone or desktop app",
    });
  });

  it("recommends nothing when nothing can connect", () => {
    expect(recommendWallet([enkryptMissing])).toBeUndefined();
  });
});
