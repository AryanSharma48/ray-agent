import assert from 'node:assert';
import { encryptApiKey, decryptApiKey } from '../src/crypto.js';
import { createStreamRenderer } from '../src/formatter.js';

console.log('Running Ray CLI tests...\n');

// 1. Crypto tests
{
  const testKey = 'gsk_test1234567890abcdefghijklmnopqrstuvwxyz';
  const testPassword = 'supersecretpass';

  const payload = encryptApiKey(testKey, testPassword);
  assert(payload.salt, 'Payload must have salt');
  assert(payload.iv, 'Payload must have iv');
  assert(payload.ciphertext, 'Payload must have ciphertext');

  const decrypted = decryptApiKey(payload, testPassword);
  assert.strictEqual(decrypted, testKey, 'Decrypted key must match original');

  assert.throws(() => {
    decryptApiKey(payload, 'wrongpassword');
  }, /Invalid password/, 'Must throw on invalid password');

  console.log('✔ Crypto encryption and decryption tests passed.');
}

// 2. Formatter tests
{
  const renderer = createStreamRenderer(false); // non-TTY mode
  renderer.write('```bash\n');
  renderer.write('lsof -ti:3000 | xargs kill -9\n');
  renderer.write('```\n');
  const full = renderer.flush();
  assert(full.includes('kill -9'), 'Full output must include command');
  console.log('✔ Stream renderer tests passed.');
}

console.log('\nAll tests passed successfully! 🚀');
