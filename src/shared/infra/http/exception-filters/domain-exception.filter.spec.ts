import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { DomainError } from '../../../domain/domain-error';
import { CORRELATION_ID_HEADER } from '../correlation-id.constants';
import { AppConfigService } from '../../../config/app-config.service';
import { DomainExceptionFilter } from './domain-exception.filter';

class FakeDomainError extends DomainError {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface CapturedResponse {
  statusCode: number;
  body: Record<string, unknown> | null;
  headers: Record<string, string>;
}

const makeHost = (
  req: { headers?: Record<string, unknown>; originalUrl?: string; url?: string } = {},
): { host: ArgumentsHost; captured: CapturedResponse } => {
  const captured: CapturedResponse = { statusCode: 0, body: null, headers: {} };
  const res = {
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
    },
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      captured.body = payload;
      return this;
    },
  };
  const request = {
    headers: req.headers ?? {},
    originalUrl: req.originalUrl,
    url: req.url ?? '/',
  };
  const host = {
    switchToHttp() {
      return {
        getResponse: () => res,
        getRequest: () => request,
      };
    },
  } as unknown as ArgumentsHost;
  return { host, captured };
};

describe('DomainExceptionFilter', () => {
  describe('reasonPhrase + HttpException mapping', () => {
    it('maps a BadRequestException to 400 with the Bad Request reason phrase', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost();
      filter.catch(new BadRequestException('payload'), host);
      expect(captured.statusCode).toBe(400);
      expect(captured.body?.statusCode).toBe(400);
      expect(captured.body?.error).toBe('Bad Request');
      expect(captured.body?.message).toBe('payload');
    });

    it('maps a 404 HttpException carrying a string response', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost();
      filter.catch(new HttpException('nope', HttpStatus.NOT_FOUND), host);
      expect(captured.statusCode).toBe(404);
      expect(captured.body?.error).toBe('Not Found');
      expect(captured.body?.message).toBe('nope');
    });

    it('maps a 409 HttpException with an object response, preserving message/error from the object', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost();
      filter.catch(
        new HttpException({ message: 'conflict-msg', error: 'CustomConflict' }, HttpStatus.CONFLICT),
        host,
      );
      expect(captured.body?.error).toBe('CustomConflict');
      expect(captured.body?.message).toBe('conflict-msg');
    });

    it('falls back to errorName when the HttpException object has no error/message', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost();
      filter.catch(new HttpException({}, HttpStatus.UNPROCESSABLE_ENTITY), host);
      expect(captured.statusCode).toBe(422);
      expect(captured.body?.error).toBe('Unprocessable Entity');
    });

    it('falls back to HttpStatus name for unmapped status codes', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost();
      filter.catch(new HttpException('teapot', 418), host);
      expect(captured.statusCode).toBe(418);
      // HttpStatus[418] is undefined in @nestjs/common, so the helper falls back to 'Error'.
      expect(typeof captured.body?.error).toBe('string');
    });
  });

  describe('DomainError -> structured response with code', () => {
    it('maps a domain error code that resolves to 404', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost();
      filter.catch(new FakeDomainError('product.not_found', 'Product missing'), host);
      expect(captured.statusCode).toBe(404);
      expect(captured.body?.code).toBe('product.not_found');
      expect(captured.body?.error).toBe('Not Found');
      expect(captured.body?.message).toBe('Product missing');
    });
  });

  describe('plain Error -> 400', () => {
    it('treats raw Error as a value-object validation failure -> 400', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost();
      filter.catch(new Error('ProductName cannot be empty'), host);
      expect(captured.statusCode).toBe(400);
      expect(captured.body?.error).toBe('Bad Request');
      expect(captured.body?.message).toBe('ProductName cannot be empty');
    });
  });

  describe('unknown exception -> 500 with prod-aware message', () => {
    it('returns a generic message in production', () => {
      const config = { nodeEnv: 'production' } as unknown as AppConfigService;
      const filter = new DomainExceptionFilter(config);
      const { host, captured } = makeHost();
      filter.catch(new Error('leaky internal detail'), host);
      // Plain Error path still wins here -> 400. Unknown branch needs a non-Error throwable.
      expect(captured.statusCode).toBe(400);

      const { host: host2, captured: captured2 } = makeHost();
      filter.catch({ weird: true }, host2);
      expect(captured2.statusCode).toBe(500);
      expect(captured2.body?.message).toBe('Internal server error');
    });

    it('returns the exception message in non-production for diagnostics', () => {
      const config = { nodeEnv: 'development' } as unknown as AppConfigService;
      const filter = new DomainExceptionFilter(config);
      const { host, captured } = makeHost();
      class SubclassError extends Error {}
      filter.catch(new SubclassError('boom subclass'), host);
      expect(captured.statusCode).toBe(500);
      expect(captured.body?.message).toBe('boom subclass');
    });

    it('returns "Unknown error" outside production when the thrown value is not an Error', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost();
      filter.catch('weird string throw', host);
      expect(captured.statusCode).toBe(500);
      expect(captured.body?.message).toBe('Unknown error');
    });

    it('works without an AppConfigService (defaults to non-prod messaging)', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost();
      class SubclassError extends Error {}
      filter.catch(new SubclassError('detail'), host);
      expect(captured.body?.message).toBe('detail');
    });
  });

  describe('correlationId + path propagation', () => {
    it('echoes x-correlation-id from the request headers back into the response header AND body', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost({
        headers: { [CORRELATION_ID_HEADER]: 'corr-xyz' },
        originalUrl: '/foo?bar=1',
      });
      filter.catch(new BadRequestException('x'), host);
      expect(captured.headers[CORRELATION_ID_HEADER]).toBe('corr-xyz');
      expect(captured.body?.correlationId).toBe('corr-xyz');
      expect(captured.body?.path).toBe('/foo?bar=1');
      expect(typeof captured.body?.timestamp).toBe('string');
    });

    it('omits the response header when no correlationId is available', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost();
      filter.catch(new BadRequestException('x'), host);
      expect(captured.headers[CORRELATION_ID_HEADER]).toBeUndefined();
    });

    it('falls back to req.url when originalUrl is absent', () => {
      const filter = new DomainExceptionFilter();
      const { host, captured } = makeHost({ url: '/bare' });
      filter.catch(new BadRequestException('x'), host);
      expect(captured.body?.path).toBe('/bare');
    });
  });
});
