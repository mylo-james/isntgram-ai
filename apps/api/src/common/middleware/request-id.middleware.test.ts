import {
  RequestIdMiddleware,
  normalizeRequestIdForLog,
} from './request-id.middleware';

describe('RequestIdMiddleware logging normalization', () => {
  it('preserves a valid UUID for logging', () => {
    const requestId = '6d6a4c21-5b6e-4e50-9d86-0d66d2b9f0cc';
    expect(normalizeRequestIdForLog(requestId)).toBe(requestId);
  });

  it('bounds an unsafe ID for logs while preserving the response/header value', () => {
    const rawRequestId = `unsafe?token=${'x'.repeat(400)}`;
    const middleware = new RequestIdMiddleware();
    const request = { headers: { 'x-request-id': rawRequestId } } as any;
    const response = { setHeader: jest.fn() } as any;

    middleware.use(request, response, jest.fn());

    expect(request.requestId).toBe(rawRequestId);
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      rawRequestId,
    );
    const normalized = normalizeRequestIdForLog(rawRequestId);
    expect(normalized).toMatch(/^invalid:/);
    expect(normalized.length).toBeLessThanOrEqual(180);
    expect(normalized).not.toContain(rawRequestId);
    expect(normalized).not.toContain('token=');
  });
});
