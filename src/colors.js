// Zero-dependency ANSI color utilities
const enabled = !process.env.NO_COLOR && process.stdout.isTTY !== false;

const c = (open, close) => (str = '') => (enabled ? `\x1b[${open}m${str}\x1b[${close}m` : String(str));

export const bold = c(1, 22);
export const dim = c(2, 22);
export const italic = c(3, 23);
export const underline = c(4, 24);

export const red = c(31, 39);
export const green = c(32, 39);
export const yellow = c(33, 39);
export const blue = c(34, 39);
export const magenta = c(35, 39);
export const cyan = c(36, 39);
export const gray = c(90, 39);
export const white = c(37, 39);

// Stealth text: dim low-contrast gray, virtually invisible from distance/angle
export const stealthColor = (str = '') => (enabled ? `\x1b[2;90m${str}\x1b[0m` : String(str));

export const clearScreen = () => {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
  }
};

export const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
