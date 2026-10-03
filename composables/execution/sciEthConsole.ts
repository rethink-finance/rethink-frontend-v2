import { ethers } from "ethers";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ChainId } from "~/types/enums/chain_id";
import type { IRoleCall } from "~/composables/permissions/useRoleExecution";

/**
 * Scientific Vote Vault (sciETH) execution console: addresses, one-block state
 * read, the 1:1 accounting, and the calldata for every action the executor
 * role is allowed to take.
 *
 * The vault's promise is that a share is always worth exactly one ETH:
 * depositors lend their ETH, its staking yield funds Scientific Vote, and the
 * principal never moves. Two facts make that work and both are encoded here:
 *
 * 1. What the NAV counts. WETH in the Safe and in the vault contract (the
 *    vault adds those itself, live), ETH staked in validators, unbonded
 *    principal still inside the staking vault, and stETH in the Safe. Plain
 *    ETH in the Safe and unclaimed rewards are deliberately NOT counted.
 * 2. Yield therefore leaves as plain ETH: rewards are claimed into the Safe,
 *    where they do not touch the share price, and sent on from there.
 *
 * The accounting below answers the one question the page exists for: how much
 * of the plain ETH in the Safe is yield that may go, and how much is
 * depositors' principal that happens to be unwrapped right now.
 */
export const SCI = {
  CHAIN: ChainId.ETHEREUM,
  EXPLORER: "https://etherscan.io",
  ROLE: "defaulManagerRole",
  /** Roles v2 allowance key the ETH transfer to the multisig is metered by. */
  ALLOWANCE_KEY: ethers.encodeBytes32String("yieldToMultisig"),
  ADDR: {
    fund: "0x2741408077cd7C7D3943D0142bafAE28c97EAA35",
    safe: "0xfBF17BFf29D7798626E1188272aFDA107152F070",
    roles: "0x02b3BD4BD280ECF97E9ff60f9390b47B750cc8c6",
    multisig: "0xf0b31Db69b57023b2050eCa2A32932Dd0CEac9E9",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    steth: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    stakingHub: "0xA2A9C501D1D29fF696E7045c05DeEf1ed7511143",
    /** StakingHub.predictVaultAddress(safe, 0); empty until createVault(0) runs. */
    stakingVault: "0x51CDD86C08319283aFc8d9a797efaa0458DB6343",
    navExecutor: "0x6Bcbc7959CE79b8F27efe1EAe504f98CBe2647A8",
    /** CoW Protocol: pulls the sell token at settlement, so it is what stETH is approved to. */
    cowRelayer: "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110",
    cowSettlement: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41",
    /** Pre-signs one fully specified order on the settlement contract; delegatecall only. */
    cowSigner: "0x23dA9AdE38E4477b23770DeD512fD37b12381FAB",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    /**
     * Safe's MultiSendCallOnly 1.4.1 and Gnosis Guild's unwrapper for it. When
     * the modifier is told about the pair (setTransactionUnwrapper), a batch
     * sent through the role is taken apart and every call in it is checked
     * against the role on its own: a batch can do nothing the role could not
     * do call by call, but it does it in one transaction.
     */
    multiSend: "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
    multiSendUnwrapper: "0x93B7fCbc63ED8a3a24B59e1C3e6649D50B7427c0",
  },
  /** One validator. The staking vault only takes whole multiples of it. */
  VALIDATOR: 32n * 10n ** 18n,
  COW_API: "https://api.cow.fi/mainnet/api/v1",
  COW_EXPLORER: "https://explorer.cow.fi/orders",
  /** Differences below this are rounding (stETH moves by a wei or two per transfer). */
  DUST: 10n ** 12n,
} as const;

const A = SCI.ADDR;

const IF = {
  erc20: new ethers.Interface([
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner,address spender) view returns (uint256)",
    "function approve(address spender,uint256 amount)",
    "function transfer(address to,uint256 amount)",
  ]),
  cowSigner: new ethers.Interface([
    "function signOrder((address sellToken,address buyToken,address receiver,uint256 sellAmount,uint256 buyAmount,uint32 validTo,bytes32 appData,uint256 feeAmount,bytes32 kind,bool partiallyFillable,bytes32 sellTokenBalance,bytes32 buyTokenBalance) order,uint32 validDuration,uint256 feeAmountBP)",
    "function unsignOrder((address sellToken,address buyToken,address receiver,uint256 sellAmount,uint256 buyAmount,uint32 validTo,bytes32 appData,uint256 feeAmount,bytes32 kind,bool partiallyFillable,bytes32 sellTokenBalance,bytes32 buyTokenBalance) order)",
  ]),
  weth: new ethers.Interface([
    "function deposit() payable",
    "function withdraw(uint256 amount)",
  ]),
  lido: new ethers.Interface(["function submit(address referral) payable returns (uint256)"]),
  hub: new ethers.Interface([
    "function createVault(uint256 initialStakeQuota) returns (address)",
    "function vaultOfStaker(address) view returns (address)",
  ]),
  staking: new ethers.Interface([
    "function stakedBalance() view returns (uint256)",
    "function withdrawablePrincipal() view returns (uint256)",
    "function claimableRewards() view returns (uint256)",
    "function stakeQuota() view returns (uint256)",
    "function requestStakeQuota(uint256 amount)",
    "function withdrawPrincipal()",
    "function claimRewards()",
  ]),
  fund: new ethers.Interface([
    "function name() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function totalNAV() view returns (uint256)",
    "function _feeBal() view returns (uint256)",
    "function _navUpdateLatestTime() view returns (uint256)",
    "function getCurrentPendingDepositBal() view returns (uint256)",
    "function getCurrentPendingWithdrawalBal() view returns (uint256)",
    "function executeNAVUpdate(address navExecutor)",
  ]),
  roles: new ethers.Interface([
    "function allowances(bytes32) view returns (uint128 refill,uint128 maxRefill,uint64 period,uint128 balance,uint64 timestamp)",
    "function unwrappers(bytes32) view returns (address)",
  ]),
  multiSend: new ethers.Interface(["function multiSend(bytes transactions) payable"]),
  multicall: new ethers.Interface([
    "function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[])",
    "function getEthBalance(address) view returns (uint256)",
    "function getBlockNumber() view returns (uint256)",
    "function getCurrentBlockTimestamp() view returns (uint256)",
  ]),
};

const MULTISEND_SELECTOR = "0x8d80ff0a";
/** How Roles v2 keys its unwrappers: the target address, then the selector, right-padded. */
const MULTISEND_KEY = ethers.zeroPadBytes(
  ethers.solidityPacked(["address", "bytes4"], [A.multiSend, MULTISEND_SELECTOR]),
  32,
);

/* -------------------------------------------------------------------------- */
/* State                                                                      */
/* -------------------------------------------------------------------------- */

export interface SciAllowance {
  /** What can be sent right now, refills already applied. */
  available: bigint;
  max: bigint;
  refill: bigint;
  /** Seconds; 0 means the budget never refills. */
  period: number;
  /** Unix seconds of the next refill, or null when there is none to wait for. */
  nextRefillAt: number | null;
}

export interface SciState {
  block: number;
  /** Chain time of that block, unix seconds. */
  now: number;
  safeEth: bigint;
  safeWeth: bigint;
  safeSteth: bigint;
  /** How much stETH the CoW relayer may pull from the Safe. */
  stethCowAllowance: bigint;
  /**
   * The modifier knows how to take a MultiSend batch apart, so several calls
   * can go out as one transaction. Without it, moving principal between WETH
   * and a staked position takes separate transactions, and the NAV reads
   * wrong in between.
   */
  batching: boolean;
  /** WETH parked in the vault contract: what redemptions are paid from. */
  fundWeth: bigint;
  multisigEth: bigint;
  staking: {
    /** False until StakingHub.createVault(0) has run. */
    exists: boolean;
    staked: bigint;
    /** Unbonded principal still inside the staking vault. */
    withdrawable: bigint;
    claimableRewards: bigint;
    /** How much more the operator has approved for staking. */
    quota: bigint;
  };
  vault: {
    /** False while the vault is still in the create flow. */
    finalized: boolean;
    supply: bigint;
    /** The vault's own totalNAV() right now; null before it is finalized. */
    totalNav: bigint | null;
    feeBal: bigint;
    /** Unix seconds of the last NAV update, 0 if there has been none. */
    lastNavUpdate: number;
    pendingDeposits: bigint;
    /** Shares waiting to be redeemed. */
    pendingWithdrawShares: bigint;
  };
  allowance: SciAllowance;
}

/**
 * Raw eth_call over the chain's configured RPCs: try each until one answers.
 * Same rule docConsole follows, kept local because a console must not depend
 * on another vault's module.
 */
const ethCall = async (to: string, data: string): Promise<string> => {
  const rpcUrls = useWeb3Store().networkRpcUrls(SCI.CHAIN);
  let lastError: any;
  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to, data }, "latest"],
        }),
      });
      const json = await response.json();
      if (json.error) throw new Error(json.error.message);
      if (typeof json.result !== "string") throw new Error("empty eth_call result");
      return json.result;
    } catch (error: any) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("No RPC answered.");
};

/**
 * The budget as the modifier will see it on the next send. Roles stores the
 * balance as of the last spend and only applies refills lazily, so the stored
 * number reads low (often zero) until someone sends; this replays the same
 * accrual rule (AllowanceTracker._accruedAllowance) against chain time.
 */
export const accrueAllowance = (
  stored: { refill: bigint; maxRefill: bigint; period: bigint; balance: bigint; timestamp: bigint },
  now: number,
): SciAllowance => {
  const period = Number(stored.period);
  let balance = stored.balance;
  let timestamp = Number(stored.timestamp);
  if (period > 0 && now >= timestamp + period) {
    const intervals = BigInt(Math.floor((now - timestamp) / period));
    if (balance < stored.maxRefill) {
      const grown = balance + stored.refill * intervals;
      balance = grown < stored.maxRefill ? grown : stored.maxRefill;
    }
    timestamp += period * Number(intervals);
  }
  const full = balance >= stored.maxRefill;
  return {
    available: balance,
    max: stored.maxRefill,
    refill: stored.refill,
    period,
    nextRefillAt: period > 0 && !full ? timestamp + period : null,
  };
};

/**
 * Everything the page shows, read in ONE multicall so every figure is from
 * the same block: the 1:1 arithmetic is a difference of large numbers, and
 * balances read a block apart would show a gap that is not there.
 */
export const sciReadState = async (): Promise<SciState> => {
  const request = sciStateCall();
  return sciDecodeState(await ethCall(request.to, request.data));
};

/** The one call that reads everything. Split from its decoding so a dry run can replay it on simulated state. */
export const sciStateCall = (): { to: string; data: string } => {
  const call = (target: string, callData: string) => ({ target, allowFailure: true, callData });
  const mc = (name: string, args: any[] = []) => call(A.multicall3, IF.multicall.encodeFunctionData(name, args));
  const calls = [
    mc("getBlockNumber"), // 0
    mc("getCurrentBlockTimestamp"), // 1
    mc("getEthBalance", [A.safe]), // 2
    mc("getEthBalance", [A.multisig]), // 3
    call(A.weth, IF.erc20.encodeFunctionData("balanceOf", [A.safe])), // 4
    call(A.weth, IF.erc20.encodeFunctionData("balanceOf", [A.fund])), // 5
    call(A.steth, IF.erc20.encodeFunctionData("balanceOf", [A.safe])), // 6
    call(A.stakingHub, IF.hub.encodeFunctionData("vaultOfStaker", [A.safe])), // 7
    call(A.stakingVault, IF.staking.encodeFunctionData("stakedBalance")), // 8
    call(A.stakingVault, IF.staking.encodeFunctionData("withdrawablePrincipal")), // 9
    call(A.stakingVault, IF.staking.encodeFunctionData("claimableRewards")), // 10
    call(A.stakingVault, IF.staking.encodeFunctionData("stakeQuota")), // 11
    call(A.fund, IF.fund.encodeFunctionData("name")), // 12
    call(A.fund, IF.fund.encodeFunctionData("totalSupply")), // 13
    call(A.fund, IF.fund.encodeFunctionData("totalNAV")), // 14
    call(A.fund, IF.fund.encodeFunctionData("_feeBal")), // 15
    call(A.fund, IF.fund.encodeFunctionData("_navUpdateLatestTime")), // 16
    call(A.fund, IF.fund.encodeFunctionData("getCurrentPendingDepositBal")), // 17
    call(A.fund, IF.fund.encodeFunctionData("getCurrentPendingWithdrawalBal")), // 18
    call(A.roles, IF.roles.encodeFunctionData("allowances", [SCI.ALLOWANCE_KEY])), // 19
    call(A.steth, IF.erc20.encodeFunctionData("allowance", [A.safe, A.cowRelayer])), // 20
    call(A.roles, IF.roles.encodeFunctionData("unwrappers", [MULTISEND_KEY])), // 21
  ];
  return { to: A.multicall3, data: IF.multicall.encodeFunctionData("aggregate3", [calls]) };
};

export const sciDecodeState = (raw: string): SciState => {
  const results = IF.multicall.decodeFunctionResult("aggregate3", raw)[0] as { success: boolean; returnData: string }[];

  // A call to an address with no code "succeeds" with empty data, and an
  // uninitialized vault answers some views with a revert: both read as absent.
  const uint = (i: number): bigint | null => {
    const r = results[i];
    if (!r?.success || r.returnData.length < 66) return null;
    return BigInt(r.returnData.slice(0, 66));
  };
  const text = (i: number): string => {
    const r = results[i];
    if (!r?.success || r.returnData.length < 130) return "";
    try {
      return ethers.AbiCoder.defaultAbiCoder().decode(["string"], r.returnData)[0];
    } catch {
      return "";
    }
  };

  const now = Number(uint(1) ?? BigInt(Math.floor(Date.now() / 1000)));
  const vaultOfStaker = results[7]?.success && results[7].returnData.length >= 66
    ? ethers.getAddress("0x" + results[7].returnData.slice(26, 66))
    : ethers.ZeroAddress;
  const stakingExists = vaultOfStaker.toLowerCase() === A.stakingVault.toLowerCase();

  const allowanceRaw = results[19]?.success && results[19].returnData.length >= 2 + 64 * 5
    ? IF.roles.decodeFunctionResult("allowances", results[19].returnData)
    : null;

  const finalized = text(12) !== "";
  return {
    block: Number(uint(0) ?? 0n),
    now,
    safeEth: uint(2) ?? 0n,
    multisigEth: uint(3) ?? 0n,
    safeWeth: uint(4) ?? 0n,
    fundWeth: uint(5) ?? 0n,
    safeSteth: uint(6) ?? 0n,
    stethCowAllowance: uint(20) ?? 0n,
    batching:
      !!results[21]?.success &&
      results[21].returnData.length >= 66 &&
      results[21].returnData.slice(26, 66).toLowerCase() === A.multiSendUnwrapper.slice(2).toLowerCase(),
    staking: {
      exists: stakingExists,
      staked: stakingExists ? uint(8) ?? 0n : 0n,
      withdrawable: stakingExists ? uint(9) ?? 0n : 0n,
      claimableRewards: stakingExists ? uint(10) ?? 0n : 0n,
      quota: stakingExists ? uint(11) ?? 0n : 0n,
    },
    vault: {
      finalized,
      supply: uint(13) ?? 0n,
      totalNav: finalized ? uint(14) : null,
      feeBal: uint(15) ?? 0n,
      lastNavUpdate: Number(uint(16) ?? 0n),
      pendingDeposits: uint(17) ?? 0n,
      pendingWithdrawShares: uint(18) ?? 0n,
    },
    allowance: accrueAllowance(
      allowanceRaw
        ? {
          refill: allowanceRaw.refill,
          maxRefill: allowanceRaw.maxRefill,
          period: allowanceRaw.period,
          balance: allowanceRaw.balance,
          timestamp: allowanceRaw.timestamp,
        }
        : { refill: 0n, maxRefill: 0n, period: 0n, balance: 0n, timestamp: 0n },
      now,
    ),
  };
};

/* -------------------------------------------------------------------------- */
/* The 1:1 accounting                                                         */
/* -------------------------------------------------------------------------- */

export type SciStepKey =
  | "createStakingVault"
  | "stake"
  | "wrap"
  | "claimRewards"
  | "withdrawPrincipal"
  | "settle"
  | "exitInFlight"
  | "fundRedemptions";

export interface SciStep {
  key: SciStepKey;
  title: string;
  why: string;
  /** Wei the action should be run with, when it takes an amount. */
  amount?: bigint;
  /** Nothing to press: the step only explains why the console is waiting. */
  info?: boolean;
}

export interface SciAccounting {
  /** What depositors are owed: one ETH per share. */
  owed: bigint;
  /** What a NAV update run right now would report (methods + live WETH - fees). */
  counted: bigint;
  /** counted - owed. Positive: yield is being counted. Negative: principal is not. */
  gap: bigint;
  /** Principal the NAV cannot see right now (unwrapped, or mid-exit). */
  principalUncounted: bigint;
  /** Plain ETH in the Safe that has to stay because it is principal. */
  principalInSafeEth: bigint;
  /** Plain ETH in the Safe that is yield. */
  yieldInSafe: bigint;
  /** The most that may go to the multisig right now: yield, within the cap. */
  sendNow: bigint;
  /** Yield still sitting in counted positions (stETH growth, wrapped rewards). */
  surplusCounted: bigint;
  /** Of that, what can be unwrapped right now (it has to be WETH in the Safe). */
  unwrappableSurplus: bigint;
  /**
   * Principal sitting as plain ETH with no staking quota waiting for it: what
   * should go back into a counted form (WETH, or stETH through Lido).
   */
  principalToPlace: bigint;
  /**
   * What can be staked right now: whole validators, within the operator's
   * quota, out of principal only. With batching it may come out of WETH too.
   */
  stakeAmount: bigint;
  /**
   * stETH worth selling for WETH: yield that has built up in counted positions
   * beyond what unwrapping can free, or the WETH that requested redemptions
   * are short of, whichever is larger. Never more than the Safe holds.
   */
  stethToSell: bigint;
  /** Value stored at the last NAV update (methods only), null before finalizing. */
  storedMethods: bigint | null;
  /** What the methods read now. */
  liveMethods: bigint;
  /** The stored value is out of date by more than dust. */
  navStale: boolean;
  /** Share price in ETH, 18 decimals, as the vault reports it; null with no supply. */
  price: bigint | null;
  /** The same after a NAV update run now. */
  priceIfUpdated: bigint | null;
  /**
   * What it takes, right now, to put the vault back at exactly 1:1 and move
   * the excess on: unwrap yield that is sitting in WETH, refresh a stale NAV,
   * send the yield (within the cap). All zero / false when nothing is off.
   */
  settle: {
    /** Yield counted as WETH, to be unwrapped. */
    unwrap: bigint;
    updateNav: boolean;
    /** The stored NAV is out of date but must not be refreshed: a validator exit is in flight. */
    navHeld: boolean;
    /** ETH that would go to the multisig. */
    send: bigint;
    /** Yield that stays in the Safe as plain ETH because the cap is used up. */
    leftover: bigint;
  };
  /** WETH the vault contract is short of to pay the redemptions already requested. */
  redemptionShortfall: bigint;
  steps: SciStep[];
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
const max0 = (a: bigint) => (a > 0n ? a : 0n);
const ONE = 10n ** 18n;

/**
 * Pure: every number the guidance shows, from one state snapshot.
 *
 * The rule for sending is the conservative reading of "not a cent more".
 * Whatever part of the principal the NAV cannot see (because it was unwrapped
 * to be staked, came back from the staking vault as plain ETH, or is mid-exit
 * between the validators and the staking vault) is assumed to be sitting in
 * the Safe's plain ETH, and that much is held back. Only what is left over is
 * yield. In the mid-exit case this holds back more than necessary; that is
 * the intended direction of the error.
 */
export const sciAccounting = (state: SciState): SciAccounting => {
  const { staking, vault } = state;
  const owed = vault.finalized ? vault.supply : 0n;
  const liveMethods = staking.staked + staking.withdrawable + state.safeSteth;
  const counted = max0(liveMethods + state.safeWeth + state.fundWeth - vault.feeBal);
  const gap = counted - owed;

  const principalUncounted = max0(-gap);
  const principalInSafeEth = min(state.safeEth, principalUncounted);
  const yieldInSafe = state.safeEth - principalInSafeEth;
  const sendNow = min(yieldInSafe, state.allowance.available);

  const surplusCounted = max0(gap);
  const unwrappableSurplus = min(surplusCounted, state.safeWeth);

  const storedMethods = vault.totalNav === null
    ? null
    : vault.totalNav - state.safeWeth - state.fundWeth + vault.feeBal;
  const diff = storedMethods === null ? 0n : storedMethods - liveMethods;
  const navStale = storedMethods !== null && (diff > SCI.DUST || diff < -SCI.DUST);

  const price = vault.supply > 0n && vault.totalNav !== null ? (vault.totalNav * ONE) / vault.supply : null;
  const priceIfUpdated = vault.supply > 0n ? (counted * ONE) / vault.supply : null;

  // Redemptions are paid in WETH out of the vault contract, at the share price.
  // Never budgeted below 1:1: a price that reads low because principal is
  // unwrapped right now is about to be corrected, and the redemption will
  // settle after that.
  //
  // The vault pays each request floor(totalNAV * shares / supply) and refuses
  // the whole withdrawal if its WETH is a wei short, so the figure is rounded
  // up, taken at the NAV as it will be once counted yield has been settled
  // out, and given a hair of headroom (a millionth, plus a gwei): every
  // deposit that settles in the meantime nudges the price up by billionths.
  // WETH in the vault contract is counted in the NAV like WETH in the Safe,
  // so the headroom costs nothing.
  const countedAfterSettle = counted - (unwrappableSurplus > SCI.DUST ? unwrappableSurplus : 0n);
  const redemptionBase = countedAfterSettle > owed ? countedAfterSettle : owed;
  const redemptionExact = vault.pendingWithdrawShares > 0n && vault.supply > 0n
    ? (vault.pendingWithdrawShares * redemptionBase + vault.supply - 1n) / vault.supply
    : 0n;
  const redemptionValue = redemptionExact > 0n ? redemptionExact + redemptionExact / 1_000_000n + 10n ** 9n : 0n;
  const redemptionShortfall = max0(redemptionValue - state.fundWeth);

  const steps: SciStep[] = [];
  if (!staking.exists) {
    steps.push({
      key: "createStakingVault",
      title: "Create the staking vault",
      why: "Nothing can be staked, and no NAV update can run, until it exists. Do this before the first deposit arrives.",
    });
  }
  // Principal sitting as plain ETH: stake what the operator has approved room
  // for (whole validators only), and wrap whatever is left over.
  // With batching the WETH principal can be staked too (unwrap, stake and
  // NAV update travel together); what requested redemptions need stays put.
  const principalWeth = max0(state.safeWeth - unwrappableSurplus - redemptionShortfall);
  const stakeSource = state.batching ? principalInSafeEth + principalWeth : principalInSafeEth;
  const stakeable = staking.exists
    ? (min(stakeSource, staking.quota) / SCI.VALIDATOR) * SCI.VALIDATOR
    : 0n;
  if (stakeable > 0n) {
    steps.push({
      key: "stake",
      title: `Stake ${fmtEth(stakeable)} ETH`,
      why: state.batching
        ? "The operator has approved this much and the principal is there. One transaction unwraps what is needed, stakes it and updates the NAV, so the share price never moves."
        : "This plain ETH in the Safe is depositors' principal and the operator has approved it for staking. Until it is staked and the NAV updated, shares read below 1 ETH.",
      amount: stakeable,
    });
  }
  // The positions read LESS than what is stored while principal is already
  // unaccounted for: a validator exit on its way back (it has left
  // stakedBalance and not yet reached withdrawablePrincipal). Whatever part of
  // it the Safe's plain ETH cannot explain is in flight, and while it is, the
  // ETH in the Safe is not known to be principal either, so none of it is
  // offered for wrapping.
  const navHeld = navStale && diff > 0n && principalUncounted > SCI.DUST;
  const inFlight = navHeld ? principalUncounted - principalInSafeEth : 0n;
  const toWrap = inFlight > SCI.DUST ? 0n : principalInSafeEth - min(stakeable, principalInSafeEth);

  // stETH moves by a wei or two on transfer, so the last two wei are not sellable.
  const sellableSteth = state.safeSteth > 2n ? state.safeSteth - 2n : 0n;
  const surplusBeyondWeth = max0(surplusCounted - state.safeWeth);
  const wethShortForRedemptions = max0(redemptionShortfall - state.safeWeth);
  const stethToSell = min(
    sellableSteth,
    surplusBeyondWeth > wethShortForRedemptions ? surplusBeyondWeth : wethShortForRedemptions,
  );
  if (toWrap > SCI.DUST) {
    steps.push({
      key: "wrap",
      title: `Wrap ${fmtEth(toWrap)} ETH of principal`,
      why: "The NAV counts this much less than depositors are owed, and this much plain ETH is in the Safe. If it is principal that ended up unwrapped, wrap it. If a validator exit is on its way back, leave it: it resolves when the principal is withdrawn.",
      amount: toWrap,
    });
  }

  // Putting the vault back at 1:1 and moving the excess on.
  //
  // The NAV update is held back while an exit is in flight (navHeld): it would
  // write the dip into the share price. It resolves when the principal is withdrawn.
  const settleUnwrap = unwrappableSurplus > SCI.DUST ? unwrappableSurplus : 0n;
  const yieldAfterUnwrap = yieldInSafe + settleUnwrap;
  const settleSend = min(yieldAfterUnwrap, state.allowance.available);
  const settle = {
    unwrap: settleUnwrap,
    updateNav: vault.finalized && staking.exists && navStale && !navHeld,
    navHeld,
    send: settleSend > SCI.DUST ? settleSend : 0n,
    leftover: yieldAfterUnwrap - (settleSend > SCI.DUST ? settleSend : 0n),
  };

  const hasPrincipalBack = staking.withdrawable > SCI.DUST;
  const hasRewards = staking.claimableRewards > SCI.DUST;
  if (inFlight > SCI.DUST) {
    steps.push({
      key: "exitInFlight",
      title: `Wait: ${fmtEth(inFlight)} ETH of principal is on its way back from the validators`,
      why: "It has left the staked balance and not reached the staking vault yet, so nothing on chain shows it. The stored NAV still counts it, which is right. Until it lands the console does not update the NAV and does not withdraw what has already arrived: either would move the share price off 1 ETH.",
      info: true,
    });
  } else if (hasPrincipalBack) {
    steps.push({
      key: "withdrawPrincipal",
      title: `Bring back ${fmtEth(staking.withdrawable)} ETH of unbonded principal`,
      why: state.batching
        ? "One transaction withdraws it, wraps it into WETH, updates the NAV and sends any rewards that came with it to the multisig. The share price never moves."
        : "It arrives as plain ETH, which the NAV does not count: wrap it and update the NAV in the same sitting.",
    });
  } else if (hasRewards) {
    steps.push({
      key: "claimRewards",
      title: `Claim ${fmtEth(staking.claimableRewards)} ETH of rewards`,
      why: state.batching
        ? "One transaction claims them and sends them to the multisig, within the 30-day cap. Rewards are never part of the NAV, so the share price does not move."
        : "Rewards land in the Safe as plain ETH. They are not part of the NAV before or after, so claiming never moves the share price.",
    });
  } else if (settle.unwrap > 0n || settle.updateNav || settle.send > 0n) {
    const todo: string[] = [];
    if (settle.unwrap > 0n) todo.push(`unwrap ${fmtEth(settle.unwrap)} WETH`);
    if (settle.updateNav) todo.push("update the NAV");
    if (settle.send > 0n) todo.push(`send ${fmtEth(settle.send)} ETH to the multisig`);
    let why: string;
    if (!vault.finalized) {
      why = "The vault is not open yet, so everything in the Safe is your own test money. WETH left there would be counted the moment the vault opens and the first depositor would get shares for it. This is also the transaction that moves yield later, so it doubles as a rehearsal.";
    } else if (settle.unwrap > 0n) {
      why = "The NAV counts more than depositors put in, so shares read above 1 ETH. The excess is yield: unwrapped it leaves the NAV, and it goes on to the multisig in the same transaction.";
    } else if (settle.send > 0n) {
      why = settle.leftover > SCI.DUST
        ? `That is what the 30-day cap leaves. Another ${fmtEth(settle.leftover)} ETH of yield stays in the Safe until the cap refills.`
        : "That is exactly the yield in the Safe. Everything else in the vault is principal.";
    } else {
      why = "The value stored at the last update no longer matches the positions. Deposits and redemptions settle at the stored value.";
    }
    steps.push({
      key: "settle",
      title: todo.join(", ").replace(/^./, (c) => c.toUpperCase()),
      why,
    });
  }
  if (redemptionShortfall > SCI.DUST) {
    steps.push({
      key: "fundRedemptions",
      title: `Send ${fmtEth(redemptionShortfall)} WETH to the vault contract`,
      why: "Redemptions already requested are paid from the vault contract, and it holds less than they are worth. One transaction sends the WETH and updates the NAV, which is what makes the requests payable.",
      amount: redemptionShortfall,
    });
  }

  return {
    owed,
    counted,
    gap,
    principalUncounted,
    principalInSafeEth,
    yieldInSafe,
    sendNow,
    surplusCounted,
    unwrappableSurplus,
    principalToPlace: toWrap,
    stakeAmount: stakeable,
    stethToSell,
    storedMethods,
    liveMethods,
    navStale,
    price,
    priceIfUpdated,
    redemptionShortfall,
    settle,
    steps,
  };
};

/* -------------------------------------------------------------------------- */
/* The CoW order shape (the flow that uses it is further down)                */
/* -------------------------------------------------------------------------- */

export const COW_EMPTY_APP_DATA = ethers.id("{}");
const COW_KIND_SELL = ethers.id("sell");
const COW_BALANCE_ERC20 = ethers.id("erc20");

/** The order exactly as it is signed. Amounts in wei. */
export interface CowOrder {
  sellAmount: bigint;
  buyAmount: bigint;
  /** Unix seconds. */
  validTo: number;
}

/** The full order struct: everything but the two amounts and validTo is fixed, as the role demands. */
const cowOrderStruct = (order: CowOrder) => ({
  sellToken: A.steth,
  buyToken: A.weth,
  receiver: A.safe,
  sellAmount: order.sellAmount,
  buyAmount: order.buyAmount,
  validTo: order.validTo,
  appData: COW_EMPTY_APP_DATA,
  feeAmount: 0n,
  kind: COW_KIND_SELL,
  partiallyFillable: false,
  sellTokenBalance: COW_BALANCE_ERC20,
  buyTokenBalance: COW_BALANCE_ERC20,
});

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

const hex = (value: bigint) => ethers.toQuantity(value);

export const sciCalls = {
  wrap: (amount: bigint): IRoleCall => ({
    to: A.weth,
    data: IF.weth.encodeFunctionData("deposit"),
    value: hex(amount),
  }),
  unwrap: (amount: bigint): IRoleCall => ({
    to: A.weth,
    data: IF.weth.encodeFunctionData("withdraw", [amount]),
  }),
  createStakingVault: (): IRoleCall => ({
    to: A.stakingHub,
    data: IF.hub.encodeFunctionData("createVault", [0]),
  }),
  requestStakeQuota: (amount: bigint): IRoleCall => ({
    to: A.stakingVault,
    data: IF.staking.encodeFunctionData("requestStakeQuota", [amount]),
  }),
  /** Staking is a plain ETH send to the staking vault: no function, just value. */
  stake: (amount: bigint): IRoleCall => ({ to: A.stakingVault, data: "0x", value: hex(amount) }),
  claimRewards: (): IRoleCall => ({
    to: A.stakingVault,
    data: IF.staking.encodeFunctionData("claimRewards"),
  }),
  withdrawPrincipal: (): IRoleCall => ({
    to: A.stakingVault,
    data: IF.staking.encodeFunctionData("withdrawPrincipal"),
  }),
  lidoSubmit: (amount: bigint): IRoleCall => ({
    to: A.steth,
    data: IF.lido.encodeFunctionData("submit", [ethers.ZeroAddress]),
    value: hex(amount),
  }),
  /** Lets the CoW relayer pull this much stETH when an order of the Safe's is settled. */
  approveCow: (amount: bigint): IRoleCall => ({
    to: A.steth,
    data: IF.erc20.encodeFunctionData("approve", [A.cowRelayer, amount]),
  }),
  /**
   * Pre-sign one order. A DELEGATECALL: the signer contract runs as the Safe
   * and marks exactly this order as signed on the settlement contract. The
   * role only lets it through for stETH to WETH, paid to the Safe, with empty
   * app data, no signed fee and at most a day of validity.
   */
  signCowOrder: (order: CowOrder, validDuration: number): IRoleCall => ({
    to: A.cowSigner,
    data: IF.cowSigner.encodeFunctionData("signOrder", [cowOrderStruct(order), validDuration, 0]),
    operation: 1,
  }),
  /** Withdraw the pre-signature: the order can no longer be filled. */
  unsignCowOrder: (order: CowOrder): IRoleCall => ({
    to: A.cowSigner,
    data: IF.cowSigner.encodeFunctionData("unsignOrder", [cowOrderStruct(order)]),
    operation: 1,
  }),
  /** Plain ETH to the multisig. The Roles modifier meters the value against the cap. */
  sendYield: (amount: bigint): IRoleCall => ({ to: A.multisig, data: "0x", value: hex(amount) }),
  fundRedemptions: (amount: bigint): IRoleCall => ({
    to: A.weth,
    data: IF.erc20.encodeFunctionData("transfer", [A.fund, amount]),
  }),
  updateNav: (): IRoleCall => ({
    to: A.fund,
    data: IF.fund.encodeFunctionData("executeNAVUpdate", [A.navExecutor]),
  }),
};

/**
 * Several calls as ONE transaction: a delegatecall to MultiSend, which the
 * modifier unpacks and checks call by call. Only usable when state.batching.
 */
export const sciBatch = (calls: IRoleCall[]): IRoleCall => ({
  to: A.multiSend,
  data: IF.multiSend.encodeFunctionData("multiSend", [
    ethers.concat(
      calls.map((c) =>
        ethers.solidityPacked(
          ["uint8", "address", "uint256", "uint256", "bytes"],
          [c.operation ?? 0, c.to, BigInt(c.value ?? "0"), ethers.dataLength(c.data), c.data],
        ),
      ),
    ),
  ]),
  operation: 1,
});

export interface SciPlan {
  /** What goes to the wallet: the single call, or the batch. */
  call: IRoleCall;
  /** The calls inside, in order, for showing what one press will do. */
  parts: string[];
  /**
   * Set when the plan must not be carried out: it cannot be covered, or it
   * would leave the vault's NAV wrong. A plan with a problem is never sent.
   */
  problem: string;
  /** A caution that does not stop the plan (only on a vault without batching). */
  warning?: string;
}

/**
 * Where `amount` of ETH for staking or Lido comes from: principal that is
 * already plain ETH first, then WETH (only when it can be unwrapped in the
 * same transaction), then, last, yield.
 */
export const sciSource = (state: SciState, amount: bigint) => {
  const acc = sciAccounting(state);
  const fromPrincipalEth = min(amount, acc.principalInSafeEth);
  const fromWeth = state.batching ? min(amount - fromPrincipalEth, state.safeWeth) : 0n;
  const fromYieldEth = amount - fromPrincipalEth - fromWeth;
  return { fromPrincipalEth, fromWeth, fromYieldEth, short: fromYieldEth > acc.yieldInSafe };
};

/**
 * The plan as it goes to the wallet. A vault whose modifier cannot batch can
 * only take the first call; the rest has to follow by hand, and the plan
 * says so rather than pretending.
 */
const plan = (state: SciState, calls: IRoleCall[], parts: string[], problem: string, cautions: string[] = []): SciPlan => {
  if (calls.length <= 1 || state.batching) {
    return {
      call: calls.length === 1 ? calls[0] : sciBatch(calls),
      parts,
      problem,
      ...(cautions.length ? { warning: cautions.join(" ") } : {}),
    };
  }
  return {
    call: calls[0],
    parts: [parts[0]],
    problem,
    warning: `Batching is off on this vault, so only the first step goes out. Still to do afterwards, each on its own: ${parts.slice(1).join(", ")}.`,
  };
};

/** The state as it will be once a move has happened, so what follows can be worked out before sending. */
const project = (
  state: SciState,
  d: { safeEth?: bigint; safeWeth?: bigint; fundWeth?: bigint; safeSteth?: bigint; staked?: bigint; withdrawable?: bigint; claimable?: bigint },
): SciState => ({
  ...state,
  safeEth: state.safeEth + (d.safeEth ?? 0n),
  safeWeth: state.safeWeth + (d.safeWeth ?? 0n),
  fundWeth: state.fundWeth + (d.fundWeth ?? 0n),
  safeSteth: state.safeSteth + (d.safeSteth ?? 0n),
  staking: {
    ...state.staking,
    staked: state.staking.staked + (d.staked ?? 0n),
    withdrawable: state.staking.withdrawable + (d.withdrawable ?? 0n),
    claimableRewards: state.staking.claimableRewards + (d.claimable ?? 0n),
  },
  vault: {
    ...state.vault,
    // totalNAV() is "stored positions + live WETH": WETH moving moves it at once,
    // the stored part only at the next update.
    totalNav: state.vault.totalNav === null ? null : state.vault.totalNav + (d.safeWeth ?? 0n) + (d.fundWeth ?? 0n),
  },
});

/**
 * How every plan ends. `after` is the state once the calls already in the
 * plan have run.
 *
 * Always: the NAV update, when the stored positions no longer match, so the
 * move and its bookkeeping are one transaction and no deposit or redemption
 * can settle in between.
 *
 * With `settle` (every claim, withdrawal and settlement): the vault is put
 * back at exactly 1:1 and the excess moves on.
 *  - yield that is sitting in WETH is unwrapped, so it leaves the NAV,
 *  - the yield in the Safe goes to the multisig, as much as the cap allows.
 *    What the cap does not allow stays in the Safe as plain ETH, which the
 *    NAV does not count, so the share price is right either way.
 *
 * Last, the check nothing gets past: a plan that would leave the vault
 * reporting less than it does now, and less than depositors are owed, is
 * refused.
 */
const finish = (
  before: SciState,
  after: SciState,
  calls: IRoleCall[],
  parts: string[],
  problem: string,
  opts: { settle: boolean; standalone?: boolean; alwaysUpdateNav?: boolean },
): SciPlan => {
  const cautions: string[] = [];
  let state = after;
  let acc = sciAccounting(state);
  // Before the vault opens nothing is owed, so all WETH reads as surplus. It is
  // only cleared out when that is the whole point of the press.
  if (opts.settle && acc.settle.unwrap > 0n && (state.vault.finalized || opts.standalone)) {
    calls.push(sciCalls.unwrap(acc.settle.unwrap));
    parts.push(`unwrap ${fmtEth(acc.settle.unwrap)} WETH of yield`);
    state = project(state, { safeWeth: -acc.settle.unwrap, safeEth: acc.settle.unwrap });
    acc = sciAccounting(state);
  }
  let updated = false;
  const canUpdate = state.vault.finalized && state.staking.exists && !acc.settle.navHeld;
  if (acc.settle.updateNav || (opts.alwaysUpdateNav && canUpdate)) {
    calls.push(sciCalls.updateNav());
    parts.push("update the NAV");
    updated = true;
  } else if (acc.settle.navHeld) {
    cautions.push(
      `The NAV is left as stored: the positions read ${fmtEth(acc.principalUncounted)} ETH less than depositors are owed, which is what a validator exit on its way back looks like. It corrects itself when the principal is withdrawn.`,
    );
  }
  if (opts.settle) {
    const send = min(acc.yieldInSafe, state.allowance.available);
    const sent = send > SCI.DUST ? send : 0n;
    if (sent > 0n) {
      calls.push(sciCalls.sendYield(sent));
      parts.push(`send ${fmtEth(sent)} ETH to the multisig`);
    }
    if (acc.yieldInSafe - sent > SCI.DUST) {
      cautions.push(
        `${fmtEth(acc.yieldInSafe - sent)} ETH of yield stays in the Safe as plain ETH, outside the NAV: the 30-day cap has ${fmtEth(state.allowance.available)} ETH left.`,
      );
    }
    if (acc.principalInSafeEth > SCI.DUST) {
      cautions.push(
        `${fmtEth(acc.principalInSafeEth)} ETH stays in the Safe: the NAV counts that much less than depositors are owed, so it is treated as principal and not sent.`,
      );
    }
  }

  // What the vault will report once the plan has run. Refused when that is
  // further from one ETH per share than it is now and no NAV update in the
  // plan accounts for it: too low (WETH unwrapped with nothing to show for
  // it) or too high (principal brought back while the stored NAV still
  // counts it where it was).
  const reportedBefore = before.vault.totalNav;
  const reportedAfter = updated ? acc.counted : state.vault.totalNav;
  if (!problem && state.batching && state.vault.finalized && reportedBefore !== null && reportedAfter !== null) {
    const tooLow = reportedAfter < acc.owed - SCI.DUST && reportedAfter < reportedBefore - SCI.DUST;
    const tooHigh = !updated && reportedAfter > acc.owed + SCI.DUST && reportedAfter > reportedBefore + SCI.DUST;
    if (tooLow || tooHigh) {
      problem = `Not now: this would leave the vault reporting ${fmtEth(reportedAfter)} ETH for ${fmtEth(acc.owed)} ETH of deposits, and no NAV update can put that right while a validator exit is on its way back. Wait for it to arrive, then withdraw the principal.`;
    }
  }
  return plan(before, calls, parts, problem, cautions);
};

/**
 * Every move the console can make, built so that it cannot leave the vault's
 * NAV wrong and so that yield never lingers.
 *
 * 1. Nothing that changes what the NAV counts goes out on its own. The vault
 *    values itself as "positions at the last NAV update, plus the WETH it
 *    holds this instant", so an unwrap, a stake or a withdrawal that is not
 *    followed by a NAV update in the SAME transaction leaves a gap in which
 *    deposits and redemptions settle at the wrong price.
 * 2. Yield never enters a counted position, and principal never leaves one.
 * 3. A claim or a withdrawal ends by sending the excess to the multisig, in
 *    that same transaction (see finish).
 *
 * Before the vault is finalized there are no shares to misprice and no
 * depositors' principal, so rule 2 is off: everything can be rehearsed with
 * the operator's own money.
 */
export const sciPlans = {
  /**
   * Plain ETH into WETH, for the rare state where principal is sitting
   * unwrapped. Never yield: wrapped, the NAV would count it.
   */
  wrap: (state: SciState, amount: bigint): SciPlan => {
    const acc = sciAccounting(state);
    const yieldPart = amount - min(amount, acc.principalInSafeEth);
    return finish(
      state,
      project(state, { safeEth: -amount, safeWeth: amount }),
      [sciCalls.wrap(amount)],
      [`wrap ${fmtEth(amount)} ETH`],
      state.vault.finalized && yieldPart > SCI.DUST
        ? `${fmtEth(yieldPart)} of this is yield. Wrapped, the NAV would count it and shares would read above 1 ETH. Only ${fmtEth(acc.principalInSafeEth)} ETH in the Safe is principal.`
        : "",
      { settle: false },
    );
  },

  /** `action` puts `amount` of ETH into a counted position, unwrapping WETH for it. */
  spendEth: (
    state: SciState,
    amount: bigint,
    action: IRoleCall,
    name: string,
    into: { staked?: bigint; safeSteth?: bigint },
  ): SciPlan => {
    const source = sciSource(state, amount);
    const calls: IRoleCall[] = [];
    const parts: string[] = [];
    if (source.fromWeth > 0n) {
      calls.push(sciCalls.unwrap(source.fromWeth));
      parts.push(`unwrap ${fmtEth(source.fromWeth)} WETH`);
    }
    calls.push(action);
    parts.push(name);
    let problem = "";
    if (source.short) {
      problem = `The Safe does not hold ${fmtEth(amount)} of principal in WETH to do this.`;
    } else if (state.vault.finalized && source.fromYieldEth > SCI.DUST) {
      problem = `${fmtEth(source.fromYieldEth)} of this would have to come out of yield. In a counted position the NAV would count it and shares would read above 1 ETH.`;
    }
    return finish(
      state,
      project(state, { safeWeth: -source.fromWeth, safeEth: source.fromWeth - amount, ...into }),
      calls,
      parts,
      problem,
      { settle: false },
    );
  },
  /** WETH into the validators. */
  stake: (state: SciState, amount: bigint): SciPlan =>
    sciPlans.spendEth(state, amount, sciCalls.stake(amount), `stake ${fmtEth(amount)} ETH`, { staked: amount }),
  /** WETH into stETH. */
  lidoDeposit: (state: SciState, amount: bigint): SciPlan =>
    sciPlans.spendEth(state, amount, sciCalls.lidoSubmit(amount), `deposit ${fmtEth(amount)} ETH into Lido`, {
      safeSteth: amount,
    }),

  /** Rewards out of the staking vault and straight on to the multisig. They stay plain ETH throughout. */
  claimRewards: (state: SciState): SciPlan => {
    const rewards = state.staking.claimableRewards;
    return finish(
      state,
      project(state, { safeEth: rewards, claimable: -rewards }),
      [sciCalls.claimRewards()],
      [`claim ${fmtEth(rewards)} ETH of rewards`],
      rewards > 0n ? "" : "There are no rewards to claim.",
      { settle: true },
    );
  },

  /**
   * Unbonded principal back into WETH, where the NAV counts it live, with
   * whatever rewards arrived alongside it claimed and sent on.
   */
  withdrawPrincipal: (state: SciState): SciPlan => {
    const principal = state.staking.withdrawable;
    const rewards = state.staking.claimableRewards > SCI.DUST ? state.staking.claimableRewards : 0n;
    const calls = [sciCalls.withdrawPrincipal()];
    const parts = [`withdraw ${fmtEth(principal)} ETH of principal`];
    if (rewards > 0n) {
      calls.push(sciCalls.claimRewards());
      parts.push(`claim ${fmtEth(rewards)} ETH of rewards`);
    }
    calls.push(sciCalls.wrap(principal));
    parts.push(`wrap ${fmtEth(principal)} ETH into WETH`);
    return finish(
      state,
      project(state, { withdrawable: -principal, claimable: -rewards, safeEth: rewards, safeWeth: principal }),
      calls,
      parts,
      principal > 0n ? "" : "No principal is waiting in the staking vault.",
      { settle: true },
    );
  },

  /**
   * WETH into the vault contract, which is what redemptions are paid from.
   * The NAV update travels with it: a request only becomes payable against
   * an update made after it, and yield that is still counted is settled out
   * first so the redemption is paid at 1 ETH per share.
   */
  fundRedemptions: (state: SciState, amount: bigint): SciPlan =>
    finish(
      state,
      project(state, { safeWeth: -amount, fundWeth: amount }),
      [sciCalls.fundRedemptions(amount)],
      [`send ${fmtEth(amount)} WETH to the vault contract`],
      amount > state.safeWeth
        ? `The Safe holds ${fmtEth(state.safeWeth)} WETH. Bring principal back first: withdraw unbonded principal, or sell stETH.`
        : "",
      { settle: true, alwaysUpdateNav: true },
    ),

  /**
   * Nothing new to claim: put the vault back at 1:1 and move the excess on.
   * This is what follows a filled stETH sale, and what harvests the yield
   * that builds up inside stETH.
   */
  settle: (state: SciState): SciPlan => {
    const built = finish(state, state, [], [], "", { settle: true, standalone: true });
    return built.parts.length
      ? built
      : {
        ...built,
        call: sciCalls.updateNav(),
        problem: built.warning
          ? `Nothing can go out right now. ${built.warning}`
          : "Nothing to settle: the NAV is up to date and no yield is waiting.",
      };
  },
};

/* -------------------------------------------------------------------------- */
/* CoW: the way back from stETH                                               */
/* -------------------------------------------------------------------------- */

/**
 * stETH leaves through a CoW Protocol order, because that is the only exit
 * the role was given: it sells stETH for WETH, paid to the Safe, and the WETH
 * is then unwrapped like any other.
 *
 * A Safe cannot sign an order off chain, so the order is made valid by a
 * transaction instead (a "pre-signature"). The sequence is: approve the
 * relayer, post the order to CoW's order book, pre-sign that exact order on
 * chain, then wait for a solver to fill it.
 */
/** How long an order stays fillable. The role refuses anything over a day. */
export const COW_ORDER_SECONDS = 30 * 60;
/** Slack between the order's validTo and the bound handed to the signer. */
const COW_DURATION_SLACK = 10 * 60;

export interface CowQuote {
  id: number | null;
  /** What the order sells in total (the amount asked for). */
  sellAmount: bigint;
  /** What the solvers' network cost eats out of it, in stETH. */
  networkCost: bigint;
  /** WETH the quote expects to deliver for it. */
  buyAmount: bigint;
}

/** The bound signOrder is given: validTo must fall inside now + this. */
export const cowValidDuration = (order: CowOrder, now: number) =>
  Math.max(order.validTo - now, 0) + COW_DURATION_SLACK;

/**
 * The order a quote turns into. The minimum received is the quote less the
 * slippage allowance; nothing else is negotiable, because the role pins the
 * rest.
 */
export const cowBuildOrder = (quote: CowQuote, slippageBps: number, now: number): CowOrder => ({
  sellAmount: quote.sellAmount,
  buyAmount: (quote.buyAmount * BigInt(10_000 - slippageBps)) / 10_000n,
  validTo: now + COW_ORDER_SECONDS,
});

/**
 * What a sale costs against 1 stETH = 1 ETH, in wei and in basis points of
 * the amount sold. Uses the worst case the order allows (the minimum buy
 * amount), so the figure shown is the most that can be lost, not a hope.
 */
export const cowWorstCaseCost = (order: CowOrder) => {
  const cost = order.sellAmount > order.buyAmount ? order.sellAmount - order.buyAmount : 0n;
  const bps = order.sellAmount > 0n ? Number((cost * 10_000n) / order.sellAmount) : 0;
  return { cost, bps };
};

/**
 * The order's id as the settlement contract computes it: EIP-712 digest,
 * then the owner, then validTo. Worked out locally so the id CoW's API hands
 * back can be checked against the order that is about to be pre-signed: if
 * they differ, the API recorded something else and nothing is signed.
 */
export const cowOrderUid = (order: CowOrder): string => {
  const digest = ethers.TypedDataEncoder.hash(
    { name: "Gnosis Protocol", version: "v2", chainId: 1, verifyingContract: A.cowSettlement },
    {
      Order: [
        { name: "sellToken", type: "address" },
        { name: "buyToken", type: "address" },
        { name: "receiver", type: "address" },
        { name: "sellAmount", type: "uint256" },
        { name: "buyAmount", type: "uint256" },
        { name: "validTo", type: "uint32" },
        { name: "appData", type: "bytes32" },
        { name: "feeAmount", type: "uint256" },
        { name: "kind", type: "string" },
        { name: "partiallyFillable", type: "bool" },
        { name: "sellTokenBalance", type: "string" },
        { name: "buyTokenBalance", type: "string" },
      ],
    },
    {
      sellToken: A.steth,
      buyToken: A.weth,
      receiver: A.safe,
      sellAmount: order.sellAmount,
      buyAmount: order.buyAmount,
      validTo: order.validTo,
      appData: COW_EMPTY_APP_DATA,
      feeAmount: 0n,
      kind: "sell",
      partiallyFillable: false,
      sellTokenBalance: "erc20",
      buyTokenBalance: "erc20",
    },
  );
  return ethers.solidityPacked(["bytes32", "address", "uint32"], [digest, A.safe, order.validTo]);
};

const cowFetch = async (path: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(SCI.COW_API + path, {
    ...init,
    headers: { "content-type": "application/json", accept: "application/json" },
  });
  const text = await response.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* a bare string (an order id) or an empty body */
  }
  if (!response.ok) {
    // CoW answers errors as { errorType, description }.
    throw new Error(body?.description || body?.errorType || `CoW's API answered ${response.status}.`);
  }
  return body;
};

/** Price a sale of `sellAmount` stETH for WETH, as a pre-signed order from the Safe. */
export const cowQuote = async (sellAmount: bigint): Promise<CowQuote> => {
  const body = await cowFetch("/quote", {
    method: "POST",
    body: JSON.stringify({
      sellToken: A.steth,
      buyToken: A.weth,
      receiver: A.safe,
      from: A.safe,
      kind: "sell",
      sellAmountBeforeFee: sellAmount.toString(),
      appData: "{}",
      appDataHash: COW_EMPTY_APP_DATA,
      signingScheme: "presign",
      onchainOrder: true,
      partiallyFillable: false,
      priceQuality: "optimal",
    }),
  });
  const quote = body.quote;
  return {
    id: typeof body.id === "number" ? body.id : null,
    sellAmount,
    networkCost: BigInt(quote.feeAmount),
    buyAmount: BigInt(quote.buyAmount),
  };
};

/**
 * Put the order in CoW's order book. It sits there as "waiting for its
 * signature" and does nothing until signCowOrder is mined. Returns the id,
 * after checking it is the id of the order described here.
 */
export const cowPostOrder = async (order: CowOrder, quoteId: number | null): Promise<string> => {
  const expected = cowOrderUid(order).toLowerCase();
  const uid = await cowFetch("/orders", {
    method: "POST",
    body: JSON.stringify({
      sellToken: A.steth,
      buyToken: A.weth,
      receiver: A.safe,
      sellAmount: order.sellAmount.toString(),
      buyAmount: order.buyAmount.toString(),
      validTo: order.validTo,
      feeAmount: "0",
      kind: "sell",
      partiallyFillable: false,
      sellTokenBalance: "erc20",
      buyTokenBalance: "erc20",
      signingScheme: "presign",
      signature: "0x",
      from: A.safe,
      appData: "{}",
      appDataHash: COW_EMPTY_APP_DATA,
      ...(quoteId === null ? {} : { quoteId }),
    }),
  });
  if (typeof uid !== "string" || uid.toLowerCase() !== expected) {
    throw new Error("CoW's API returned a different order id than the order built here. Nothing was signed.");
  }
  return uid;
};

export type CowStatus = "presignaturePending" | "open" | "fulfilled" | "cancelled" | "expired";

export interface CowOrderState {
  status: CowStatus;
  executedSell: bigint;
  executedBuy: bigint;
}

export const cowOrderState = async (uid: string): Promise<CowOrderState> => {
  const body = await cowFetch(`/orders/${uid}`);
  return {
    status: body.status,
    executedSell: BigInt(body.executedSellAmount ?? "0"),
    executedBuy: BigInt(body.executedBuyAmount ?? "0"),
  };
};

/**
 * Two refusals the shared layer reports only by number, in the vault's terms:
 * a wallet the modifier does not know at all, and a send past the cap.
 */
export const NOT_AN_EXECUTOR = "The connected wallet is not an executor of this vault.";
export const sciExplainDenial = (reason: string | undefined): string => {
  const text = reason || "";
  // NotAuthorized(address): the wallet is not enabled on the modifier.
  if (text.includes("0x4a0bfec1") || /no ?membership|holds no role/i.test(text)) return NOT_AN_EXECUTOR;
  // ConditionViolation status 19: EtherAllowanceExceeded.
  if (/status 19\b/.test(text)) return "This would go over the 30-day cap on sends to the multisig.";
  return text || "The Roles modifier does not allow this for the connected wallet.";
};

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * ETH with up to `digits` decimals, trailing zeros dropped, ROUNDED DOWN. The
 * figures here are amounts to act on: rounding half-up could print a number a
 * hair above what is really there, and "send exactly this" must never be more.
 */
export const fmtEth = (wei: bigint, digits = 6): string => {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const unit = 10n ** BigInt(18 - digits);
  const floored = (abs / unit) * unit;
  let s = ethers.formatEther(floored);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  if (floored === 0n && abs > 0n) return (negative ? "-" : "") + "<0." + "0".repeat(digits - 1) + "1";
  return (negative ? "-" : "") + s;
};

/** Full 18-decimal precision, for the amount an input is filled with. */
export const exactEth = (wei: bigint): string => ethers.formatEther(wei);

/** Parse a typed amount; null when it is not a positive number of ETH. */
export const parseEth = (text: string): bigint | null => {
  const trimmed = (text || "").trim().replace(",", ".");
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return null;
  try {
    const wei = ethers.parseEther(trimmed);
    return wei > 0n ? wei : null;
  } catch {
    return null;
  }
};

export const shortAddr = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
