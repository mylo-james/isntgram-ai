export const PORTFOLIO_READY_REQUEST = 'portfolio:ready-request';
export const PORTFOLIO_READY = 'portfolio:ready';
export const PORTFOLIO_PROTOCOL_VERSION = 1;
export const PORTFOLIO_PROJECT = 'isntgram';

export type PortfolioReadyRequest = {
  type: typeof PORTFOLIO_READY_REQUEST;
  version: typeof PORTFOLIO_PROTOCOL_VERSION;
  project: typeof PORTFOLIO_PROJECT;
};

export function isPortfolioReadyRequest(value: unknown): value is PortfolioReadyRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return Object.keys(data).length === 3 && data.type === PORTFOLIO_READY_REQUEST && data.version === PORTFOLIO_PROTOCOL_VERSION && data.project === PORTFOLIO_PROJECT;
}

export function acceptsPortfolioParent(event: Pick<MessageEvent, 'origin' | 'source'>, origin: string, parent: Window): boolean {
  return Boolean(origin) && event.origin === origin && event.source === parent;
}
