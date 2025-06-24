import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { ConfigModule } from "@nestjs/config";
import { NavModule } from "./nav/nav.module";
import { SharedModule } from "./shared/shared.module";
import { ormConfig } from "./orm-config";

// TODO there is a duplicate DB config in data-source.ts also, refactor
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(ormConfig),
    ScheduleModule.forRoot(),
    SharedModule,
    NavModule,
  ],
})
export class AppModule {}
