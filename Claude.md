# Claude.md -- WD Agent

## Project Identity

- **Name**: WD Agent (`wd-agent`)
- **Purpose**: A local AI agent operating system powered by Claude Opus 4.6 and WorthDoing Capabilities
- **Author**: WorthDoing AI (admin@worthdoing.ai)
- **License**: MIT
- **Repository**: https://github.com/Worth-Doing/wd-agent

## What This Project Is

WD Agent is a CLI-based agent that operates in a sequential think-act-observe loop. It is NOT a chatbot. It receives a task from the user, reasons about it using Claude Opus 4.6, executes actions (shell commands, capability calls, file I/O), observes the results, and repeats until the task is complete.

The agent uses the `worthdoing-capabilities` SDK to access external services (Exa, Tavily, Firecrawl, OpenRouter, OpenAlex, FMP, EODHD) through a unified interface.

## Architecture

```
src/
├── index.ts                 Public API exports
├── agent/
│   ├── types.ts             Core type definitions (AgentAction, AgentThought, StepRecord, ConversationMeta)
│   └── loop.ts              The main agent loop (think → act → observe → persist → loop/done)
├── cli/
│   └── app.ts               CLI entry point, interactive REPL, slash commands
├── config/
│   └── settings.ts          Configuration loading/saving (~/.wdagent/config.json)
├── runtime/
│   ├── executor.ts          Action dispatcher (routes actions to shell/capabilities/files)
│   ├── shell.ts             Shell command runner with blocked-command safety list
│   ├── capabilities.ts      Bridge to worthdoing-capabilities SDK
│   └── files.ts             File I/O handler with path traversal protection
└── utils/
    ├── colors.ts            Terminal ANSI color helpers
    └── logger.ts            Structured JSON-lines logger
```

## Key Types

```typescript
interface AgentAction {
  type: "shell" | "capability" | "file" | "spawn_agent" | "message" | "done";
  command?: string;        // shell
  name?: string;           // capability name (e.g., "exa.search")
  input?: Record<string, unknown>;  // capability input
  operation?: "read" | "write" | "edit";  // file
  path?: string;           // file
  content?: string;        // file
  task?: string;           // spawn_agent
  agentName?: string;      // spawn_agent
  text?: string;           // message / done
}

interface StepRecord {
  step: number;
  timestamp: string;
  thought: string;
  action: AgentAction;
  result: { success: boolean; output: unknown; error?: string; duration_ms: number };
}

interface ConversationMeta {
  id: string;
  created: string;
  updated: string;
  title: string;
  steps: number;
  status: "active" | "completed" | "paused";
}
```

## Design Principles

1. **Sequential execution only**: The agent loop runs one step at a time. No parallelism, no async fan-out. This is intentional for debuggability and auditability.
2. **File-based persistence**: Every conversation is stored as JSON files in a workspace folder. No database required.
3. **Local-first**: Everything runs on the user's machine. API keys are stored locally in `~/.wdagent/config.json`.
4. **Safety by default**: Dangerous shell commands are blocked. File paths are sandboxed to the workspace. Shell commands require user confirmation by default.
5. **Minimal dependencies**: Only `@anthropic-ai/sdk` and `worthdoing-capabilities` at runtime.

## Build & Development

```bash
npm install          # Install dependencies
npm run build        # Build with tsup
npm run dev          # Watch mode
npm test             # Run tests with vitest
npm run typecheck    # Type-check with tsc --noEmit
```

## Configuration

Stored at `~/.wdagent/config.json`:

```json
{
  "anthropicApiKey": "",
  "apiKeys": {},
  "model": "claude-opus-4-6-20250219",
  "maxSteps": 50,
  "confirmShell": true,
  "conversationsDir": ".conversations"
}
```

## Conventions

- All source code is TypeScript with `strict: true`.
- Module format: ES2022 with bundler resolution.
- Build output: CommonJS (for Node.js CLI compatibility) via tsup.
- Tests: vitest.
- No default exports. Use named exports everywhere.
- Capability names use `provider.method` syntax (e.g., `exa.search`, `fmp.quote`).
- Action types are a closed union: `"shell" | "capability" | "file" | "spawn_agent" | "message" | "done"`.

## Important Notes for Claude

- When modifying the agent loop, preserve the sequential nature. Do not introduce Promise.all or concurrent execution.
- When adding new capabilities, update both `src/runtime/capabilities.ts` (the bridge) and the capability table in `README.md`.
- The `ShellRunner` has a blocked-commands list in `src/runtime/shell.ts`. New dangerous patterns should be added there.
- File operations in `src/runtime/files.ts` include path traversal protection. Do not bypass it.
- The CLI entry point is `src/cli/app.ts`, which is the `bin` target in `package.json`.
- The public API (`src/index.ts`) exports `AgentLoop` and the core types. Keep this surface small.
