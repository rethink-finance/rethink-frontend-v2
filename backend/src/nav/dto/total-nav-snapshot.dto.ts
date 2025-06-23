import { IsString, IsNumber, IsOptional, IsDate } from "class-validator";
import { ChainId } from "../../types/enums/chain_id";

export class CreateTotalNavSnapshotDto {
  @IsString()
    fundAddress: string;

  @IsString()
    fundChainId: ChainId;

  @IsNumber()
    navUpdateId: number;

  @IsNumber()
    navUpdateIndex: number;

  @IsString()
    totalSimulatedNav: string;

  @IsString()
    totalSimulatedNavFormatted: string;

  @IsDate()
  @IsOptional()
    calculatedAt?: Date;
}

export class GetTotalNavSnapshotDto {
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

  @IsString()
  @IsOptional()
    fromDate?: string;

  @IsString()
  @IsOptional()
    toDate?: string;
}

export class TotalNavSnapshotResponseDto {
  id: number;
  fundAddress: string;
  fundChainId: string;
  navUpdateId: number;
  navUpdateIndex: number;
  totalSimulatedNav: string;
  totalSimulatedNavFormatted: string;
  calculatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
