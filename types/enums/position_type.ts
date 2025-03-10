import { ethers } from "ethers";
import { ValuationType } from "~/types/enums/valuation_type";
import type { IPositionType } from "~/types/position_type";
import { InputType } from "~/types/enums/input_type";

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
export const NAVEntryTypeToPositionTypeMap: Record<number, PositionType> = {
  0: PositionType.Liquid, // NAVLiquidUpdateType
  1: PositionType.Illiquid, // NAVIlliquidUpdateType
  2: PositionType.NFT, // NAVNFTUpdateType
  3: PositionType.Composable, // NAVComposableUpdateType
}
export const NAVEntryTypeStringToPositionTypeMap: Record<string, PositionType> = {
  NAVLiquidUpdateType: PositionType.Liquid,
  NAVIlliquidUpdateType: PositionType.Illiquid,
  NAVNFTUpdateType: PositionType.NFT,
  NAVComposableUpdateType: PositionType.Composable,
}
export const NAVEntryTypeStringToNAVEntryTypeMap: Record<string, number> = {
  NAVLiquidUpdateType: 0,
  NAVIlliquidUpdateType: 1,
  NAVNFTUpdateType: 2,
  NAVComposableUpdateType: 3,
}
export const PositionTypeToNAVEntryTypeMap: Record<PositionType, number> = {
  [PositionType.Liquid]: 0, // NAVLiquidUpdateType
  [PositionType.Illiquid]: 1, // NAVIlliquidUpdateType
  [PositionType.NFT]: 2, // NAVNFTUpdateType
  [PositionType.Composable]: 3, // NAVComposableUpdateType
}
export const PositionTypeToNAVCalculationMethod: Record<PositionType, string> = {
  [PositionType.Liquid]: "liquidCalculationReadOnly",
  [PositionType.Illiquid]: "illiquidCalculationReadOnly",
  [PositionType.NFT]: "nftCalculationReadOnly",
  [PositionType.Composable]: "composableCalculationReadOnly",
}
export const PositionTypeToNAVCacheMethod: Record<PositionType, string> = {
  [PositionType.Liquid]: "getNAVLiquidCache",
  [PositionType.Illiquid]: "getNAVIlliquidCache",
  [PositionType.NFT]: "getNAVNFTCache",
  [PositionType.Composable]: "getNAVComposableCache",
}
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
    [key in ValuationType | "undefined"]?: any[];
  };
};

export const getInputTypeCols = (inputType: InputType) => {
  // Default width of 6 for number and checkbox inputs.
  if ([InputType.Number, InputType.Checkbox].includes(inputType)) return 6;
  return 12;
}

export const PositionTypeValuationTypeFieldsMap: PositionTypeValuationTypeFieldsMapType = {
  [PositionType.Liquid]: {
    [ValuationType.DEXPair]: [
      {
        label: "Token Pair Address",
        key: "tokenPair",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
      {
        label: "Position Token Address",
        key: "assetTokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
    ],
    [ValuationType.Aggregator]: [
      {
        label: "Aggregator Address",
        key: "aggregatorAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
      {
        label: "Encoded Function Input Data",
        key: "functionSignatureWithEncodedInputs",
        type: InputType.Textarea,
        cols: 12,
      },
      {
        label: "Position Token Address",
        key: "assetTokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
      {
        label: "Is Return Array?",
        key: "isReturnArray",
        type: InputType.Checkbox,
      },
      {
        label: "Return Length",
        key: "returnLength",
        type: InputType.Number,
        min: 0,
        placeholder: "E.g. 4",
      },
      {
        label: "Return Index",
        key: "returnIndex",
        type: InputType.Number,
        min: 0,
        placeholder: "E.g. 1",
      },
    ],
  },
  [PositionType.Illiquid]: {
    [ValuationType.ERC20]: [
      {
        label: "Base Currency Spent",
        key: "baseCurrencySpent",
        type: InputType.Number,
        placeholder: "E.g. 10",
      },
      {
        label: "Price Per Token (in the base asset)",
        key: "pricePerToken",
        type: InputType.Number,
        placeholder: "E.g. 10",
      },
      {
        label: "Amount Of Acquired Tokens",
        key: "amountAquiredTokens",
        type: InputType.Number,
        placeholder: "E.g. 10",
      },
      {
        label: "Token Address",
        key: "tokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
      {
        label: "Comma-separated list of TX hashes",
        key: "otcTxHashes",
        type: InputType.Textarea,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984,\n0xbb4570f3dd5aG2nf1512uDF915BDcdF34202h17g",
        // TODO validate multiple addresses
      },
    ],
    [ValuationType.ERC721]: [
      {
        label: "Base Currency Spent",
        key: "baseCurrencySpent",
        type: InputType.Number,
        placeholder: "E.g. 10",
      },
      {
        label: "Price Per Token (in the base asset)",
        key: "pricePerToken", // TODO correct this key
        type: InputType.Number,
        placeholder: "E.g. 10",
      },
      {
        label: "Amount Of Acquired Tokens",
        key: "amountAquiredTokens",
        type: InputType.Number,
        placeholder: "E.g. 10",
      },
      {
        label: "Token Address",
        key: "tokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
      {
        label: "Comma-separated list of TX hashes",
        key: "otcTxHashes",
        type: InputType.Textarea,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984,\n0xbb4570f3dd5aG2nf1512uDF915BDcdF34202h17g",
        // TODO validate multiple addresses
      },
    ],
    [ValuationType.ERC1155]: [
      {
        label: "Base Currency Spent",
        key: "baseCurrencySpent",
        type: InputType.Number,
        placeholder: "E.g. 10",
      },
      {
        label: "Price Per Token (in the base asset)",
        key: "pricePerToken",
        type: InputType.Number,
        placeholder: "E.g. 10",
      },
      {
        label: "Amount Of Acquired Tokens",
        key: "amountAquiredTokens",
        type: InputType.Number,
        placeholder: "E.g. 10",
      },
      {
        label: "Token Address",
        key: "tokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
      {
        label: "Comma-separated list of TX hashes",
        key: "otcTxHashes",
        type: InputType.Textarea,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984,\n0xbb4570f3dd5aG2nf1512uDF915BDcdF34202h17g",
        // TODO validate multiple addresses
      },
      {
        label: "NFT Index",
        key: "nftIndex",
        type: InputType.Number,
        placeholder: "E.g. 1",
      },
    ],
  },
  [PositionType.NFT]: {
    [ValuationType.ERC721]: [
      {
        label: "Oracle Feed Address",
        key: "tokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
      {
        label: "NFT Address",
        key: "tokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
    ],
    [ValuationType.ERC1155]: [
      {
        label: "Oracle Feed Address",
        key: "tokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
      {
        label: "NFT Address",
        key: "tokenAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
      {
        label: "NFT Index",
        key: "nftIndex",
        type: InputType.Number,
        placeholder: "E.g. 1",
      },
    ],
  },
  [PositionType.Composable]: {
    undefined: [
      {
        label: "Contract Address",
        key: "remoteContractAddress",
        type: InputType.Text,
        placeholder: "E.g. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        rules: [formRules.isValidAddress],
      },
      {
        label: "Function Signature",
        key: "functionSignatures",
        type: InputType.Text,
        placeholder: "E.g. getPositionValueInUSD(address,address,uint)",
      },
      {
        label: "Encoded Function Input Data",
        key: "encodedFunctionSignatureWithInputs",
        type: InputType.Textarea,
        cols: 12,
      },
      {
        label: "Decimals Used For Return Value",
        key: "normalizationDecimals",
        type: InputType.Number,
        placeholder: "E.g. 18",
      },
      {
        label: "Is Return Array?",
        key: "isReturnArray",
        type: InputType.Checkbox,
      },
      {
        label: "Return Length",
        key: "returnArraySize",
        type: InputType.Number,
        min: 0,
        placeholder: "E.g. 4",
      },
      {
        label: "Return Index",
        key: "returnValIndex",
        type: InputType.Number,
        min: 0,
        placeholder: "E.g. 1",
      },
      {
        label: "Return Value Type",
        key: "returnValType",
        type: InputType.Select,
        choices: [
          {
            value: 0,
            title: "uint256",
          },
          {
            value: 1,
            title: "int256",
          },
        ],
      },
      {
        label: "Is Negative?",
        key: "isNegative",
        type: InputType.Checkbox,
      },
    ],
  },
};


/** A map of default fields for each position type & valuation type combination. **/
export const PositionTypeValuationTypeDefaultFieldsMap: PositionTypeValuationTypeFieldsMapType = {
  [PositionType.Liquid]: {
    [ValuationType.DEXPair]: [
      {
        key: "aggregatorAddress",
        value: ethers.ZeroAddress,
      },
      {
        key: "functionSignatureWithEncodedInputs",
        value: "0x",
      },
      {
        key: "isReturnArray",
        value: false,
      },
      {
        key: "returnLength",
        value: 0,
      },
      {
        key: "returnIndex",
        value: 0,
      },
      {
        key: "pastNAVUpdateIndex",
        value: 0,
      },
    ],
    [ValuationType.Aggregator]: [
      {
        key: "aggregatorAddress",
        value: ethers.ZeroAddress,
      },
      {
        key: "functionSignatureWithEncodedInputs",
        value: "0x",
      },
      {
        key: "pastNAVUpdateIndex",
        value: 0,
      },
    ],
  },
  [PositionType.Illiquid]: {
    [ValuationType.ERC20]: [
      {
        key: "isNFT",
        value: false,
      },
      {
        key: "nftType",
        value: "ERC-20",
      },
      {
        key: "nftIndex",
        value: 0,
      },
      {
        key: "pastNAVUpdateIndex",
        value: null,
      },
    ],
    [ValuationType.ERC721]: [
      {
        key: "isNFT",
        value: true,
      },
      {
        key: "nftType",
        value: "ERC-721",
      },
      {
        key: "nftIndex",
        value: 0,
      },
      {
        key: "pastNAVUpdateIndex",
        value: null,
      },
    ],
    [ValuationType.ERC1155]: [
      {
        key: "isNFT",
        value: true,
      },
      {
        key: "nftType",
        value: "ERC-1155",
      },
      {
        key: "pastNAVUpdateIndex",
        value: null,
      },
    ],
  },
  [PositionType.NFT]: {
    [ValuationType.ERC721]: [],
    [ValuationType.ERC1155]: [],
  },
  [PositionType.Composable]: {
    undefined: [
      {
        key: "pastNAVUpdateIndex",
        value: 0,
      },
    ],
  },
};
