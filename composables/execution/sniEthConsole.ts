import { ethers } from "ethers";
import { rpcRequestOn, ethCallOn } from "~/composables/execution/rpc";
import type { IRoleCall } from "~/composables/permissions/useRoleExecution";
import { ChainId } from "~/types/enums/chain_id";

/**
 * soonami Venture Staking I (sniETH) execution console: addresses, state read,
 * and the calldata for the one routine this vault runs — claim the validator
 * rewards into the Safe, then bridge them to soonami on Polygon.
 *
 * The vault runs Zodiac Roles **v1** and every operation goes out as
 * `execTransactionWithRole(…, role 1, shouldRevert = true)` from a role-1
 * member's own wallet. No Pilot, no Safe signature.
 *
 * What role 1 may do for these two steps, read off the modifier's event log
 * (setup tx 0x347185ce 2025-02-11, bridge permissions 2025-06-21 → 2026-04-07)
 * and confirmed by the executed history (claim + bridge pairs from
 * 0xf0d92E2B, last on 2026-10-07):
 *
 *   W3 StakingVault 0x549d…1562
 *     · claimRewards() — wildcarded, Send allowed. Rewards land in the Safe as
 *       plain ETH. The NAV (entry #1 reads stakedBalance() live) counts
 *       neither unclaimed nor claimed rewards, so claiming moves no share price.
 *
 *   Across SpokePoolPeriphery `depositNative`, Send allowed — three deployments:
 *     · 0x767e…147f (2026-03-16) and 0x8941…a85C (2026-01-20), selector
 *       0x656a20e6: pinned recipient (p1), inputToken WETH (p2), outputToken
 *       Polygon WETH (p4), destinationChainId 137 (p6).
 *     · 0x10D8…B610 (2026-03-28), selector 0x609ea081 (extra `depositor`
 *       param at p1): same four pins shifted by one.
 *     · NOT pinned anywhere: spokePool (p0), inputAmount, outputAmount,
 *       exclusiveRelayer, timestamps, message, and the depositor. The
 *       periphery forwards msg.value to whatever `spokePool` says, so this
 *       module pins those itself (validateBridge) — the modifier would let a
 *       malicious spokePool through.
 *
 * The destination every bridge permission pins is Polygon 0x979A…952B, the
 * old SNI Yield Claim vault Safe. That Safe is still owned by its own
 * governor, which has a passed, unexecuted "sni-yield-sweep" proposal able to
 * take any WETH that lands there (see destinationGuard). The bridge refuses
 * to run while that is true.
 */
export const SNI = {
  CHAIN: ChainId.ETHEREUM,
  EXPLORER: "https://etherscan.io",
  POLYGON_EXPLORER: "https://polygonscan.com",
  ACROSS_EXPLORER: "https://app.across.to/transactions",
  /** Roles v1 role id (uint16). */
  ROLE: "1",
  ADDR: {
    fund: "0xaC3D76E29f866702E17f571cccb15937E5A17303",
    safe: "0xb05Eeac3701B0Ba9Cf18e54f076BbD72359EE9EF",
    roles: "0x694B7475435B4265eCeB5cC985658ba7897fC2EA",
    governor: "0xdE2ABcc5b9ba5EEC16EBa8F003C22D7d7cf98D26",
    stakingVault: "0x549d2398B34288dfb2b9ba0171086257AEff1562",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    /** Across' Ethereum SpokePool — the only `spokePool` this console sends. */
    spokePool: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
  },
  /** Role 1 members (AssignRoles events, none revoked). */
  MEMBERS: [
    "0xADb8Ac05F86EF79BB65fF9e10Abe4072fc301a7c",
    "0xC419021546FDfEa5e097Bd48951cF1c8ACF9769B",
    "0xf0d92E2B30A2c99ef515A02Cd28EfF8d21B42F9F",
    "0x79d0E42bf0A5D675BeFe1e1CEb21F214BF689080",
  ],
  /** Where the permissions send the rewards. */
  DEST: {
    chainId: 137,
    chainName: "Polygon",
    recipient: "0x979AeA92BbfC33BE4F3d4Cf328133d695B88952B",
    /** WETH on Polygon PoS. */
    outputToken: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    /** The old SNI vault's governor — owner of the recipient Safe. */
    recipientGovernor: "0x42c252ee61063eDd84939A7CC045d8a144E94167",
    /** "sni-yield-sweep" (proposer 0x00aa588B…6970), Succeeded since 2026-11. */
    sweepProposalId:
      "77277987880383309076117452990468681959018275907827572255682830766492949745478",
  },
  ACROSS_API: "https://app.across.to/api",
  /** Refuse a quote that keeps more than this share of the amount (basis points). */
  MAX_FEE_BPS: 100n,
  /** Below this the claim is not worth its gas. */
  MIN_CLAIM: 10n ** 15n,
} as const;

const A = SNI.ADDR;

export type PeripheryKind = "noDepositor" | "withDepositor";

export interface Periphery {
  address: string;
  kind: PeripheryKind;
  /** When governance scoped it for role 1. */
  scoped: string;
}

/** In the order they are tried: most recently used first. */
export const PERIPHERIES: Periphery[] = [
  { address: "0x767e4c20F521a829dE4Ffc40C25176676878147f", kind: "noDepositor", scoped: "2026-03-16" },
  { address: "0x10D8b8DaA26d307489803e10477De69C0492B610", kind: "withDepositor", scoped: "2026-03-28" },
  { address: "0x89415a82d909a7238d69094C3Dd1dCC1aCbDa85C", kind: "noDepositor", scoped: "2026-01-20" },
];

const IF = {
  vault: new ethers.Interface([
    "function claimRewards()",
    "function claimableRewards() view returns (uint256)",
    "function claimedRewards() view returns (uint256)",
    "function stakedBalance() view returns (uint256)",
  ]),
  erc20: new ethers.Interface(["function balanceOf(address) view returns (uint256)"]),
  noDepositor: new ethers.Interface([
    "function depositNative(address spokePool,bytes32 recipient,address inputToken,uint256 inputAmount,bytes32 outputToken,uint256 outputAmount,uint256 destinationChainId,bytes32 exclusiveRelayer,uint32 quoteTimestamp,uint32 fillDeadline,uint32 exclusivityParameter,bytes message) payable",
  ]),
  withDepositor: new ethers.Interface([
    "function depositNative(address spokePool,address depositor,bytes32 recipient,address inputToken,uint256 inputAmount,bytes32 outputToken,uint256 outputAmount,uint256 destinationChainId,bytes32 exclusiveRelayer,uint32 quoteTimestamp,uint32 fillDeadline,uint32 exclusivityParameter,bytes message) payable",
  ]),
  safe: new ethers.Interface(["function getOwners() view returns (address[])"]),
  governor: new ethers.Interface(["function state(uint256) view returns (uint8)"]),
};

export const SELECTORS = {
  claimRewards: "0x372500ab",
  noDepositor: "0x656a20e6",
  withDepositor: "0x609ea081",
} as const;

const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const toBytes32 = (address: string) => ethers.zeroPadValue(ethers.getAddress(address), 32);
const fromBytes32 = (word: string) => ethers.getAddress(ethers.dataSlice(word, 12));

/* -------------------------------------------------------------------------- */
/* State                                                                      */
/* -------------------------------------------------------------------------- */

export interface SniState {
  block: number;
  /** Rewards waiting in the staking vault. claimRewards() moves exactly this. */
  claimable: bigint;
  /** Lifetime rewards claimed into the Safe. */
  claimed: bigint;
  staked: bigint;
  /** Plain ETH in the Safe — what the bridge step sends. */
  safeEth: bigint;
  safeWeth: bigint;
}

const callUint = async (to: string, iface: ethers.Interface, fn: string, args: unknown[] = []) =>
  BigInt(iface.decodeFunctionResult(fn, await ethCallOn(SNI.CHAIN, to, iface.encodeFunctionData(fn, args)))[0]);

export const sniReadState = async (): Promise<SniState> => {
  const [block, claimable, claimed, staked, safeEth, safeWeth] = await Promise.all([
    rpcRequestOn(SNI.CHAIN, "eth_blockNumber", []),
    callUint(A.stakingVault, IF.vault, "claimableRewards"),
    callUint(A.stakingVault, IF.vault, "claimedRewards"),
    callUint(A.stakingVault, IF.vault, "stakedBalance"),
    rpcRequestOn(SNI.CHAIN, "eth_getBalance", [A.safe, "latest"]),
    callUint(A.weth, IF.erc20, "balanceOf", [A.safe]),
  ]);
  return {
    block: Number(block),
    claimable,
    claimed,
    staked,
    safeEth: BigInt(safeEth),
    safeWeth,
  };
};

/* -------------------------------------------------------------------------- */
/* Destination guard                                                          */
/* -------------------------------------------------------------------------- */

const PROPOSAL_STATES = [
  "Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed",
] as const;

export interface DestinationCheck {
  /** True only when the recipient Safe was read and nothing can sweep it. */
  safe: boolean;
  /** The Safe's owners on Polygon, as read. */
  owners: string[];
  ownerIsGovernor: boolean;
  /** State of the known sweep proposal, when it could be read. */
  sweepState: string;
  reason: string;
}

/**
 * Can WETH bridged to the pinned recipient be taken by someone else?
 *
 * The recipient is a Safe whose only owner is a governor with quorum 0 and
 * proposal threshold 0: any SNI holder can pass a proposal that empties it,
 * and one ("sni-yield-sweep") has already passed and only waits to be
 * executed. Executing it sweeps 9.41 WETH; the attacker tops up any shortfall
 * atomically, so any amount sent there is at risk. The destination counts
 * as safe once that governor no longer owns the Safe (the planned fix is
 * swapOwner to the deployer). A failed read counts as unsafe.
 */
export const destinationGuard = async (): Promise<DestinationCheck> => {
  const D = SNI.DEST;
  try {
    const [ownersHex, stateHex] = await Promise.all([
      ethCallOn(ChainId.POLYGON, D.recipient, IF.safe.encodeFunctionData("getOwners")),
      ethCallOn(
        ChainId.POLYGON,
        D.recipientGovernor,
        IF.governor.encodeFunctionData("state", [D.sweepProposalId]),
      ).catch(() => ""),
    ]);
    const owners = [...IF.safe.decodeFunctionResult("getOwners", ownersHex)[0]] as string[];
    const sweepState = stateHex
      ? PROPOSAL_STATES[Number(IF.governor.decodeFunctionResult("state", stateHex)[0])] ?? "Unknown"
      : "Unknown";
    const ownerIsGovernor = owners.some((owner) => eq(owner, D.recipientGovernor));
    const sweepLive = sweepState === "Succeeded" || sweepState === "Queued";
    let reason = "";
    if (ownerIsGovernor && sweepLive) {
      reason = `The recipient Safe on Polygon is still owned by its governor, and the "sni-yield-sweep" proposal there is ${sweepState} and can be executed at any moment. It would take the WETH you bridge.`;
    } else if (ownerIsGovernor) {
      reason = "The recipient Safe on Polygon is still owned by its governor, which anyone holding SNI can pass a proposal through (quorum 0). WETH bridged there is not safe until the governor is removed as owner.";
    }
    return { safe: !ownerIsGovernor, owners, ownerIsGovernor, sweepState, reason };
  } catch (error: any) {
    return {
      safe: false,
      owners: [],
      ownerIsGovernor: false,
      sweepState: "Unknown",
      reason: `Could not read the recipient Safe on Polygon, so the bridge stays locked. ${error?.message || ""}`.trim(),
    };
  }
};

/* -------------------------------------------------------------------------- */
/* Across quote                                                               */
/* -------------------------------------------------------------------------- */

export interface AcrossQuote {
  inputAmount: bigint;
  outputAmount: bigint;
  feeTotal: bigint;
  quoteTimestamp: number;
  fillDeadline: number;
  exclusiveRelayer: string;
  exclusivityDeadline: number;
  estimatedFillTimeSec: number;
  minDeposit: bigint;
  isAmountTooLow: boolean;
}

/**
 * Across' suggested-fees for sending `amount` WETH from Ethereum to Polygon.
 * Everything the deposit needs besides the pinned addresses comes from here,
 * and the SpokePool it names is checked against the one this console pins.
 */
export const fetchAcrossQuote = async (
  amount: bigint,
  fetchImpl: typeof fetch = fetch,
): Promise<AcrossQuote> => {
  const params = new URLSearchParams({
    inputToken: A.weth.toLowerCase(),
    outputToken: SNI.DEST.outputToken.toLowerCase(),
    originChainId: "1",
    destinationChainId: String(SNI.DEST.chainId),
    amount: amount.toString(),
    recipient: SNI.DEST.recipient.toLowerCase(),
    depositor: A.safe.toLowerCase(),
  });
  const response = await fetchImpl(`${SNI.ACROSS_API}/suggested-fees?${params}`);
  const json: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Across did not quote: ${json?.message || response.status}`);
  }
  if (!eq(json.spokePoolAddress, A.spokePool)) {
    throw new Error(
      `Across quoted through SpokePool ${json.spokePoolAddress}, not ${A.spokePool}. Not sending.`,
    );
  }
  const outputAmount = BigInt(json.outputAmount ?? 0);
  return {
    inputAmount: amount,
    outputAmount,
    feeTotal: BigInt(json.totalRelayFee?.total ?? amount - outputAmount),
    quoteTimestamp: Number(json.timestamp),
    fillDeadline: Number(json.fillDeadline),
    exclusiveRelayer: ethers.getAddress(json.exclusiveRelayer || ethers.ZeroAddress),
    exclusivityDeadline: Number(json.exclusivityDeadline ?? 0),
    estimatedFillTimeSec: Number(json.estimatedFillTimeSec ?? 0),
    minDeposit: BigInt(json.limits?.minDeposit ?? 0),
    isAmountTooLow: !!json.isAmountTooLow,
  };
};

/* -------------------------------------------------------------------------- */
/* Calldata                                                                   */
/* -------------------------------------------------------------------------- */

export const sniCalls = {
  claim: (): IRoleCall => ({
    to: A.stakingVault,
    data: IF.vault.encodeFunctionData("claimRewards"),
  }),

  /** depositNative of the whole quoted amount, sent as the call's value. */
  bridge: (periphery: Periphery, quote: AcrossQuote): IRoleCall => {
    const common = {
      recipient: toBytes32(SNI.DEST.recipient),
      outputToken: toBytes32(SNI.DEST.outputToken),
      exclusiveRelayer: toBytes32(quote.exclusiveRelayer),
    };
    const data =
      periphery.kind === "withDepositor"
        ? IF.withDepositor.encodeFunctionData("depositNative", [
          A.spokePool,
          A.safe,
          common.recipient,
          A.weth,
          quote.inputAmount,
          common.outputToken,
          quote.outputAmount,
          SNI.DEST.chainId,
          common.exclusiveRelayer,
          quote.quoteTimestamp,
          quote.fillDeadline,
          quote.exclusivityDeadline,
          "0x",
        ])
        : IF.noDepositor.encodeFunctionData("depositNative", [
          A.spokePool,
          common.recipient,
          A.weth,
          quote.inputAmount,
          common.outputToken,
          quote.outputAmount,
          SNI.DEST.chainId,
          common.exclusiveRelayer,
          quote.quoteTimestamp,
          quote.fillDeadline,
          quote.exclusivityDeadline,
          "0x",
        ]);
    return { to: periphery.address, data, value: quote.inputAmount.toString() };
  },
};

export interface DecodedBridge {
  periphery: Periphery;
  spokePool: string;
  depositor: string | null;
  recipient: string;
  inputToken: string;
  inputAmount: bigint;
  outputToken: string;
  outputAmount: bigint;
  destinationChainId: bigint;
  fillDeadline: number;
  message: string;
  value: bigint;
}

export const decodeBridge = (call: IRoleCall): DecodedBridge => {
  const periphery = PERIPHERIES.find((p) => eq(p.address, call.to));
  if (!periphery) throw new Error(`${call.to} is not one of the Across peripheries role 1 may call.`);
  const iface = periphery.kind === "withDepositor" ? IF.withDepositor : IF.noDepositor;
  const args = iface.decodeFunctionData("depositNative", call.data);
  const at = periphery.kind === "withDepositor" ? 1 : 0;
  return {
    periphery,
    spokePool: args[0],
    depositor: periphery.kind === "withDepositor" ? args[1] : null,
    recipient: fromBytes32(args[1 + at]),
    inputToken: args[2 + at],
    inputAmount: args[3 + at],
    outputToken: fromBytes32(args[4 + at]),
    outputAmount: args[5 + at],
    destinationChainId: args[6 + at],
    fillDeadline: Number(args[9 + at]),
    message: args[11 + at],
    value: BigInt(call.value ?? "0"),
  };
};

/**
 * Every field the modifier pins, re-checked, plus the ones it does not: the
 * SpokePool, the depositor (refund address), an empty message, the fee and
 * that the deposit is still fillable. Returns what is wrong; empty means send.
 */
export const validateBridge = (call: IRoleCall, nowSec = Math.floor(Date.now() / 1000)): string[] => {
  let d: DecodedBridge;
  try {
    d = decodeBridge(call);
  } catch (error: any) {
    return [error?.message || "The bridge calldata does not decode."];
  }
  const problems: string[] = [];
  if (!eq(d.spokePool, A.spokePool)) problems.push(`spokePool is ${d.spokePool}, not Across' ${A.spokePool}.`);
  if (d.depositor !== null && !eq(d.depositor, A.safe)) problems.push("The refund address is not the Safe.");
  if (!eq(d.recipient, SNI.DEST.recipient)) problems.push("The recipient is not the pinned Polygon address.");
  if (!eq(d.inputToken, A.weth)) problems.push("The input token is not WETH.");
  if (!eq(d.outputToken, SNI.DEST.outputToken)) problems.push("The output token is not Polygon WETH.");
  if (d.destinationChainId !== BigInt(SNI.DEST.chainId)) problems.push("The destination chain is not Polygon.");
  if (d.message !== "0x") problems.push("The deposit carries a message; it must be empty.");
  if (d.inputAmount <= 0n) problems.push("Nothing to bridge.");
  if (d.value !== d.inputAmount) problems.push("The ETH sent does not equal the deposit amount.");
  const floor = d.inputAmount - (d.inputAmount * SNI.MAX_FEE_BPS) / 10_000n;
  if (d.outputAmount < floor) {
    problems.push(`Across would keep more than ${Number(SNI.MAX_FEE_BPS) / 100}% of the amount.`);
  }
  if (d.outputAmount > d.inputAmount) problems.push("The output is larger than the input.");
  if (d.fillDeadline <= nowSec + 60) problems.push("The quote has expired; fetch a new one.");
  return problems;
};

/* -------------------------------------------------------------------------- */
/* Polygon: the landing Safe — defuse it, then move what lands                */
/* -------------------------------------------------------------------------- */

/**
 * The bridge can only land on the old SNI vault Safe, so the routine ends on
 * Polygon. Two things happen there, both through that vault's own Roles v1
 * modifier (still owned by the V1 factory: the vault never finalized):
 *
 * Defuse, once. Both attacker proposals act as the Safe's owner (approveHash
 * + execTransaction from the governor). Replacing the governor with the team
 * deployer as owner makes them revert. It takes:
 *   1. the deployer storing a permission through the factory: role 1 may call
 *      swapOwner on the Safe with exactly (sentinel, governor, deployer);
 *   2. a role-1 member sending that swapOwner through the modifier (a module
 *      call from the Safe to itself is "authorized" for Safe owner management).
 *
 * Move, every time. Role 1 may transfer WETH to the SYC vault's Safe 0x3Fca
 * (permission stored 2026-11-23). The console sends the Safe's whole balance.
 */
export const POLY = {
  CHAIN: ChainId.POLYGON,
  EXPLORER: "https://polygonscan.com",
  ROLE: "1",
  ADDR: {
    oldSafe: SNI.DEST.recipient,
    oldRoles: "0xD1c533001F94510b691bbf0d6454aF060fcc6C10",
    oldGovernor: SNI.DEST.recipientGovernor,
    /** Rethink V1 factory: owns the old modifier, takes the deployer's permission batch. */
    factory: "0x4C342E583A7Aa2840e07B4a3afB71533FBE37726",
    deployer: "0x8C2eb5359041d2d1Eb12866eC2111eC15eD81e8d",
    /** Team multisig (2-of-3): a permitted WETH/SNI recipient of the old Safe. */
    multisig: "0x83f2492db796bf0692c90b65debb926bd688fae5",
    /**
     * The Safe's sole owner after the defuse (threshold stays 1). The user's
     * choice on 2026-11-24 over the multisig: one key, full control of what
     * lands there, so it is worth guarding like the funds themselves.
     */
    newOwner: "0x8C2eb5359041d2d1Eb12866eC2111eC15eD81e8d",
    /** The SNI Yield Claim (SYC) vault's Safe — same as SYC.ADDR.safe (tested). */
    newSafe: "0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF",
    weth: SNI.DEST.outputToken,
  },
  /** Role 1 on the old modifier. */
  MEMBERS: [
    "0x8C2eb5359041d2d1Eb12866eC2111eC15eD81e8d",
    "0xf0d92E2B30A2c99ef515A02Cd28EfF8d21B42F9F",
  ],
  SENTINEL: "0x0000000000000000000000000000000000000001",
} as const;

const P = POLY.ADDR;
/** Roles v1: the call passed the permissions but the Safe's own call reverted. */
const MODULE_TRANSACTION_FAILED = "0xd27b44a9";

const PIF = {
  safe: new ethers.Interface(["function swapOwner(address prevOwner,address oldOwner,address newOwner)"]),
  erc20: new ethers.Interface([
    "function transfer(address to,uint256 amount)",
    "function balanceOf(address) view returns (uint256)",
  ]),
  rolesV1: new ethers.Interface([
    "function scopeTarget(uint16 role,address targetAddress)",
    "function scopeFunction(uint16 role,address targetAddress,bytes4 functionSig,bool[] isParamScoped,uint8[] paramType,uint8[] paramComp,bytes[] compValue,uint8 options)",
    "function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,uint16 role,bool shouldRevert) returns (bool)",
  ]),
  factory: new ethers.Interface(["function submitPermissions(bytes[] permissions)"]),
};

const word = (address: string) => ethers.zeroPadValue(ethers.getAddress(address), 32);

export const polyCalls = {
  /** The one Safe call the defuse needs, sent through role 1. */
  swapOwner: (): IRoleCall => ({
    to: P.oldSafe,
    data: PIF.safe.encodeFunctionData("swapOwner", [POLY.SENTINEL, P.oldGovernor, P.newOwner]),
  }),

  /**
   * Sent by the deployer straight to the factory (not through a role): lets
   * role 1 call swapOwner on the Safe with these three exact arguments and
   * nothing else on the Safe.
   */
  defusePermission: (): IRoleCall => ({
    to: P.factory,
    data: PIF.factory.encodeFunctionData("submitPermissions", [[
      PIF.rolesV1.encodeFunctionData("scopeTarget", [POLY.ROLE, P.oldSafe]),
      PIF.rolesV1.encodeFunctionData("scopeFunction", [
        POLY.ROLE,
        P.oldSafe,
        PIF.safe.getFunction("swapOwner")!.selector,
        [true, true, true],
        [0, 0, 0], // Static
        [0, 0, 0], // EqualTo
        [word(POLY.SENTINEL), word(P.oldGovernor), word(P.newOwner)],
        0, // None: no value, no delegatecall
      ]),
    ]]),
  }),

  moveWeth: (amount: bigint): IRoleCall => ({
    to: P.weth,
    data: PIF.erc20.encodeFunctionData("transfer", [P.newSafe, amount]),
  }),
};

export interface PolyState {
  /** WETH waiting in the old Safe — what the move step sends on. */
  oldSafeWeth: bigint;
  newSafeWeth: bigint;
  /** Role 1 may already call swapOwner (the deployer's permission is stored). */
  defuseScoped: boolean;
}

/**
 * Asked the way the modifier answers: a dry run of the swapOwner from a role
 * member. Refused at the permission layer means the deployer has not stored
 * it yet; any other answer (passes, or the Safe itself reverting because the
 * governor is already gone) means it is in place.
 */
export const polyReadState = async (): Promise<PolyState> => {
  const balance = async (who: string) =>
    BigInt(PIF.erc20.decodeFunctionResult(
      "balanceOf",
      await ethCallOn(POLY.CHAIN, P.weth, PIF.erc20.encodeFunctionData("balanceOf", [who])),
    )[0]);
  const call = polyCalls.swapOwner();
  const probe = ethCallOn(
    POLY.CHAIN,
    P.oldRoles,
    PIF.rolesV1.encodeFunctionData("execTransactionWithRole", [call.to, 0, call.data, 0, POLY.ROLE, true]),
    POLY.MEMBERS[1],
  ).then(
    () => true,
    (error: any) => {
      if (!error?.answered) throw error;
      // Permission refusals are their own errors (TargetAddressNotAllowed
      // 0xef3440ac before the defuse is stored); the Safe refusing the call
      // itself comes back as ModuleTransactionFailed().
      return String(error.revertData || "").startsWith(MODULE_TRANSACTION_FAILED);
    },
  );
  const [oldSafeWeth, newSafeWeth, defuseScoped] = await Promise.all([
    balance(P.oldSafe),
    balance(P.newSafe),
    probe,
  ]);
  return { oldSafeWeth, newSafeWeth, defuseScoped };
};

export const isPolyMember = (account?: string | null) => !!account && POLY.MEMBERS.some((m) => eq(m, account));

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/** ETH rounded DOWN to `digits` decimals, trailing zeros dropped. */
export const fmtEth = (wei: bigint, digits = 6): string => {
  const unit = 10n ** BigInt(18 - digits);
  const floored = (wei / unit) * unit;
  let s = ethers.formatEther(floored);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  if (floored === 0n && wei > 0n) return "<0." + "0".repeat(digits - 1) + "1";
  return s;
};

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export const isMember = (account?: string | null) => !!account && SNI.MEMBERS.some((m) => eq(m, account));
