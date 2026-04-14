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
    ${c.cyan}/model${c.reset}         Change model (with OpenRouter model browser)
    ${c.cyan}/caps${c.reset}          List available capabilities
    ${c.cyan}/steps${c.reset}         Show steps in current conversation
    ${c.cyan}/clear${c.reset}         Clear screen
    ${c.cyan}/exit${c.reset}          Exit the agent

  ${c.bold}Or just type a message to chat with the agent.${c.reset}
`);
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
  console.log(`\n  ${c.yellow}${c.bold}Setup Required${c.reset}`);
  console.log(`  ${c.dim}Choose your AI provider to get started.${c.reset}\n`);
  console.log(`  ${c.cyan}1${c.reset}  Anthropic (Claude API direct)`);
  console.log(`  ${c.cyan}2${c.reset}  OpenRouter (350+ models — Claude, GPT, Gemini, Llama, etc.)\n`);

  const choice = await ask(rl, `  ${c.cyan}Choice [1/2]: ${c.reset}`);

  if (choice === "2") {
    // OpenRouter flow
    console.log(`\n  ${c.dim}Get an API key at: https://openrouter.ai/settings/keys${c.reset}\n`);
    const apiKey = await ask(rl, `  ${c.cyan}OpenRouter API Key: ${c.reset}`);
    if (!apiKey) throw new Error("No API key provided");

    // Fetch models from OpenRouter
    console.log(`\n  ${c.dim}Fetching available models...${c.reset}`);
    const model = await selectOpenRouterModel(rl, apiKey);

    return { provider: "openrouter", apiKey, model };
  }

  // Anthropic flow
  console.log(`\n  ${c.dim}Get an API key at: https://console.anthropic.com/settings/keys${c.reset}\n`);
  const apiKey = await ask(rl, `  ${c.cyan}Anthropic API Key: ${c.reset}`);
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

    console.log(`\n  ${c.bold}${models.length} models available${c.reset}\n`);
    console.log(`  ${c.bold}Popular models:${c.reset}\n`);

    availablePopular.forEach((id, i) => {
      const m = models.find((m) => m.id === id);
      if (m) {
        console.log(`  ${c.cyan}${String(i + 1).padStart(2)}${c.reset}  ${c.bold}${m.id}${c.reset}  ${c.dim}(${(m.context / 1000).toFixed(0)}K ctx)${c.reset}`);
      }
    });

    console.log(`\n  ${c.dim}Or type a model ID directly (e.g. anthropic/claude-opus-4-6)${c.reset}\n`);

    const selection = await ask(rl, `  ${c.cyan}Model [number or ID]: ${c.reset}`);

    // Parse selection
    const num = parseInt(selection, 10);
    if (!isNaN(num) && num >= 1 && num <= availablePopular.length) {
      const selected = availablePopular[num - 1];
      console.log(`  ${c.green}✓${c.reset} Selected: ${c.bold}${selected}${c.reset}`);
      return selected;
    }

    // Check if it's a valid model ID
    if (selection.includes("/")) {
      const exists = models.some((m) => m.id === selection);
      if (exists) {
        console.log(`  ${c.green}✓${c.reset} Selected: ${c.bold}${selection}${c.reset}`);
        return selection;
      }
      // Even if not found in list, trust the user
      console.log(`  ${c.yellow}⚠${c.reset} Model not found in catalog, using anyway: ${c.bold}${selection}${c.reset}`);
      return selection;
    }

    // Search by name
    const matches = models.filter((m) =>
      m.id.toLowerCase().includes(selection.toLowerCase()) ||
      m.name.toLowerCase().includes(selection.toLowerCase())
    ).slice(0, 10);

    if (matches.length > 0) {
      console.log(`\n  ${c.bold}Matching models:${c.reset}\n`);
      matches.forEach((m, i) => {
        console.log(`  ${c.cyan}${String(i + 1).padStart(2)}${c.reset}  ${c.bold}${m.id}${c.reset}  ${c.dim}${m.name}${c.reset}`);
      });

      const pick = await ask(rl, `\n  ${c.cyan}Pick [1-${matches.length}]: ${c.reset}`);
      const pickNum = parseInt(pick, 10);
      if (!isNaN(pickNum) && pickNum >= 1 && pickNum <= matches.length) {
        const selected = matches[pickNum - 1].id;
        console.log(`  ${c.green}✓${c.reset} Selected: ${c.bold}${selected}${c.reset}`);
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
            console.log(`\n  ${c.bold}Configuration:${c.reset}\n`);
            console.log(`  ${c.dim}Provider:${c.reset}    ${currentConfig.provider}`);
            console.log(`  ${c.dim}Model:${c.reset}       ${currentConfig.model}`);
            console.log(`  ${c.dim}Max Steps:${c.reset}   ${currentConfig.maxSteps}`);
            console.log(`  ${c.dim}Confirm:${c.reset}     ${currentConfig.confirmShell}`);
            console.log(
              `  ${c.dim}Anthropic:${c.reset}   ${currentConfig.anthropicApiKey ? "\u2713 Set" : "\u2717 Not set"}`,
            );
            console.log(
              `  ${c.dim}OpenRouter:${c.reset}  ${currentConfig.openrouterApiKey ? "\u2713 Set" : "\u2717 Not set"}`,
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
      console.log(`\n  ${c.green}\u2713${c.reset} Configuration saved to ~/.wdagent/config.json\n`);
    } catch {
      console.log(`\n  ${c.red}Setup failed. Exiting.${c.reset}\n`);
      process.exit(1);
    }
  } else {
    const providerLabel = config.provider === "openrouter" ? "OpenRouter" : "Anthropic";
    console.log(`  ${c.green}\u2713${c.reset} ${providerLabel} configured — model: ${c.bold}${config.model}${c.reset}\n`);
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
