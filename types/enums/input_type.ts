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
