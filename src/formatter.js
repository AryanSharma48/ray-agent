import { cyan, green, yellow, gray, bold, dim, magenta, stealthColor } from './colors.js';

// Syntax highlighting patterns for popular languages
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case',
  'break', 'continue', 'class', 'import', 'from', 'export', 'default', 'async', 'await', 'try',
  'catch', 'finally', 'throw', 'new', 'typeof', 'instanceof', 'void', 'delete', 'null', 'undefined',
  'true', 'false', 'def', 'elif', 'import', 'as', 'pass', 'with', 'yield', 'lambda', 'fn', 'mut',
  'pub', 'impl', 'struct', 'enum', 'trait', 'type', 'where', 'match', 'use', 'crate', 'self',
  'package', 'func', 'go', 'select', 'chan', 'defer', 'interface', 'map', 'range', 'SELECT', 'FROM',
  'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'LIMIT'
]);

function highlightLine(line) {
  // Comments
  if (/^\s*(\/\/|#|--|\/\*)/.test(line)) {
    return gray(line);
  }

  // Highlight strings: "..." or '...' or `...`
  let formatted = line.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, (match) => green(match));

  // Highlight numbers
  formatted = formatted.replace(/\b(\d+(\.\d+)?)\b/g, (match) => yellow(match));

  // Highlight keywords
  formatted = formatted.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match) => {
    if (KEYWORDS.has(match) || KEYWORDS.has(match.toUpperCase())) {
      return magenta(match);
    }
    return match;
  });

  return formatted;
}

/**
 * Creates a stream renderer that handles markdown code blocks and syntax highlighting.
 * If stealth is enabled, output is rendered in dim, low-contrast text without borders.
 */
export function createStreamRenderer({ isTTY = process.stdout.isTTY, stealth = false } = {}) {
  let inCodeBlock = false;
  let codeLang = '';
  let lineBuffer = '';
  let fullOutput = '';

  return {
    write(chunk) {
      fullOutput += chunk;
      if (!isTTY) {
        process.stdout.write(chunk);
        return;
      }

      lineBuffer += chunk;
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || ''; // keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('```')) {
          if (!inCodeBlock) {
            inCodeBlock = true;
            codeLang = line.slice(3).trim();
            if (!stealth) {
              const tag = codeLang ? ` ${codeLang.toUpperCase()} ` : ' CODE ';
              process.stdout.write(`\n${dim('---')} ${cyan(bold(tag))}\n`);
            } else {
              process.stdout.write('\n');
            }
          } else {
            inCodeBlock = false;
            if (!stealth) {
              process.stdout.write(`${dim('----------------------------')}\n`);
            } else {
              process.stdout.write('\n');
            }
          }
        } else if (inCodeBlock) {
          if (stealth) {
            process.stdout.write(`${stealthColor(line)}\n`);
          } else {
            process.stdout.write(`  ${highlightLine(line)}\n`);
          }
        } else {
          if (stealth) {
            process.stdout.write(`${stealthColor(line)}\n`);
          } else {
            process.stdout.write(`${line}\n`);
          }
        }
      }
    },

    flush() {
      if (lineBuffer.length > 0) {
        if (!isTTY) {
          process.stdout.write(lineBuffer);
        } else if (stealth) {
          process.stdout.write(`${stealthColor(lineBuffer)}\n`);
        } else if (inCodeBlock) {
          process.stdout.write(`  ${highlightLine(lineBuffer)}\n`);
          process.stdout.write(`${dim('----------------------------')}\n`);
        } else {
          process.stdout.write(`${lineBuffer}\n`);
        }
      }
      return fullOutput;
    }
  };
}
