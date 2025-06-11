import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SharedModule } from "../shared/shared.module";
import { NavController } from "./nav.controller";
import { NavService } from "./nav.service";
import { NavValue } from "./nav.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([NavValue]),
    SharedModule,
  ],
  controllers: [NavController],
  providers: [NavService],
  exports: [NavService],
})
export class NavModule {}
