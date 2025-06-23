import { IsString, IsNumber, IsOptional, IsDate } from "class-validator";
import { ChainId } from "../../types/enums/chain_id";

export class CreateNavMethodValueDto {
  @IsString()
    fundAddress: string;

  @IsString()
    fundChainId: ChainId;

  @IsNumber()
    navUpdateId: number;

  @IsNumber()
    navUpdateIndex: number;

  @IsNumber()
    navMethodId: number;

  @IsString()
  @IsOptional()
    detailsHash?: string;

  @IsString()
    simulatedNav: string;

  @IsString()
    simulatedNavFormatted: string;

  @IsDate()
  @IsOptional()
    calculatedAt?: Date;
}

export class GetNavMethodValueDto {
  @IsNumber()
  @IsOptional()
    id?: number;

  @IsString()
  @IsOptional()
    fundAddress?: string;

  @IsString()
  @IsOptional()
    fundChainId?: ChainId;

  @IsNumber()
  @IsOptional()
    navUpdateId?: number;

  @IsNumber()
  @IsOptional()
    navMethodId?: number;

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

export class NavMethodValueResponseDto {
  id: number;
  fundAddress: string;
  fundChainId: string;
  navUpdateId: number;
  navUpdateIndex: number;
  navMethodId: number;
  detailsHash?: string;
  simulatedNav: string;
  simulatedNavFormatted: string;
  calculatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
