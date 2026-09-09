import { fireEvent, render } from '@testing-library/react';
import PortfolioBridge from './PortfolioBridge';

const origin = 'https://preview.mjames.dev';
const parent = { postMessage: jest.fn() };
const originalParent = window.parent;
const originalOrigin = process.env.NEXT_PUBLIC_PORTFOLIO_ORIGIN;

function send(data: unknown, source: unknown = parent, from = origin) {
  fireEvent(window, new MessageEvent('message', { source: source as Window, origin: from, data }));
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, 'parent', { configurable: true, value: parent });
  process.env.NEXT_PUBLIC_PORTFOLIO_ORIGIN = origin;
});

afterEach(() => {
  Object.defineProperty(window, 'parent', { configurable: true, value: originalParent });
  if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_PORTFOLIO_ORIGIN;
  else process.env.NEXT_PUBLIC_PORTFOLIO_ORIGIN = originalOrigin;
});

it('answers one exact parent readiness request with no app state', () => {
  render(<PortfolioBridge />);
  send({ type: 'portfolio:ready-request', version: 1, project: 'isntgram' });
  expect(parent.postMessage).toHaveBeenCalledWith(
    { type: 'portfolio:ready', version: 1, project: 'isntgram' },
    origin,
  );
});

it('rejects a foreign origin, foreign source, malformed request, and command-shaped payload', () => {
  render(<PortfolioBridge />);
  parent.postMessage.mockClear();
  send({ type: 'portfolio:ready-request', version: 1, project: 'isntgram' }, {}, origin);
  send({ type: 'portfolio:ready-request', version: 1, project: 'isntgram' }, parent, 'https://evil.test');
  send({ type: 'portfolio:ready-request', version: 1, project: 'other' });
  send({ type: 'portfolio:ready-request', version: 1, project: 'isntgram', action: 'inspect' });
  send({ type: 'portfolio:tour', version: 1, project: 'isntgram' });
  expect(parent.postMessage).not.toHaveBeenCalled();
});

it('announces readiness after hydration even when the load-time request was missed', () => {
  render(<PortfolioBridge />);
  expect(parent.postMessage).toHaveBeenCalledTimes(1);
  expect(parent.postMessage).toHaveBeenCalledWith({ type: 'portfolio:ready', version: 1, project: 'isntgram' }, origin);
});
