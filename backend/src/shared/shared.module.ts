import { Module } from "@nestjs/common";
import { TimestampLogger } from "./logger.service";

@Module({
  providers: [TimestampLogger],
  exports: [TimestampLogger],
})
export class SharedModule {}
