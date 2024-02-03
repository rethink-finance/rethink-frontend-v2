export const numberColorClass = (value: number): string => {
  if (value > 0) {
    return "text-success";
  } else if (value < 0) {
    return "text-error";
  }
  return "";
};
