import { ethers } from "ethers";

export const RPC = "https://polygon.gateway.tenderly.co";
// The app's role model (origin/main): Admin and Executor are built in, custom roles are named by their key.
// Role 1 — Admin: key "adminRole". Its permissions come from the app's switches (updateSettings, member management).
export const ADMIN_ROLE_KEY_STR = "adminRole";
export const ADMIN_ROLE_KEY = ethers.encodeBytes32String(ADMIN_ROLE_KEY_STR);
// Role 2 — Executor: the key the factory assigns to the creating wallet. On this vault that is "defaultManagerRole"
// (the app resolves either spelling). The app's switches (NAV, flows, base-token transfer) live on the same key.
export const ROLE_KEY_STR = "defaultManagerRole";
export const ROLE_KEY = ethers.encodeBytes32String(ROLE_KEY_STR);
// Role 3 — buyback script. A custom role's name IS its key: letters, digits, dashes, underscores, no spaces.
export const ROLE3_KEY_STR = "Buyback-Executor";
export const ROLE3_KEY = ethers.encodeBytes32String(ROLE3_KEY_STR);
// Keys stored by the first save (block 97023561) that this migration empties.
export const OLD_ROLE2_KEY = ethers.encodeBytes32String("executorRole");
export const OLD_ROLE3_KEY = ethers.encodeBytes32String("buybackExecutorRole");
export const BUYBACK_ALLOWANCE_KEY = ethers.encodeBytes32String("sniBuybackWethDaily");
export const BUYBACK_MAX = ethers.parseEther("0.1");
export const BUYBACK_PERIOD = 86400n; // one refill window per UTC day
export const BUYBACK_ANCHOR = BigInt(Date.UTC(2026, 10, 1) / 1000); // 2026-11-01T00:00:00Z — windows roll over at 00:00 UTC
// Members, mirroring the V1 modifier 0xD1c5…6C10 (V1 role 1 -> executor, V1 role 2 -> buyback). Confirmed by Rok on 2026-11-09.
export const ROLE2_MEMBERS = ["0x8C2eb5359041d2d1Eb12866eC2111eC15eD81e8d", "0xf0d92E2B30A2c99ef515A02Cd28EfF8d21B42F9F"];
export const ROLE3_MEMBERS = ["0x7859CC463D1eEC6448AFF371db3B23B05d02D7Cc", "0xb1C2B62CF20903335f7ABb1c5f0aa26405B31337"];
export const EXECUTOR = ROLE2_MEMBERS[0];
export const BUYBACK = ROLE3_MEMBERS[0];

export const ROLES_MOD = "0x8A984794a920BBd367B3e54362014dE973200aB0";
export const SAFE = "0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF";
export const FACTORY = "0xD45e5D73bcD8625f8B5C4b1b6DD7Ca48Dd47F4F6"; // owner of ROLES_MOD during init
export const FUND = "0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007";
export const DEPLOYER = "0xB5d01172e73559B07ef3CD53dE84459c6BA3a054"; // role member + init-cache owner
export const MULTISIG = "0x83f2492DB796BF0692C90B65DeBB926bd688fAe5";

export const WETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
export const SNI = "0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57";
export const USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
export const USDCE = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
export const WMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
export const TOKENS = [WETH, SNI, USDC];

export const SWAP_ROUTER_02 = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
export const SWAP_ROUTER_01 = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
export const UNIVERSAL_ROUTER = "0x1095692A6237d83C6a72F3F5eFEdb9A670C49223";
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
export const NFPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
export const UNI_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
export const ONEINCH_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
export const KYBER = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5";
export const ODOS_V2 = "0x4E3288c9ca110bCC82bf38F09A7b425c095d92Bf";
export const ODOS_V3 = "0x0D05a7D3448512B78fa8A9e46c4872C88C4a0D05";

export const POOL_WETH_USDC_500 = "0xA4D8c89f0c20efbe54cBa9e7e7a7E509056228D9";
export const POOL_SNI_USDC_3000 = "0x9Ecb733A74B48eE31586c98986F0AA1eD5057c6A";
// 1inch v6 packed dex words from the V1 role-2 permission (protocol bits + pool address)
export const ONEINCH_DEX_WETH_USDC = BigInt("0x200000000000000000000000a4d8c89f0c20efbe54cba9e7e7a7e509056228d9");
export const ONEINCH_DEX_SNI_USDC = BigInt("0x2080000000000000000000009ecb733a74b48ee31586c98986f0aa1ed5057c6a");

export const SPENDERS = [SWAP_ROUTER_02, NFPM, ONEINCH_V6];
export const WETH_USDC_FEES = [100, 500, 3000, 10000];
export const SNI_USDC_FEE = 3000;

export const packPath = (hops: (string | number)[]) =>
  ethers.solidityPacked(hops.map((h) => (typeof h === "number" ? "uint24" : "address")), hops);

// Every multi-hop path the role may use (SNI <-> WETH through USDC). The byte
// strings are symmetric between exactInput and exactOutput: exactOutput reads
// the path in reverse, so the same 8 strings cover both directions.
export const PATHS: string[] = [];
for (const fee of WETH_USDC_FEES) {
  PATHS.push(packPath([SNI, SNI_USDC_FEE, USDC, fee, WETH]));
  PATHS.push(packPath([WETH, fee, USDC, SNI_USDC_FEE, SNI]));
}

export const ERC20_ABI = [
  "function approve(address spender,uint256 amount) returns (bool)",
  "function transfer(address to,uint256 amount) returns (bool)",
  "function transferFrom(address from,address to,uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
];
export const ROUTER02_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountOut,uint256 amountInMaximum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)",
  "function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum) params) payable returns (uint256 amountOut)",
  "function exactOutput((bytes path,address recipient,uint256 amountOut,uint256 amountInMaximum) params) payable returns (uint256 amountIn)",
  "function multicall(bytes[] data) payable returns (bytes[])",
  "function multicall(uint256 deadline,bytes[] data) payable returns (bytes[])",
  "function multicall(bytes32 previousBlockhash,bytes[] data) payable returns (bytes[])",
  "function sweepToken(address token,uint256 amountMinimum,address recipient) payable",
  "function unwrapWETH9(uint256 amountMinimum,address recipient) payable",
  "function refundETH() payable",
  "function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,address[] path,address to) payable returns (uint256)",
  "function selfPermit(address token,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s) payable",
  "function wrapETH(uint256 value) payable",
  "function pull(address token,uint256 value) payable",
];
export const NFPM_ABI = [
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline) params) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
  "function increaseLiquidity((uint256 tokenId,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,uint256 deadline) params) payable returns (uint128 liquidity,uint256 amount0,uint256 amount1)",
  "function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline) params) payable returns (uint256 amount0,uint256 amount1)",
  "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max) params) payable returns (uint256 amount0,uint256 amount1)",
  "function approve(address to,uint256 tokenId)",
  "function setApprovalForAll(address operator,bool approved)",
  "function safeTransferFrom(address from,address to,uint256 tokenId)",
  "function transferFrom(address from,address to,uint256 tokenId)",
  "function burn(uint256 tokenId) payable",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function positions(uint256 tokenId) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)",
  "function multicall(bytes[] data) payable returns (bytes[])",
];
export const ONEINCH_ABI = [
  "function swap(address executor,(address srcToken,address dstToken,address srcReceiver,address dstReceiver,uint256 amount,uint256 minReturnAmount,uint256 flags) desc,bytes data) payable returns (uint256 returnAmount,uint256 spentAmount)",
  "function unoswapTo2(uint256 to,uint256 token,uint256 amount,uint256 minReturn,uint256 dex,uint256 dex2) returns (uint256 returnAmount)",
  "function unoswapTo(uint256 to,uint256 token,uint256 amount,uint256 minReturn,uint256 dex) returns (uint256 returnAmount)",
  "function unoswap(uint256 token,uint256 amount,uint256 minReturn,uint256 dex) returns (uint256 returnAmount)",
  "function clipperSwapTo(address clipperExchange,address recipient,address srcToken,address dstToken,uint256 inputAmount,uint256 outputAmount,uint256 goodUntil,bytes32 r,bytes32 vs) payable returns (uint256)",
];
export const SIG = {
  exactInputSingle: "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))",
  exactOutputSingle: "exactOutputSingle((address,address,uint24,address,uint256,uint256,uint160))",
  exactInput: "exactInput((bytes,address,uint256,uint256))",
  exactOutput: "exactOutput((bytes,address,uint256,uint256))",
  approve: "approve(address,uint256)",
  increaseLiquidity: "increaseLiquidity((uint256,uint256,uint256,uint256,uint256,uint256))",
  decreaseLiquidity: "decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))",
  collect: "collect((uint256,address,uint128,uint128))",
  oneInchSwap: "swap(address,(address,address,address,address,uint256,uint256,uint256),bytes)",
  unoswapTo2: "unoswapTo2(uint256,uint256,uint256,uint256,uint256,uint256)",
};
