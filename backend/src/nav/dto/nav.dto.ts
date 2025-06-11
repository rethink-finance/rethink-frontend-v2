import { IsString, IsNumber, IsObject, IsOptional, IsBoolean } from "class-validator";
import { ChainId } from "../../types/enums/chain_id";

export class CalculateNavDto {
  @IsString()
    fundChainId: ChainId;

  @IsString()
    fundAddress: string;

  @IsString()
    safeAddress: string;

  @IsNumber()
    baseDecimals: number;

  @IsString()
    baseSymbol: string;

  @IsObject()
    navEntry: any; // Using any for now, will be typed as INAVMethod

  @IsBoolean()
  @IsOptional()
    isFundNonInit?: boolean;
}

export class GetNavValuesDto {
  @IsString()
    fundAddress: string;

  @IsString()
  @IsOptional()
    fundChainId?: string;

  @IsString()
  @IsOptional()
    detailsHash?: string;

  @IsString()
  @IsOptional()
    fromDate?: string;

  @IsString()
  @IsOptional()
    toDate?: string;
}

export class NavValueResponseDto {
  id: string;
  fundAddress: string;
  fundChainId: string;
  safeAddress: string;
  simulatedNav: string;
  simulatedNavFormatted: string;
  baseDecimals: number;
  baseSymbol: string;
  detailsHash?: string;
  calculatedAt: Date;
}
