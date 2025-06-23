import { Controller, Get, Query, Param, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ChainId } from "../types/enums/chain_id";
import { NavService } from "./nav.service";

@Controller("nav")
export class NavController {
  private readonly logger = new Logger(NavController.name);

  constructor(private readonly navService: NavService) {}

  @Get("latest-total/:fundAddress")
  async getLatestNavUpdateTotalValue(
    @Param("fundAddress") fundAddress: string,
    @Query("fundChainId") fundChainId: ChainId,
  ): Promise<{ totalValue: string, formattedValue: string, baseSymbol: string }> {
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
}
