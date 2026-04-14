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
  underline: "\x1b[4m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

// ---------------------------------------------------------------------------
// Screen helpers
// ---------------------------------------------------------------------------
function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

function printBanner(): void {
  console.log(`
${c.cyan}${c.bold}  \u2566 \u2566\u2554\u2566\u2557  \u2554\u2550\u2557\u250c\u2500\u2510\u250c\u2500\u2510\u250c\u2510\u250c\u252c\u2500\u2510
  \u2551\u2551\u2551 \u2551\u2551  \u2560\u2550\u2563\u2502 \u2534\u251c\u2524 \u2502\u2502\u2502 \u2502
  \u255a\u2569\u255d\u2550\u2569\u255d  \u2569 \u2569\u2514\u2500\u2518\u2514\u2500\u2518\u2518\u2514\u2518 \u2534 ${c.reset}
  ${c.dim}\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501${c.reset}
  ${c.bold}Local AI Agent by WorthDoing AI${c.reset}
  ${c.dim}Powered by Claude Opus 4.6${c.reset}
  ${c.dim}\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501${c.reset}
`);
}

function printHelp(): void {
  console.log(`
  ${c.bold}Commands:${c.reset}

    ${c.cyan}/help${c.reset}          Show this help
    ${c.cyan}/new${c.reset}           Start a new conversation
    ${c.cyan}/list${c.reset}          List conversations
    ${c.cyan}/resume <id>${c.reset}   Resume a conversation
    ${c.cyan}/config${c.reset}        Show/edit configuration
    ${c.cyan}/caps${c.reset}          List available capabilities
    ${c.cyan}/steps${c.reset}         Show steps in current conversation
    ${c.cyan}/clear${c.reset}         Clear screen
    ${c.cyan}/exit${c.reset}          Exit the agent

  ${c.bold}Or just type a message to chat with the agent.${c.reset}
`);
}

// ---------------------------------------------------------------------------
// API key prompt
// ---------------------------------------------------------------------------
async function promptApiKey(rl: readline.Interface): Promise<string> {
  return new Promise((resolve) => {
    console.log(`\n  ${c.yellow}${c.bold}API Key Required${c.reset}`);
    console.log(`  ${c.dim}Enter your Anthropic API key to get started.${c.reset}`);
    console.log(`  ${c.dim}Get one at: https://console.anthropic.com/settings/keys${c.reset}\n`);
    rl.question(`  ${c.cyan}API Key: ${c.reset}`, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
interface Spinner {
  stop: (result?: string) => void;
}

function showSpinner(message: string): Spinner {
  const frames = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${c.cyan}${frames[i % frames.length]}${c.reset} ${c.dim}${message}${c.reset}  `);
    i++;
  }, 80);

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
// Format an action for display
// ---------------------------------------------------------------------------
function formatAction(action: AgentAction): string {
  if (!action) return "";
  switch (action.type) {
    case "shell":
      return `${c.yellow}Shell${c.reset} ${c.dim}\u2192${c.reset} ${c.bold}${action.command ?? ""}${c.reset}`;
    case "capability": {
      const inputPreview = action.input
        ? ` ${c.dim}${JSON.stringify(action.input).slice(0, 80)}${c.reset}`
        : "";
      return `${c.magenta}Capability${c.reset} ${c.dim}\u2192${c.reset} ${c.bold}${action.name ?? ""}${c.reset}${inputPreview}`;
    }
    case "file":
      return `${c.blue}File${c.reset} ${c.dim}\u2192${c.reset} ${c.bold}${action.operation ?? ""}${c.reset} ${action.path ?? ""}`;
    case "spawn_agent":
      return `${c.cyan}Sub-Agent${c.reset} ${c.dim}\u2192${c.reset} ${c.bold}${action.agentName ?? "agent"}${c.reset}: ${action.task ?? ""}`;
    case "message":
      return `${c.green}Message${c.reset}`;
    case "done":
      return `${c.green}Done${c.reset}`;
    default:
      return JSON.stringify(action);
  }
}

// ---------------------------------------------------------------------------
// Render step output preview
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
    preview = preview.slice(0, 500) + "...";
  }
  console.log(`  ${c.dim}${preview}${c.reset}\n`);
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
    const spinner = showSpinner("Thinking...");

    let result: StepRecord;
    try {
      result = await loop.step(messageForStep);
    } catch (err: unknown) {
      spinner.stop();
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`\n  ${c.red}${c.bold}Error:${c.reset} ${c.red}${errMsg}${c.reset}\n`);
      return;
    }

    // After the first step, subsequent steps should not re-send the user
    // message — the agent is continuing from its own prior output.
    messageForStep = "";

    const actionType = result.action.type;

    if (actionType === "message" || actionType === "done") {
      // Final answer — print it and return to prompt
      spinner.stop(formatAction(result.action));
      const text = result.action.text ?? "Task completed.";
      console.log(`\n  ${c.bold}agent \u276f${c.reset} ${text}\n`);
      return;
    }

    // Intermediate action — show what was done
    spinner.stop(formatAction(result.action));
    renderStepOutput(result.result?.output);

    // Guard against infinite loops
    if (stepCount >= maxSteps) {
      console.log(`  ${c.yellow}Max steps (${maxSteps}) reached.${c.reset}\n`);
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
    rl.question(`\n  ${c.green}${c.bold}you \u276f${c.reset} `, async (input: string) => {
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
          case "q":
            console.log(`\n  ${c.cyan}${c.bold}Thanks for using WD Agent${c.reset} ${c.dim}\u2014 worthdoing.ai${c.reset}\n`);
            process.exit(0);
            break;

          case "help":
            printHelp();
            break;

          case "clear":
            clearScreen();
            printBanner();
            break;

          case "new":
            conv = convManager.create("New conversation");
            loop = new AgentLoop(config, conv);
            console.log(`\n  ${c.green}\u2713${c.reset} New conversation: ${c.dim}${conv.meta.id}${c.reset}`);
            break;

          case "list": {
            const conversations = convManager.list();
            if (conversations.length === 0) {
              console.log(`\n  ${c.dim}No conversations yet.${c.reset}`);
            } else {
              console.log(`\n  ${c.bold}Conversations:${c.reset}\n`);
              for (const cv of conversations) {
                const isCurrent = cv.id === conv.meta.id;
                const marker = isCurrent
                  ? `${c.green}\u25b6${c.reset}`
                  : cv.status === "active"
                    ? `${c.green}\u25cf${c.reset}`
                    : `${c.dim}\u25cb${c.reset}`;
                console.log(
                  `  ${marker} ${c.cyan}${cv.id}${c.reset}  ${c.bold}${cv.title}${c.reset}  ${c.dim}(${cv.steps} steps)${c.reset}`,
                );
              }
            }
            break;
          }

          case "resume": {
            if (!cmdArgs[0]) {
              console.log(`\n  ${c.red}Usage: /resume <conversation-id>${c.reset}`);
              break;
            }
            const loaded = convManager.load(cmdArgs[0]);
            if (loaded) {
              conv = loaded;
              loop = new AgentLoop(config, conv);
              console.log(`\n  ${c.green}\u2713${c.reset} Resumed: ${c.bold}${conv.meta.title}${c.reset}`);
            } else {
              console.log(`\n  ${c.red}Not found: ${cmdArgs[0]}${c.reset}`);
            }
            break;
          }

          case "steps": {
            const steps = conv.getSteps();
            if (steps.length === 0) {
              console.log(`\n  ${c.dim}No steps yet.${c.reset}`);
            } else {
              console.log(`\n  ${c.bold}Steps:${c.reset}\n`);
              const recentSteps = steps.slice(-10);
              for (const s of recentSteps) {
                const durationLabel = s.result.duration_ms.toFixed(0);
                console.log(
                  `  ${c.dim}#${s.step}${c.reset} ${formatAction(s.action)} ${c.dim}(${durationLabel}ms)${c.reset}`,
                );
              }
            }
            break;
          }

          case "caps": {
            console.log(`\n  ${c.bold}Available Capabilities:${c.reset}\n`);
            const capList = loop.listCapabilities();
            for (const cap of capList) {
              console.log(`  ${c.cyan}\u25b8${c.reset} ${c.bold}${cap}${c.reset}`);
            }
            break;
          }

          case "config": {
            const currentConfig = loadConfig();
            console.log(`\n  ${c.bold}Configuration:${c.reset}\n`);
            console.log(`  ${c.dim}Model:${c.reset}       ${currentConfig.model}`);
            console.log(`  ${c.dim}Max Steps:${c.reset}   ${currentConfig.maxSteps}`);
            console.log(`  ${c.dim}Confirm:${c.reset}     ${currentConfig.confirmShell}`);
            console.log(
              `  ${c.dim}API Key:${c.reset}     ${currentConfig.anthropicApiKey ? "\u2713 Set" : "\u2717 Not set"}`,
            );
            break;
          }

          default:
            console.log(`\n  ${c.red}Unknown command: /${cmd}${c.reset}`);
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
    console.log("wd-agent v0.1.0 by WorthDoing AI");
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

  // ---- API key ----

  let config = loadConfig();
  if (!config.anthropicApiKey) {
    const key = await promptApiKey(rl);
    if (!key) {
      console.log(`\n  ${c.red}No API key provided. Exiting.${c.reset}\n`);
      process.exit(1);
    }
    saveConfig({ anthropicApiKey: key });
    config = loadConfig();
    console.log(`  ${c.green}\u2713${c.reset} API key saved to ~/.wdagent/config.json\n`);
  } else {
    console.log(`  ${c.green}\u2713${c.reset} API key loaded from ~/.wdagent/config.json\n`);
  }

  // ---- Conversation manager ----

  const convManager = new ConversationManager(config.conversationsDir);

  // ---- CLI: "run <task>" ----

  if (args[0] === "run" && args.length > 1) {
    const task = args.slice(1).join(" ");
    console.log(`  ${c.bold}Running task:${c.reset} ${task}\n`);
    const conv = convManager.create(task);
    const loop = new AgentLoop(config, conv);

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
      console.log(`  ${c.bold}Conversations:${c.reset}\n`);
      for (const cv of conversations) {
        const marker =
          cv.status === "active" ? `${c.green}\u25cf${c.reset}` : `${c.dim}\u25cb${c.reset}`;
        console.log(
          `  ${marker} ${c.cyan}${cv.id}${c.reset}  ${c.bold}${cv.title}${c.reset}  ${c.dim}(${cv.steps} steps)${c.reset}`,
        );
      }
      console.log();
    }
    process.exit(0);
  }

  // ---- CLI: "resume <id>" ----

  if (args[0] === "resume" && args[1]) {
    const conv = convManager.load(args[1]);
    if (!conv) {
      console.log(`  ${c.red}Conversation not found: ${args[1]}${c.reset}\n`);
      process.exit(1);
    }
    console.log(`  ${c.green}\u2713${c.reset} Resumed conversation: ${c.bold}${conv.meta.title}${c.reset}\n`);
    await interactiveLoop(rl, config, convManager, conv);
    return;
  }

  // ---- Default: new interactive session ----

  const conv = convManager.create("New conversation");
  console.log(`  ${c.dim}Conversation: ${conv.meta.id}${c.reset}`);
  console.log(`  ${c.dim}Type /help for commands, or just start chatting.${c.reset}\n`);

  await interactiveLoop(rl, config, convManager, conv);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
