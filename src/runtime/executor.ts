import { AgentAction, StepRecord } from "../agent/types";
import { ShellRunner } from "./shell";
import { CapabilityBridge } from "./capabilities";
import { FileHandler } from "./files";

export class ActionExecutor {
  private shell: ShellRunner;
  private capabilities: CapabilityBridge;
  private files: FileHandler;

  constructor(workspaceDir: string, apiKeys: Record<string, string>) {
    this.shell = new ShellRunner(workspaceDir);
    this.capabilities = new CapabilityBridge(apiKeys);
    this.files = new FileHandler(workspaceDir);
  }

  async execute(action: AgentAction): Promise<{ success: boolean; output: unknown; error?: string }> {
    const start = Date.now();
    try {
      let output: unknown;

      switch (action.type) {
        case "shell":
          output = await this.shell.run(action.command || "");
          break;

        case "capability":
          output = await this.capabilities.execute(action.name || "", action.input || {});
          break;

        case "file":
          output = await this.files.handle(action.operation || "read", action.path || "", action.content);
          break;

        case "message":
        case "done":
          output = { text: action.text || "" };
          break;

        case "spawn_agent":
          output = { status: "spawned", task: action.task, name: action.agentName };
          // Sub-agent spawning is handled by the agent loop
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      return { success: true, output };
    } catch (err: any) {
      return { success: false, output: null, error: err.message };
    }
  }

  listCapabilities(): string[] {
    return this.capabilities.list();
  }
}
