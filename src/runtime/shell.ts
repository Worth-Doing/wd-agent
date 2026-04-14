import { exec } from "node:child_process";
import * as path from "node:path";

const BLOCKED_COMMANDS = [
  "rm -rf /", "rm -rf /*", "mkfs", "dd if=", ":(){", "fork bomb",
  "> /dev/sda", "chmod -R 777 /", "chown -R", "shutdown", "reboot",
  "halt", "poweroff", "init 0", "init 6",
];

const BLOCKED_PATTERNS = [
  /python3?\s+<</i,     // python heredoc
  /node\s+-e\s/i,       // node eval
  /python3?\s+-c\s/i,   // python -c
  /ruby\s+-e\s/i,       // ruby eval
  /perl\s+-e\s/i,       // perl eval
];

export class ShellRunner {
  constructor(private workspaceDir: string) {}

  async run(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Safety check — blocked strings
    const lower = command.toLowerCase().trim();
    for (const blocked of BLOCKED_COMMANDS) {
      if (lower.includes(blocked.toLowerCase())) {
        throw new Error(`Blocked: "${command.slice(0, 60)}" — dangerous pattern`);
      }
    }

    // Safety check — no inline scripts
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        throw new Error(`Blocked: shell cannot run inline scripts. Use "file" action to create files instead.`);
      }
    }

    // Reject commands that are too long (likely full scripts)
    if (command.length > 500) {
      throw new Error(`Blocked: command too long (${command.length} chars). Use "file" action to create scripts.`);
    }

    return new Promise((resolve, reject) => {
      const options = {
        cwd: this.workspaceDir,
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 5, // 5MB
        env: { ...process.env },
      };

      exec(command, options, (error, stdout, stderr) => {
        if (error && error.killed) {
          reject(new Error(`Command timed out after 30s: ${command}`));
          return;
        }

        resolve({
          stdout: stdout.toString().slice(0, 10000),
          stderr: stderr.toString().slice(0, 5000),
          exitCode: error?.code ?? 0,
        });
      });
    });
  }
}
