import * as fs from "node:fs";
import * as path from "node:path";

export class FileHandler {
  constructor(private workspaceDir: string) {}

  async handle(operation: string, filePath: string, content?: string): Promise<{ path: string; content?: string; size?: number; created?: boolean }> {
    // Resolve path relative to workspace
    const resolved = path.resolve(this.workspaceDir, filePath);

    // Security: ensure path is within workspace
    if (!resolved.startsWith(path.resolve(this.workspaceDir))) {
      throw new Error(`Path traversal detected: ${filePath} resolves outside workspace`);
    }

    switch (operation) {
      case "read": {
        if (!fs.existsSync(resolved)) {
          throw new Error(`File not found: ${filePath}`);
        }
        const data = fs.readFileSync(resolved, "utf-8");
        return { path: filePath, content: data.slice(0, 50000), size: data.length };
      }

      case "write": {
        const dir = path.dirname(resolved);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(resolved, content || "", "utf-8");
        return { path: filePath, size: (content || "").length, created: true };
      }

      case "edit": {
        if (!fs.existsSync(resolved)) {
          throw new Error(`File not found: ${filePath}`);
        }
        fs.writeFileSync(resolved, content || "", "utf-8");
        return { path: filePath, size: (content || "").length, created: false };
      }

      default:
        throw new Error(`Unknown file operation: ${operation}`);
    }
  }
}
