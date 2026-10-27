#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cyan, bold, dim, yellow, green, red, gray } from '../src/colors.js';
import { resolveApiKey, readConfig, writeConfig, setupSharedKey, DEFAULT_MODEL } from '../src/config.js';
import { streamChat } from '../src/groq.js';
import { createStreamRenderer } from '../src/formatter.js';
import { startRepl } from '../src/repl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_PATH = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));

async function readStdin() {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', () => resolve(''));
  });
}

function printHelp() {
  console.log(`
${cyan(bold('ray'))} ${dim(`v${pkg.version}`)} - Ultra-fast, zero-bloat Groq CLI assistant

${bold('USAGE')}
  ${cyan('ray')}                           Start interactive chat (REPL)
  ${cyan('ray')} <question>                One-shot instant answer
  ${cyan('ray')} -s <question>             Force shared key mode
  <command> | ${cyan('ray')} [question]    Process piped terminal input

${bold('OPTIONS')}
  ${cyan('-s, --shared')}                  Use shared encrypted key
  ${cyan('--key')} <key>                   Set your personal Groq API key
  ${cyan('--model')} <name>                Select model (default: llama-3.1-8b-instant)
  ${cyan('--setup-shared')}                Encrypt & bundle a shared key (admin/creator)
  ${cyan('--config')}                      Show current configuration status
  ${cyan('--reset')}                       Clear saved local config
  ${cyan('-h, --help')}                    Display this help message
  ${cyan('-v, --version')}                 Display version

${bold('EXAMPLES')}
  ray "kill process on port 3000"
  ray "convert string to title case in python"
  git diff | ray "summarize changes"
  cat error.log | ray "explain error"
`);
}

async function main() {
  const args = process.argv.slice(2);

  // Flags handling
  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('-v') || args.includes('--version')) {
    console.log(pkg.version);
    process.exit(0);
  }

  if (args.includes('--setup-shared')) {
    await setupSharedKey();
    process.exit(0);
  }

  if (args.includes('--reset')) {
    writeConfig({ apiKey: null, useShared: false });
    console.log(green('✔ Configuration reset.'));
    process.exit(0);
  }

  if (args.includes('--config')) {
    const config = readConfig();
    console.log(`\n${cyan(bold('⚡ Ray Configuration'))}`);
    console.log(`Config file:  ~/.ray-agent/config.json`);
    console.log(`Model:        ${config.model || DEFAULT_MODEL}`);
    console.log(`Shared Key:   ${config.useShared ? green('Enabled') : dim('Disabled')}`);
    console.log(`Personal Key: ${config.apiKey ? green('Configured (' + config.apiKey.slice(0, 8) + '...)') : dim('None')}\n`);
    process.exit(0);
  }

  // Key flag
  const keyIdx = args.findIndex(a => a === '--key');
  if (keyIdx !== -1 && args[keyIdx + 1]) {
    const newKey = args[keyIdx + 1];
    writeConfig({ apiKey: newKey, useShared: false });
    console.log(green('✔ Personal Groq API key saved.\n'));
    args.splice(keyIdx, 2);
  }

  // Model flag
  const modelIdx = args.findIndex(a => a === '--model');
  let chosenModel = DEFAULT_MODEL;
  if (modelIdx !== -1 && args[modelIdx + 1]) {
    chosenModel = args[modelIdx + 1];
    args.splice(modelIdx, 2);
  } else {
    const config = readConfig();
    if (config.model) chosenModel = config.model;
  }

  // Shared flag
  const forceShared = args.includes('-s') || args.includes('--shared');
  const filteredArgs = args.filter(a => a !== '-s' && a !== '--shared');

  // Check stdin for piped data
  const stdinData = await readStdin();

  // Resolve API Key
  const apiKey = await resolveApiKey({ forceShared });

  // Query construction
  const query = filteredArgs.join(' ').trim();

  // If there's a one-shot query or piped data
  if (query || stdinData) {
    let promptContent = query;
    if (stdinData) {
      promptContent = query ? `${query}:\n\n${stdinData}` : stdinData;
    }

    const renderer = createStreamRenderer();
    try {
      await streamChat({
        apiKey,
        model: chosenModel,
        messages: [{ role: 'user', content: promptContent }],
        onChunk: (chunk) => renderer.write(chunk)
      });
      renderer.flush();
      if (process.stdout.isTTY) process.stdout.write('\n');
    } catch (err) {
      console.error(`\n${red('Error:')} ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // Otherwise, start interactive REPL
  await startRepl({ apiKey, model: chosenModel });
}

main().catch((err) => {
  console.error(`\n${red('Fatal:')} ${err.message}`);
  process.exit(1);
});
