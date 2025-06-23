import { IsString, IsNumber, IsOptional, IsObject } from "class-validator";
import { ChainId } from "../../types/enums/chain_id";

export class CreateNavMethodDto {
  @IsString()
    fundAddress: string;

  @IsString()
    fundChainId: ChainId;

  @IsNumber()
    navUpdateIndex: number;

  @IsNumber()
    navUpdateId: number;

  @IsObject()
    methodDetails: Record<string, any>;

  @IsString()
  @IsOptional()
    detailsHash?: string;
}

export class GetNavMethodDto {
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
    detailsHash?: string;

  @IsString()
  @IsOptional()
    fromDate?: string;

  @IsString()
  @IsOptional()
    toDate?: string;
}

export class NavMethodResponseDto {
  id: number;
  fundAddress: string;
  fundChainId: string;
  navUpdateIndex: number;
  navUpdateId: number;
  methodDetails: Record<string, any>;
  detailsHash?: string;
  createdAt: Date;
  updatedAt: Date;
}
