export enum ClockMode {
  Timestamp = "timestamp",
  BlockNumber = "blocknumber",
}

export const ClockModeMap: Record<ClockMode, ClockMode> = {
  [ClockMode.Timestamp]: ClockMode.Timestamp,
  [ClockMode.BlockNumber]: ClockMode.BlockNumber,
}
