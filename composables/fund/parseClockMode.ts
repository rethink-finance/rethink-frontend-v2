import type IClockMode from "~/types/clock_mode";
import { ClockMode, ClockModeMap } from "~/types/enums/clock_mode";

export const parseClockMode = (clockModeString: string): IClockMode => {
  // Example clockModeString:
  //   - "mode=blocknumber&from=default"
  //   - "mode=timestamp"
  const params = new URLSearchParams(clockModeString);
  const mode = (params.get("mode") as ClockMode) || "";
  const from = params.get("from");

  if (!(mode in ClockModeMap)) {
    console.error(
      "Fund clock mode is not in valid options: ",
      mode,
      clockModeString,
    );
  }

  return {
    mode: ClockModeMap[mode],
    ...(from ? { from } : {}),
  } as IClockMode;
};
