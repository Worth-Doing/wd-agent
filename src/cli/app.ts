import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
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
  bgWhite: "\x1b[47m",
};

// ---------------------------------------------------------------------------
// Token / cost tracking
// ---------------------------------------------------------------------------
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalCostUSD: number;
}

const sessionTokens: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalCostUSD: 0,
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(4)}`;
}

// Estimate token usage from step (heuristic: 1 token ~ 4 chars)
function estimateTokenUsage(userMsg: string, step: StepRecord): void {
  const inputEst = Math.ceil(userMsg.length / 4) + 500; // system prompt overhead
  const outputEst = Math.ceil(
    (step.thought.length + JSON.stringify(step.action).length) / 4,
  );
  sessionTokens.inputTokens += inputEst;
  sessionTokens.outputTokens += outputEst;
  // Rough Claude pricing: $15/M input, $75/M output (Opus)
  sessionTokens.totalCostUSD +=
    (inputEst / 1_000_000) * 15 + (outputEst / 1_000_000) * 75;
}

// ---------------------------------------------------------------------------
// Box-drawing helper -- premium bordered panels
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
  const termWidth = process.stdout.columns || 80;
  const width = Math.min(termWidth - 6, 72);
  const innerWidth = width - 2;

  const titleClean = stripAnsi(title);
  const dashCount = Math.max(0, width - titleClean.length - 4);
  const top = `  ${color}\u250c\u2500 ${c.reset}${c.bold}${title}${c.reset}${color} ${"\u2500".repeat(dashCount)}\u2510${c.reset}`;
  const bottom = `  ${color}\u2514${"\u2500".repeat(width)}\u2518${c.reset}`;

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

// ---------------------------------------------------------------------------
// Left-border rendering for long responses
// ---------------------------------------------------------------------------
function renderWithLeftBorder(
  text: string,
  borderColor: string = c.dim,
  borderChar: string = "\u2502",
): void {
  const termWidth = process.stdout.columns || 80;
  const maxWidth = Math.min(termWidth - 8, 76);
  const lines = wrapText(text, maxWidth);

  for (const line of lines) {
    console.log(`  ${borderColor}${borderChar}${c.reset} ${line}`);
  }
}

function renderErrorBlock(text: string): void {
  const lines = text.split("\n");
  for (const line of lines) {
    console.log(`  ${c.red}\u2503${c.reset} ${c.red}${line}${c.reset}`);
  }
}

// ---------------------------------------------------------------------------
// Markdown-lite formatting for agent responses
// ---------------------------------------------------------------------------
function formatResponseText(text: string): string {
  // Bold: **text**
  let formatted = text.replace(
    /\*\*([^*]+)\*\*/g,
    `${c.bold}$1${c.reset}`,
  );
  // Bullet points: leading "- " or "* "
  formatted = formatted.replace(
    /^(\s*)[*-]\s+/gm,
    `$1${c.cyan}\u2022${c.reset} `,
  );
  // Inline code: `code`
  formatted = formatted.replace(
    /`([^`]+)`/g,
    `${c.yellow}$1${c.reset}`,
  );
  return formatted;
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
  const providerLabel =
    config.provider === "openrouter" ? "OpenRouter" : "Anthropic";
  const modelShort =
    config.model.length > 20
      ? config.model.slice(0, 20) + "\u2026"
      : config.model;
  const statusBox = box(`${c.cyan}Status${c.reset}`, [
    `${c.dim}Provider:${c.reset} ${c.bold}${providerLabel}${c.reset}   ${c.dim}Model:${c.reset} ${c.bold}${modelShort}${c.reset}`,
    `${c.dim}Session:${c.reset}  ${c.gray}${convId}${c.reset}   ${c.dim}Steps:${c.reset} ${sessionStepCount}`,
  ], c.cyan);
  console.log(`${statusBox}\n`);
}

function printSystemInfo(
  config: AgentConfig,
  convId: string,
  capsCount: number,
): void {
  const providerLabel =
    config.provider === "openrouter" ? "OpenRouter" : "Anthropic";
  const nodeVer = process.version;
  const sysBox = box(`${c.green}System${c.reset}`, [
    `${c.dim}Node${c.reset}      ${c.bold}${nodeVer}${c.reset}`,
    `${c.dim}Provider${c.reset}  ${c.bold}${providerLabel}${c.reset}`,
    `${c.dim}Model${c.reset}     ${c.bold}${config.model}${c.reset}`,
    `${c.dim}Caps${c.reset}      ${c.green}${capsCount} capabilities loaded${c.reset}`,
    `${c.dim}Session${c.reset}   ${c.gray}${convId}${c.reset}`,
  ], c.green);
  console.log(`${sysBox}`);
  console.log(
    `\n  ${c.dim}Type a message to start, or ${c.reset}${c.cyan}/help${c.reset}${c.dim} for commands.${c.reset}\n`,
  );
}

// ---------------------------------------------------------------------------
// Help -- clean aligned text without heavy boxes
// ---------------------------------------------------------------------------
function printHelp(): void {
  console.log();
  console.log(`  ${c.bold}${c.cyan}Commands${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(44)}${c.reset}`);

  const commands: [string, string][] = [
    ["/help", "Show this help"],
    ["/new", "Start a new conversation"],
    ["/list", "List conversations"],
    ["/resume <id>", "Resume a conversation"],
    ["/config", "Show/edit configuration"],
    ["/model", "Change model (scrollable list for OpenRouter)"],
    ["/caps", "List available capabilities"],
    ["/steps", "Show steps in current conversation"],
    ["/tokens", "Show token usage for this session"],
    ["/compact", "Trigger context compaction"],
    ["/workspace", "Show workspace path and files"],
    ["/clear", "Clear screen"],
    ["/exit", "Exit the agent"],
  ];

  for (const [cmd, desc] of commands) {
    const padded = cmd.padEnd(18);
    console.log(`  ${c.cyan}${padded}${c.reset}${c.dim}${desc}${c.reset}`);
  }
  console.log();
  console.log(
    `  ${c.dim}Or just type a message to chat with the agent.${c.reset}`,
  );
  console.log();
}

// ---------------------------------------------------------------------------
// Setup prompts
// ---------------------------------------------------------------------------
function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function setupProvider(
  rl: readline.Interface,
): Promise<{ provider: "anthropic" | "openrouter"; apiKey: string; model: string }> {
  const setupLines = [
    "",
    `${c.bold}Choose your AI provider to get started.${c.reset}`,
    "",
    `${c.cyan}1${c.reset}  Anthropic (Claude API direct)`,
    `${c.cyan}2${c.reset}  OpenRouter (350+ models)`,
    "",
  ];
  console.log(
    `\n${box(`${c.yellow}Setup Required${c.reset}`, setupLines, c.yellow)}\n`,
  );

  const choice = await ask(
    rl,
    `  ${c.cyan}\u276f${c.reset} ${c.bold}Choice [1/2]:${c.reset} `,
  );

  if (choice === "2") {
    console.log(
      `\n  ${c.dim}Get an API key at: https://openrouter.ai/settings/keys${c.reset}\n`,
    );
    const apiKey = await ask(
      rl,
      `  ${c.cyan}\u276f${c.reset} ${c.bold}OpenRouter API Key:${c.reset} `,
    );
    if (!apiKey) throw new Error("No API key provided");

    console.log(`\n  ${c.dim}Fetching available models...${c.reset}`);
    const model = await selectOpenRouterModelInteractive(rl, apiKey);

    return { provider: "openrouter", apiKey, model };
  }

  console.log(
    `\n  ${c.dim}Get an API key at: https://console.anthropic.com/settings/keys${c.reset}\n`,
  );
  const apiKey = await ask(
    rl,
    `  ${c.cyan}\u276f${c.reset} ${c.bold}Anthropic API Key:${c.reset} `,
  );
  if (!apiKey) throw new Error("No API key provided");

  return { provider: "anthropic", apiKey, model: "claude-opus-4-6" };
}

// ---------------------------------------------------------------------------
// OpenRouter model -- interactive scrollable list
// ---------------------------------------------------------------------------
interface ModelInfo {
  id: string;
  name: string;
  context: number;
  promptPrice: string;
}

async function selectOpenRouterModelInteractive(
  rl: readline.Interface,
  apiKey: string,
): Promise<string> {
  let allModels: ModelInfo[];

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = (await response.json()) as any;

    allModels = ((data.data as any[]) || []).map((m: any) => ({
      id: m.id as string,
      name: (m.name || m.id) as string,
      context: (m.context_length || 0) as number,
      promptPrice: (m.pricing?.prompt || "0") as string,
    }));
  } catch {
    console.log(
      `  ${c.yellow}Could not fetch models. Defaulting to anthropic/claude-opus-4-6${c.reset}`,
    );
    return "anthropic/claude-opus-4-6";
  }

  if (allModels.length === 0) {
    console.log(
      `  ${c.yellow}No models returned. Defaulting to anthropic/claude-opus-4-6${c.reset}`,
    );
    return "anthropic/claude-opus-4-6";
  }

  // Sort: popular providers first
  const providerOrder = [
    "anthropic",
    "openai",
    "google",
    "meta-llama",
    "deepseek",
    "mistralai",
  ];
  allModels.sort((a, b) => {
    const aProvider = a.id.split("/")[0];
    const bProvider = b.id.split("/")[0];
    const aIdx = providerOrder.indexOf(aProvider);
    const bIdx = providerOrder.indexOf(bProvider);
    const aOrder = aIdx === -1 ? 999 : aIdx;
    const bOrder = bIdx === -1 ? 999 : bIdx;
    return aOrder - bOrder;
  });

  // Close readline temporarily to use raw mode for interactive selection
  rl.close();

  const selected = await rawModeModelSelector(allModels);

  return selected;
}

function rawModeModelSelector(allModels: ModelInfo[]): Promise<string> {
  return new Promise<string>((resolve) => {
    let filteredModels = [...allModels];
    let selectedIdx = 0;
    let scrollOffset = 0;
    let searchQuery = "";
    const viewportSize = 15;

    // Enable raw mode for keypress events
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    readline.emitKeypressEvents(process.stdin);

    function render(): void {
      // Filter models based on search
      if (searchQuery) {
        filteredModels = allModels.filter(
          (m) =>
            m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      } else {
        filteredModels = [...allModels];
      }

      // Clamp selection
      if (selectedIdx >= filteredModels.length) {
        selectedIdx = Math.max(0, filteredModels.length - 1);
      }

      // Adjust scroll window
      if (selectedIdx < scrollOffset) scrollOffset = selectedIdx;
      if (selectedIdx >= scrollOffset + viewportSize) {
        scrollOffset = selectedIdx - viewportSize + 1;
      }

      // Clear screen and draw
      process.stdout.write("\x1b[2J\x1b[H");

      console.log(
        `\n${box(
          "Select Model",
          [
            "",
            `${c.dim}${filteredModels.length} models available${c.reset}  ${c.dim}(${allModels.length} total)${c.reset}`,
            "",
            `${c.cyan}Search:${c.reset} ${searchQuery || c.dim + "type to filter..." + c.reset}`,
            "",
          ],
          c.cyan,
        )}\n`,
      );

      // Viewport
      const visible = filteredModels.slice(
        scrollOffset,
        scrollOffset + viewportSize,
      );
      const hasMoreBelow =
        scrollOffset + viewportSize < filteredModels.length;
      const hasMoreAbove = scrollOffset > 0;

      if (hasMoreAbove) {
        console.log(
          `  ${c.dim}  \u2191 ${scrollOffset} more above${c.reset}`,
        );
      }

      if (filteredModels.length === 0) {
        console.log(`  ${c.dim}  No matching models.${c.reset}`);
      }

      for (let i = 0; i < visible.length; i++) {
        const model = visible[i];
        const globalIdx = scrollOffset + i;
        const isSelected = globalIdx === selectedIdx;
        const ctxK = model.context
          ? `${Math.round(model.context / 1000)}K`
          : "?";
        const price = parseFloat(model.promptPrice);
        const priceStr =
          price > 0
            ? `$${(price * 1_000_000).toFixed(2)}/M`
            : `${c.green}free${c.reset}`;

        if (isSelected) {
          console.log(
            `  ${c.bgCyan}${c.bold} \u25b8 ${c.reset} ${c.bold}${model.id}${c.reset}  ${c.dim}${ctxK} ctx${c.reset}  ${c.dim}${priceStr}${c.reset}`,
          );
        } else {
          console.log(
            `    ${c.gray}${model.id}${c.reset}  ${c.dim}${ctxK}${c.reset}  ${c.dim}${priceStr}${c.reset}`,
          );
        }
      }

      if (hasMoreBelow) {
        console.log(
          `  ${c.dim}  \u2193 ${filteredModels.length - scrollOffset - viewportSize} more below${c.reset}`,
        );
      }

      console.log(
        `\n  ${c.dim}\u2191/\u2193 scroll \u00b7 type to search \u00b7 enter to select \u00b7 esc to cancel${c.reset}`,
      );
    }

    render();

    function onKeypress(
      _str: string | undefined,
      key: readline.Key,
    ): void {
      if (!key) return;

      if (key.name === "escape" || (key.ctrl && key.name === "c")) {
        cleanup();
        resolve("anthropic/claude-opus-4-6");
        return;
      }

      if (key.name === "return") {
        const selected = filteredModels[selectedIdx];
        cleanup();
        resolve(selected?.id || "anthropic/claude-opus-4-6");
        return;
      }

      if (key.name === "up") {
        selectedIdx = Math.max(0, selectedIdx - 1);
        render();
        return;
      }

      if (key.name === "down") {
        selectedIdx = Math.min(
          filteredModels.length - 1,
          selectedIdx + 1,
        );
        render();
        return;
      }

      if (key.name === "pageup") {
        selectedIdx = Math.max(0, selectedIdx - viewportSize);
        render();
        return;
      }

      if (key.name === "pagedown") {
        selectedIdx = Math.min(
          filteredModels.length - 1,
          selectedIdx + viewportSize,
        );
        render();
        return;
      }

      if (key.name === "backspace") {
        searchQuery = searchQuery.slice(0, -1);
        selectedIdx = 0;
        scrollOffset = 0;
        render();
        return;
      }

      // Regular character -- add to search
      if (
        key.sequence &&
        key.sequence.length === 1 &&
        !key.ctrl &&
        !key.meta
      ) {
        searchQuery += key.sequence;
        selectedIdx = 0;
        scrollOffset = 0;
        render();
      }
    }

    function cleanup(): void {
      process.stdin.removeListener("keypress", onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
    }

    process.stdin.on("keypress", onKeypress);
  });
}

// After interactive selection, create a fresh readline
function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
}

// ---------------------------------------------------------------------------
// Spinner -- braille dots with elapsed time
// ---------------------------------------------------------------------------
interface Spinner {
  stop: (result?: string) => void;
}

const spinnerFrames = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];

function showSpinner(message: string): Spinner {
  let i = 0;
  const startTime = Date.now();
  const interval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(
      `\r  ${c.cyan}${spinnerFrames[i % spinnerFrames.length]}${c.reset} ${c.dim}${message}${c.reset} ${c.dim}(${elapsed}s)${c.reset}   `,
    );
    i++;
  }, 80);

  return {
    stop(result?: string): void {
      clearInterval(interval);
      if (result) {
        process.stdout.write(
          `\r  ${c.green}\u2713${c.reset} ${result}${" ".repeat(40)}\n`,
        );
      } else {
        process.stdout.write(`\r${" ".repeat(80)}\r`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Format elapsed time
// ---------------------------------------------------------------------------
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDurationCompact(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

// ---------------------------------------------------------------------------
// Action badges with icons and duration
// ---------------------------------------------------------------------------
function renderActionBadge(action: AgentAction, durationMs: number): void {
  const durStr = `${c.dim}${formatDurationCompact(durationMs).padStart(8)}${c.reset}`;

  switch (action.type) {
    case "shell": {
      const cmd = action.command ?? "";
      const cmdShort = cmd.length > 50 ? cmd.slice(0, 47) + "..." : cmd;
      console.log(
        `  \u26a1 ${c.yellow}shell${c.reset}    ${c.bold}${cmdShort}${c.reset}  ${durStr}`,
      );
      break;
    }
    case "capability": {
      const inputPreview = action.input
        ? ` ${c.dim}${JSON.stringify(action.input).slice(0, 40)}${c.reset}`
        : "";
      console.log(
        `  \ud83d\udd0c ${c.magenta}${(action.name ?? "").padEnd(8)}${c.reset}${inputPreview}  ${durStr}`,
      );
      break;
    }
    case "file": {
      const op = action.operation ?? "?";
      const filePath = action.path ?? "";
      const sizeInfo =
        action.content != null
          ? ` (${formatBytes(action.content.length)})`
          : "";
      console.log(
        `  \ud83d\udcc4 ${c.blue}${op.padEnd(8)}${c.reset} ${filePath}${c.dim}${sizeInfo}${c.reset}  ${durStr}`,
      );
      break;
    }
    case "spawn_agent":
      console.log(
        `  \ud83e\udd16 ${c.cyan}agent${c.reset}    ${c.bold}${action.agentName ?? "agent"}${c.reset}: ${action.task ?? ""}  ${durStr}`,
      );
      break;
    case "message":
      console.log(`  \u2705 ${c.green}done${c.reset}  ${durStr}`);
      break;
    case "done":
      console.log(`  \u2705 ${c.green}done${c.reset}  ${durStr}`);
      break;
    default:
      console.log(
        `  ${c.dim}${action.type}${c.reset}  ${durStr}`,
      );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Render capability result -- compact preview
// ---------------------------------------------------------------------------
function renderCapabilityResult(output: unknown): void {
  if (output == null) return;
  let preview: string;
  if (typeof output === "object") {
    preview = JSON.stringify(output, null, 2);
  } else {
    preview = String(output);
  }

  // Show first 3 lines or 200 chars
  const lines = preview.split("\n");
  const previewLines = lines.slice(0, 3);
  let joined = previewLines.join("\n");
  if (joined.length > 200) {
    joined = joined.slice(0, 200);
  }
  const truncated = lines.length > 3 || preview.length > 200;

  console.log(`  ${c.dim}\u250c\u2500 result${c.reset}`);
  for (const line of joined.split("\n")) {
    console.log(`  ${c.dim}\u2502${c.reset} ${c.dim}${line}${c.reset}`);
  }
  if (truncated) {
    const remaining = lines.length - 3;
    console.log(
      `  ${c.dim}\u2502 ... ${remaining > 0 ? `${remaining} more lines` : "truncated"}${c.reset}`,
    );
  }
  console.log(`  ${c.dim}\u2514\u2500${c.reset}`);
}

// ---------------------------------------------------------------------------
// Render step output (for /steps)
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
// Format action for /steps display
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
// Token usage line
// ---------------------------------------------------------------------------
function printTokenUsage(): void {
  const inTok = formatTokens(sessionTokens.inputTokens);
  const outTok = formatTokens(sessionTokens.outputTokens);
  const cost = formatCost(sessionTokens.totalCostUSD);
  console.log(
    `  ${c.dim}tokens: ${inTok} in \u00b7 ${outTok} out \u00b7 ${cost}${c.reset}`,
  );
}

// ---------------------------------------------------------------------------
// Session bar -- compact status line between interactions
// ---------------------------------------------------------------------------
function printSessionBar(
  config: AgentConfig,
  convId: string,
): void {
  const modelShort = config.model.includes("/")
    ? config.model.split("/")[1]
    : config.model;
  const totalTok = formatTokens(
    sessionTokens.inputTokens + sessionTokens.outputTokens,
  );
  const termWidth = process.stdout.columns || 80;
  const content = ` step ${sessionStepCount} \u00b7 ${convId} \u00b7 ${modelShort} \u00b7 ${totalTok} tokens `;
  const dashCount = Math.max(
    0,
    Math.floor((termWidth - stripAnsi(content).length - 4) / 2),
  );
  const left = "\u2500".repeat(dashCount);
  const right = "\u2500".repeat(dashCount);
  console.log(`  ${c.dim}${left}${content}${right}${c.reset}`);
}

// ---------------------------------------------------------------------------
// Agent execution loop -- runs steps until "message" or "done"
// ---------------------------------------------------------------------------
async function runAgentLoop(
  loop: AgentLoop,
  userMessage: string,
  maxSteps: number,
  config: AgentConfig,
  convId: string,
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
      console.log();
      renderErrorBlock(`Error: ${errMsg}`);
      console.log();
      return;
    }

    const stepElapsed = Date.now() - stepStart;

    // Estimate token usage
    estimateTokenUsage(messageForStep || "", result);

    // After the first step, subsequent steps should not re-send the user
    // message -- the agent is continuing from its own prior output.
    messageForStep = "";

    const actionType = result.action.type;

    if (actionType === "message" || actionType === "done") {
      // Final answer
      spinner.stop();
      const text = result.action.text ?? "Task completed.";
      const formatted = formatResponseText(text);

      // Show thought if present
      if (result.thought && result.thought.length > 0) {
        console.log(
          `  ${c.dim}${c.italic}\ud83d\udcad ${result.thought}${c.reset}`,
        );
      }

      console.log();

      // Use left-border rendering for the response
      renderWithLeftBorder(formatted, c.green);

      console.log();

      // Token usage
      printTokenUsage();

      // Session bar
      printSessionBar(config, convId);

      return;
    }

    // Intermediate action
    spinner.stop();

    // Show thought on its own dim italic line
    if (result.thought && result.thought.length > 0) {
      console.log(
        `  ${c.dim}${c.italic}\ud83d\udcad ${result.thought}${c.reset}`,
      );
    }

    // Action badge with duration
    renderActionBadge(result.action, stepElapsed);

    // Compact result preview
    if (result.result?.output != null) {
      renderCapabilityResult(result.result.output);
    }

    // If there was an error, show it
    if (result.result?.error) {
      console.log();
      renderErrorBlock(result.result.error);
    }

    console.log();

    // Guard against infinite loops
    if (stepCount >= maxSteps) {
      console.log();
      renderErrorBlock(`Max steps (${maxSteps}) reached. Stopping.`);
      console.log();
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
  let currentRl = rl;

  const askPrompt = (): void => {
    currentRl.question(
      `\n  ${c.cyan}${c.bold}\u276f${c.reset} `,
      async (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) {
          askPrompt();
          return;
        }

        // ----------------------------------------------------------------
        // Slash commands
        // ----------------------------------------------------------------
        if (trimmed.startsWith("/")) {
          const parts = trimmed.slice(1).split(" ");
          const cmd = parts[0];
          const cmdArgs = parts.slice(1);

          switch (cmd) {
            case "exit":
            case "quit":
            case "q": {
              const elapsed = formatDuration(Date.now() - sessionStartTime);
              console.log();
              console.log(
                `  ${c.cyan}${c.bold}Goodbye${c.reset}`,
              );
              console.log(
                `  ${c.dim}Session: ${sessionStepCount} steps in ${elapsed}${c.reset}`,
              );
              printTokenUsage();
              console.log(
                `  ${c.dim}worthdoing.ai${c.reset}`,
              );
              console.log();
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
              sessionTokens.inputTokens = 0;
              sessionTokens.outputTokens = 0;
              sessionTokens.totalCostUSD = 0;
              console.log(
                `\n  ${c.green}\u2713${c.reset} New conversation: ${c.dim}${conv.meta.id}${c.reset}`,
              );
              break;

            case "list": {
              const conversations = convManager.list();
              if (conversations.length === 0) {
                console.log(
                  `\n  ${c.dim}No conversations yet.${c.reset}`,
                );
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
                const listBox = box(
                  `${c.blue}Conversations${c.reset}`,
                  ["", ...listLines, ""],
                  c.blue,
                );
                console.log(`\n${listBox}`);
              }
              break;
            }

            case "resume": {
              if (!cmdArgs[0]) {
                console.log();
                renderErrorBlock("Usage: /resume <conversation-id>");
                break;
              }
              const loaded = convManager.load(cmdArgs[0]);
              if (loaded) {
                conv = loaded;
                loop = new AgentLoop(config, conv);
                console.log(
                  `\n  ${c.green}\u2713${c.reset} Resumed: ${c.bold}${conv.meta.title}${c.reset}`,
                );
              } else {
                console.log();
                renderErrorBlock(`Not found: ${cmdArgs[0]}`);
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
                const stepsBox = box(
                  `${c.blue}Steps${c.reset}`,
                  ["", ...stepLines, ""],
                  c.blue,
                );
                console.log(`\n${stepsBox}`);
              }
              break;
            }

            case "caps": {
              const capList = loop.listCapabilities();
              const capLines = capList.map(
                (cap) =>
                  `${c.cyan}\u25b8${c.reset} ${c.bold}${cap}${c.reset}`,
              );
              const capsBox = box(
                `${c.magenta}Capabilities${c.reset}`,
                ["", ...capLines, ""],
                c.magenta,
              );
              console.log(`\n${capsBox}`);
              break;
            }

            case "tokens": {
              console.log();
              console.log(`  ${c.bold}${c.cyan}Token Usage${c.reset}`);
              console.log(`  ${c.dim}${"─".repeat(30)}${c.reset}`);
              console.log(
                `  ${c.dim}Input:${c.reset}    ${c.bold}${formatTokens(sessionTokens.inputTokens)}${c.reset}`,
              );
              console.log(
                `  ${c.dim}Output:${c.reset}   ${c.bold}${formatTokens(sessionTokens.outputTokens)}${c.reset}`,
              );
              console.log(
                `  ${c.dim}Total:${c.reset}    ${c.bold}${formatTokens(sessionTokens.inputTokens + sessionTokens.outputTokens)}${c.reset}`,
              );
              console.log(
                `  ${c.dim}Est cost:${c.reset} ${c.bold}${formatCost(sessionTokens.totalCostUSD)}${c.reset}`,
              );
              console.log();
              break;
            }

            case "compact": {
              console.log(
                `\n  ${c.dim}Compacting context... (experimental)${c.reset}`,
              );
              // Start a fresh loop with existing conversation
              loop = new AgentLoop(config, conv);
              console.log(
                `  ${c.green}\u2713${c.reset} Context compacted. New loop initialized.`,
              );
              break;
            }

            case "workspace": {
              const wsPath = conv.workspacePath;
              console.log();
              console.log(`  ${c.bold}${c.cyan}Workspace${c.reset}`);
              console.log(`  ${c.dim}${"─".repeat(30)}${c.reset}`);
              console.log(
                `  ${c.dim}Path:${c.reset} ${c.bold}${wsPath}${c.reset}`,
              );
              try {
                const entries = fs.readdirSync(wsPath);
                if (entries.length === 0) {
                  console.log(
                    `  ${c.dim}(empty)${c.reset}`,
                  );
                } else {
                  const maxShow = 20;
                  const toShow = entries.slice(0, maxShow);
                  for (const entry of toShow) {
                    const fullPath = path.join(wsPath, entry);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                      console.log(
                        `  ${c.blue}\u25b8${c.reset} ${c.bold}${entry}/${c.reset}`,
                      );
                    } else {
                      console.log(
                        `  ${c.dim}\u25b8${c.reset} ${entry} ${c.dim}(${formatBytes(stat.size)})${c.reset}`,
                      );
                    }
                  }
                  if (entries.length > maxShow) {
                    console.log(
                      `  ${c.dim}... and ${entries.length - maxShow} more${c.reset}`,
                    );
                  }
                }
              } catch {
                console.log(
                  `  ${c.dim}(could not read workspace)${c.reset}`,
                );
              }
              console.log();
              break;
            }

            case "model": {
              const curConfig = loadConfig();
              if (
                curConfig.provider === "openrouter" &&
                curConfig.openrouterApiKey
              ) {
                console.log(
                  `\n  ${c.dim}Fetching models...${c.reset}`,
                );

                // Need to close readline for raw mode
                currentRl.close();

                try {
                  const newModel =
                    await selectOpenRouterModelInteractive(
                      currentRl,
                      curConfig.openrouterApiKey,
                    );
                  saveConfig({ model: newModel });
                  config = loadConfig();

                  // Restore readline
                  currentRl = createReadline();
                  loop = new AgentLoop(config, conv);

                  clearScreen();
                  console.log(
                    `\n  ${c.green}\u2713${c.reset} Model changed to: ${c.bold}${newModel}${c.reset}\n`,
                  );
                } catch {
                  // Restore readline on failure
                  currentRl = createReadline();
                  console.log(
                    `\n  ${c.yellow}Model selection failed.${c.reset}\n`,
                  );
                }
              } else if (cmdArgs[0]) {
                saveConfig({ model: cmdArgs[0] });
                config = loadConfig();
                loop = new AgentLoop(config, conv);
                console.log(
                  `\n  ${c.green}\u2713${c.reset} Model changed to: ${c.bold}${cmdArgs[0]}${c.reset}`,
                );
              } else {
                console.log(
                  `\n  ${c.dim}Current model: ${curConfig.model}${c.reset}`,
                );
                console.log(
                  `  ${c.dim}Usage: /model <model-id>${c.reset}`,
                );
                console.log(
                  `  ${c.dim}Use OpenRouter provider for interactive model browser.${c.reset}`,
                );
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
              const configBox = box(
                `${c.yellow}Configuration${c.reset}`,
                configLines,
                c.yellow,
              );
              console.log(`\n${configBox}`);
              break;
            }

            default: {
              console.log();
              renderErrorBlock(`Unknown command: /${cmd}`);
              console.log(
                `  ${c.dim}Type /help for available commands.${c.reset}`,
              );
            }
          }

          askPrompt();
          return;
        }

        // ----------------------------------------------------------------
        // Regular message -- send to agent loop
        // ----------------------------------------------------------------
        console.log();
        await runAgentLoop(
          loop,
          trimmed,
          config.maxSteps,
          config,
          conv.meta.id,
        );
        askPrompt();
      },
    );
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
    console.log(
      `${c.cyan}${c.bold}wd-agent${c.reset} ${c.dim}v0.1.0${c.reset} ${c.dim}by WorthDoing AI${c.reset}`,
    );
    process.exit(0);
  }

  if (args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    printBanner();
    printHelp();
    process.exit(0);
  }

  // ---- Set up readline ----

  let rl = createReadline();

  clearScreen();
  printBanner();

  // ---- API key / Provider setup ----

  let config = loadConfig();
  const hasKey = config.anthropicApiKey || config.openrouterApiKey;

  if (!hasKey) {
    try {
      const setup = await setupProvider(rl);

      // Restore readline after interactive model selection
      rl = createReadline();

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
      console.log(
        `\n  ${c.green}\u2713${c.reset} Configuration saved to ${c.dim}~/.wdagent/config.json${c.reset}\n`,
      );
    } catch {
      console.log();
      renderErrorBlock("Setup failed. Exiting.");
      console.log();
      process.exit(1);
    }
  } else {
    const providerLabel =
      config.provider === "openrouter" ? "OpenRouter" : "Anthropic";
    console.log(
      `  ${c.green}\u2713${c.reset} ${providerLabel} configured \u2014 model: ${c.bold}${config.model}${c.reset}\n`,
    );
  }

  // ---- Conversation manager ----

  const convManager = new ConversationManager(config.conversationsDir);

  // ---- CLI: "run <task>" ----

  if (args[0] === "run" && args.length > 1) {
    const task = args.slice(1).join(" ");
    const taskBox = box(
      `${c.cyan}Task${c.reset}`,
      [`${c.bold}${task}${c.reset}`],
      c.cyan,
    );
    console.log(`${taskBox}\n`);
    const conv = convManager.create(task);
    const loop = new AgentLoop(config, conv);

    const capsCount = loop.listCapabilities().length;
    printSystemInfo(config, conv.meta.id, capsCount);

    await runAgentLoop(loop, task, config.maxSteps, config, conv.meta.id);

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
          cv.status === "active"
            ? `${c.green}\u25cf${c.reset}`
            : `${c.dim}\u25cb${c.reset}`;
        return `${marker} ${c.cyan}${cv.id}${c.reset} ${c.bold}${cv.title}${c.reset} ${c.dim}(${cv.steps} steps)${c.reset}`;
      });
      const listBox = box(
        `${c.blue}Conversations${c.reset}`,
        ["", ...listLines, ""],
        c.blue,
      );
      console.log(`${listBox}\n`);
    }
    process.exit(0);
  }

  // ---- CLI: "resume <id>" ----

  if (args[0] === "resume" && args[1]) {
    const conv = convManager.load(args[1]);
    if (!conv) {
      renderErrorBlock(`Conversation not found: ${args[1]}`);
      console.log();
      process.exit(1);
    }
    console.log(
      `  ${c.green}\u2713${c.reset} Resumed conversation: ${c.bold}${conv.meta.title}${c.reset}\n`,
    );

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

  const tempLoop = new AgentLoop(config, conv);
  const capsCount = tempLoop.listCapabilities().length;
  printSystemInfo(config, conv.meta.id, capsCount);

  await interactiveLoop(rl, config, convManager, conv);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
main().catch((err: unknown) => {
  console.error();
  renderErrorBlock(
    `Fatal: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
