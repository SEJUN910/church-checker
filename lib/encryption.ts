import crypto from 'crypto';

const ALG = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.RRN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error('RRN_ENCRYPTION_KEY must be 64 hex chars');
  return Buffer.from(hex, 'hex');
}

export function encryptRRN(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptRRN(ciphertext: string): string {
  try {
    const key = getKey();
    const [ivHex, tagHex, encHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc).toString('utf8') + decipher.final('utf8');
  } catch {
    return '복호화 오류';
  }
}
