export enum InputType {
  Text = "text",
  Textarea = "textarea",
  Checkbox = "checkbox",
  Number = "number",
  Select = "select",
  Image = "image",
}

export const defaultInputTypeValue: Record<InputType, any> = {
  [InputType.Text]: "",
  [InputType.Textarea]: "",
  [InputType.Checkbox]: false,
  [InputType.Number]: 0,
  // If the default value 0 as integer won't work for all, add default values to PositionTypeValuationTypeFieldsMap
  // wherever we will need them.
  [InputType.Select]: 0,
  [InputType.Image]: "",
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
  isDeletable?: boolean;
  fields?: IField[];
  title?: string;
  value?: string | boolean;
  choices?: { value: number | string | boolean; title: string }[],
}

export interface IFieldGroup {
  isToggleable: boolean;
  isToggleOn: boolean;
  fields: IField[];
}
