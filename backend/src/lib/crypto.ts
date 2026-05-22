import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_ENV = 'ENCRYPTION_KEY';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(
      `${KEY_ENV} ist nicht gesetzt. Generiere einen mit: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }

  let key: Buffer;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length >= 43) {
    key = Buffer.from(raw, 'base64');
  } else {
    throw new Error(`${KEY_ENV} muss 32 Bytes sein (hex: 64 Zeichen, base64: 44 Zeichen)`);
  }

  if (key.length !== 32) {
    throw new Error(`${KEY_ENV} muss genau 32 Bytes (256 Bit) lang sein, ist aber ${key.length} Bytes`);
  }

  cachedKey = key;
  return key;
}

export function assertEncryptionKey(): void {
  getKey();
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Verschlüsselter Wert ist zu kurz');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
