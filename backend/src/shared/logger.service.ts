import { ConsoleLogger, Injectable, LoggerService, Scope } from "@nestjs/common";

@Injectable({ scope: Scope.TRANSIENT })
export class TimestampLogger extends ConsoleLogger implements LoggerService {
  log(message: any, ...optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    super.log(`[${timestamp}] ${message}`, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    super.error(`[${timestamp}] ${message}`, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    super.warn(`[${timestamp}] ${message}`, ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    super.debug(`[${timestamp}] ${message}`, ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    super.verbose(`[${timestamp}] ${message}`, ...optionalParams);
  }
}
