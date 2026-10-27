# Ray (`ray-agent`)

> Ultra-fast, zero-bloat AI CLI assistant powered by Groq.  
> Pure speed. Bare-minimum direct answers. Zero fluff. Zero external dependencies.

---

## Features

- **Blazing Speed**: Sub-second response streaming powered by Groq's `llama-3.1-8b-instant` (~800+ tokens/sec).
- **Zero Fluff**: Strictly tuned system persona. Never says *"Sure!"*, *"Here is..."*, or gives unprompted lectures. Just the direct commands/code.
- **Zero External Dependencies**: Built with pure Node.js 18+ (native `fetch`, `node:readline`, `node:crypto`). Total package size is under 30KB, cold-start latency < 25ms.
- **Shared Key Option (`-s`)**: Run with your own personal Groq API key, OR pass `-s` to unlock a bundled shared key with a password. No server needed.
- **Universal Compatibility**: Works out of the box on Apple macOS (Apple Silicon M1/M2/M3/M4 & Intel), Linux, and Windows.
- **Piping & Unix Friendly**: Cleanly pipes input and output with other tools (`git diff | ray`, `ray "uuid" | pbcopy`).

---

## Installation

Install globally via npm:

```bash
npm i -g ray-agent
```

Or run instantly without installing:

```bash
npx ray-agent "how to kill port 3000 macos"
```

---

## First-Time Setup

When you first launch `ray`, it prompts for your key:

```text
Ray (Ultra-Fast Groq CLI)
─────────────────────────────────────────────
Provide your Groq API key or type "-s" to use a shared key:

Enter Groq API Key or -s: 
```

- **Option A (Personal Key)**: Paste your Groq API Key (`gsk_...`). It is saved securely to `~/.ray-agent/config.json`.
- **Option B (Shared Key with `-s`)**: Type `-s` and enter the shared team password to unlock the embedded key.

---

## Usage

### 1. One-Shot Instant Answers
Fastest way to get shell commands, regexes, and code snippets:

```bash
ray "kill process on port 8080"
# Output:
# lsof -ti:8080 | xargs kill -9
```

```bash
ray "convert csv to json in nodejs"
```

### 2. Interactive Chat (REPL)
Run `ray` without arguments to enter an interactive session:

```bash
ray
```
```text
ray (llama-3.1-8b-instant) | :q to quit, :c to clear

ray > how to extract tar.gz to /tmp
tar -xzf archive.tar.gz -C /tmp

ray > what flag to list contents instead?
tar -ztvf archive.tar.gz
```

- `:q` or `exit`: Quit session
- `:c` or `clear`: Clear conversation context

### 3. Piped Input
Pipe terminal output directly into Ray:

```bash
# Diagnose an error log
cat error.log | ray "explain what failed"

# Write a clean git commit message
git diff | ray "write a concise conventional git commit message"

# Copy generated command directly to clipboard (macOS)
ray "generate random 32 char hex" | pbcopy
```

---

## Setting Up a Bundled Shared Key (For Teams/Friends)

If you are publishing or sharing this package and want others to be able to use your Groq key via `-s` + password without exposing the key in plaintext:

1. Run the encryption helper:
   ```bash
   npm run encrypt
   # or
   ray --setup-shared
   ```
2. Enter your Groq API key and choose an access password.
3. It creates an AES-256-GCM encrypted payload in `src/shared-secret.json`.
4. Anyone who runs `ray -s` and enters your password can use it.

---

---

## Stealth & Ghost Mode (Anti-Shoulder-Surfing)

Run Ray with stealth flags when working in public spaces, offices, or libraries:
- **`-g` (Stealth Text)**: Answers stream in ultra-low-contrast dim gray text with zero bright banners. Legible up close, virtually invisible to anyone standing a couple of feet away.
- **`-G` (Ghost Window Injection)**: Injects 100% transparent glass (no frosted blur), hides the window from the taskbar, and enters fullscreen (`F11`) to eliminate all titlebars, tabs, and shadows!
- **`--restore`**: Restores Windows Terminal window settings back to defaults.

```bash
# Ghost window injection (100% transparent glass, fullscreen, hidden taskbar)
ray -G

# Stealth one-shot query
ray -g "sql left join syntax"

# Restore terminal settings
ray --restore
```

---

## CLI Options

| Command | Description |
| :--- | :--- |
| `ray <question>` | Stream instant answer for a question |
| `ray` | Launch interactive REPL |
| `ray -g, --stealth` | Stealth mode: low-contrast text, silent prompt, panic wipe |
| `ray -G, --ghost` | Ghost mode: 100% transparent, fullscreen, hides taskbar |
| `ray --restore` | Restore Windows Terminal settings to default |
| `ray -s <question>` | Force shared password mode |
| `ray --key <key>` | Set or update your personal Groq key |
| `ray --model <name>` | Select model (default: `qwen/qwen3.8-27b`) |
| `ray --config` | View current config and key status |
| `ray --reset` | Clear stored config in `~/.ray-agent/` |
| `ray --setup-shared` | Encrypt and bundle a shared key |
| `ray --help` | Show help and flags |

---

## License
MIT (c) Aryan Sharma
