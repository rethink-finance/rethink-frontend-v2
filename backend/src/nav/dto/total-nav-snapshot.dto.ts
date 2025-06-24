import { IsString, IsNumber, IsOptional } from "class-validator";
import { Exclude, Type } from "class-transformer";
import { ChainId } from "../../types/enums/chain_id";
import { NavMethodValueResponseDto } from "./nav-method-value.dto";
import { NavUpdateResponseDto } from "./nav-update.dto";

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
}

export class TotalNavSnapshotResponseDto {
  @Exclude()
    id: number;

  fundAddress: string;
  fundChainId: string;

  @Exclude()
    navUpdateId: number;

  navUpdateIndex: number;
  totalSimulatedNav: string;
  totalSimulatedNavFormatted: string;

  @Type(() => NavUpdateResponseDto)
    navUpdate?: NavUpdateResponseDto;

  @Type(() => NavMethodValueResponseDto)
    navMethodValues?: NavMethodValueResponseDto[];

  calculatedAt: Date;

  @Exclude()
    createdAt: Date;
}
