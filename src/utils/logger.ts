import * as fs from "node:fs";
import * as path from "node:path";

export class Logger {
  private logPath: string | null = null;

  setLogPath(dir: string): void {
    this.logPath = path.join(dir, "agent.log");
  }

  log(level: "info" | "warn" | "error" | "debug", message: string, data?: unknown): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data ? { data } : {}),
    };
    if (this.logPath) {
      fs.appendFileSync(this.logPath, JSON.stringify(entry) + "\n");
    }
  }
}

export const logger = new Logger();
