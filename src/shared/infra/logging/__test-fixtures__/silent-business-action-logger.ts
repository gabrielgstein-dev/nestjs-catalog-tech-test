import { PinoLogger } from 'nestjs-pino';
import { BusinessActionLogger } from '../business-action.logger';

const silentPino = {
  setContext: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
  trace: () => undefined,
  fatal: () => undefined,
} as unknown as PinoLogger;

export const silentBusinessActionLogger = (): BusinessActionLogger =>
  new BusinessActionLogger(silentPino);
