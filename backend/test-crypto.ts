/* Eigenständiger Verifikationstest für src/lib/crypto.ts.
 * Ausführen: cd backend && npx ts-node test-crypto.ts
 */
import assert from 'node:assert/strict';

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  '0000000000000000000000000000000000000000000000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { encrypt, decrypt } = require('./src/lib/crypto') as typeof import('./src/lib/crypto');

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('crypto.ts');

run('encrypt/decrypt roundtrip (ASCII)', () => {
  const plaintext = 'zeit_sso_201501=eyJhbGciOiJIUzI1NiJ9.payload.signature';
  const cipher = encrypt(plaintext);
  assert.notEqual(cipher, plaintext);
  assert.equal(decrypt(cipher), plaintext);
});

run('encrypt/decrypt roundtrip (Unicode)', () => {
  const plaintext = 'äöü漢字 🍣';
  assert.equal(decrypt(encrypt(plaintext)), plaintext);
});

run('encrypt produces different ciphertext for same input (random IV)', () => {
  const plaintext = 'same-input';
  const a = encrypt(plaintext);
  const b = encrypt(plaintext);
  assert.notEqual(a, b);
  assert.equal(decrypt(a), plaintext);
  assert.equal(decrypt(b), plaintext);
});

run('decrypt fails on tampered payload', () => {
  const cipher = encrypt('original');
  const buf = Buffer.from(cipher, 'base64');
  buf[buf.length - 1] ^= 0xff;
  const tampered = buf.toString('base64');
  assert.throws(() => decrypt(tampered));
});

run('decrypt fails on truncated payload', () => {
  assert.throws(() => decrypt('AAAA'));
});
