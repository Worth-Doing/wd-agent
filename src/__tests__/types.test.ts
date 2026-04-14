import { describe, it, expect } from "vitest";
import type {
  AgentAction,
  AgentMessage,
  AgentThought,
  StepRecord,
  ConversationMeta,
} from "../agent/types";

describe("Agent Types", () => {
  it("should define AgentMessage with required fields", () => {
    const message: AgentMessage = {
      role: "user",
      content: "Hello, agent.",
      timestamp: new Date().toISOString(),
    };

    expect(message.role).toBe("user");
    expect(message.content).toBe("Hello, agent.");
    expect(message.timestamp).toBeTruthy();
  });

  it("should accept all valid AgentMessage roles", () => {
    const roles: AgentMessage["role"][] = ["user", "assistant", "system"];

    for (const role of roles) {
      const message: AgentMessage = {
        role,
        content: `Message from ${role}`,
        timestamp: new Date().toISOString(),
      };
      expect(message.role).toBe(role);
    }
  });

  it("should define AgentAction with shell type", () => {
    const action: AgentAction = {
      type: "shell",
      command: "ls -la",
    };

    expect(action.type).toBe("shell");
    expect(action.command).toBe("ls -la");
  });

  it("should define AgentAction with capability type", () => {
    const action: AgentAction = {
      type: "capability",
      name: "exa.search",
      input: { query: "test query", numResults: 5 },
    };

    expect(action.type).toBe("capability");
    expect(action.name).toBe("exa.search");
    expect(action.input).toEqual({ query: "test query", numResults: 5 });
  });

  it("should define AgentAction with file type", () => {
    const action: AgentAction = {
      type: "file",
      operation: "write",
      path: "output.md",
      content: "# Report\n\nContent here.",
    };

    expect(action.type).toBe("file");
    expect(action.operation).toBe("write");
    expect(action.path).toBe("output.md");
    expect(action.content).toContain("Report");
  });

  it("should define AgentAction with spawn_agent type", () => {
    const action: AgentAction = {
      type: "spawn_agent",
      task: "Analyze financial data",
      agentName: "financial-analyst",
    };

    expect(action.type).toBe("spawn_agent");
    expect(action.task).toBe("Analyze financial data");
    expect(action.agentName).toBe("financial-analyst");
  });

  it("should define AgentAction with message type", () => {
    const action: AgentAction = {
      type: "message",
      text: "Here is what I found so far...",
    };

    expect(action.type).toBe("message");
    expect(action.text).toBeTruthy();
  });

  it("should define AgentAction with done type", () => {
    const action: AgentAction = {
      type: "done",
      text: "Task complete.",
    };

    expect(action.type).toBe("done");
    expect(action.text).toBe("Task complete.");
  });

  it("should define all valid action types", () => {
    const validTypes: AgentAction["type"][] = [
      "shell",
      "capability",
      "file",
      "spawn_agent",
      "message",
      "done",
    ];

    expect(validTypes).toHaveLength(6);
    for (const type of validTypes) {
      const action: AgentAction = { type };
      expect(action.type).toBe(type);
    }
  });

  it("should define AgentThought with thought and action", () => {
    const thought: AgentThought = {
      thought: "I need to search for recent papers on RAG.",
      action: {
        type: "capability",
        name: "exa.search",
        input: { query: "retrieval augmented generation" },
      },
    };

    expect(thought.thought).toContain("RAG");
    expect(thought.action.type).toBe("capability");
    expect(thought.action.name).toBe("exa.search");
  });

  it("should define StepRecord with all required fields", () => {
    const step: StepRecord = {
      step: 1,
      timestamp: "2026-04-13T14:00:00.000Z",
      thought: "I should search for information.",
      action: {
        type: "capability",
        name: "tavily.search",
        input: { query: "AI startups" },
      },
      result: {
        success: true,
        output: { results: [] },
        duration_ms: 1200,
      },
    };

    expect(step.step).toBe(1);
    expect(step.timestamp).toBeTruthy();
    expect(step.thought).toContain("search");
    expect(step.action.type).toBe("capability");
    expect(step.result.success).toBe(true);
    expect(step.result.duration_ms).toBe(1200);
    expect(step.result.error).toBeUndefined();
  });

  it("should define StepRecord with error result", () => {
    const step: StepRecord = {
      step: 2,
      timestamp: "2026-04-13T14:01:00.000Z",
      thought: "Let me try running a command.",
      action: {
        type: "shell",
        command: "some-nonexistent-command",
      },
      result: {
        success: false,
        output: null,
        error: "Command not found: some-nonexistent-command",
        duration_ms: 45,
      },
    };

    expect(step.result.success).toBe(false);
    expect(step.result.error).toContain("Command not found");
    expect(step.result.output).toBeNull();
  });

  it("should define ConversationMeta with all required fields", () => {
    const meta: ConversationMeta = {
      id: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      created: "2026-04-13T14:00:00.000Z",
      updated: "2026-04-13T14:30:00.000Z",
      title: "Research AI startups in Montreal",
      steps: 8,
      status: "completed",
    };

    expect(meta.id).toHaveLength(36);
    expect(meta.created).toBeTruthy();
    expect(meta.updated).toBeTruthy();
    expect(meta.title).toContain("Montreal");
    expect(meta.steps).toBe(8);
    expect(meta.status).toBe("completed");
  });

  it("should accept all valid ConversationMeta statuses", () => {
    const statuses: ConversationMeta["status"][] = ["active", "completed", "paused"];

    for (const status of statuses) {
      const meta: ConversationMeta = {
        id: "test-id",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        title: "Test conversation",
        steps: 0,
        status,
      };
      expect(meta.status).toBe(status);
    }
  });
});
