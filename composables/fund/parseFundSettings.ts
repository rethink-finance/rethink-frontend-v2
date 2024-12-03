import type IFundSettings from "~/types/fund_settings";

export const parseFundSettings = (fundData: any): IFundSettings => {
  const fundSettings: Partial<IFundSettings> = {};

  // Directly iterate over the fund details object's entries.
  Object.entries(fundData).forEach(([key, value]) => {
    // Assume that every key in quantity corresponds to a valid key in IFundSettings.
    const detailKey = key as keyof IFundSettings;

    // Convert bigint values to strings, otherwise assign the value directly.
    // This approach skips checking if detailKey is explicitly part of fundSettings
    // since fundSettings is typed as Partial<IFundSettings> and initialized accordingly.
    fundSettings[detailKey] =
      typeof value === "bigint" ? value.toString() : value;
  });

  return fundSettings as IFundSettings;
};
