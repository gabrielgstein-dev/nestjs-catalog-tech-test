import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { CORRELATION_ID_HEADER } from './correlation-id.constants';
import type { Request, Response } from 'express';

const buildReq = (overrides: Partial<Request> & { id?: string } = {}): Request =>
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

  it('propagates req.id (set by pino-http genReqId) to the response header', () => {
    const req = buildReq({ id: 'pino-generated-uuid' });
    const { res, setHeader } = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'pino-generated-uuid');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to the inbound x-correlation-id header when req.id is absent', () => {
    const req = buildReq({ headers: { [CORRELATION_ID_HEADER]: 'inbound-corr' } });
    const { res, setHeader } = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'inbound-corr');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('prefers req.id over the inbound header when both are present', () => {
    const req = buildReq({
      id: 'pino-id',
      headers: { [CORRELATION_ID_HEADER]: 'inbound' },
    });
    const { res, setHeader } = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'pino-id');
  });

  it('does not set the header when neither req.id nor inbound header are present', () => {
    const req = buildReq();
    const { res, setHeader } = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('always calls next exactly once', () => {
    const req = buildReq({ id: 'x' });
    const { res } = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
