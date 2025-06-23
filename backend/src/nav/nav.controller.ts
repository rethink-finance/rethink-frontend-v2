import { Controller, Get, Query, Param, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { NavService } from "./nav.service";
import { GetNavValuesDto, NavValueResponseDto } from "./dto/nav.dto";
import { ChainId } from "../types/enums/chain_id";

@Controller("nav")
export class NavController {
  private readonly logger = new Logger(NavController.name);

  constructor(private readonly navService: NavService) {}

  @Get("values")
  async getNavValues(@Query() getNavValuesDto: GetNavValuesDto): Promise<NavValueResponseDto[]> {
    try {
      this.logger.log(`Retrieving NAV values for fund ${getNavValuesDto.fundAddress}`);
      return await this.navService.getNavValues(getNavValuesDto);
    } catch (error) {
      this.logger.error(`Error retrieving NAV values: ${error.message}`, error.stack);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `Failed to retrieve NAV values: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("values/:id")
  async getNavValueById(@Param("id") id: string): Promise<NavValueResponseDto> {
    try {
      this.logger.log(`Retrieving NAV value with ID ${id}`);
      const navValues = await this.navService.getNavValues({ fundAddress: "", detailsHash: id });
      if (navValues.length === 0) {
        throw new HttpException(
          {
            status: HttpStatus.NOT_FOUND,
            error: `NAV value with ID ${id} not found`,
          },
          HttpStatus.NOT_FOUND,
        );
      }
      return navValues[0];
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error retrieving NAV value by ID: ${error.message}`, error.stack);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `Failed to retrieve NAV value: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("latest/:fundAddress")
  async getLatestNavValue(@Param("fundAddress") fundAddress: string): Promise<NavValueResponseDto> {
    try {
      this.logger.log(`Retrieving latest NAV value for fund ${fundAddress}`);
      const navValues = await this.navService.getNavValues({ fundAddress });
      if (navValues.length === 0) {
        throw new HttpException(
          {
            status: HttpStatus.NOT_FOUND,
            error: `No NAV values found for fund ${fundAddress}`,
          },
          HttpStatus.NOT_FOUND,
        );
      }
      return navValues[0]; // The first one is the latest due to DESC ordering
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error retrieving latest NAV value: ${error.message}`, error.stack);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `Failed to retrieve latest NAV value: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("latest-total/:fundAddress")
  async getLatestNavUpdateTotalValue(
    @Param("fundAddress") fundAddress: string,
    @Query("fundChainId") fundChainId: ChainId
  ): Promise<{ totalValue: string, formattedValue: string, baseSymbol: string }> {
    try {
      this.logger.log(`Retrieving latest NAV update total value for fund ${fundAddress}`);
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
