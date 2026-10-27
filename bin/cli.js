#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cyan, bold, dim, green, red, gray, stealthColor } from '../src/colors.js';
import { resolveApiKey, readConfig, writeConfig, setupSharedKey, DEFAULT_MODEL } from '../src/config.js';
import { streamChat } from '../src/groq.js';
import { createStreamRenderer } from '../src/formatter.js';
import { startRepl } from '../src/repl.js';
import { launchQuakeFullscreen, resetWindowsTerminalSettings, hideFromTaskbar } from '../src/window.js';

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
  ${cyan('ray')} -g <question>             Stealth mode (subtle low-contrast text)
  ${cyan('ray')} -G [question]             Ghost mode: hooks into Quake (Win + \`) & opens fullscreen
  <command> | ${cyan('ray')} [question]    Process piped terminal input

${bold('OPTIONS')}
  ${cyan('-g, --stealth')}                 Stealth text mode (subtle low-contrast gray)
  ${cyan('-G, --ghost')}                   Ghost mode: launches Quake dropdown (Win + \`) in fullscreen
  ${cyan('--restore')}                     Reset Windows Terminal settings back to default
  ${cyan('-s, --shared')}                  Use shared encrypted key
  ${cyan('--key')} <key>                   Set your personal Groq API key
  ${cyan('--model')} <name>                Select model (default: qwen/qwen3.8-27b)
  ${cyan('--setup-shared')}                Encrypt & bundle a shared key
  ${cyan('--config')}                      Show current configuration status
  ${cyan('--reset')}                       Clear saved local config
  ${cyan('-h, --help')}                    Display this help message
  ${cyan('-v, --version')}                 Display version

${bold('EXAMPLES')}
  ray "kill process on port 3000"
  ray -g "convert string to title case in python"
  ray -G "sql left join syntax"
  git diff | ray "summarize changes"
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

  if (args.includes('--restore')) {
    resetWindowsTerminalSettings();
    console.log(green('ok: windows terminal settings restored to defaults'));
    process.exit(0);
  }

  if (args.includes('--hide-taskbar')) {
    hideFromTaskbar(true);
    console.log(green('ok: windows terminal configured to hide from taskbar (system tray only)'));
    process.exit(0);
  }

  // Ghost mode (-G) or Quake flag: hook into Quake window (Win + `) and fullscreen natively
  const isGhostTrigger = args.includes('-G') || args.includes('--ghost') || args.includes('-q') || args.includes('--quake');
  const alreadyInQuake = args.includes('--in-quake');

  if (isGhostTrigger && !alreadyInQuake) {
    const remainingArgs = args.filter(a => a !== '-G' && a !== '--ghost' && a !== '-q' && a !== '--quake');
    const launched = launchQuakeFullscreen(['--in-quake', ...remainingArgs]);
    if (launched) {
      process.exit(0);
    }
  }

  if (args.includes('--setup-shared')) {
    await setupSharedKey();
    process.exit(0);
  }

  if (args.includes('--reset')) {
    writeConfig({ apiKey: null, useShared: false });
    console.log(green('ok: configuration reset'));
    process.exit(0);
  }

  if (args.includes('--config')) {
    const config = readConfig();
    console.log(`\n${cyan(bold('ray configuration'))}`);
    console.log(`config file:  ~/.ray-agent/config.json`);
    console.log(`model:        ${config.model || DEFAULT_MODEL}`);
    console.log(`stealth:      ${config.stealth ? green('enabled') : dim('disabled')}`);
    console.log(`shared key:   ${config.useShared ? green('enabled') : dim('disabled')}`);
    console.log(`personal key: ${config.apiKey ? green('configured (' + config.apiKey.slice(0, 8) + '...)') : dim('none')}\n`);
    process.exit(0);
  }

  // Key flag
  const keyIdx = args.findIndex(a => a === '--key');
  if (keyIdx !== -1 && args[keyIdx + 1]) {
    const newKey = args[keyIdx + 1];
    writeConfig({ apiKey: newKey, useShared: false });
    console.log(green('ok: personal groq api key saved\n'));
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

  // Stealth flag
  const isStealth = args.includes('-g') || args.includes('--stealth') || alreadyInQuake || readConfig().stealth === true;
  const filteredArgs = args.filter(a =>
    a !== '-s' && a !== '--shared' &&
    a !== '-g' && a !== '--stealth' &&
    a !== '-G' && a !== '--ghost' &&
    a !== '--in-quake'
  );

  // Shared flag
  const forceShared = args.includes('-s') || args.includes('--shared');

  // Check stdin for piped data
  const stdinData = await readStdin();

  // Resolve API Key
  const apiKey = await resolveApiKey({ forceShared, silent: isStealth });

  // Query construction
  const query = filteredArgs.join(' ').trim();

  // If there's a one-shot query or piped data
  if (query || stdinData) {
    let promptContent = query;
    if (stdinData) {
      promptContent = query ? `${query}:\n\n${stdinData}` : stdinData;
    }

    const renderer = createStreamRenderer({ isTTY: process.stdout.isTTY, stealth: isStealth });
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
      if (!isStealth) {
        console.error(`\n${red('error:')} ${err.message}`);
      } else {
        console.error(`\n${stealthColor(`error: ${err.message}`)}`);
      }
      process.exit(1);
    }
    return;
  }

  // Otherwise, start interactive REPL
  await startRepl({ apiKey, model: chosenModel, stealth: isStealth });
}

main().catch((err) => {
  console.error(`\nfatal: ${err.message}`);
  process.exit(1);
});
