import Anthropic from "@anthropic-ai/sdk";
import { AgentAction, AgentThought, StepRecord } from "./types";
import { ActionExecutor } from "../runtime/executor";
import { logger } from "../utils/logger";

const SYSTEM_PROMPT = `You are WD Agent, a powerful local AI agent built by WorthDoing AI.

You operate through a sequential action loop. At each step, you MUST output valid JSON with:
{
  "thought": "your reasoning about what to do next",
  "action": {
    "type": "shell" | "capability" | "file" | "message" | "done",
    ...action-specific fields
  }
}

## Action Types

### shell — Execute a shell command
{"type": "shell", "command": "ls -la"}

### capability — Use a WorthDoing capability (PREFERRED for structured actions)
{"type": "capability", "name": "exa.search", "input": {"query": "..."}}

Available capabilities:
- exa.search, exa.findSimilar, exa.contents, exa.answer — Web search & discovery
- tavily.search, tavily.extract — AI-powered search & extraction
- firecrawl.scrape, firecrawl.search, firecrawl.map — Web scraping
- openrouter.chat, openrouter.models — LLM access (350+ models)
- openalex.works, openalex.authors, openalex.institutions — Academic research
- fmp.quote, fmp.profile, fmp.financialStatements, fmp.historicalPrices — Finance
- eodhd.eod, eodhd.fundamentals, eodhd.search — Historical market data

### file — Read, write, or edit files
{"type": "file", "operation": "write", "path": "report.md", "content": "..."}
{"type": "file", "operation": "read", "path": "data.json"}

### message — Send a message to the user (intermediate communication)
{"type": "message", "text": "Here's what I found..."}

### done — Task is complete, provide final response
{"type": "done", "text": "Here's the final result..."}

## Rules
1. ONE action per step
2. Use capabilities instead of shell when possible
3. Think step by step
4. Store results in files for complex tasks
5. Respond with "done" when the task is complete
6. ALL output must be valid JSON — no markdown, no extra text

You are operating in a workspace directory. All file paths are relative to this workspace.`;

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
    // Try to extract JSON from the response
    let jsonStr = text.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // Try to find JSON object in the text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);

      // Validate structure
      if (!parsed.action || !parsed.action.type) {
        // If the model returned something without the right structure, wrap it
        return {
          thought: parsed.thought || "Processing...",
          action: {
            type: "message",
            text: parsed.text || parsed.content || text,
          },
        };
      }

      return {
        thought: parsed.thought || "",
        action: parsed.action,
      };
    } catch {
      // If JSON parsing fails, treat as a message
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
