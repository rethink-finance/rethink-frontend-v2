import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { parseOneInchSwap } from "../oneInchSwap";
import {
  INDEFI,
  INDEFI_SWAP_RULES,
  INDEFI_TOKENS,
  indefiInner,
  indefiToken,
  indefiValidateWrapped,
  indefiWrappedPreview,
  parseAmount,
} from "../indefiConsole";
import fixture from "./mock_data/indefi_swap_calldata.json";

const ROLES_V1 = new ethers.Interface([
  "function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,uint16 role,bool shouldRevert)",
]);
const ERC20 = new ethers.Interface(["function approve(address spender,uint256 amount)"]);

const token = (symbol: string) => INDEFI_TOKENS.find((t) => t.symbol === symbol)!;

describe("INDEFI whitelist facts", () => {
  it("permits buying exactly the three assets the modifier lists", () => {
    expect(INDEFI_SWAP_RULES.permittedDst.map((t) => t.symbol)).toEqual(["USDC", "WETH", "AERO"]);
    expect(INDEFI_SWAP_RULES.safe).toBe(INDEFI.ADDR.safe);
  });

  it("resolves tokens case-insensitively and nothing else", () => {
    expect(indefiToken(token("WETH").address.toLowerCase())?.symbol).toBe("WETH");
    expect(indefiToken("0x000000000000000000000000000000000000dEaD")).toBeUndefined();
  });
});

describe("inner calls", () => {
  it("approves the router, unlimited, on the token itself", () => {
    const inner = indefiInner.approve(token("USDC"));
    expect(inner.to).toBe(token("USDC").address);
    const [spender, amount] = ERC20.decodeFunctionData("approve", inner.data);
    expect(spender).toBe(INDEFI.ADDR.oneInch);
    expect(amount).toBe(ethers.MaxUint256);
    expect(inner.params.find((p) => p.k === "spender")?.pinned).toBe(true);
  });

  it("passes a swap's calldata through untouched and reads it out", () => {
    const hex = fixture.wethToUsdc.calldata;
    const call = parseOneInchSwap(hex);
    const inner = indefiInner.swap(call, hex, token("WETH"), token("USDC"), "Uniswap V3");
    expect(inner.to).toBe(INDEFI.ADDR.oneInch);
    expect(inner.data).toBe(hex);
    const byKey = Object.fromEntries(inner.params.map((p) => [p.k, p.v]));
    expect(byKey.sell).toBe("1.458602 WETH");
    expect(byKey.buy).toBe("USDC");
    expect(byKey.minReturn).toBe("3,969.275285 USDC");
    expect(byKey.route).toBe("Uniswap V3");
    expect(inner.params.find((p) => p.k === "dstReceiver")?.pinned).toBe(true);
  });
});

describe("Roles v1 wrap", () => {
  it("wraps for role 1 of the INDEFI modifier, exactly as the vault's own history shows", () => {
    const hex = fixture.wethToUsdc.calldata;
    const inner = indefiInner.swap(parseOneInchSwap(hex), hex, token("WETH"), token("USDC"));
    const wrapped = indefiWrappedPreview(inner);
    expect(indefiValidateWrapped(wrapped)).toBe(true);
    const decoded = ROLES_V1.decodeFunctionData("execTransactionWithRole", wrapped);
    expect(decoded.to).toBe(INDEFI.ADDR.oneInch);
    expect(decoded.value).toBe(0n);
    expect(decoded.data).toBe(hex);
    expect(decoded.operation).toBe(0n);
    expect(decoded.role).toBe(1n);
    expect(decoded.shouldRevert).toBe(true);
    // The manager's real transaction of 2026-09-21 wrapped the same way.
    expect(wrapped).toBe(fixture.wethToUsdc.wrapped);
  });

  it("flags anything that is not a v1 wrap", () => {
    expect(indefiValidateWrapped("0xc6fe8747")).toBe(false);
    expect(indefiValidateWrapped("0x6928e74b0")).toBe(false);
  });
});

describe("parseAmount", () => {
  it("turns typed amounts into base units and refuses the rest", () => {
    expect(parseAmount("22753.749962", 6)).toBe(22753749962n);
    expect(parseAmount("0", 6)).toBeNull();
    expect(parseAmount("", 6)).toBeNull();
    expect(parseAmount("1.1234567", 6)).toBeNull();
    expect(parseAmount("abc", 6)).toBeNull();
  });
});
