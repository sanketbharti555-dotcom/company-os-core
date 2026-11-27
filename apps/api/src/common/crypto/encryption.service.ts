import { Injectable } from '@nestjs/common';
import crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const hex =
      process.env.ENCRYPTION_KEY_HEX ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    this.key = Buffer.from(hex.slice(0, 64), 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, tagHex, dataHex] = ciphertext.split(':');
    if (!ivHex || !tagHex || !dataHex) {
      throw new Error('Malformed encrypted payload');
    }
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  generateScopedToken(prefix = 'cos_mod_'): { raw: string; hash: string; prefix: string } {
    const raw = `${prefix}${crypto.randomBytes(32).toString('hex')}`;
    return {
      raw,
      hash: this.sha256(raw),
      prefix: raw.slice(0, 14),
    };
  }
}
