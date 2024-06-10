export const formRules: Record<string, any> = {
  required:  (value: any) => value !== "" && value !== undefined && value !== null || "This field is required.",
};
