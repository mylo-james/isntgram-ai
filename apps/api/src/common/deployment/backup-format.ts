import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { LifecycleRule } from '@aws-sdk/client-s3';

const MAGIC = Buffer.from('ISNTBK02');
export const BACKUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Authenticate the payload and its exact object location, including manifest. */
export function encryptBackup(
  bytes: Buffer,
  key: Buffer,
  objectKey: string,
): Buffer {
  if (key.length !== 32) throw new Error('Backup key must contain 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`isntgram-backup-v2:${objectKey}`));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptBackup(
  bytes: Buffer,
  key: Buffer,
  objectKey: string,
): Buffer {
  if (
    key.length !== 32 ||
    bytes.length < 36 ||
    !bytes.subarray(0, 8).equals(MAGIC)
  )
    throw new Error('Unsupported or incomplete encrypted backup payload');
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(8, 20));
  decipher.setAAD(Buffer.from(`isntgram-backup-v2:${objectKey}`));
  decipher.setAuthTag(bytes.subarray(20, 36));
  return Buffer.concat([decipher.update(bytes.subarray(36)), decipher.final()]);
}

/** Native object age expiry covers complete, pre-migration and partial copies. */
export function assertBackupRetention(
  rules: LifecycleRule[] | undefined,
): void {
  const expiry = rules?.some(
    (rule) =>
      rule.Status === 'Enabled' &&
      rule.Expiration?.Days === 7 &&
      rule.Filter?.Prefix === 'snapshots/' &&
      !rule.Filter.And &&
      !rule.Filter.Tag &&
      rule.Filter.ObjectSizeGreaterThan === undefined &&
      rule.Filter.ObjectSizeLessThan === undefined,
  );
  if (!expiry)
    throw new Error(
      'Backup bucket requires verified seven-day snapshots/ lifecycle expiry',
    );
}

export function assertSnapshotFresh(createdAt: string, now = Date.now()): void {
  const created = Date.parse(createdAt);
  if (
    !Number.isFinite(created) ||
    created > now + 60_000 ||
    now - created >= BACKUP_MAX_AGE_MS
  )
    throw new Error('Snapshot is expired or has an invalid creation time');
}
