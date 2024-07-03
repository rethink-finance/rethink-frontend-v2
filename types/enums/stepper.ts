export type FieldsMapType = {
  [key in string]: {
    label: string;
    key: string;
    type: InputType;
    placeholder?: string;
    rules?: any[];
    min?: number;
    choices?: { value: number; title: string }[];
  }[];
};

export enum InputType {
  Text = "text",
  Textarea = "textarea",
  Checkbox = "checkbox",
  Number = "number",
  Select = "select",
}
