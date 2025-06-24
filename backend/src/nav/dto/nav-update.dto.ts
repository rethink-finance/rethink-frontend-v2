import { IsString, IsNumber, IsOptional } from "class-validator";
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
  id: number;
  fundAddress: string;
  fundChainId: string;
  navUpdateIndex: number;
  safeAddress: string;
  baseDecimals: number;
  baseSymbol: string;
  createdAt: Date;
  updatedAt: Date;
}
