export enum InputType {
  Text = "text",
  Textarea = "textarea",
  ReadonlyJSON = "readonlyJson",
  Checkbox = "checkbox",
  Number = "number",
  Select = "select",
  Image = "image",
  Period = "period",
  Date = "date",
}

export enum PeriodUnits {
  Seconds = "second",
  Minutes = "minute",
  Hours = "hour",
  Days = "day",
  Weeks = "week",
}

type TimeInSecondsMap = Record<PeriodUnits, number>;


export const TimeInSeconds: TimeInSecondsMap = {
  [PeriodUnits.Seconds]: 1,
  [PeriodUnits.Minutes]: 60,
  [PeriodUnits.Hours]: 3600,
  [PeriodUnits.Days]: 86400,
  [PeriodUnits.Weeks]: 604800,
};
export const periodChoices = [
  { value: PeriodUnits.Seconds, title: "Seconds" },
  { value: PeriodUnits.Minutes, title: "Minutes" },
  { value: PeriodUnits.Hours, title: "Hours" },
  { value: PeriodUnits.Days, title: "Days" },
  { value: PeriodUnits.Weeks, title: "Weeks" },
]

export const defaultInputTypeValue: Record<InputType, any> = {
  [InputType.Text]: "",
  [InputType.Textarea]: "",
  [InputType.ReadonlyJSON]: "",
  [InputType.Checkbox]: false,
  [InputType.Number]: 0,
  // If the default value 0 as integer won't work for all, add default values to PositionTypeValuationTypeFieldsMap
  // wherever we will need them.
  [InputType.Select]: 0,
  [InputType.Image]: "",
  [InputType.Period]: "0",
  [InputType.Date]: "",
}

export interface IField {
  label: string;
  key: string;
  type: InputType;
  placeholder: string;
  rules?: any[];
  isEditable?: boolean;
  cols?: number;
  min?: number;
  charLimit?: number;
  info?: string;
  isToggleable?: boolean;
  isToggleOn?: boolean;
  isCustomValueToggleOn?: boolean;
  defaultValue?: any;
  defaultValueInfo?: string;
  isFieldByUser?: boolean;
  fields?: IField[];
  groupName?: string;
  title?: string;
  value?: string | boolean;
  choices?: { value: number | string | boolean; title: string }[],
  tooltip?: string;
  tag?: string;
}

export interface IFieldGroup {
  isToggleable: boolean;
  isToggleOn: boolean;
  groupName?: string;
  fields: IField[];
  info?: string;
  tooltip?: string;
}
