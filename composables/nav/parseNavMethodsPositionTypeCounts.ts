import type INAVMethod from "~/types/nav_method";
import type IPositionTypeCount from "~/types/position_type";
import type INAVUpdate from "~/types/nav_update";
import { PositionType, PositionTypeKeys, PositionTypesMap } from "~/types/enums/position_type";


export const parseNavMethodsPositionTypeCounts = (navMethods?: INAVMethod[], navUpdate?: INAVUpdate): IPositionTypeCount[] => {
  /**
   * Counts occurrences of each position type in the provided NAV methods.
   * Example response:
   * [
   *   { type: PositionType.Liquid, count: 2 },
   *   { type: PositionType.Composable, count: 0 },
   *   { type: PositionType.NFT, count: 1 },
   *   { type: PositionType.Illiquid, count: 0 }
   * ]
   */
  const counts =  PositionTypeKeys.reduce((acc, positionType) => {
    acc[positionType] = 0n;
    return acc;
  }, {} as Record<PositionType, bigint>);


  if (navMethods) {
    for (const navMethod of navMethods) {
      if(navMethod.positionType === PositionType.Composable) {

        if(navMethod.details.composable[0].functionSignatures.includes("illiquidCalc")) {
          counts[PositionType.Illiquid] += navMethod.pastNavValue || 0n;
        } else if (navMethod.details.composable[0].functionSignatures.includes("liquidCalc")) {
          counts[PositionType.Liquid] += navMethod.pastNavValue || 0n;
        } else {
          counts[navMethod.positionType] += navMethod.pastNavValue || 0n;
        }
      } else {
          counts[navMethod.positionType] += navMethod.pastNavValue || 0n;
      }
    }
  }

  return PositionTypeKeys.map(positionType => {
    /*if (navUpdate && navUpdate.navParts) {
      //factor in base asset of oiv
      counts[PositionType.Liquid] += (
        (navUpdate.navParts.baseAssetOIVBal || 0n) + 
        (navUpdate.navParts.feeBal || 0n) + 
        (navUpdate.navParts.baseAssetSafeBal || 0n)
      );
    }
    */


    return {
      type: PositionTypesMap[positionType],
      count: counts[positionType],
    }
  })
}
