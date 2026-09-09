import {
  encryptBackup,
  decryptBackup,
  assertBackupRetention,
  assertSnapshotFresh,
  BACKUP_MAX_AGE_MS,
} from './backup-format';

const key = Buffer.alloc(32, 7);
const objectKey = 'snapshots/preview/fixture/manifest.enc';
const rule = {
  Status: 'Enabled' as const,
  Filter: { Prefix: 'snapshots/' },
  Expiration: { Days: 7 },
};

describe('authenticated backup format', () => {
  it('round trips payloads and randomizes ciphertext without revealing plaintext', () => {
    const plain = Buffer.from(
      'Synthetic manifest with private visitor photo metadata',
    );
    const first = encryptBackup(plain, key, objectKey);
    expect(first.includes(plain)).toBe(false);
    expect(encryptBackup(plain, key, objectKey)).not.toEqual(first);
    expect(decryptBackup(first, key, objectKey)).toEqual(plain);
  });
  it('rejects changed key, path, ciphertext, format and invalid key lengths', () => {
    const original = encryptBackup(
      Buffer.from('visitor fixture'),
      key,
      objectKey,
    );
    expect(() =>
      decryptBackup(original, Buffer.alloc(32, 8), objectKey),
    ).toThrow();
    expect(() => decryptBackup(original, key, objectKey + '.other')).toThrow();
    const corrupt = Buffer.from(original);
    corrupt[corrupt.length - 1] ^= 1;
    expect(() => decryptBackup(corrupt, key, objectKey)).toThrow();
    expect(() =>
      decryptBackup(Buffer.from('plaintext'), key, objectKey),
    ).toThrow();
    expect(() =>
      decryptBackup(original, Buffer.alloc(16), objectKey),
    ).toThrow();
    expect(() =>
      encryptBackup(Buffer.from('x'), Buffer.alloc(16), objectKey),
    ).toThrow();
  });
  it('requires an enabled seven-day expiry for every snapshot object including partial copies', () => {
    expect(() => assertBackupRetention([rule])).not.toThrow();
    for (const rules of [
      undefined,
      [],
      [{ ...rule, Status: 'Disabled' as const }],
      [{ ...rule, Expiration: { Days: 8 } }],
      [{ ...rule, Filter: { Prefix: 'snapshots/preview/complete/' } }],
      [
        {
          ...rule,
          Filter: {
            Prefix: 'snapshots/',
            Tag: { Key: 'complete', Value: 'true' },
          },
        },
      ],
    ]) {
      expect(() => assertBackupRetention(rules)).toThrow();
    }
  });
  it('rejects expired and invalid snapshots before a restore can write', () => {
    const now = Date.parse('2026-09-09T00:00:00Z');
    expect(() =>
      assertSnapshotFresh(
        new Date(now - BACKUP_MAX_AGE_MS + 1).toISOString(),
        now,
      ),
    ).not.toThrow();
    expect(() =>
      assertSnapshotFresh(new Date(now - BACKUP_MAX_AGE_MS).toISOString(), now),
    ).toThrow();
    expect(() => assertSnapshotFresh('invalid', now)).toThrow();
    expect(() =>
      assertSnapshotFresh(new Date(now + 60_001).toISOString(), now),
    ).toThrow();
  });
});
