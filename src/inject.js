import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const wtSettingsPath = path.join(
  process.env.LOCALAPPDATA || '',
  'Packages',
  'Microsoft.WindowsTerminal_8wekyb3d8bbwe',
  'LocalState',
  'settings.json'
);

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
