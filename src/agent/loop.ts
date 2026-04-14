import Anthropic from "@anthropic-ai/sdk";
import { AgentAction, AgentThought, StepRecord } from "./types";
import { ActionExecutor } from "../runtime/executor";
import { logger } from "../utils/logger";

const SYSTEM_PROMPT = `You are WD Agent, a powerful local AI agent built by WorthDoing AI.

## CRITICAL OUTPUT FORMAT

You MUST respond with EXACTLY ONE valid JSON object per response. Nothing else.
No markdown. No explanation. No multiple JSON objects. ONLY ONE JSON object:

{"thought":"your reasoning","action":{"type":"...","..."}}

## Action Types

### message — Talk to the user
{"thought":"Greeting the user","action":{"type":"message","text":"Hello! How can I help?"}}

### done — Task complete, final answer to the user
{"thought":"Task is finished","action":{"type":"done","text":"Here is the result..."}}

### capability — Use a WorthDoing capability (ALWAYS PREFER THIS over shell)
{"thought":"Need to search","action":{"type":"capability","name":"exa.search","input":{"query":"AI research"}}}

Available capabilities:
- exa.search, exa.findSimilar, exa.contents, exa.answer
- tavily.search, tavily.extract
- firecrawl.scrape, firecrawl.search, firecrawl.map
- openrouter.chat, openrouter.models
- openalex.works, openalex.authors, openalex.institutions
- fmp.quote, fmp.profile, fmp.financialStatements, fmp.historicalPrices
- eodhd.eod, eodhd.fundamentals, eodhd.search

### file — Read, write, or edit files in workspace
{"thought":"Creating report","action":{"type":"file","operation":"write","path":"report.md","content":"# Report\\n..."}}

### shell — Execute a SHORT shell command (ls, cat, mkdir, etc.)
{"thought":"Listing files","action":{"type":"shell","command":"ls -la"}}

## STRICT RULES

1. EXACTLY ONE JSON object per response — never two or more
2. ALWAYS prefer capabilities over shell commands
3. NEVER use shell to run Python/Node scripts — use file+shell or capabilities instead
4. Shell commands must be SHORT and SIMPLE (ls, cat, mkdir, cp, mv, git)
5. For simple questions, use "message" type immediately
6. For complex tasks, work step by step — one action per step
7. When the task is fully done, use "done" type with the final answer
8. File content should be written directly via "file" action, not via shell echo/cat

You operate in a workspace directory. All file paths are relative to this workspace.`;

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
      // Use OpenRouter as backend via Anthropic SDK compatibility
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

    // Restore step count from conversation
    this.stepCount = conversation.getSteps().length;
  }

  async step(userMessage?: string): Promise<StepRecord> {
    // Add user message to history if provided
    if (userMessage) {
      this.conversation.addMessage({
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      });
    }

    // Build messages for Claude
    const history = this.conversation.getHistory();
    const steps = this.conversation.getSteps();

    const messages: { role: "user" | "assistant"; content: string }[] = [];

    // Add conversation history
    for (const msg of history) {
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        messages.push({ role: "assistant", content: msg.content });
      }
    }

    // Add recent step results as context
    if (steps.length > 0 && !userMessage) {
      const lastStep = steps[steps.length - 1];
      const resultSummary = JSON.stringify({
        previous_action: lastStep.action,
        result: lastStep.result,
      });
      messages.push({
        role: "user",
        content: `Previous step result:\n${resultSummary}\n\nDecide what to do next. Output valid JSON.`,
      });
    }

    // Ensure messages alternate correctly
    if (messages.length === 0) {
      messages.push({ role: "user", content: "Hello" });
    }

    // Call Claude
    const start = Date.now();
    let thought: AgentThought;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
      });

      const text = response.content
        .filter(
          (block): block is Anthropic.TextBlock => block.type === "text",
        )
        .map((block) => block.text)
        .join("");

      // Parse JSON response
      thought = this.parseThought(text);
    } catch (err: any) {
      logger.log("error", "Model call failed", { error: err.message });
      throw new Error(`Model error: ${err.message}`);
    }

    // Execute the action
    this.stepCount++;
    const execStart = Date.now();
    const result = await this.executor.execute(thought.action);
    const duration = Date.now() - execStart;

    // Create step record
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

    // Store in conversation
    this.conversation.addStep(record);

    // Add assistant message to history
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
    let jsonStr = text.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // If there are multiple JSON objects, take only the FIRST one
    // This handles cases where the model returns multiple actions
    const firstBrace = jsonStr.indexOf("{");
    if (firstBrace >= 0) {
      let depth = 0;
      let end = firstBrace;
      for (let i = firstBrace; i < jsonStr.length; i++) {
        if (jsonStr[i] === "{") depth++;
        if (jsonStr[i] === "}") depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
      jsonStr = jsonStr.slice(firstBrace, end);
    }

    try {
      const parsed = JSON.parse(jsonStr);

      // Validate structure
      if (!parsed.action || !parsed.action.type) {
        return {
          thought: parsed.thought || "Processing...",
          action: {
            type: "message",
            text: parsed.text || parsed.content || text.slice(0, 2000),
          },
        };
      }

      return {
        thought: parsed.thought || "",
        action: parsed.action,
      };
    } catch {
      // If JSON parsing fails, treat as a plain message
      return {
        thought: "Responding to user",
        action: {
          type: "message",
          text: text,
        },
      };
    }
  }

  listCapabilities(): string[] {
    return this.executor.listCapabilities();
  }
}
