import { IsString, IsNumber, IsOptional } from "class-validator";
import { Exclude } from "class-transformer";
import { ChainId } from "../../types/enums/chain_id";

export class CreateNavUpdateDto {
  @IsString()
    fundAddress: string;

  @IsString()
    fundChainId: ChainId;

  @IsNumber()
    navUpdateIndex: number;

  @IsString()
    safeAddress: string;

  @IsNumber()
    baseDecimals: number;

  @IsString()
    baseSymbol: string;
}

export class GetNavUpdateDto {
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
    navUpdateIndex?: number;
}

export class NavUpdateResponseDto {
  @Exclude()
    id: number;

  @Exclude()
    fundAddress: string;

  @Exclude()
    fundChainId: string;

  navUpdateIndex: number;
  safeAddress: string;
  baseDecimals: number;
  baseSymbol: string;

  @Exclude()
    createdAt: Date;

  @Exclude()
    updatedAt: Date;
}
