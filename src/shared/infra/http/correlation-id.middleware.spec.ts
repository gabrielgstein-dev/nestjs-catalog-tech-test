import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { CORRELATION_ID_HEADER, CORRELATION_ID_KEY } from './correlation-id.constants';
import type { Request, Response } from 'express';

const buildReq = (
  overrides: Partial<Request> & { id?: string; [CORRELATION_ID_KEY]?: string } = {},
): Request =>
  ({
    headers: {},
    ...overrides,
  }) as unknown as Request;

const buildRes = () => {
  const setHeader = jest.fn();
  return { res: { setHeader } as unknown as Response, setHeader };
};

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('reuses req.id when already set (e.g. by pino-http genReqId)', () => {
    const req = buildReq({ id: 'pino-generated' });
    const { res, setHeader } = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'pino-generated');
    expect(req.headers[CORRELATION_ID_HEADER]).toBe('pino-generated');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses req.correlationId when set (genReqId in LoggerModule populates it)', () => {
    const req = buildReq({ [CORRELATION_ID_KEY]: 'corr-from-genReqId' });
    const { res, setHeader } = buildRes();

    middleware.use(req, res, jest.fn());

    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'corr-from-genReqId');
  });

  it('falls back to the inbound x-correlation-id header', () => {
    const req = buildReq({ headers: { [CORRELATION_ID_HEADER]: 'inbound-corr' } });
    const { res, setHeader } = buildRes();

    middleware.use(req, res, jest.fn());

    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'inbound-corr');
  });

  it('generates a UUID when nothing upstream provides one', () => {
    const req = buildReq();
    const { res, setHeader } = buildRes();

    middleware.use(req, res, jest.fn());

    expect(setHeader).toHaveBeenCalledTimes(1);
    const [, value] = setHeader.mock.calls[0];
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('populates req.id, req.correlationId and req.headers so downstream consumers all agree', () => {
    const req = buildReq();
    const { res, setHeader } = buildRes();

    middleware.use(req, res, jest.fn());

    const [, emittedValue] = setHeader.mock.calls[0];
    const r = req as Request & { id?: string; [CORRELATION_ID_KEY]?: string };
    expect(r.id).toBe(emittedValue);
    expect(r[CORRELATION_ID_KEY]).toBe(emittedValue);
    expect(req.headers[CORRELATION_ID_HEADER]).toBe(emittedValue);
  });

  it('prefers req.id over req.correlationId and inbound header (precedence)', () => {
    const req = buildReq({
      id: 'from-req-id',
      [CORRELATION_ID_KEY]: 'from-correlationId-prop',
      headers: { [CORRELATION_ID_HEADER]: 'from-inbound-header' },
    });
    const { res, setHeader } = buildRes();

    middleware.use(req, res, jest.fn());

    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'from-req-id');
  });

  it('uses the first value when the inbound header is multi-valued', () => {
    const req = buildReq({ headers: { [CORRELATION_ID_HEADER]: ['first', 'second'] } });
    const { res, setHeader } = buildRes();

    middleware.use(req, res, jest.fn());

    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'first');
  });

  it('always calls next exactly once with no arguments', () => {
    const req = buildReq();
    const { res } = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
