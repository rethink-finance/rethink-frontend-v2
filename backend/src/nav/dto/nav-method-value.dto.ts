import { IsString, IsNumber, IsOptional, IsDate } from "class-validator";
import { Exclude } from "class-transformer";
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

  @IsNumber()
    totalNavSnapshotId: number;

  @IsString()
    detailsHash: string;

  @IsString()
    simulatedNav: string;

  @IsString()
    simulatedNavFormatted: string;

  @IsDate()
    calculatedAt: Date;
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
    fundChainId: ChainId;

  @IsNumber()
  @IsOptional()
    navUpdateId: number;

  @IsNumber()
  @IsOptional()
    navMethodId: number;

  @IsNumber()
  @IsOptional()
    totalNavSnapshotId: number;

  @IsString()
  @IsOptional()
    detailsHash: string;
}

export class NavMethodValueResponseDto {
  @Exclude()
    id: number;

  @Exclude()
    fundAddress: string;

  @Exclude()
    fundChainId: string;

  @Exclude()
    navUpdateId: number;

  @Exclude()
    navUpdateIndex: number;

  @Exclude()
    navMethodId: number;

  @Exclude()
    totalNavSnapshotId: number;

  detailsHash: string;
  simulatedNav: string;
  simulatedNavFormatted: string;
  calculatedAt: Date;
  createdAt: Date;
  @Exclude()
    updatedAt: Date;
}
