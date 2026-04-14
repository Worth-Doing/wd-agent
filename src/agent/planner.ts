import Anthropic from "@anthropic-ai/sdk";
import { AgentAction } from "./types";
import { logger } from "../utils/logger";

/**
 * A structured plan produced by the planner.
 * Each plan step has a description and an optional pre-determined action.
 */
export interface PlanStep {
  /** Human-readable description of what this step accomplishes */
  description: string;
  /** Optional action type hint (e.g. "capability", "shell", "file") */
  actionType?: AgentAction["type"];
  /** Optional pre-filled action details */
  action?: Partial<AgentAction>;
  /** Whether this step depends on output from the previous step */
  dependsOnPrevious: boolean;
}

export interface Plan {
  /** Short summary of the overall goal */
  goal: string;
  /** Ordered list of steps to achieve the goal */
  steps: PlanStep[];
  /** Estimated number of agent loop iterations needed */
  estimatedSteps: number;
  /** Capabilities that will likely be used */
  requiredCapabilities: string[];
}

const PLANNER_SYSTEM = `You are a task planner for WD Agent, a local AI agent built by WorthDoing AI.

Given a user request, decompose it into a structured plan of sequential steps.

You MUST output valid JSON with this structure:
{
  "goal": "short summary of the overall goal",
  "steps": [
    {
      "description": "what this step does",
      "actionType": "capability" | "shell" | "file" | "message" | null,
      "action": { ... partial action details if known ... } | null,
      "dependsOnPrevious": true | false
    }
  ],
  "estimatedSteps": <number>,
  "requiredCapabilities": ["exa.search", ...]
}

## Available capabilities
- exa.search, exa.findSimilar, exa.contents, exa.answer — Web search & discovery
- tavily.search, tavily.extract — AI-powered search & extraction
- firecrawl.scrape, firecrawl.search, firecrawl.map — Web scraping
- openrouter.chat, openrouter.models — LLM access (350+ models)
- openalex.works, openalex.authors, openalex.institutions — Academic research
- fmp.quote, fmp.profile, fmp.financialStatements, fmp.historicalPrices — Finance
- eodhd.eod, eodhd.fundamentals, eodhd.search — Historical market data

## Rules
1. Break complex tasks into small, concrete steps
2. Prefer capabilities over shell commands when possible
3. Mark steps that depend on previous output with dependsOnPrevious: true
4. Include a final "done" step that summarises the result to the user
5. Be realistic about estimated steps — include buffer for retries
6. ALL output must be valid JSON — no markdown, no extra text`;

export class Planner {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || "claude-opus-4-6-20250219";
  }

  /**
   * Generate a structured plan for a user request.
   */
  async createPlan(
    userRequest: string,
    context?: string,
  ): Promise<Plan> {
    const userContent = context
      ? `Context:\n${context}\n\nRequest:\n${userRequest}`
      : userRequest;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: PLANNER_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      });

      const text = response.content
        .filter(
          (block): block is Anthropic.TextBlock => block.type === "text",
        )
        .map((block) => block.text)
        .join("");

      return this.parsePlan(text);
    } catch (err: any) {
      logger.log("error", "Planner call failed", { error: err.message });
      // Return a minimal single-step plan as fallback
      return {
        goal: userRequest,
        steps: [
          {
            description: "Execute the user request directly",
            dependsOnPrevious: false,
          },
          {
            description: "Return the result to the user",
            actionType: "done",
            dependsOnPrevious: true,
          },
        ],
        estimatedSteps: 2,
        requiredCapabilities: [],
      };
    }
  }

  /**
   * Replan from a given step when the original plan fails or needs adjustment.
   */
  async replan(
    originalPlan: Plan,
    completedSteps: number,
    failureReason: string,
  ): Promise<Plan> {
    const context = [
      `Original plan goal: ${originalPlan.goal}`,
      `Completed ${completedSteps} of ${originalPlan.steps.length} steps.`,
      `Remaining steps were:`,
      ...originalPlan.steps
        .slice(completedSteps)
        .map((s, i) => `  ${completedSteps + i + 1}. ${s.description}`),
      `\nFailure reason: ${failureReason}`,
      `\nPlease create a revised plan to complete the goal, accounting for what has already been done and the failure.`,
    ].join("\n");

    return this.createPlan(originalPlan.goal, context);
  }

  private parsePlan(text: string): Plan {
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
      return this.validatePlan(parsed);
    } catch {
      // Return a minimal plan if parsing fails
      return {
        goal: "Execute user request",
        steps: [
          {
            description: "Process the request",
            dependsOnPrevious: false,
          },
          {
            description: "Return result",
            actionType: "done",
            dependsOnPrevious: true,
          },
        ],
        estimatedSteps: 2,
        requiredCapabilities: [],
      };
    }
  }

  private validatePlan(parsed: any): Plan {
    const plan: Plan = {
      goal: typeof parsed.goal === "string" ? parsed.goal : "Execute request",
      steps: [],
      estimatedSteps: typeof parsed.estimatedSteps === "number" ? parsed.estimatedSteps : 2,
      requiredCapabilities: Array.isArray(parsed.requiredCapabilities)
        ? parsed.requiredCapabilities.filter((c: unknown) => typeof c === "string")
        : [],
    };

    if (Array.isArray(parsed.steps)) {
      for (const step of parsed.steps) {
        if (typeof step === "object" && step !== null) {
          plan.steps.push({
            description:
              typeof step.description === "string"
                ? step.description
                : "Unnamed step",
            actionType: step.actionType || undefined,
            action: step.action || undefined,
            dependsOnPrevious: !!step.dependsOnPrevious,
          });
        }
      }
    }

    // Ensure at least one step
    if (plan.steps.length === 0) {
      plan.steps.push({
        description: "Process the request and return result",
        actionType: "done",
        dependsOnPrevious: false,
      });
    }

    return plan;
  }
}
