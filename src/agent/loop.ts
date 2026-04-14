import Anthropic from "@anthropic-ai/sdk";
import { AgentAction, AgentThought, StepRecord } from "./types";
import { ActionExecutor } from "../runtime/executor";
import { logger } from "../utils/logger";

const SYSTEM_PROMPT = `You are WD Agent by WorthDoing AI. You execute tasks step by step.

# OUTPUT FORMAT (MANDATORY)

Respond with ONE raw JSON object. No markdown. No \`\`\`. No explanation before or after.

{"thought":"why you are doing this","action":{"type":"...","..."}}

# AVAILABLE ACTIONS

## message — Reply to the user
{"thought":"greeting","action":{"type":"message","text":"Hello!"}}

## done — Task finished, final answer
{"thought":"completed","action":{"type":"done","text":"Here is the result."}}

## capability — Call a WorthDoing API capability
{"thought":"searching web","action":{"type":"capability","name":"exa.search","input":{"query":"AI news"}}}

### Capability catalog:
SEARCH: exa.search, exa.findSimilar, exa.contents, exa.answer, tavily.search, tavily.extract
SCRAPING: firecrawl.scrape, firecrawl.search, firecrawl.map
LLM: openrouter.chat, openrouter.models
RESEARCH: openalex.works, openalex.authors, openalex.institutions
FINANCE: fmp.quote, fmp.profile, fmp.financialStatements, fmp.historicalPrices, eodhd.eod, eodhd.fundamentals, eodhd.search

## file — Create/read/edit files in workspace
{"thought":"writing report","action":{"type":"file","operation":"write","path":"report.md","content":"# My Report\\nContent here..."}}
{"thought":"reading file","action":{"type":"file","operation":"read","path":"data.json"}}

## shell — Run a simple shell command
{"thought":"checking files","action":{"type":"shell","command":"ls -la"}}

# RULES

1. Output EXACTLY ONE JSON object. Not two. Not three. ONE.
2. No markdown fences (\`\`\`). No text outside the JSON.
3. For simple questions, reply with "message" or "done" immediately.
4. For tasks requiring multiple steps, do ONE action per response. You will get the result back and can continue.
5. Use "file" action to create documents. Write the full content directly in the "content" field.
6. Use "shell" ONLY for simple commands: ls, cat, head, mkdir, cp, mv, wc, grep, find, git.
7. NEVER run python/node/ruby scripts via shell. Create files via "file" action instead.
8. ALWAYS use capabilities for API calls (search, finance, scraping). Never curl.
9. When task is complete, use "done" with a clear summary.

You work in an isolated workspace directory. All paths are relative.`;

export class AgentLoop {
  private client: Anthropic;
  private executor: ActionExecutor;
  private conversation: any;
  private model: string;
  private provider: "anthropic" | "openrouter";
  private stepCount: number = 0;

  constructor(config: any, conversation: any) {
    this.provider = config.provider || "anthropic";
    this.model = config.model || "claude-opus-4-6";

    if (this.provider === "openrouter") {
      this.client = new Anthropic({
        apiKey: config.openrouterApiKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
    } else {
      this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    }

    this.conversation = conversation;
    this.executor = new ActionExecutor(
      conversation.workspacePath,
      config.apiKeys || {},
    );

    this.stepCount = conversation.getSteps().length;
  }

  async step(userMessage?: string): Promise<StepRecord> {
    if (userMessage) {
      this.conversation.addMessage({
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      });
    }

    // Build messages
    const history = this.conversation.getHistory();
    const steps = this.conversation.getSteps();
    const messages: { role: "user" | "assistant"; content: string }[] = [];

    // Add history (keep last 20 messages to avoid overflow)
    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // If continuing from a previous step (no new user message), inject result
    if (steps.length > 0 && !userMessage) {
      const lastStep = steps[steps.length - 1];
      const resultStr = JSON.stringify({
        step_completed: lastStep.step,
        action_was: { type: lastStep.action.type, name: lastStep.action.name },
        success: lastStep.result.success,
        output: lastStep.result.output,
        error: lastStep.result.error,
      });
      messages.push({
        role: "user",
        content: `Step ${lastStep.step} result: ${resultStr}\n\nContinue with the next action. Output ONE JSON object.`,
      });
    }

    // Ensure at least one message
    if (messages.length === 0) {
      messages.push({ role: "user", content: "Hello" });
    }

    // Ensure messages alternate (Claude requirement)
    const cleaned: typeof messages = [];
    for (const msg of messages) {
      if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== msg.role) {
        cleaned.push(msg);
      } else {
        // Merge consecutive same-role messages
        cleaned[cleaned.length - 1].content += "\n" + msg.content;
      }
    }
    // Must start with user
    if (cleaned.length > 0 && cleaned[0].role !== "user") {
      cleaned.unshift({ role: "user", content: "(conversation start)" });
    }

    // Call Claude
    let thought: AgentThought;
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: cleaned,
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      thought = this.parseThought(text);
    } catch (err: any) {
      logger.log("error", "Model call failed", { error: err.message });
      throw new Error(`Model error: ${err.message}`);
    }

    // Execute
    this.stepCount++;
    const execStart = Date.now();
    const result = await this.executor.execute(thought.action);
    const duration = Date.now() - execStart;

    const record: StepRecord = {
      step: this.stepCount,
      timestamp: new Date().toISOString(),
      thought: thought.thought,
      action: thought.action,
      result: {
        success: result.success,
        output: result.output,
        error: result.error,
        duration_ms: duration,
      },
    };

    this.conversation.addStep(record);
    this.conversation.addMessage({
      role: "assistant",
      content: JSON.stringify(thought),
      timestamp: new Date().toISOString(),
    });

    logger.log("info", `Step ${this.stepCount}`, {
      action: thought.action.type,
      success: result.success,
      duration,
    });

    return record;
  }

  private parseThought(text: string): AgentThought {
    let cleaned = text.trim();

    // Strip ALL markdown code fences aggressively
    cleaned = cleaned.replace(/```json\s*/g, "").replace(/```\s*/g, "");

    // Find the first complete JSON object using brace matching
    const start = cleaned.indexOf("{");
    if (start === -1) {
      // No JSON at all — treat entire text as a message
      return {
        thought: "Responding to user",
        action: { type: "message", text: cleaned.slice(0, 3000) },
      };
    }

    let depth = 0;
    let end = start;
    let inString = false;
    let escape = false;

    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];

      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    const jsonStr = cleaned.slice(start, end);

    try {
      const parsed = JSON.parse(jsonStr);

      if (parsed.action && parsed.action.type) {
        return {
          thought: parsed.thought || "",
          action: parsed.action,
        };
      }

      // Has thought but no proper action
      return {
        thought: parsed.thought || "Processing",
        action: {
          type: "message",
          text: parsed.text || parsed.content || jsonStr.slice(0, 2000),
        },
      };
    } catch {
      // JSON parse failed — return as message
      return {
        thought: "Responding to user",
        action: { type: "message", text: text.slice(0, 3000) },
      };
    }
  }

  listCapabilities(): string[] {
    return this.executor.listCapabilities();
  }
}
