export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface AgentAction {
  type: "shell" | "capability" | "file" | "spawn_agent" | "message" | "done";
  // Shell
  command?: string;
  // Capability
  name?: string;
  input?: Record<string, unknown>;
  // File
  operation?: "read" | "write" | "edit";
  path?: string;
  content?: string;
  // Sub-agent
  task?: string;
  agentName?: string;
  // Message / Done
  text?: string;
}

export interface AgentThought {
  thought: string;
  action: AgentAction;
}

export interface StepRecord {
  step: number;
  timestamp: string;
  thought: string;
  action: AgentAction;
  result: {
    success: boolean;
    output: unknown;
    error?: string;
    duration_ms: number;
  };
}

export interface ConversationMeta {
  id: string;
  created: string;
  updated: string;
  title: string;
  steps: number;
  status: "active" | "completed" | "paused";
}
