import * as readline from "node:readline";
import { loadConfig, saveConfig, hasApiKey } from "../config/settings";
import type { AgentConfig } from "../config/settings";
import type { AgentAction, StepRecord, ConversationMeta } from "../agent/types";
import { ConversationManager } from "../conversations/manager";
import { AgentLoop } from "../agent/loop";

// ---------------------------------------------------------------------------
// ANSI color helpers (no external deps)
// ---------------------------------------------------------------------------
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

// ---------------------------------------------------------------------------
// Box-drawing helper — premium bordered panels
// ---------------------------------------------------------------------------
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function wrapText(text: string, maxWidth: number): string[] {
  if (!text) return [""];
  const result: string[] = [];
  for (const rawLine of text.split("\n")) {
    const cleanLine = stripAnsi(rawLine);
    if (cleanLine.length <= maxWidth) {
      result.push(rawLine);
    } else {
      // Word wrap
      const words = rawLine.split(" ");
      let current = "";
      for (const word of words) {
        const testLine = current ? current + " " + word : word;
        if (stripAnsi(testLine).length > maxWidth && current) {
          result.push(current);
          current = word;
        } else {
          current = testLine;
        }
      }
      if (current) result.push(current);
    }
  }
  return result;
}

function box(title: string, lines: string[], color: string = c.dim): string {
  // Dynamic width based on terminal, capped at 72
  const termWidth = process.stdout.columns || 80;
  const width = Math.min(termWidth - 6, 72);
  const innerWidth = width - 2;

  const titleClean = stripAnsi(title);
  const dashCount = Math.max(0, width - titleClean.length - 4);
  const top = `  ${color}\u250c\u2500 ${c.reset}${c.bold}${title}${c.reset}${color} ${"\u2500".repeat(dashCount)}\u2510${c.reset}`;
  const bottom = `  ${color}\u2514${"\u2500".repeat(width)}\u2518${c.reset}`;

  // Wrap all lines
  const wrappedLines: string[] = [];
  for (const l of lines) {
    wrappedLines.push(...wrapText(l, innerWidth));
  }

  const body = wrappedLines.map((l) => {
    const clean = stripAnsi(l);
    const padding = Math.max(0, innerWidth - clean.length);
    return `  ${color}\u2502${c.reset} ${l}${" ".repeat(padding)} ${color}\u2502${c.reset}`;
  });
  return [top, ...body, bottom].join("\n");
}

function emptyBoxLine(): string {
  return "";
}

// ---------------------------------------------------------------------------
// Session tracking
// ---------------------------------------------------------------------------
let sessionStepCount = 0;
let sessionStartTime = Date.now();

function generateSessionId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `conv_${date}_${rand}`;
}

let currentSessionId = generateSessionId();

// ---------------------------------------------------------------------------
// Screen helpers
// ---------------------------------------------------------------------------
function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

function printBanner(): void {
  const banner = box("", [
    "",
    `  ${c.cyan}${c.bold}\u2588\u2588\u2557    \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557      \u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557${c.reset}`,
    `  ${c.cyan}${c.bold}\u2588\u2588\u2551    \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557    \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d${c.reset}`,
    `  ${c.cyan}${c.bold}\u2588\u2588\u2551 \u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551    \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2588\u2557${c.reset}`,
    `  ${c.cyan}${c.bold}\u2588\u2588\u2551\u2588\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551    \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551${c.reset}`,
    `  ${c.cyan}${c.bold}\u255a\u2588\u2588\u2588\u2554\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d    \u2588\u2588\u2551  \u2588\u2588\u2551\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d${c.reset}`,
    `  ${c.cyan}${c.bold} \u255a\u2550\u2550\u255d\u255a\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d     \u255a\u2550\u255d  \u255a\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d${c.reset}`,
    "",
    `  ${c.bold}Local AI Agent by WorthDoing AI${c.reset}`,
    `  ${c.dim}\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${c.reset}`,
    `  ${c.dim}Powered by Claude \u00b7 22+ Capabilities${c.reset}`,
    "",
  ], c.cyan);
  console.log(`\n${banner}\n`);
}

function printStatusBar(config: AgentConfig, convId: string): void {
  const providerLabel = config.provider === "openrouter" ? "OpenRouter" : "Anthropic";
  const modelShort = config.model.length > 20 ? config.model.slice(0, 20) + "\u2026" : config.model;
  const statusBox = box(`${c.cyan}Status${c.reset}`, [
    `${c.dim}Provider:${c.reset} ${c.bold}${providerLabel}${c.reset}   ${c.dim}Model:${c.reset} ${c.bold}${modelShort}${c.reset}`,
    `${c.dim}Session:${c.reset}  ${c.gray}${convId}${c.reset}   ${c.dim}Steps:${c.reset} ${sessionStepCount}`,
  ], c.cyan);
  console.log(`${statusBox}\n`);
}

function printSystemInfo(config: AgentConfig, convId: string, capsCount: number): void {
  const providerLabel = config.provider === "openrouter" ? "OpenRouter" : "Anthropic";
  const nodeVer = process.version;
  const sysBox = box(`${c.green}System${c.reset}`, [
    `${c.dim}Node${c.reset}      ${c.bold}${nodeVer}${c.reset}`,
    `${c.dim}Provider${c.reset}  ${c.bold}${providerLabel}${c.reset}`,
    `${c.dim}Model${c.reset}     ${c.bold}${config.model}${c.reset}`,
    `${c.dim}Caps${c.reset}      ${c.green}${capsCount} capabilities loaded${c.reset}`,
    `${c.dim}Session${c.reset}   ${c.gray}${convId}${c.reset}`,
  ], c.green);
  console.log(`${sysBox}`);
  console.log(`\n  ${c.dim}Type a message to start, or ${c.reset}${c.cyan}/help${c.reset}${c.dim} for commands.${c.reset}\n`);
}

function printHelp(): void {
  const commands = [
    [`${c.cyan}/help${c.reset}`, "Show this help"],
    [`${c.cyan}/new${c.reset}`, "Start a new conversation"],
    [`${c.cyan}/list${c.reset}`, "List conversations"],
    [`${c.cyan}/resume <id>${c.reset}`, "Resume a conversation"],
    [`${c.cyan}/config${c.reset}`, "Show/edit configuration"],
    [`${c.cyan}/model${c.reset}`, "Change model (OpenRouter browser)"],
    [`${c.cyan}/caps${c.reset}`, "List available capabilities"],
    [`${c.cyan}/steps${c.reset}`, "Show steps in current conversation"],
    [`${c.cyan}/clear${c.reset}`, "Clear screen"],
    [`${c.cyan}/exit${c.reset}`, "Exit the agent"],
  ];
  const lines = commands.map(([cmd, desc]) => {
    const cleanCmd = stripAnsi(cmd);
    const pad = Math.max(0, 16 - cleanCmd.length);
    return `${cmd}${" ".repeat(pad)}${c.dim}${desc}${c.reset}`;
  });
  lines.push("");
  lines.push(`${c.dim}Or just type a message to chat with the agent.${c.reset}`);
  const helpBox = box(`${c.yellow}Help${c.reset}`, ["", ...lines, ""], c.yellow);
  console.log(`\n${helpBox}\n`);
}

// ---------------------------------------------------------------------------
// Setup prompts
// ---------------------------------------------------------------------------
function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function setupProvider(rl: readline.Interface): Promise<{ provider: "anthropic" | "openrouter"; apiKey: string; model: string }> {
  const setupLines = [
    "",
    `${c.bold}Choose your AI provider to get started.${c.reset}`,
    "",
    `${c.cyan}1${c.reset}  Anthropic (Claude API direct)`,
    `${c.cyan}2${c.reset}  OpenRouter (350+ models)`,
    "",
  ];
  console.log(`\n${box(`${c.yellow}Setup Required${c.reset}`, setupLines, c.yellow)}\n`);

  const choice = await ask(rl, `  ${c.cyan}\u276f${c.reset} ${c.bold}Choice [1/2]:${c.reset} `);

  if (choice === "2") {
    // OpenRouter flow
    console.log(`\n  ${c.dim}Get an API key at: https://openrouter.ai/settings/keys${c.reset}\n`);
    const apiKey = await ask(rl, `  ${c.cyan}\u276f${c.reset} ${c.bold}OpenRouter API Key:${c.reset} `);
    if (!apiKey) throw new Error("No API key provided");

    // Fetch models from OpenRouter
    console.log(`\n  ${c.dim}Fetching available models...${c.reset}`);
    const model = await selectOpenRouterModel(rl, apiKey);

    return { provider: "openrouter", apiKey, model };
  }

  // Anthropic flow
  console.log(`\n  ${c.dim}Get an API key at: https://console.anthropic.com/settings/keys${c.reset}\n`);
  const apiKey = await ask(rl, `  ${c.cyan}\u276f${c.reset} ${c.bold}Anthropic API Key:${c.reset} `);
  if (!apiKey) throw new Error("No API key provided");

  return { provider: "anthropic", apiKey, model: "claude-opus-4-6" };
}

async function selectOpenRouterModel(rl: readline.Interface, apiKey: string): Promise<string> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    const data = await response.json() as any;
    const models: { id: string; name: string; context: number; pricing: string }[] = [];

    for (const m of (data.data || [])) {
      models.push({
        id: m.id,
        name: m.name || m.id,
        context: m.context_length || 0,
        pricing: m.pricing?.prompt || "0",
      });
    }

    // Group by provider
    const providers = new Map<string, typeof models>();
    for (const m of models) {
      const provider = m.id.split("/")[0];
      if (!providers.has(provider)) providers.set(provider, []);
      providers.get(provider)!.push(m);
    }

    // Show popular models first
    const popular = [
      "anthropic/claude-opus-4-6",
      "anthropic/claude-sonnet-4-6",
      "anthropic/claude-haiku-4-5",
      "openai/gpt-4.1",
      "openai/gpt-4.1-mini",
      "openai/o3",
      "openai/o4-mini",
      "google/gemini-2.5-pro-preview",
      "google/gemini-2.5-flash",
      "meta-llama/llama-4-maverick",
      "deepseek/deepseek-r1",
      "mistralai/mistral-large",
    ];

    const availablePopular = popular.filter((id) => models.some((m) => m.id === id));

    const modelLines: string[] = [""];
    modelLines.push(`${c.bold}${models.length} models available${c.reset}`);
    modelLines.push("");
    availablePopular.forEach((id, i) => {
      const m = models.find((m) => m.id === id);
      if (m) {
        modelLines.push(`${c.cyan}${String(i + 1).padStart(2)}${c.reset}  ${c.bold}${m.id}${c.reset}`);
      }
    });
    modelLines.push("");

    console.log(`\n${box(`${c.magenta}Models${c.reset}`, modelLines, c.magenta)}\n`);
    console.log(`  ${c.dim}Or type a model ID directly (e.g. anthropic/claude-opus-4-6)${c.reset}\n`);

    const selection = await ask(rl, `  ${c.cyan}\u276f${c.reset} ${c.bold}Model [number or ID]:${c.reset} `);

    // Parse selection
    const num = parseInt(selection, 10);
    if (!isNaN(num) && num >= 1 && num <= availablePopular.length) {
      const selected = availablePopular[num - 1];
      console.log(`  ${c.green}\u2713${c.reset} Selected: ${c.bold}${selected}${c.reset}`);
      return selected;
    }

    // Check if it's a valid model ID
    if (selection.includes("/")) {
      const exists = models.some((m) => m.id === selection);
      if (exists) {
        console.log(`  ${c.green}\u2713${c.reset} Selected: ${c.bold}${selection}${c.reset}`);
        return selection;
      }
      // Even if not found in list, trust the user
      console.log(`  ${c.yellow}\u26a0${c.reset} Model not found in catalog, using anyway: ${c.bold}${selection}${c.reset}`);
      return selection;
    }

    // Search by name
    const matches = models.filter((m) =>
      m.id.toLowerCase().includes(selection.toLowerCase()) ||
      m.name.toLowerCase().includes(selection.toLowerCase())
    ).slice(0, 10);

    if (matches.length > 0) {
      const matchLines = matches.map((m, i) =>
        `${c.cyan}${String(i + 1).padStart(2)}${c.reset}  ${c.bold}${m.id}${c.reset}`
      );
      console.log(`\n${box(`${c.magenta}Matches${c.reset}`, ["", ...matchLines, ""], c.magenta)}\n`);

      const pick = await ask(rl, `  ${c.cyan}\u276f${c.reset} ${c.bold}Pick [1-${matches.length}]:${c.reset} `);
      const pickNum = parseInt(pick, 10);
      if (!isNaN(pickNum) && pickNum >= 1 && pickNum <= matches.length) {
        const selected = matches[pickNum - 1].id;
        console.log(`  ${c.green}\u2713${c.reset} Selected: ${c.bold}${selected}${c.reset}`);
        return selected;
      }
    }

    // Default
    console.log(`  ${c.dim}Defaulting to anthropic/claude-opus-4-6${c.reset}`);
    return "anthropic/claude-opus-4-6";
  } catch (err) {
    console.log(`  ${c.yellow}Could not fetch models. Defaulting to anthropic/claude-opus-4-6${c.reset}`);
    return "anthropic/claude-opus-4-6";
  }
}

// ---------------------------------------------------------------------------
// Spinner — smooth dot animation
// ---------------------------------------------------------------------------
interface Spinner {
  stop: (result?: string) => void;
}

function showSpinner(message: string): Spinner {
  const frames = [
    `${c.cyan}\u25cf${c.reset} ${c.dim}\u25cb \u25cb${c.reset}`,
    `${c.dim}\u25cb${c.reset} ${c.cyan}\u25cf${c.reset} ${c.dim}\u25cb${c.reset}`,
    `${c.dim}\u25cb \u25cb${c.reset} ${c.cyan}\u25cf${c.reset}`,
    `${c.dim}\u25cb${c.reset} ${c.cyan}\u25cf${c.reset} ${c.dim}\u25cb${c.reset}`,
  ];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i % frames.length]}  ${c.dim}${message}${c.reset}   `);
    i++;
  }, 200);

  return {
    stop(result?: string): void {
      clearInterval(interval);
      if (result) {
        process.stdout.write(`\r  ${c.green}\u2713${c.reset} ${result}${" ".repeat(40)}\n`);
      } else {
        process.stdout.write(`\r${" ".repeat(80)}\r`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Format an action for display — with action badges and icons
// ---------------------------------------------------------------------------
function formatAction(action: AgentAction): string {
  if (!action) return "";
  switch (action.type) {
    case "shell":
      return `\u26a1 ${c.yellow}${c.bold}shell${c.reset} ${c.dim}\u2192${c.reset} ${c.bold}${action.command ?? ""}${c.reset}`;
    case "capability": {
      const inputPreview = action.input
        ? ` ${c.dim}${JSON.stringify(action.input).slice(0, 60)}${c.reset}`
        : "";
      return `\ud83d\udd0c ${c.magenta}${c.bold}capability${c.reset} ${c.dim}\u2192${c.reset} ${c.bold}${action.name ?? ""}${c.reset}${inputPreview}`;
    }
    case "file":
      return `\ud83d\udcc4 ${c.blue}${c.bold}file${c.reset} ${c.dim}\u2192${c.reset} ${c.bold}${action.operation ?? ""}${c.reset} ${action.path ?? ""}`;
    case "spawn_agent":
      return `\ud83e\udd16 ${c.cyan}${c.bold}sub-agent${c.reset} ${c.dim}\u2192${c.reset} ${c.bold}${action.agentName ?? "agent"}${c.reset}: ${action.task ?? ""}`;
    case "message":
      return `${c.green}${c.bold}message${c.reset}`;
    case "done":
      return `${c.green}${c.bold}done${c.reset}`;
    default:
      return JSON.stringify(action);
  }
}

// ---------------------------------------------------------------------------
// Format action type badge for step boxes
// ---------------------------------------------------------------------------
function actionBadge(action: AgentAction): string {
  switch (action.type) {
    case "shell":
      return `\u26a1 ${c.yellow}shell${c.reset} \u2192 ${c.bold}${action.command ?? ""}${c.reset}`;
    case "capability":
      return `\ud83d\udd0c ${c.magenta}capability${c.reset} \u2192 ${c.bold}${action.name ?? ""}${c.reset}`;
    case "file":
      return `\ud83d\udcc4 ${c.blue}file${c.reset} \u2192 ${c.bold}${action.operation ?? ""}${c.reset} ${c.dim}${action.path ?? ""}${c.reset}`;
    case "spawn_agent":
      return `\ud83e\udd16 ${c.cyan}sub-agent${c.reset} \u2192 ${c.bold}${action.agentName ?? ""}${c.reset}`;
    default:
      return action.type;
  }
}

// ---------------------------------------------------------------------------
// Render step output in a bordered box
// ---------------------------------------------------------------------------
function renderStepOutput(output: unknown): void {
  if (output == null) return;
  let preview: string;
  if (typeof output === "object") {
    preview = JSON.stringify(output, null, 2);
  } else {
    preview = String(output);
  }
  if (preview.length > 500) {
    preview = preview.slice(0, 500) + "\u2026";
  }

  const outputLines = preview.split("\n").map((l) => `${c.dim}${l}${c.reset}`);
  const outputBox = box(`${c.dim}Output${c.reset}`, outputLines, c.dim);
  console.log(`${outputBox}\n`);
}

// ---------------------------------------------------------------------------
// Format elapsed time nicely
// ---------------------------------------------------------------------------
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ---------------------------------------------------------------------------
// Agent execution loop — runs steps until "message" or "done"
// ---------------------------------------------------------------------------
async function runAgentLoop(
  loop: AgentLoop,
  userMessage: string,
  maxSteps: number,
): Promise<void> {
  let messageForStep = userMessage;
  let stepCount = 0;

  while (true) {
    stepCount++;
    sessionStepCount++;
    const stepStart = Date.now();
    const spinner = showSpinner("Thinking...");

    let result: StepRecord;
    try {
      result = await loop.step(messageForStep);
    } catch (err: unknown) {
      spinner.stop();
      const errMsg = err instanceof Error ? err.message : String(err);
      const errBox = box(`${c.red}Error${c.reset}`, [
        `${c.red}${errMsg}${c.reset}`,
      ], c.red);
      console.log(`\n${errBox}\n`);
      return;
    }

    const stepElapsed = Date.now() - stepStart;

    // After the first step, subsequent steps should not re-send the user
    // message — the agent is continuing from its own prior output.
    messageForStep = "";

    const actionType = result.action.type;

    if (actionType === "message" || actionType === "done") {
      // Final answer — print it in a nice panel
      spinner.stop();
      const text = result.action.text ?? "Task completed.";
      const textLines = text.split("\n").map((l: string) => l);
      const agentBox = box(`${c.green}Agent${c.reset}`, ["", ...textLines, ""], c.green);
      console.log(`\n${agentBox}\n`);
      return;
    }

    // Intermediate action — show in a step box
    spinner.stop();

    const thought = result.thought;
    const stepLines: string[] = [];
    if (thought) {
      stepLines.push(`${c.dim}${c.italic}\ud83d\udcad ${thought}${c.reset}`);
    }
    stepLines.push(actionBadge(result.action));
    stepLines.push(`${c.dim}\u23f1  ${formatDuration(stepElapsed)}${c.reset}`);

    const stepBox = box(`${c.cyan}Step ${stepCount}${c.reset}`, stepLines, c.cyan);
    console.log(`\n${stepBox}`);

    renderStepOutput(result.result?.output);

    // Guard against infinite loops
    if (stepCount >= maxSteps) {
      const maxBox = box(`${c.yellow}Warning${c.reset}`, [
        `${c.yellow}Max steps (${maxSteps}) reached. Stopping.${c.reset}`,
      ], c.yellow);
      console.log(`${maxBox}\n`);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Interactive REPL
// ---------------------------------------------------------------------------
async function interactiveLoop(
  rl: readline.Interface,
  config: AgentConfig,
  convManager: ConversationManager,
  initialConv: ReturnType<ConversationManager["create"]>,
): Promise<void> {
  let conv = initialConv;
  let loop = new AgentLoop(config, conv);

  const askPrompt = (): void => {
    rl.question(`\n  ${c.cyan}${c.bold}\u276f${c.reset} `, async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) {
        askPrompt();
        return;
      }

      // ------------------------------------------------------------------
      // Slash commands
      // ------------------------------------------------------------------
      if (trimmed.startsWith("/")) {
        const parts = trimmed.slice(1).split(" ");
        const cmd = parts[0];
        const cmdArgs = parts.slice(1);

        switch (cmd) {
          case "exit":
          case "quit":
          case "q": {
            const elapsed = formatDuration(Date.now() - sessionStartTime);
            const exitBox = box(`${c.cyan}Goodbye${c.reset}`, [
              "",
              `${c.bold}Thanks for using WD Agent${c.reset}`,
              `${c.dim}Session: ${sessionStepCount} steps in ${elapsed}${c.reset}`,
              `${c.dim}worthdoing.ai${c.reset}`,
              "",
            ], c.cyan);
            console.log(`\n${exitBox}\n`);
            process.exit(0);
            break;
          }

          case "help":
            printHelp();
            break;

          case "clear":
            clearScreen();
            printBanner();
            printStatusBar(config, conv.meta.id);
            break;

          case "new":
            conv = convManager.create("New conversation");
            loop = new AgentLoop(config, conv);
            currentSessionId = conv.meta.id;
            sessionStepCount = 0;
            console.log(`\n  ${c.green}\u2713${c.reset} New conversation: ${c.dim}${conv.meta.id}${c.reset}`);
            break;

          case "list": {
            const conversations = convManager.list();
            if (conversations.length === 0) {
              console.log(`\n  ${c.dim}No conversations yet.${c.reset}`);
            } else {
              const listLines = conversations.map((cv) => {
                const isCurrent = cv.id === conv.meta.id;
                const marker = isCurrent
                  ? `${c.green}\u25b6${c.reset}`
                  : cv.status === "active"
                    ? `${c.green}\u25cf${c.reset}`
                    : `${c.dim}\u25cb${c.reset}`;
                return `${marker} ${c.cyan}${cv.id}${c.reset} ${c.bold}${cv.title}${c.reset} ${c.dim}(${cv.steps} steps)${c.reset}`;
              });
              const listBox = box(`${c.blue}Conversations${c.reset}`, ["", ...listLines, ""], c.blue);
              console.log(`\n${listBox}`);
            }
            break;
          }

          case "resume": {
            if (!cmdArgs[0]) {
              const errBox = box(`${c.red}Error${c.reset}`, [
                `${c.red}Usage: /resume <conversation-id>${c.reset}`,
              ], c.red);
              console.log(`\n${errBox}`);
              break;
            }
            const loaded = convManager.load(cmdArgs[0]);
            if (loaded) {
              conv = loaded;
              loop = new AgentLoop(config, conv);
              console.log(`\n  ${c.green}\u2713${c.reset} Resumed: ${c.bold}${conv.meta.title}${c.reset}`);
            } else {
              const errBox = box(`${c.red}Error${c.reset}`, [
                `${c.red}Not found: ${cmdArgs[0]}${c.reset}`,
              ], c.red);
              console.log(`\n${errBox}`);
            }
            break;
          }

          case "steps": {
            const steps = conv.getSteps();
            if (steps.length === 0) {
              console.log(`\n  ${c.dim}No steps yet.${c.reset}`);
            } else {
              const recentSteps = steps.slice(-10);
              const stepLines = recentSteps.map((s) => {
                const dur = formatDuration(s.result.duration_ms);
                return `${c.dim}[${s.step}]${c.reset} ${formatAction(s.action)} ${c.dim}${dur}${c.reset}`;
              });
              const stepsBox = box(`${c.blue}Steps${c.reset}`, ["", ...stepLines, ""], c.blue);
              console.log(`\n${stepsBox}`);
            }
            break;
          }

          case "caps": {
            const capList = loop.listCapabilities();
            const capLines = capList.map((cap) => `${c.cyan}\u25b8${c.reset} ${c.bold}${cap}${c.reset}`);
            const capsBox = box(`${c.magenta}Capabilities${c.reset}`, ["", ...capLines, ""], c.magenta);
            console.log(`\n${capsBox}`);
            break;
          }

          case "model": {
            const curConfig = loadConfig();
            if (curConfig.provider === "openrouter" && curConfig.openrouterApiKey) {
              const newModel = await selectOpenRouterModel(rl, curConfig.openrouterApiKey);
              saveConfig({ model: newModel });
              config = loadConfig();
              loop = new AgentLoop(config, conv);
              console.log(`\n  ${c.green}\u2713${c.reset} Model changed to: ${c.bold}${newModel}${c.reset}`);
            } else if (cmdArgs[0]) {
              saveConfig({ model: cmdArgs[0] });
              config = loadConfig();
              loop = new AgentLoop(config, conv);
              console.log(`\n  ${c.green}\u2713${c.reset} Model changed to: ${c.bold}${cmdArgs[0]}${c.reset}`);
            } else {
              console.log(`\n  ${c.dim}Current model: ${curConfig.model}${c.reset}`);
              console.log(`  ${c.dim}Usage: /model <model-id>${c.reset}`);
              console.log(`  ${c.dim}Use OpenRouter provider for interactive model browser.${c.reset}`);
            }
            break;
          }

          case "config": {
            const currentConfig = loadConfig();
            const configLines = [
              "",
              `${c.dim}Provider${c.reset}    ${c.bold}${currentConfig.provider}${c.reset}`,
              `${c.dim}Model${c.reset}       ${c.bold}${currentConfig.model}${c.reset}`,
              `${c.dim}Max Steps${c.reset}   ${c.bold}${currentConfig.maxSteps}${c.reset}`,
              `${c.dim}Confirm${c.reset}     ${c.bold}${currentConfig.confirmShell}${c.reset}`,
              `${c.dim}Anthropic${c.reset}   ${currentConfig.anthropicApiKey ? `${c.green}\u2713 Set${c.reset}` : `${c.red}\u2717 Not set${c.reset}`}`,
              `${c.dim}OpenRouter${c.reset}  ${currentConfig.openrouterApiKey ? `${c.green}\u2713 Set${c.reset}` : `${c.red}\u2717 Not set${c.reset}`}`,
              "",
            ];
            const configBox = box(`${c.yellow}Configuration${c.reset}`, configLines, c.yellow);
            console.log(`\n${configBox}`);
            break;
          }

          default: {
            const errBox = box(`${c.red}Error${c.reset}`, [
              `${c.red}Unknown command: /${cmd}${c.reset}`,
            ], c.red);
            console.log(`\n${errBox}`);
          }
        }

        askPrompt();
        return;
      }

      // ------------------------------------------------------------------
      // Regular message — send to agent loop
      // ------------------------------------------------------------------
      console.log();
      await runAgentLoop(loop, trimmed, config.maxSteps);
      askPrompt();
    });
  };

  askPrompt();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // ---- Non-interactive commands ----

  if (args[0] === "version" || args[0] === "--version" || args[0] === "-v") {
    console.log(`${c.cyan}${c.bold}wd-agent${c.reset} ${c.dim}v0.1.0${c.reset} ${c.dim}by WorthDoing AI${c.reset}`);
    process.exit(0);
  }

  if (args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    printBanner();
    printHelp();
    process.exit(0);
  }

  // ---- Set up readline ----

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  clearScreen();
  printBanner();

  // ---- API key / Provider setup ----

  let config = loadConfig();
  const hasKey = config.anthropicApiKey || config.openrouterApiKey;

  if (!hasKey) {
    try {
      const setup = await setupProvider(rl);
      if (setup.provider === "openrouter") {
        saveConfig({
          provider: "openrouter",
          openrouterApiKey: setup.apiKey,
          model: setup.model,
        });
      } else {
        saveConfig({
          provider: "anthropic",
          anthropicApiKey: setup.apiKey,
          model: setup.model,
        });
      }
      config = loadConfig();
      console.log(`\n  ${c.green}\u2713${c.reset} Configuration saved to ${c.dim}~/.wdagent/config.json${c.reset}\n`);
    } catch {
      const errBox = box(`${c.red}Error${c.reset}`, [
        `${c.red}Setup failed. Exiting.${c.reset}`,
      ], c.red);
      console.log(`\n${errBox}\n`);
      process.exit(1);
    }
  } else {
    const providerLabel = config.provider === "openrouter" ? "OpenRouter" : "Anthropic";
    console.log(`  ${c.green}\u2713${c.reset} ${providerLabel} configured \u2014 model: ${c.bold}${config.model}${c.reset}\n`);
  }

  // ---- Conversation manager ----

  const convManager = new ConversationManager(config.conversationsDir);

  // ---- CLI: "run <task>" ----

  if (args[0] === "run" && args.length > 1) {
    const task = args.slice(1).join(" ");
    const taskBox = box(`${c.cyan}Task${c.reset}`, [
      `${c.bold}${task}${c.reset}`,
    ], c.cyan);
    console.log(`${taskBox}\n`);
    const conv = convManager.create(task);
    const loop = new AgentLoop(config, conv);

    // Show system info
    const capsCount = loop.listCapabilities().length;
    printSystemInfo(config, conv.meta.id, capsCount);

    await runAgentLoop(loop, task, config.maxSteps);

    // Drop into interactive mode after the run
    await interactiveLoop(rl, config, convManager, conv);
    return;
  }

  // ---- CLI: "list" ----

  if (args[0] === "list") {
    const conversations = convManager.list();
    if (conversations.length === 0) {
      console.log(`  ${c.dim}No conversations yet.${c.reset}\n`);
    } else {
      const listLines = conversations.map((cv) => {
        const marker =
          cv.status === "active" ? `${c.green}\u25cf${c.reset}` : `${c.dim}\u25cb${c.reset}`;
        return `${marker} ${c.cyan}${cv.id}${c.reset} ${c.bold}${cv.title}${c.reset} ${c.dim}(${cv.steps} steps)${c.reset}`;
      });
      const listBox = box(`${c.blue}Conversations${c.reset}`, ["", ...listLines, ""], c.blue);
      console.log(`${listBox}\n`);
    }
    process.exit(0);
  }

  // ---- CLI: "resume <id>" ----

  if (args[0] === "resume" && args[1]) {
    const conv = convManager.load(args[1]);
    if (!conv) {
      const errBox = box(`${c.red}Error${c.reset}`, [
        `${c.red}Conversation not found: ${args[1]}${c.reset}`,
      ], c.red);
      console.log(`${errBox}\n`);
      process.exit(1);
    }
    console.log(`  ${c.green}\u2713${c.reset} Resumed conversation: ${c.bold}${conv.meta.title}${c.reset}\n`);

    // Show system info
    const tempLoop = new AgentLoop(config, conv);
    const capsCount = tempLoop.listCapabilities().length;
    printSystemInfo(config, conv.meta.id, capsCount);

    await interactiveLoop(rl, config, convManager, conv);
    return;
  }

  // ---- Default: new interactive session ----

  const conv = convManager.create("New conversation");
  currentSessionId = conv.meta.id;
  sessionStartTime = Date.now();
  sessionStepCount = 0;

  // Show system info with capabilities count
  const tempLoop = new AgentLoop(config, conv);
  const capsCount = tempLoop.listCapabilities().length;
  printSystemInfo(config, conv.meta.id, capsCount);

  await interactiveLoop(rl, config, convManager, conv);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
main().catch((err: unknown) => {
  const errBox = box(`${c.red}Fatal Error${c.reset}`, [
    `${c.red}${err instanceof Error ? err.message : String(err)}${c.reset}`,
  ], c.red);
  console.error(errBox);
  process.exit(1);
});
