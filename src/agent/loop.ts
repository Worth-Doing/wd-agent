import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ContentBlock, ToolUseBlock, TextBlock, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { AgentAction, AgentThought, StepRecord } from "./types";
import { ActionExecutor } from "../runtime/executor";
import { logger } from "../utils/logger";

// ── Tool Definitions ─────────────────────────────────────────
const AGENT_TOOLS: Tool[] = [
  {
    name: "respond",
    description: "Send a message to the user. Use this for greetings, clarifications, or intermediate updates.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "The message to send to the user" },
      },
      required: ["text"],
    },
  },
  {
    name: "task_complete",
    description: "The task is fully done. Provide the final summary/answer to the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Final result/summary for the user" },
      },
      required: ["text"],
    },
  },
  {
    name: "use_capability",
    description: `Execute a WorthDoing AI capability. Available capabilities:

SEARCH: exa.search, exa.findSimilar, exa.contents, exa.answer, tavily.search, tavily.extract
SCRAPING: firecrawl.scrape, firecrawl.search, firecrawl.map
LLM: openrouter.chat, openrouter.models
RESEARCH: openalex.works, openalex.authors, openalex.institutions
FINANCE: fmp.quote, fmp.profile, fmp.financialStatements, fmp.historicalPrices, eodhd.eod, eodhd.fundamentals, eodhd.search`,
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Capability name (e.g. exa.search, fmp.quote)" },
        input: { type: "object", description: "Input parameters for the capability" },
      },
      required: ["name", "input"],
    },
  },
  {
    name: "shell_execute",
    description: "Run a simple shell command (ls, cat, head, mkdir, cp, mv, grep, find, git, wc). Do NOT run Python/Node scripts — use write_file instead.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "Shell command to execute (must be short and simple)" },
      },
      required: ["command"],
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a file in the workspace. Use this for creating reports, scripts, documents, data files.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path relative to workspace" },
        content: { type: "string", description: "Full content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file from the workspace.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path relative to workspace" },
      },
      required: ["path"],
    },
  },
];

const SYSTEM_PROMPT = `You are WD Agent, a powerful local AI agent by WorthDoing AI.

You execute tasks step by step using tools. You have access to:
- Web search (Exa, Tavily, Firecrawl)
- Academic research (OpenAlex — 250M+ papers)
- Financial data (FMP, EODHD — real-time quotes, financials)
- LLM access (OpenRouter — 350+ models)
- Shell commands (simple operations only)
- File operations (read/write files in workspace)

RULES:
1. Use tools to accomplish tasks. Don't just talk — take action.
2. ALWAYS use capabilities (use_capability) for API calls. Never use shell for API access.
3. Shell is ONLY for simple commands: ls, cat, head, mkdir, cp, mv, grep, find, git, wc.
4. NEVER run Python/Node/Ruby scripts via shell. Use write_file to create files.
5. Work step by step. After each tool use, assess the result and decide next step.
6. Use task_complete when the task is fully done, with a comprehensive summary.
7. Use respond for intermediate communication or simple questions.
8. When creating documents, use write_file with the full content.

You work in an isolated workspace directory. All file paths are relative to this workspace.`;

// ── Agent Loop ───────────────────────────────────────────────
export class AgentLoop {
  private client: Anthropic;
  private executor: ActionExecutor;
  private conversation: any;
  private model: string;
  private provider: "anthropic" | "openrouter";
  private stepCount: number = 0;
  private messages: MessageParam[] = [];
  private contextSummary: string = "";
  private totalTokensUsed: number = 0;

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

    // Restore messages from conversation history
    this._restoreMessages();
  }

  private _restoreMessages(): void {
    const history = this.conversation.getHistory();
    for (const msg of history.slice(-20)) {
      if (msg.role === "user" || msg.role === "assistant") {
        this.messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  private _estimateTokens(messages: MessageParam[]): number {
    let total = 0;
    for (const msg of messages) {
      if (typeof msg.content === "string") {
        total += Math.ceil(msg.content.length / 4);
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if ("text" in block) total += Math.ceil((block as any).text.length / 4);
          if ("content" in block && typeof (block as any).content === "string") total += Math.ceil((block as any).content.length / 4);
        }
      }
    }
    return total;
  }

  private async _compactIfNeeded(): Promise<void> {
    const estimated = this._estimateTokens(this.messages);
    const threshold = 80000; // ~80K tokens

    if (estimated < threshold || this.messages.length < 6) return;

    logger.log("info", "Compacting conversation", { estimatedTokens: estimated });

    // Keep last 6 messages, summarize the rest
    const toSummarize = this.messages.slice(0, -6);
    const toKeep = this.messages.slice(-6);

    // Build a summary of older messages
    const summaryParts: string[] = [];
    for (const msg of toSummarize) {
      const content = typeof msg.content === "string"
        ? msg.content.slice(0, 200)
        : JSON.stringify(msg.content).slice(0, 200);
      summaryParts.push(`[${msg.role}]: ${content}...`);
    }

    const summary = `[Context Summary — ${toSummarize.length} messages compacted]\n${summaryParts.join("\n").slice(0, 2000)}`;

    this.messages = [
      { role: "user", content: summary },
      { role: "assistant", content: "Understood. I have the context. Continuing with the task." },
      ...toKeep,
    ];

    this.contextSummary = summary;
    logger.log("info", "Compaction done", {
      removed: toSummarize.length,
      kept: toKeep.length,
      newEstimate: this._estimateTokens(this.messages),
    });
  }

  /**
   * Execute one step of the agent loop.
   * Returns the step record with action and result.
   *
   * The step uses Anthropic's native tool_use feature:
   * 1. Send messages + tools to Claude
   * 2. Claude responds with tool_use blocks
   * 3. We execute the tool and return the result
   */
  async step(userMessage?: string): Promise<StepRecord> {
    // Add user message
    if (userMessage) {
      this.messages.push({ role: "user", content: userMessage });
      this.conversation.addMessage({
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      });
    }

    // Auto-compact if context too large
    await this._compactIfNeeded();

    // Ensure message alternation
    this._ensureAlternation();

    // Call Claude with tools
    const start = Date.now();
    let action: AgentAction;
    let thought = "";

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: AGENT_TOOLS,
        messages: this.messages,
      });

      // Track usage
      if (response.usage) {
        this.totalTokensUsed += response.usage.input_tokens + response.usage.output_tokens;
      }

      // Process response — extract tool use and text
      const textBlocks: string[] = [];
      let toolUse: ToolUseBlock | null = null;

      for (const block of response.content) {
        if (block.type === "text") {
          textBlocks.push((block as TextBlock).text);
        } else if (block.type === "tool_use") {
          toolUse = block as ToolUseBlock;
        }
      }

      thought = textBlocks.join("\n") || "Processing...";

      if (toolUse) {
        // Convert tool_use to our action format
        action = this._toolUseToAction(toolUse);

        // Add assistant message with the full response
        this.messages.push({ role: "assistant", content: response.content as any });
      } else {
        // No tool use — treat as a message response
        action = { type: "message", text: thought };
        this.messages.push({ role: "assistant", content: thought });
      }

    } catch (err: any) {
      logger.log("error", "Model call failed", { error: err.message });
      throw new Error(`Model error: ${err.message}`);
    }

    // Execute the action
    this.stepCount++;
    const execStart = Date.now();
    const result = await this.executor.execute(action);
    const duration = Date.now() - execStart;

    // If we used a tool, send the result back as tool_result
    if (action.type !== "message" && action.type !== "done") {
      // Find the tool_use_id from the last assistant message
      const lastAssistantMsg = this.messages[this.messages.length - 1];
      let toolUseId = "unknown";
      if (lastAssistantMsg && Array.isArray(lastAssistantMsg.content)) {
        const toolBlock = (lastAssistantMsg.content as any[]).find(
          (b: any) => b.type === "tool_use"
        );
        if (toolBlock) {
          toolUseId = toolBlock.id;
        }
      }

      const toolResult: ToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: JSON.stringify(result.output).slice(0, 10000),
        is_error: !result.success,
      };
      this.messages.push({ role: "user", content: [toolResult] });
    }

    // Create step record
    const record: StepRecord = {
      step: this.stepCount,
      timestamp: new Date().toISOString(),
      thought,
      action,
      result: {
        success: result.success,
        output: result.output,
        error: result.error,
        duration_ms: duration,
      },
    };

    // Store in conversation
    this.conversation.addStep(record);
    this.conversation.addMessage({
      role: "assistant",
      content: JSON.stringify({ thought, action }),
      timestamp: new Date().toISOString(),
    });

    logger.log("info", `Step ${this.stepCount}`, {
      action: action.type,
      success: result.success,
      duration,
      totalTokens: this.totalTokensUsed,
    });

    return record;
  }

  private _toolUseToAction(toolUse: ToolUseBlock): AgentAction {
    const input = toolUse.input as Record<string, any>;

    switch (toolUse.name) {
      case "respond":
        return { type: "message", text: input.text || "" };
      case "task_complete":
        return { type: "done", text: input.text || "" };
      case "use_capability":
        return { type: "capability", name: input.name, input: input.input || {} };
      case "shell_execute":
        return { type: "shell", command: input.command || "" };
      case "write_file":
        return { type: "file", operation: "write", path: input.path, content: input.content };
      case "read_file":
        return { type: "file", operation: "read", path: input.path };
      default:
        return { type: "message", text: `Unknown tool: ${toolUse.name}` };
    }
  }

  private _ensureAlternation(): void {
    if (this.messages.length === 0) return;

    // Must start with user
    if (this.messages[0].role !== "user") {
      this.messages.unshift({ role: "user", content: "(session start)" });
    }

    // Merge consecutive same-role messages
    const merged: MessageParam[] = [];
    for (const msg of this.messages) {
      if (merged.length === 0 || merged[merged.length - 1].role !== msg.role) {
        merged.push(msg);
      } else {
        // Merge into previous
        const prev = merged[merged.length - 1];
        if (typeof prev.content === "string" && typeof msg.content === "string") {
          prev.content = prev.content + "\n" + msg.content;
        }
        // If either is an array (tool_use/tool_result), keep as-is (skip merge)
      }
    }
    this.messages = merged;
  }

  get tokensUsed(): number {
    return this.totalTokensUsed;
  }

  listCapabilities(): string[] {
    return this.executor.listCapabilities();
  }
}
