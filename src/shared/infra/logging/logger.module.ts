import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { CorrelationContext } from '../../application/correlation-context';
import { CORRELATION_ID_HEADER, CORRELATION_ID_KEY } from '../http/correlation-id.constants';
import { BusinessActionLogger } from './business-action.logger';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.apiKey',
];

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: () => {
        const env = process.env.NODE_ENV ?? 'development';
        const usePretty = env === 'development';
        return {
          pinoHttp: {
            level: process.env.LOG_LEVEL ?? 'info',
            genReqId: (req: IncomingMessage) => {
              const headerVal = req.headers[CORRELATION_ID_HEADER];
              const incoming = Array.isArray(headerVal) ? headerVal[0] : headerVal;
              const correlationId = incoming ?? randomUUID();
              (req as IncomingMessage & { [k: string]: unknown })[CORRELATION_ID_KEY] =
                correlationId;
              return correlationId;
            },
            customProps: (req) => ({
              [CORRELATION_ID_KEY]:
                (req as IncomingMessage & { id?: string }).id ?? CorrelationContext.get() ?? null,
            }),
            customLogLevel: (_req, res, err) => {
              if (err || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            transport: usePretty
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
            redact: {
              paths: REDACT_PATHS,
              remove: true,
            },
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res) => ({ statusCode: res.statusCode }),
            },
          },
        };
      },
    }),
  ],
  providers: [BusinessActionLogger],
  exports: [BusinessActionLogger],
})
export class AppLoggerModule {}
