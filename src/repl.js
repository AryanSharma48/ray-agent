import readline from 'node:readline';
import { cyan, bold, dim, yellow, green, gray, red } from './colors.js';
import { streamChat } from './groq.js';
import { createStreamRenderer } from './formatter.js';

export async function startRepl({ apiKey, model }) {
  console.log(`\n${cyan(bold('⚡ ray'))} ${dim(`(${model})`)} ${gray('•')} ${dim(':q to quit, :c to clear')}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  const conversation = [];
  let isGenerating = false;

  const prompt = () => {
    rl.question(`${cyan(bold('ray'))} ${dim('›')} `, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed === ':q' || trimmed === 'exit' || trimmed === 'quit') {
        rl.close();
        process.exit(0);
      }

      if (trimmed === ':c' || trimmed === 'clear') {
        conversation.length = 0;
        console.clear();
        console.log(`${dim('Conversation history cleared.\n')}`);
        prompt();
        return;
      }

      conversation.push({ role: 'user', content: trimmed });

      const renderer = createStreamRenderer(true);
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
        console.error(`\n${red('Error:')} ${err.message}\n`);
      } finally {
        isGenerating = false;
        prompt();
      }
    });
  };

  rl.on('SIGINT', () => {
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
