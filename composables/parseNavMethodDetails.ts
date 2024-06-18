import { ethers } from "ethers";

/**
 * Position Type Methods preparing data from actual Object to an array of values that are ready to be encoded.
 **/
export const prepNAVMethodLiquid = (details: Record<string, any>): any[] => {
  return details.liquid.map((method: Record<string, any>) => [
    method.tokenPair || "0x0000000000000000000000000000000000000000",
    method.aggregatorAddress || "",
    method.functionSignatureWithEncodedInputs || "0x",
    method.assetTokenAddress || "",
    method.nonAssetTokenAddress || "0x0000000000000000000000000000000000000000",
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
      (hash: string) => hash.trim(),
    ).filter(
      // Remove empty strings;
      (hash: string) => hash !== "",
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

export const prepNAVMethodComposable = (details: Record<string, any>): any[] => {
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
        retDat.push(value.data[i] === "true");
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
    return value.data === "true";
  }
}
