import type INAVMethod from "~/types/nav_method";
import type IPositionTypeCount from "~/types/position_type";
import { PositionType, PositionTypeKeys, PositionTypesMap } from "~/types/enums/position_type";


export const parseNavMethodsPositionTypeCounts = (navMethods?: INAVMethod[]): IPositionTypeCount[] => {
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
    acc[positionType] = 0;
    return acc;
  }, {} as Record<PositionType, number>);

  if (navMethods) {
    for (const navMethod of navMethods) {
      if(navMethod.positionType === PositionType.Composable) {

        if(navMethod.details.composable[0].functionSignatures.includes("illiquidCalc")) {
          counts[PositionType.Illiquid] += 1;
        } else if (navMethod.details.composable[0].functionSignatures.includes("liquidCalc")) {
          counts[PositionType.Liquid] += 1;
        } else {
          counts[navMethod.positionType] += 1;
        }
      } else {
          counts[navMethod.positionType] += 1;
      }
    }
  }

  return PositionTypeKeys.map(positionType => {
    return {
      type: PositionTypesMap[positionType],
      count: counts[positionType],
    }
  })
}
