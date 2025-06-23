import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { TimestampLogger } from "./shared/logger.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use custom logger with timestamps
  const logger = new TimestampLogger();
  app.useLogger(logger);

  // Enable CORS for frontend integration
  app.enableCors();

  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Get port from config or use default
  const configService = app.get(ConfigService);
  const port = configService.get("PORT", 8000);

  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
