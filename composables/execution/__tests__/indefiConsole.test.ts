import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { buildUnoswap, parseUnoswap, routesBetween } from "../onchainSwap";
import {
  INDEFI,
  INDEFI_POOLS,
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

  it("reads a built unoswap route out for the operator", () => {
    const usdc = token("USDC");
    const weth = token("WETH");
    const route = routesBetween(INDEFI_POOLS, usdc, weth).find((r) => r.hops.length === 1)!;
    const amountIn = ethers.parseUnits("1000", 6);
    const { data } = buildUnoswap({ safe: INDEFI.ADDR.safe, route, amountIn, minReturn: ethers.parseUnits("0.37", 18) });
    const inner = indefiInner.unoswap(parseUnoswap(data), data, route, usdc, weth);
    expect(inner.to).toBe(INDEFI.ADDR.oneInch);
    expect(inner.data).toBe(data);
    expect(inner.sig).toMatch(/unoswapTo\(/);
    const byKey = Object.fromEntries(inner.params.map((p) => [p.k, p.v]));
    expect(byKey.sell).toBe("1,000 USDC");
    expect(byKey.minReturn).toBe("0.37 WETH");
    expect(byKey.route).toBe(route.label);
    expect(inner.params.find((p) => p.k === "to")?.pinned).toBe(true);
  });
});

describe("Roles v1 wrap", () => {
  it("wraps for role 1 of the INDEFI modifier", () => {
    const usdc = token("USDC");
    const weth = token("WETH");
    const route = routesBetween(INDEFI_POOLS, usdc, weth)[0];
    const { data } = buildUnoswap({ safe: INDEFI.ADDR.safe, route, amountIn: 1_000_000n, minReturn: 1n });
    const inner = indefiInner.unoswap(parseUnoswap(data), data, route, usdc, weth);
    const wrapped = indefiWrappedPreview(inner);
    expect(indefiValidateWrapped(wrapped)).toBe(true);
    const decoded = ROLES_V1.decodeFunctionData("execTransactionWithRole", wrapped);
    expect(decoded.to).toBe(INDEFI.ADDR.oneInch);
    expect(decoded.value).toBe(0n);
    expect(decoded.data).toBe(data);
    expect(decoded.operation).toBe(0n);
    expect(decoded.role).toBe(1n);
    expect(decoded.shouldRevert).toBe(true);
  });

  it("the manager's real September swap() was wrapped the same way", () => {
    // Same modifier, same role: the wrap of the vault's own history decodes to role 1.
    const decoded = ROLES_V1.decodeFunctionData("execTransactionWithRole", fixture.wethToUsdc.wrapped);
    expect(decoded.role).toBe(1n);
    expect(decoded.to).toBe(INDEFI.ADDR.oneInch);
    expect(decoded.data).toBe(fixture.wethToUsdc.calldata);
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
