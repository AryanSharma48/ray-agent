import readline from 'node:readline';
import { cyan, bold, dim, gray, red, stealthColor, clearScreen } from './colors.js';
import { streamChat } from './groq.js';
import { createStreamRenderer } from './formatter.js';

export async function startRepl({ apiKey, model, stealth = false }) {
  if (!stealth) {
    console.log(`\n${cyan(bold('ray'))} ${dim(`(${model})`)} ${dim('| :q to quit, :c to clear')}\n`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  const conversation = [];
  let isGenerating = false;

  const promptText = stealth ? dim('> ') : `${cyan(bold('ray'))} ${dim('>')} `;

  const prompt = () => {
    rl.question(promptText, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed === ':q' || trimmed === 'exit' || trimmed === 'quit') {
        if (stealth) clearScreen();
        rl.close();
        process.exit(0);
      }

      if (trimmed === ':c' || trimmed === 'clear') {
        conversation.length = 0;
        clearScreen();
        if (!stealth) {
          console.log(`${dim('Conversation history cleared.\n')}`);
        }
        prompt();
        return;
      }

      conversation.push({ role: 'user', content: trimmed });

      const renderer = createStreamRenderer({ isTTY: true, stealth });
      isGenerating = true;

      try {
        const fullResponse = await streamChat({
          apiKey,
          model,
          messages: conversation,
          onChunk: (chunk) => renderer.write(chunk)
        });
        renderer.flush();
        process.stdout.write('\n');
        conversation.push({ role: 'assistant', content: fullResponse });
      } catch (err) {
        if (!stealth) {
          console.error(`\n${red('error:')} ${err.message}\n`);
        } else {
          console.error(`\n${stealthColor(`error: ${err.message}`)}\n`);
        }
      } finally {
        isGenerating = false;
        prompt();
      }
    });
  };

  rl.on('SIGINT', () => {
    if (stealth) {
      clearScreen();
      process.exit(0);
    }
    if (isGenerating) {
      console.log('\n');
      prompt();
    } else {
      console.log('\n');
      process.exit(0);
    }
  });

  prompt();
}
