import type { InputType } from "~/types/enums/input_type";

export type FieldsMapType = {
  [key in string]: {
    label: string;
    key: string;
    type: InputType;
    placeholder?: string;
    rules?: any[];
    min?: number;
    charLimit?: number;
    choices?: { value: number; title: string }[];
  }[];
};
