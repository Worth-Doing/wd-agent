import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface AgentConfig {
  anthropicApiKey: string;
  openrouterApiKey: string;
  provider: "anthropic" | "openrouter";
  apiKeys: {
    exa?: string;
    tavily?: string;
    firecrawl?: string;
    openrouter?: string;
    openalex?: string;
    fmp?: string;
    eodhd?: string;
  };
  model: string;
  maxSteps: number;
  confirmShell: boolean;
  conversationsDir: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".wdagent");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: AgentConfig = {
  anthropicApiKey: "",
  openrouterApiKey: "",
  provider: "anthropic",
  apiKeys: {},
  model: "claude-opus-4-6",
  maxSteps: 50,
  confirmShell: true,
  conversationsDir: path.join(process.cwd(), ".conversations"),
};

export function loadConfig(): AgentConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    return { ...DEFAULT_CONFIG, ...data };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Partial<AgentConfig>): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function hasApiKey(): boolean {
  const config = loadConfig();
  return !!config.anthropicApiKey;
}
