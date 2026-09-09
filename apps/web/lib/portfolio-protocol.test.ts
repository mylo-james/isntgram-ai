import { acceptsPortfolioParent, isPortfolioReadyRequest, PORTFOLIO_PROJECT, PORTFOLIO_PROTOCOL_VERSION, PORTFOLIO_READY_REQUEST } from './portfolio-protocol';

describe('portfolio readiness protocol', () => {
  const request = { type: PORTFOLIO_READY_REQUEST, version: PORTFOLIO_PROTOCOL_VERSION, project: PORTFOLIO_PROJECT };

  it('accepts only the minimal versioned ready request', () => {
    expect(isPortfolioReadyRequest(request)).toBe(true);
    expect(isPortfolioReadyRequest({ ...request, inspect: true })).toBe(false);
    expect(isPortfolioReadyRequest({ ...request, project: 'other' })).toBe(false);
    expect(isPortfolioReadyRequest({ ...request, version: 2 })).toBe(false);
    expect(isPortfolioReadyRequest({ ...request, type: 'portfolio:tour' })).toBe(false);
  });

  it('requires the configured parent origin and its current frame window', () => {
    const parent = {} as Window;
    const origin = 'https://preview.mjames.dev';
    expect(acceptsPortfolioParent({ origin, source: parent }, origin, parent)).toBe(true);
    expect(acceptsPortfolioParent({ origin: 'https://evil.example', source: parent }, origin, parent)).toBe(false);
    expect(acceptsPortfolioParent({ origin, source: {} as Window }, origin, parent)).toBe(false);
  });
});
