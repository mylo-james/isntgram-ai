import { createHmac, timingSafeEqual } from 'crypto';
import { isIP } from 'node:net';

const ADDRESS_HEADER = 'x-isntgram-client-address';
const TIMESTAMP_HEADER = 'x-isntgram-client-timestamp';
const SIGNATURE_HEADER = 'x-isntgram-client-signature';
const MAX_AGE_MS = 60_000;

type RequestLike = {
  method?: string;
  path?: string;
  ip?: unknown;
  headers?: Record<string, unknown>;
};

function first(value: unknown): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : typeof value === 'string'
      ? value
      : undefined;
}

function canonical(
  method: string,
  path: string,
  address: string,
  timestamp: string,
) {
  return `${timestamp}\n${method.toUpperCase()}\n${path}\n${address}`;
}

function validAddress(value: string): boolean {
  return isIP(value.replace(/^\[|\]$/g, '')) !== 0;
}

export function resolveAdmissionAddress(
  request: RequestLike,
  secret: string | undefined,
): string {
  const address = first(request.headers?.[ADDRESS_HEADER]);
  const timestamp = first(request.headers?.[TIMESTAMP_HEADER]);
  const signature = first(request.headers?.[SIGNATURE_HEADER]);
  const issuedAt = timestamp ? Number(timestamp) : Number.NaN;
  const now = Date.now();
  if (
    secret &&
    secret.length >= 32 &&
    address &&
    timestamp &&
    signature &&
    validAddress(address) &&
    Number.isSafeInteger(issuedAt) &&
    Math.abs(now - issuedAt) <= MAX_AGE_MS
  ) {
    const expected = createHmac('sha256', secret)
      .update(
        canonical(
          request.method ?? 'GET',
          request.path ?? '/',
          address,
          timestamp,
        ),
      )
      .digest('hex');
    const actual = Buffer.from(signature, 'hex');
    const expectedBytes = Buffer.from(expected, 'hex');
    if (
      actual.length === expectedBytes.length &&
      timingSafeEqual(actual, expectedBytes)
    )
      return address;
  }
  return typeof request.ip === 'string' && request.ip ? request.ip : 'unknown';
}
