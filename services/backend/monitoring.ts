import type { ChainId } from "~/types/enums/chain_id";

/**
 * The governance monitoring overview: every vault's live proposals across all
 * chains, decoded and graded by the backend's threat rules, plus each vault's
 * governance posture. One read; the backend rebuilds it every five minutes.
 */

export type ThreatSeverity = "critical" | "high" | "medium" | "low" | "info";
export type ThreatLevel = ThreatSeverity | "none";

export const SEVERITY_RANK: Record<ThreatLevel, number> = {
  none: -1,
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export type MonitoredProposalState =
  | "Pending"
  | "Active"
  | "Canceled"
  | "Defeated"
  | "Succeeded"
  | "Queued"
  | "Expired"
  | "Executed";

export interface ThreatFlag {
  code: string;
  severity: ThreatSeverity;
  title: string;
  detail?: string;
  callPath?: string;
  count?: number;
  callPaths?: string[];
}

export interface DecodedCall {
  path: string;
  target: string;
  targetLabel: string;
  value: string;
  selector: string;
  contractName?: string;
  functionName?: string;
  signature?: string;
  args?: Record<string, any>;
  operation?: number;
  readOnly?: boolean;
  inner?: DecodedCall[];
  calldata: string;
}

export interface MonitoredVault {
  chainId: ChainId;
  fundAddress: string;
  fundName: string;
  fundSymbol: string;
  safe: string;
  safeIsContract?: boolean;
  governor: string;
  governanceToken: string;
  governanceTokenDecimals: number;
  baseToken: string;
  baseTokenSymbol: string;
  baseTokenDecimals: number;
  roleModules: string[];
  clockMode: "timestamp" | "blocknumber";
  quorumPercent: number;
  proposalThreshold: string;
  votingDelay: string;
  votingPeriod: string;
  allowedManagers: string[];
  feeCollectors: string[];
  flags: ThreatFlag[];
  level: ThreatLevel;
  liveProposals: number;
  flaggedProposals: number;
  snapshotUpdatedAt?: string;
  contextError?: string;
}

export interface MonitoredProposal {
  chainId: ChainId;
  fundAddress: string;
  fundName: string;
  fundSymbol: string;
  governor: string;
  proposalId: string;
  title: string;
  description: string;
  proposer: string;
  state: MonitoredProposalState;
  isLive: boolean;
  isExecutable: boolean;
  clockMode: "timestamp" | "blocknumber";
  voteStart: string;
  voteEnd: string;
  voteStartAt?: number;
  voteEndAt?: number;
  createdAt: number;
  createdBlockNumber: string;
  createdTxHash: string;
  executedAt?: number;
  canceledAt?: number;
  queuedAt?: number;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  totalSupply: string;
  quorumVotes: string;
  quorumReached: boolean;
  isPassing: boolean;
  voterCount: number;
  calls: DecodedCall[];
  flags: ThreatFlag[];
  level: ThreatLevel;
}

export interface MonitoringChain {
  chainId: ChainId;
  vaults: number;
  indexedVaults: number;
  latestBlock?: number;
  latestBlockTimestamp?: number;
  error?: string;
}

export interface MonitoringOverview {
  generatedAt: string;
  chains: MonitoringChain[];
  vaults: MonitoredVault[];
  live: MonitoredProposal[];
  executable: MonitoredProposal[];
  recent: MonitoredProposal[];
  summary: {
    liveProposals: number;
    flaggedLive: number;
    criticalLive: number;
    executableProposals: number;
    flaggedExecutable: number;
    vaults: number;
    vaultsAtRisk: number;
  };
}

/** Throws on any failure: the page has nothing to fall back to and says so. */
export const fetchMonitoringOverview = async (): Promise<MonitoringOverview> => {
  const config = useRuntimeConfig();
  const response = await fetch(`${config.public.BACKEND_URL}/governance/monitoring`);
  if (!response.ok) {
    throw new Error(`Monitoring overview request failed: ${response.status} ${response.statusText}`);
  }
  return await response.json();
};

/** High and critical are the grades that should stop a reader; the rest are context. */
export const isFlaggedLevel = (level: ThreatLevel) => SEVERITY_RANK[level] >= SEVERITY_RANK.high;

/**
 * Decimals to read share and vote amounts at. Vault shares mint in base-token
 * units while decimals() says 18 (see the vault-token-decimals note), so a
 * vault governed by its own shares reads at its base token's scale; an
 * external governance token reads at its own.
 */
export const shareDecimals = (vault?: MonitoredVault): number => {
  if (!vault) return 18;
  const selfGoverned = vault.governanceToken.toLowerCase() === vault.fundAddress.toLowerCase();
  return selfGoverned ? vault.baseTokenDecimals : vault.governanceTokenDecimals;
};
