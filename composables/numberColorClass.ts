export const numberColorClass = (value?: number, threshold: number=0): string => {
  if (!value) return "";
  if (value > threshold) {
    return "text-success";
  } else if (value < threshold) {
    return "text-error";
  }
  return "";
};
