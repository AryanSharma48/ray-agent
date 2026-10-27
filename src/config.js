import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { cyan, green, yellow, red, bold, dim } from './colors.js';
import { loadBundledSecret, decryptApiKey, saveBundledSecret, encryptApiKey } from './crypto.js';

const CONFIG_DIR = path.join(os.homedir(), '.ray-agent');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export const DEFAULT_MODEL = 'qwen/qwen3.8-27b';

export function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {
    // fallback if unparseable
  }
  return {};
}

export function writeConfig(updates) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const current = readConfig();
    const merged = { ...current, ...updates };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
    return merged;
  } catch (err) {
    console.error(red('Failed to save config:'), err.message);
  }
}

/**
 * Prompt user in terminal with optional hidden/masked input
 */
export function promptUser(questionText, { mask = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    if (!mask) {
      rl.question(questionText, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
      return;
    }

    // Masked input for passwords/keys
    process.stdout.write(questionText);
    let input = '';

    const onData = (char) => {
      char = char.toString('utf8');
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode?.(false);
        process.stdout.write('\n');
        rl.close();
        resolve(input.trim());
      } else if (char === '\u0003') { // Ctrl+C
        process.exit(1);
      } else if (char === '\u0008' || char === '\x7f') { // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        input += char;
        process.stdout.write('*');
      }
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onData);
    } else {
      rl.question('', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

/**
 * Resolves the Groq API key:
 * 1. process.env.GROQ_API_KEY
 * 2. Saved personal key
 * 3. Shared key unlocked via password
 * 4. Interactive first-time prompt
 */
export async function resolveApiKey({ forceShared = false, forcePersonal = false } = {}) {
  // 1. Environment Variable check
  if (process.env.GROQ_API_KEY && !forceShared) {
    return process.env.GROQ_API_KEY;
  }

  const config = readConfig();

  // 2. Saved personal key
  if (config.apiKey && !forceShared) {
    return config.apiKey;
  }

  // 3. Saved shared key mode
  if (config.useShared || forceShared) {
    const bundled = loadBundledSecret();
    if (!bundled) {
      console.log(yellow('⚠ No shared key has been configured yet.'));
      console.log(`Run ${cyan('ray --setup-shared')} to encrypt and bundle a shared key.\n`);
    } else {
      console.log(cyan(bold('⚡ Ray Shared Key Mode')));
      const password = await promptUser('Enter shared access password: ', { mask: true });
      try {
        const decrypted = decryptApiKey(bundled, password);
        console.log(green('✔ Key unlocked successfully.\n'));
        return decrypted;
      } catch (err) {
        console.error(red('✖ Error:'), err.message);
        process.exit(1);
      }
    }
  }

  // 4. Interactive Onboarding
  console.log(cyan(bold('\n⚡ Welcome to Ray (Ultra-Fast Groq CLI)')));
  console.log(dim('─────────────────────────────────────────────'));
  console.log('Provide your Groq API key or type "-s" to use a shared key:\n');

  const answer = await promptUser(`${bold('Enter Groq API Key')} or ${cyan('-s')}: `);

  if (answer.toLowerCase() === '-s') {
    const bundled = loadBundledSecret();
    if (!bundled) {
      console.log(yellow('\n⚠ No shared key has been packaged into this installation yet.'));
      console.log(`You can configure one using: ${cyan('ray --setup-shared')}\n`);
      const key = await promptUser('Please enter your personal Groq API key instead: ');
      if (!key) {
        console.error(red('No key provided. Exiting.'));
        process.exit(1);
      }
      writeConfig({ apiKey: key, useShared: false });
      return key;
    }

    const password = await promptUser('Enter shared access password: ', { mask: true });
    try {
      const decrypted = decryptApiKey(bundled, password);
      writeConfig({ useShared: true });
      console.log(green('✔ Configured! Saved preference to use shared key.\n'));
      return decrypted;
    } catch (err) {
      console.error(red('✖ Access denied:'), err.message);
      process.exit(1);
    }
  }

  if (!answer) {
    console.error(red('No API key provided. Exiting.'));
    process.exit(1);
  }

  writeConfig({ apiKey: answer, useShared: false });
  console.log(green('✔ API key saved to ~/.ray-agent/config.json\n'));
  return answer;
}

/**
 * Developer utility to set up the shared encrypted key
 */
export async function setupSharedKey() {
  console.log(cyan(bold('\n🔐 Setup Shared Encrypted Groq Key')));
  console.log(dim('This will encrypt an API key so anyone with the password can use it via "-s".\n'));

  const apiKey = await promptUser('Enter the Groq API Key to share: ', { mask: true });
  if (!apiKey) {
    console.error(red('API key cannot be empty.'));
    process.exit(1);
  }

  const password = await promptUser('Create a password for this key: ', { mask: true });
  if (!password || password.length < 4) {
    console.error(red('Password must be at least 4 characters.'));
    process.exit(1);
  }

  const payload = encryptApiKey(apiKey, password);
  saveBundledSecret(payload);

  console.log(green('\n✔ Shared key successfully encrypted and bundled!'));
  console.log(`Users can now run ${cyan('ray -s')} and enter the password to use it.\n`);
}
