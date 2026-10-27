import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';

const wtSettingsPath = path.join(
  process.env.LOCALAPPDATA || '',
  'Packages',
  'Microsoft.WindowsTerminal_8wekyb3d8bbwe',
  'LocalState',
  'settings.json'
);

/**
 * Toggles Full Screen (F11) on the current window.
 * MUST be called only after user has finished entering their password.
 */
export function toggleFullscreen() {
  if (os.platform() !== 'win32') return;

  // 1. Try VT sequence first (cleanest, zero keystroke simulation)
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[10;1t'); // XTerm standard VT: set fullscreen
  }

  // 2. Also send F11 via WScript.Shell
  const script = '$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys("{F11}")';
  exec(`powershell -NoProfile -NonInteractive -Command "${script}"`, () => {});
}

/**
 * Injects transparency and taskbar hiding into Windows Terminal:
 * - opacity: 0 (100% transparent glass, crystal clear)
 * - useAcrylic: false (disables all frosted blur)
 * - minimizeToNotificationArea: true (hides window from the taskbar)
 */
export function applyWindowInjection({ transparent = true, hideTaskbar = true } = {}) {
  if (os.platform() !== 'win32') return;

  try {
    if (!fs.existsSync(wtSettingsPath)) return;
    const content = fs.readFileSync(wtSettingsPath, 'utf8');
    const settings = JSON.parse(content);

    if (!settings.profiles) settings.profiles = {};
    if (!settings.profiles.defaults) settings.profiles.defaults = {};

    if (transparent) {
      settings.profiles.defaults.opacity = 0; // 100% clear transparency
      settings.profiles.defaults.useAcrylic = false; // no frosted blur
    }

    if (hideTaskbar) {
      settings.minimizeToNotificationArea = true;
    }

    fs.writeFileSync(wtSettingsPath, JSON.stringify(settings, null, 4), 'utf8');
  } catch {
    // ignore
  }
}

/**
 * Restores all Windows Terminal window settings back to defaults
 */
export function restoreWindowInjection() {
  if (os.platform() !== 'win32') return;

  try {
    if (!fs.existsSync(wtSettingsPath)) return;
    const content = fs.readFileSync(wtSettingsPath, 'utf8');
    const settings = JSON.parse(content);

    delete settings.minimizeToNotificationArea;
    if (settings.profiles?.defaults) {
      delete settings.profiles.defaults.opacity;
      delete settings.profiles.defaults.useAcrylic;
    }

    fs.writeFileSync(wtSettingsPath, JSON.stringify(settings, null, 4), 'utf8');
  } catch {
    // ignore
  }
}
