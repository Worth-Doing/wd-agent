import * as fs from "node:fs";
import * as path from "node:path";
import { ConversationMeta, AgentMessage, StepRecord } from "../agent/types";

function generateId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `conv_${date}_${rand}`;
}

export class Conversation {
  meta: ConversationMeta;
  private basePath: string;
  private history: AgentMessage[] = [];
  private steps: StepRecord[] = [];

  constructor(basePath: string, meta: ConversationMeta) {
    this.basePath = basePath;
    this.meta = meta;

    // Create directories
    fs.mkdirSync(path.join(basePath, "workspace"), { recursive: true });
    fs.mkdirSync(path.join(basePath, "outputs"), { recursive: true });
    fs.mkdirSync(path.join(basePath, "agents"), { recursive: true });

    // Load existing data
    this.loadHistory();
    this.loadSteps();
  }

  get workspacePath(): string {
    return path.join(this.basePath, "workspace");
  }

  get outputsPath(): string {
    return path.join(this.basePath, "outputs");
  }

  addMessage(msg: AgentMessage): void {
    this.history.push(msg);
    this.saveHistory();
  }

  addStep(step: StepRecord): void {
    this.steps.push(step);
    this.meta.steps = this.steps.length;
    this.meta.updated = new Date().toISOString();
    this.saveSteps();
    this.saveMeta();
  }

  getHistory(): AgentMessage[] {
    return [...this.history];
  }

  getSteps(): StepRecord[] {
    return [...this.steps];
  }

  private loadHistory(): void {
    const file = path.join(this.basePath, "history.json");
    if (fs.existsSync(file)) {
      try {
        this.history = JSON.parse(fs.readFileSync(file, "utf-8"));
      } catch {
        this.history = [];
      }
    }
  }

  private saveHistory(): void {
    fs.writeFileSync(
      path.join(this.basePath, "history.json"),
      JSON.stringify(this.history, null, 2),
    );
  }

  private loadSteps(): void {
    const file = path.join(this.basePath, "steps.json");
    if (fs.existsSync(file)) {
      try {
        this.steps = JSON.parse(fs.readFileSync(file, "utf-8"));
      } catch {
        this.steps = [];
      }
    }
  }

  private saveSteps(): void {
    fs.writeFileSync(
      path.join(this.basePath, "steps.json"),
      JSON.stringify(this.steps, null, 2),
    );
  }

  private saveMeta(): void {
    fs.writeFileSync(
      path.join(this.basePath, "meta.json"),
      JSON.stringify(this.meta, null, 2),
    );
  }
}

export class ConversationManager {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    fs.mkdirSync(baseDir, { recursive: true });
  }

  create(title: string): Conversation {
    const id = generateId();
    const meta: ConversationMeta = {
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      title: title.slice(0, 100),
      steps: 0,
      status: "active",
    };

    const convPath = path.join(this.baseDir, id);
    fs.mkdirSync(convPath, { recursive: true });
    fs.writeFileSync(
      path.join(convPath, "meta.json"),
      JSON.stringify(meta, null, 2),
    );

    return new Conversation(convPath, meta);
  }

  load(id: string): Conversation | null {
    const convPath = path.join(this.baseDir, id);
    const metaFile = path.join(convPath, "meta.json");

    if (!fs.existsSync(metaFile)) return null;

    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
      return new Conversation(convPath, meta);
    } catch {
      return null;
    }
  }

  list(): ConversationMeta[] {
    if (!fs.existsSync(this.baseDir)) return [];

    const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
    const conversations: ConversationMeta[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metaFile = path.join(this.baseDir, entry.name, "meta.json");
      if (fs.existsSync(metaFile)) {
        try {
          conversations.push(
            JSON.parse(fs.readFileSync(metaFile, "utf-8")),
          );
        } catch {
          /* skip invalid */
        }
      }
    }

    return conversations.sort((a, b) => b.updated.localeCompare(a.updated));
  }
}
