import type { IPositionType } from "~/types/position_type";
import { ValuationType } from "~/types/enums/valuation_type";

export enum PositionType {
  Liquid = "liquid",
  Composable = "composable",
  NFT = "nft",
  Illiquid = "illiquid"
}
export const PositionTypesMap: Record<PositionType, IPositionType> = {
  [PositionType.Liquid]: {
    name: "Liquid",
    key: PositionType.Liquid,
  },
  [PositionType.Illiquid]: {
    name: "Illiquid",
    key: PositionType.Illiquid,
  },
  [PositionType.NFT]: {
    name: "NFT",
    key: PositionType.NFT,
  },
  [PositionType.Composable]: {
    name: "DeFi",
    key: PositionType.Composable,
  },
};

export const PositionTypes = Object.values(PositionTypesMap);
export const PositionTypeKeys = Object.values(PositionType);


/**
 * Position Type Maps (Dynamic Form Data)
 **/
export const PositionTypeToValuationTypesMap: Record<PositionType, ValuationType[]> = {
  [PositionType.Liquid]: [
    ValuationType.DEXPair,
    ValuationType.Aggregator,
  ],
  [PositionType.Illiquid]: [
    ValuationType.ERC20,
    ValuationType.ERC721,
    ValuationType.ERC1155,
  ],
  [PositionType.NFT]: [
    ValuationType.ERC721,
    ValuationType.ERC1155,
  ],
  [PositionType.Composable]: [],
}

type PositionTypeValuationTypeFieldsMapType = {
  [key in PositionType]: {
    [key in ValuationType]?: any[];
  };
};

export enum InputType {
  Text = "text",
  Textarea = "textarea",
  Checkbox = "checkbox",
  Number = "number",
}

export const PositionTypeValuationTypeFieldsMap: PositionTypeValuationTypeFieldsMapType = {
  [PositionType.Liquid]: {
    [ValuationType.DEXPair]: [
      {
        label: "Token pair",
        key: "token_pair",
        type: "text",
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      },
      {
        label: "Position Token",
        key: "assetTokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      },
    ],
    [ValuationType.Aggregator]: [
      {
        label: "Aggregator Address",
        key: "aggregator_address",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      },
      {
        label: "Encoded Function Input Data",
        key: "encoded_function_input_data",
        type: InputType.Textarea,
        cols: 12,
      },
      {
        label: "Position Token",
        key: "assetTokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      },
      {
        label: "Is Return Array?",
        key: "is_return_array",
        type: InputType.Checkbox,
      },
      {
        label: "Return Length",
        key: "return_length",
        type: InputType.Number,
        min: 0,
        placeholder: "E.g. 4",
      },
      {
        label: "Return Index",
        key: "return_index",
        type: InputType.Number,
        min: 0,
        placeholder: "E.g. 1",
      },
    ],
  },
  [PositionType.NFT]: {
    [ValuationType.ERC721]: [
      {
        label: "Token pair",
        key: "token_pair",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      },
      {
        label: "Position Token",
        key: "assetTokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      },
    ],
    [ValuationType.ERC1155]: [
      {
        label: "Token pair",
        key: "token_pair",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      },
      {
        label: "Position Token",
        key: "assetTokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      },
    ],
  },
  [PositionType.Illiquid]: {
    [ValuationType.ERC20]: [
      {
        label: "Token pair",
        key: "token_pair",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      },
    ],
    [ValuationType.ERC721]: [
      {
        label: "Token pair",
        key: "token_pair",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      },
    ],
    [ValuationType.ERC1155]: [
      {
        label: "Token pair",
        key: "token_pair",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      },
    ],
  },
  [PositionType.Composable]: {},
};
