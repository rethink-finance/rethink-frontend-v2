import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SharedModule } from "../shared/shared.module";
import { NavController } from "./nav.controller";
import { NavService } from "./nav.service";
import { NavUpdate } from "./entities/nav-update.entity";
import { NavMethod } from "./entities/nav-method.entity";
import { NavMethodValue } from "./entities/nav-method-value.entity";
import { TotalNavSnapshot } from "./entities/total-nav-snapshot.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([NavUpdate, NavMethod, NavMethodValue, TotalNavSnapshot]),
    SharedModule,
  ],
  controllers: [NavController],
  providers: [NavService],
  exports: [NavService],
})
export class NavModule {}
