import type { ClockMode } from "./enums/clock_mode";

/**
 * Example clockModeString:
 *   - "mode=blocknumber&from=default"
 *   - "mode=timestamp"
 **/
export default interface IClockMode {
  mode: ClockMode;
  from?: string // default, this is only filled if clock mode is blocknumber
}
