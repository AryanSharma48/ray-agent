import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function getWtSettingsPaths() {
  const localAppData = process.env.LOCALAPPDATA || '';
  return [
    path.join(localAppData, 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    path.join(localAppData, 'Packages', 'Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    path.join(localAppData, 'Microsoft', 'Windows Terminal', 'settings.json')
  ].filter(p => fs.existsSync(p));
}

/**
 * Injects transparency, notification area docking, and auto-dismiss into Windows Terminal:
 * - opacity: 0 (100% transparent glass, crystal clear)
 * - useAcrylic: false (disables all frosted blur)
 * - minimizeToNotificationArea: true (hides window from the taskbar when minimized)
 * - alwaysShowNotificationIcon: true (ensures terminal icon resides in the system tray)
 * - autoHideWindow: true (makes the Win + ` Quake terminal automatically dismiss on tab switch / click away)
 */
export function applyWindowInjection({ transparent = true, hideTaskbar = true } = {}) {
  if (os.platform() !== 'win32') return;

  const paths = getWtSettingsPaths();
  for (const wtPath of paths) {
    try {
      const content = fs.readFileSync(wtPath, 'utf8');
      const settings = JSON.parse(content);

      if (!settings.profiles) settings.profiles = {};
      if (!settings.profiles.defaults) settings.profiles.defaults = {};

      if (transparent) {
        settings.profiles.defaults.opacity = 0;
        settings.profiles.defaults.useAcrylic = false;
      }

      if (hideTaskbar) {
        settings.minimizeToNotificationArea = true;
        settings.alwaysShowNotificationIcon = true;
        settings.autoHideWindow = true;
      }

      fs.writeFileSync(wtPath, JSON.stringify(settings, null, 4), 'utf8');
    } catch {
      // ignore individual failure
    }
  }
}

/**
 * Restores all Windows Terminal window settings back to defaults
 */
export function restoreWindowInjection() {
  if (os.platform() !== 'win32') return;

  const paths = getWtSettingsPaths();
  for (const wtPath of paths) {
    try {
      const content = fs.readFileSync(wtPath, 'utf8');
      const settings = JSON.parse(content);

      delete settings.minimizeToNotificationArea;
      delete settings.alwaysShowNotificationIcon;
      delete settings.autoHideWindow;

      if (settings.profiles?.defaults) {
        delete settings.profiles.defaults.opacity;
        delete settings.profiles.defaults.useAcrylic;
      }

      fs.writeFileSync(wtPath, JSON.stringify(settings, null, 4), 'utf8');
    } catch {
      // ignore individual failure
    }
  }
}
