import { Controller, Get, Query, Param, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ChainId } from "../types/enums/chain_id";
import { NavService } from "./nav.service";
import { TotalNavSnapshotResponseDto } from "./dto/total-nav-snapshot.dto";

@Controller("nav")
export class NavController {
  private readonly logger = new Logger(NavController.name);

  constructor(private readonly navService: NavService) {}
  // TODO dont rely on latest nav update index from our db, but always fetch latest nav update index

  @Get("latest-total/:fundAddress")
  async getLatestNavUpdateTotalValue(
    @Param("fundAddress") fundAddress: string,
    @Query("fundChainId") fundChainId: ChainId,
  ): Promise<{ totalValue: string, formattedValue: string, baseSymbol: string, baseDecimals: number }> {
    try {
      this.logger.log(`Retrieving latest NAV update total value for fund ${fundChainId} ${fundAddress}`);
      return await this.navService.getLatestNavUpdateTotalValue(fundAddress, fundChainId);
    } catch (error) {
      this.logger.error(`Error retrieving latest NAV update total value: ${error.message}`, error.stack);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `Failed to retrieve latest NAV update total value: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("latest-snapshot/:fundAddress")
  async getLatestNavUpdateSnapshot(
    @Param("fundAddress") fundAddress: string,
    @Query("fundChainId") fundChainId: ChainId,
  ): Promise<TotalNavSnapshotResponseDto> {
    try {
      this.logger.log(`Retrieving latest NAV update snapshot for fund ${fundChainId} ${fundAddress}`);
      return await this.navService.getLatestNavUpdateSnapshot(fundAddress, fundChainId);
    } catch (error) {
      this.logger.error(`Error retrieving latest NAV update snapshot: ${error.message}`, error.stack);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `Failed to retrieve latest NAV update snapshot: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
