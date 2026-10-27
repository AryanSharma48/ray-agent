import { cyan, green, yellow, gray, bold, dim, magenta, stripAnsi } from './colors.js';

// Syntax highlighting patterns for popular languages
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case',
  'break', 'continue', 'class', 'import', 'from', 'export', 'default', 'async', 'await', 'try',
  'catch', 'finally', 'throw', 'new', 'typeof', 'instanceof', 'void', 'delete', 'null', 'undefined',
  'true', 'false', 'def', 'elif', 'import', 'as', 'pass', 'with', 'yield', 'lambda', 'fn', 'mut',
  'pub', 'impl', 'struct', 'enum', 'trait', 'type', 'where', 'match', 'use', 'crate', 'self',
  'package', 'func', 'go', 'select', 'chan', 'defer', 'interface', 'map', 'range'
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
    if (KEYWORDS.has(match)) {
      return magenta(match);
    }
    return match;
  });

  return formatted;
}

/**
 * Creates a stream renderer that handles markdown code blocks and syntax highlighting
 */
export function createStreamRenderer(isTTY = process.stdout.isTTY) {
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
            const tag = codeLang ? ` ${codeLang.toUpperCase()} ` : ' CODE ';
            process.stdout.write(`\n${dim('┌─')} ${cyan(bold(tag))}\n`);
          } else {
            inCodeBlock = false;
            process.stdout.write(`${dim('└────────────────────────────')}\n`);
          }
        } else if (inCodeBlock) {
          process.stdout.write(`${dim('│')} ${highlightLine(line)}\n`);
        } else {
          process.stdout.write(`${line}\n`);
        }
      }
    },

    flush() {
      if (lineBuffer.length > 0) {
        if (!isTTY) {
          process.stdout.write(lineBuffer);
        } else if (inCodeBlock) {
          process.stdout.write(`${dim('│')} ${highlightLine(lineBuffer)}\n`);
          process.stdout.write(`${dim('└────────────────────────────')}\n`);
        } else {
          process.stdout.write(`${lineBuffer}\n`);
        }
      }
      return fullOutput;
    }
  };
}
