import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { CORRELATION_ID_HEADER, CORRELATION_ID_KEY } from '../http/correlation-id.constants';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: () => {
        const isProd = process.env.NODE_ENV === 'production';
        return {
          pinoHttp: {
            level: process.env.LOG_LEVEL ?? 'info',
            // Map nestjs-pino's "req.id" to the correlation header.
            genReqId: (req: IncomingMessage) => {
              const headerVal = req.headers[CORRELATION_ID_HEADER];
              const incoming = Array.isArray(headerVal) ? headerVal[0] : headerVal;
              const correlationId = incoming ?? randomUUID();
              // expose for downstream middlewares / response
              (req as IncomingMessage & { [k: string]: unknown })[CORRELATION_ID_KEY] =
                correlationId;
              return correlationId;
            },
            customProps: (req) => ({
              [CORRELATION_ID_KEY]: (req as IncomingMessage & { id?: string }).id,
            }),
            customLogLevel: (_req, res, err) => {
              if (err || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname',
                  },
                },
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie'],
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
})
export class AppLoggerModule {}
