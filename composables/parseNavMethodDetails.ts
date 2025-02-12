import { ethers } from "ethers";
import { encodeParameter } from "web3-eth-abi";
import type INAVMethod from "~/types/nav_method";
import { NAVEntryTypeToPositionTypeMap, PositionType } from "~/types/enums/position_type";
import { cleanComplexWeb3Data, formatJson } from "~/composables/utils";

/**
 * Position Type Methods preparing data from actual Object to an array of values that are ready to be encoded.
 **/
export const prepNAVMethodLiquid = (details: Record<string, any>): any[] => {
  return details.liquid.map((method: Record<string, any>) => [
    method.tokenPair || ethers.ZeroAddress,
    method.aggregatorAddress || "",
    method.functionSignatureWithEncodedInputs || "0x",
    method.assetTokenAddress || "",
    method.nonAssetTokenAddress || ethers.ZeroAddress,
    method.isReturnArray || false,
    parseInt(method.returnLength) || 0,
    parseInt(method.returnIndex) || 0,
    parseInt(method.pastNAVUpdateIndex) || 0,
  ]);
}

export const prepNAVMethodIlliquid = (details: Record<string, any>, baseDecimals: number): any[] => {
  if (!baseDecimals) {
    throw new Error("Failed preparing NAV Illiquid method, base decimals are not known.")
  }
  return details.illiquid.map((method: Record<string, any>) => {
    const trxHashes = method.otcTxHashes?.map(
      // Remove leading and trailing whitespace
      (hash: any) => hash.trim(),
    ).filter(
      // Remove empty strings;
      (hash: any) => hash !== "",
    ) || [];

    return [
      ethers.parseUnits(method.baseCurrencySpent?.toString() ?? "0", baseDecimals),
      parseInt(method.amountAquiredTokens) || 0,
      method.tokenAddress,
      method.isNFT,
      trxHashes,
      parseInt(method.nftType) || 0,
      parseInt(method.nftIndex) || 0,
      parseInt(method.pastNAVUpdateIndex) || 0,
    ]
  });
}

export const prepNAVMethodNFT = (details: Record<string, any>): any[] => {
  return details.nft.map((method: Record<string, any>) => [
    method.oracleAddress,
    method.nftAddress,
    method.nftType,
    parseInt(method.nftIndex) || 0,
    parseInt(method.pastNAVUpdateIndex) || 0,
  ]);
}

export const prepNAVMethodComposable = (
  details: Record<string, any>,
): any[] => {
  return details.composable.map((method: Record<string, any>) => [
    method.remoteContractAddress,
    method.functionSignatures,
    method.encodedFunctionSignatureWithInputs,
    parseInt(method.normalizationDecimals) || 0,
    method.isReturnArray,
    parseInt(method.returnValIndex) || 0,
    parseInt(method.returnArraySize) || 0,
    parseInt(method.returnValType) || 0,
    parseInt(method.pastNAVUpdateIndex) || 0,
    method.isNegative,
  ]);
}

export const prepRoleModEntryInput = (value: any) => {
  /*
    - address validation
    - bytes validation
    - int validation
    - enum valudation (int)
  */
  const dtype = value.internalType;

  if (value.isArray) {
    const retDat = []
    for (let i = 0; i < value.data.length; i++) {
      if (dtype.startsWith("address")) {
        retDat.push(value.data[i]);
      } else if (dtype.startsWith("bytes")) {
        retDat.push(value.data[i]);
      } else if (dtype.startsWith("int")) {
        retDat.push(value.data[i]);
      } else if (dtype.startsWith("uint")) {
        retDat.push(value.data[i]);
      } else if (dtype.startsWith("enum")) {
        retDat.push(value.data[i]);
      } else if (dtype.startsWith("bool")) {
        if (typeof value.data[i] === "boolean") {
          retDat.push(value.data[i]);
        } else {
          retDat.push(value.data[i] === "true");
        }
      }
    }
    return retDat;
  }

  if (dtype.startsWith("address")) {
    return value.data;
  } else if (dtype.startsWith("bytes")) {
    return value.data;
  } else if (dtype.startsWith("int")) {
    return value.data;
  } else if (dtype.startsWith("uint")) {
    return value.data;
  } else if (dtype.startsWith("enum")) {
    return value.data;
  } else if (dtype.startsWith("bool")) {
    if (typeof value.data === "boolean") {
      return value.data;
    }
    return value.data === "true";
  }
}


export const parseNAVMethod = (index: number, navMethodData: Record<string, any>): INAVMethod => {
  let description;
  const positionType =
    NAVEntryTypeToPositionTypeMap[navMethodData.entryType];

  try {
    if (navMethodData.description === "") {
      description = {};
    } else {
      description = JSON.parse(navMethodData.description ?? "{}");
    }
  } catch (error) {
    // Handle the error or rethrow it
    console.warn(
      "Failed to parse NAV entry JSON description string: ",
      error,
    );
  }

  // console.log("DETAILS raw 0 ", JSON.stringify(navMethodData, stringifyBigInt, 2))
  const details = cleanComplexWeb3Data(navMethodData);
  // console.log("DETAILS cleaned 1 ", JSON.stringify(details, null, 2))
  const detailsJson = formatJson(details);
  // console.log("DETAILS json 2 ", detailsJson)


  // NOTE: this is a UI hack around displaying nested rethink structures
  // inside PositionType.Composable types.
  let displayPositionType = positionType;
  if (positionType === PositionType.Composable) {
    if (details.composable[0].functionSignatures.includes("illiquidCalc")) {
      displayPositionType = PositionType.Illiquid;
    } else if (details.composable[0].functionSignatures.includes("liquidCalc")) {
      displayPositionType = PositionType.Liquid;
    }
  }

  return {
    index,
    positionType,
    displayPositionType,
    positionName: description?.positionName,
    valuationSource: description?.valuationSource,
    details,
    detailsJson,
    detailsHash: ethers.keccak256(ethers.toUtf8Bytes(detailsJson)),
  } as INAVMethod;
}
