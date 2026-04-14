<p align="center">
  <img src="https://raw.githubusercontent.com/Worth-Doing/brand-assets/main/png/variants/04-horizontal.png" alt="WorthDoing.ai" width="600" />
</p>

<h1 align="center">WD Agent</h1>

<p align="center">
  A local AI agent operating system powered by Claude Opus 4.6 and WorthDoing Capabilities.
</p>

<p align="center">
  <em>Think. Act. Execute. — All from your terminal.</em>
</p>

---

<p align="center">
  <img src="https://img.shields.io/badge/Built%20by-WorthDoing.ai-6C47FF?style=for-the-badge&logo=data:image/svg+xml;base64,..." alt="Built by WorthDoing.ai" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Claude%20Opus%204.6-191919?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude Opus 4.6" />
  <img src="https://img.shields.io/badge/Node%2018%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 18+" />
  <img src="https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="npm" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Capabilities-22%2B-6C47FF?style=flat-square" alt="Capabilities 22+" />
  <img src="https://img.shields.io/badge/Local--first-green?style=flat-square" alt="Local-first" />
  <img src="https://img.shields.io/badge/Sequential%20execution-blue?style=flat-square" alt="Sequential execution" />
  <img src="https://img.shields.io/badge/File--based%20memory-orange?style=flat-square" alt="File-based memory" />
  <img src="https://img.shields.io/badge/Sub--agents-purple?style=flat-square" alt="Sub-agents" />
  <img src="https://img.shields.io/badge/Interactive%20CLI-teal?style=flat-square" alt="Interactive CLI" />
</p>

---

## Overview

**WD Agent is NOT a chatbot.**

It is a **local agent operating system** that:

1. **Thinks** using Claude Opus 4.6 (1M context) to reason about your request, break it into steps, and decide what action to take next.
2. **Acts** using [WorthDoing Capabilities](https://github.com/Worth-Doing/worthdoing-capabilities) -- a unified SDK that wraps Exa, Tavily, Firecrawl, OpenRouter, OpenAlex, FMP, EODHD, and more behind a single interface.
3. **Executes** through your local shell, running real commands, writing real files, and producing real output on your machine.
4. **Persists** every conversation, thought, action, and result in structured workspace folders so you can resume, audit, or replay any session.

Unlike traditional chatbots that produce text and stop, WD Agent operates in a **sequential think-act-observe loop**. It decides what to do, does it, observes the result, and then decides the next step -- continuing until the task is complete or it explicitly signals `done`.

Every session creates a self-contained workspace folder containing `history.json` (the full conversation), `steps.json` (every thought/action/result), and any files the agent produced. Nothing is hidden. Everything is inspectable.

---

## Quick Start

### Install globally

```bash
npm install -g wd-agent
```

### Launch the agent

```bash
wdagent
```

### What happens next

1. On first launch, the agent prompts you for your **Anthropic API key** (Claude Opus 4.6).
2. The key is stored locally in `~/.wdagent/config.json` -- never transmitted anywhere except the Anthropic API.
3. You type a message or task. The agent thinks, decides on an action, executes it, observes the result, and repeats until the task is done.
4. The entire session is persisted to `.conversations/<session-id>/` in your current working directory.

```
$ wdagent

  ╔══════════════════════════════════════════════╗
  ║           WD Agent v0.1.0                    ║
  ║   Powered by Claude Opus 4.6                 ║
  ║   Type /help for commands                    ║
  ╚══════════════════════════════════════════════╝

  Enter your Anthropic API key: sk-ant-api03-...
  API key saved.

  You: Research the top 5 AI startups in Montreal and write a report.

  [Think] I need to search for AI startups in Montreal using Exa...
  [Act]   capability → exa.search
  [Result] Found 23 results...

  [Think] Let me get more details on the top 5...
  [Act]   capability → firecrawl.scrape
  [Result] Scraped company page...

  [Think] I have enough information. Let me write the report...
  [Act]   file → write → report.md
  [Result] Created report.md (2,847 bytes)

  [Done] Report written to report.md in your workspace.
```

---

## Architecture

WD Agent follows a strict **sequential agent loop** architecture. There is no parallelism, no background jobs, no async fan-out. Each step completes before the next begins. This makes behavior deterministic, debuggable, and auditable.

```
┌─────────────────────────────────────────────────────────────┐
│                        WD Agent                             │
│                                                             │
│  User ──→ CLI ──→ Agent Loop ──→ Claude Opus 4.6 (1M ctx)  │
│                       │                                     │
│                       ▼                                     │
│                Action Executor                              │
│              ┌────────┼────────┐                            │
│              │        │        │                            │
│           Shell  Capabilities  Files                        │
│              │        │        │                            │
│              ▼        ▼        ▼                            │
│         Local OS   WorthDoing  Workspace                    │
│         Commands   Capabilities  I/O                        │
│                       │                                     │
│                       ▼                                     │
│            ┌─────────────────────┐                          │
│            │  Exa       Tavily   │                          │
│            │  Firecrawl OpenRouter│                         │
│            │  OpenAlex  FMP      │                          │
│            │  EODHD     ...      │                          │
│            └─────────────────────┘                          │
│                                                             │
│  Persistence: .conversations/<id>/                          │
│    ├── history.json   (full message log)                    │
│    ├── steps.json     (thought + action + result per step)  │
│    ├── agent.log      (structured debug log)                │
│    └── <files>        (any files the agent created)         │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input
    │
    ▼
┌──────────┐     ┌─────────────────┐     ┌──────────────────┐
│  1. Send  │────▶│  2. Claude       │────▶│  3. Parse JSON   │
│  to Claude│     │  thinks + returns│     │  thought/action  │
└──────────┘     │  JSON action     │     └──────────────────┘
                 └─────────────────┘              │
                                                   ▼
┌──────────┐     ┌─────────────────┐     ┌──────────────────┐
│  6. Loop  │◀───│  5. Append to   │◀────│  4. Execute      │
│  or Done  │     │  conversation   │     │  the action      │
└──────────┘     └─────────────────┘     └──────────────────┘
```

---

## Agent Loop

The core of WD Agent is a **sequential think-act-observe loop**. Here is exactly what happens on every iteration:

### Step 1: Think

The full conversation history (including all prior thoughts, actions, and results) is sent to Claude Opus 4.6. Claude is instructed to return a JSON object with two fields:

```json
{
  "thought": "I need to search for recent AI papers about transformers...",
  "action": {
    "type": "capability",
    "name": "exa.search",
    "input": { "query": "transformer architecture papers 2026", "numResults": 10 }
  }
}
```

The `thought` field is Claude's internal reasoning -- what it knows, what it needs, why it chose this action. The `action` field is the concrete step to execute.

### Step 2: Act

The `ActionExecutor` dispatches the action based on its `type`:

| Type | What it does |
|------|-------------|
| `shell` | Runs a command in the workspace directory via `child_process.exec` |
| `capability` | Calls a WorthDoing Capability (e.g., `exa.search`, `fmp.quote`) |
| `file` | Reads, writes, or edits a file in the workspace |
| `spawn_agent` | Creates a sub-agent to handle a delegated task |
| `message` | Returns a text message to the user (no side effect) |
| `done` | Signals that the task is complete |

### Step 3: Observe

The result of the action (stdout/stderr for shell, API response for capabilities, file contents for reads) is serialized and appended to the conversation as an observation. This becomes context for the next Think step.

### Step 4: Persist

Every step is recorded in `steps.json` with:

```json
{
  "step": 3,
  "timestamp": "2026-04-13T14:22:07.000Z",
  "thought": "I should write the findings to a markdown file...",
  "action": { "type": "file", "operation": "write", "path": "report.md", "content": "..." },
  "result": { "success": true, "output": { "path": "report.md", "size": 2847, "created": true }, "duration_ms": 12 }
}
```

### Step 5: Loop or Done

If the action type is `done`, the loop terminates and the agent presents the final message. Otherwise, the loop returns to Step 1 with the updated conversation history. A configurable `maxSteps` limit (default: 50) prevents infinite loops.

---

## Capabilities

WD Agent has access to **22+ capabilities** through the [WorthDoing Capabilities](https://github.com/Worth-Doing/worthdoing-capabilities) SDK. Each capability is a method on a provider client, called via `provider.method` syntax.

### Search & Discovery

| Capability | Method | Description | Required Key |
|-----------|--------|-------------|-------------|
| `exa.search` | Neural search | Semantic search across the web using Exa's neural index | `EXA_API_KEY` |
| `exa.findSimilar` | Find similar | Find pages similar to a given URL | `EXA_API_KEY` |
| `exa.contents` | Get contents | Retrieve full text content from a list of URLs | `EXA_API_KEY` |
| `exa.answer` | Answer | Get a direct answer to a question using Exa's RAG | `EXA_API_KEY` |
| `tavily.search` | Web search | Real-time web search optimized for AI agents | `TAVILY_API_KEY` |
| `tavily.extract` | Extract | Extract structured content from a list of URLs | `TAVILY_API_KEY` |

### Web Scraping & Crawling

| Capability | Method | Description | Required Key |
|-----------|--------|-------------|-------------|
| `firecrawl.scrape` | Scrape | Scrape a single URL and return clean markdown | `FIRECRAWL_API_KEY` |
| `firecrawl.search` | Search | Search the web and scrape results | `FIRECRAWL_API_KEY` |
| `firecrawl.map` | Map | Discover and map all URLs on a domain | `FIRECRAWL_API_KEY` |

### AI & Language Models

| Capability | Method | Description | Required Key |
|-----------|--------|-------------|-------------|
| `openrouter.chat` | Chat completion | Send a chat completion request via OpenRouter (access to 100+ models) | `OPENROUTER_API_KEY` |
| `openrouter.models` | List models | List available models and their pricing | `OPENROUTER_API_KEY` |

### Academic Research

| Capability | Method | Description | Required Key |
|-----------|--------|-------------|-------------|
| `openalex.works` | Search works | Search academic papers, articles, and publications | None (free) |
| `openalex.authors` | Search authors | Search for academic authors and their publication records | None (free) |
| `openalex.institutions` | Search institutions | Search for universities, labs, and research organizations | None (free) |

### Financial Data

| Capability | Method | Description | Required Key |
|-----------|--------|-------------|-------------|
| `fmp.quote` | Real-time quote | Get a real-time stock quote (price, volume, change) | `FMP_API_KEY` |
| `fmp.profile` | Company profile | Get company description, CEO, sector, market cap, etc. | `FMP_API_KEY` |
| `fmp.financialStatements` | Financials | Get income statement, balance sheet, or cash flow data | `FMP_API_KEY` |
| `fmp.historicalPrices` | Historical prices | Get historical daily/weekly/monthly price data | `FMP_API_KEY` |
| `eodhd.eod` | End-of-day prices | Get end-of-day historical price data for any exchange | `EODHD_API_KEY` |
| `eodhd.fundamentals` | Fundamentals | Get detailed fundamental data (financials, valuation, etc.) | `EODHD_API_KEY` |
| `eodhd.search` | Search tickers | Search for ticker symbols across global exchanges | `EODHD_API_KEY` |

### Built-in Actions (no API key needed)

| Action | Description |
|--------|-------------|
| `shell` | Execute any shell command in the workspace directory |
| `file.read` | Read any file in the workspace |
| `file.write` | Create or overwrite a file in the workspace |
| `file.edit` | Edit an existing file in the workspace |
| `spawn_agent` | Delegate a subtask to a new sub-agent instance |
| `message` | Send a text message to the user |
| `done` | Signal task completion |

---

## Commands

WD Agent provides a CLI with the following top-level commands:

```
wdagent                    Launch interactive mode (default)
wdagent run "task"         Execute a one-shot task (agent runs to completion)
wdagent list               List all saved conversations with status
wdagent resume <id>        Resume a previous conversation by its ID
wdagent help               Show help and usage information
```

### Examples

```bash
# Interactive mode -- start a new session
wdagent

# Run a task directly
wdagent run "Find the current stock price of AAPL and write it to price.txt"

# List previous sessions
wdagent list
# Output:
#   ID         Created       Steps  Status     Title
#   a1b2c3d4   2026-04-13    7      completed  Research AI startups
#   e5f6g7h8   2026-04-12    3      paused     Stock analysis

# Resume a paused session
wdagent resume e5f6g7h8
```

---

## Slash Commands

Inside interactive mode, the following slash commands are available:

| Command | Description |
|---------|-------------|
| `/help` | Show all available slash commands and their descriptions |
| `/new` | Start a new conversation (archives the current one) |
| `/list` | List all saved conversations with their ID, title, step count, and status |
| `/resume <id>` | Resume a previous conversation by its ID |
| `/config` | View or modify configuration (API keys, model, max steps, etc.) |
| `/caps` | List all available capabilities and their required API keys |
| `/steps` | Show all steps taken in the current conversation |
| `/clear` | Clear the terminal screen |
| `/exit` | Exit the agent (conversation is automatically saved) |

### Usage

```
You: /caps

Available Capabilities:
  exa.search          Neural web search
  exa.findSimilar     Find similar pages
  exa.contents        Get page contents
  exa.answer          Direct answer via RAG
  tavily.search       Real-time web search
  tavily.extract      Extract from URLs
  firecrawl.scrape    Scrape URL to markdown
  firecrawl.search    Search + scrape
  firecrawl.map       Map domain URLs
  openrouter.chat     Chat completion (100+ models)
  openrouter.models   List models
  openalex.works      Search academic papers
  openalex.authors    Search authors
  openalex.institutions  Search institutions
  fmp.quote           Real-time stock quote
  fmp.profile         Company profile
  fmp.financialStatements  Financial statements
  fmp.historicalPrices     Historical price data
  eodhd.eod           End-of-day prices
  eodhd.fundamentals  Fundamental data
  eodhd.search        Search tickers
```

---

## Conversation System

Every conversation creates a self-contained workspace folder. By default, workspaces are stored in `.conversations/` relative to your current working directory.

### Folder Structure

```
.conversations/
└── a1b2c3d4-5678-90ab-cdef-1234567890ab/
    ├── history.json      Full message log (user + assistant + system)
    ├── steps.json        Every think/act/observe cycle
    ├── agent.log         Structured debug log (JSON lines)
    ├── report.md         Example: a file the agent created
    └── data/
        └── prices.csv    Example: another file the agent created
```

### history.json

The complete conversation log. Each entry is an `AgentMessage`:

```json
[
  {
    "role": "user",
    "content": "Research the top 5 AI startups in Montreal and write a report.",
    "timestamp": "2026-04-13T14:20:00.000Z"
  },
  {
    "role": "assistant",
    "content": "{\"thought\": \"I need to search for AI startups...\", \"action\": {\"type\": \"capability\", \"name\": \"exa.search\", ...}}",
    "timestamp": "2026-04-13T14:20:02.000Z"
  }
]
```

### steps.json

A structured record of every action the agent took. Each entry is a `StepRecord`:

```json
[
  {
    "step": 1,
    "timestamp": "2026-04-13T14:20:02.000Z",
    "thought": "I need to search for AI startups in Montreal. I'll use Exa's neural search to find recent and relevant results.",
    "action": {
      "type": "capability",
      "name": "exa.search",
      "input": { "query": "top AI startups Montreal 2026", "numResults": 15 }
    },
    "result": {
      "success": true,
      "output": { "results": ["..."] },
      "duration_ms": 1240
    }
  }
]
```

### Conversation Metadata

Each conversation also tracks metadata as a `ConversationMeta` object:

```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "created": "2026-04-13T14:20:00.000Z",
  "updated": "2026-04-13T14:25:30.000Z",
  "title": "Research AI startups in Montreal",
  "steps": 5,
  "status": "completed"
}
```

---

## Action Types

The agent communicates its intentions through JSON action objects. Each action has a `type` field that determines how it is executed.

### `shell` -- Execute a Shell Command

Runs a command in the workspace directory using `child_process.exec`. Output is captured (stdout + stderr) and returned as the observation. Commands are subject to safety filtering (see [Safety](#safety)).

```json
{
  "type": "shell",
  "command": "ls -la"
}
```

**Result:**
```json
{
  "success": true,
  "output": { "stdout": "total 24\ndrwxr-xr-x ...", "stderr": "", "exitCode": 0 },
  "duration_ms": 45
}
```

### `capability` -- Call a WorthDoing Capability

Invokes a capability from the WorthDoing Capabilities SDK. The `name` field uses `provider.method` syntax. The `input` field is passed directly to the capability method.

```json
{
  "type": "capability",
  "name": "exa.search",
  "input": {
    "query": "transformer architecture papers 2026",
    "numResults": 10,
    "type": "neural"
  }
}
```

**Result:**
```json
{
  "success": true,
  "output": { "results": [{ "title": "...", "url": "...", "score": 0.95 }] },
  "duration_ms": 1340
}
```

### `file` -- Read, Write, or Edit a File

Performs file I/O within the workspace directory. Paths are resolved relative to the workspace root. Path traversal (e.g., `../../etc/passwd`) is blocked.

**Write a file:**
```json
{
  "type": "file",
  "operation": "write",
  "path": "report.md",
  "content": "# AI Startups in Montreal\n\n..."
}
```

**Read a file:**
```json
{
  "type": "file",
  "operation": "read",
  "path": "report.md"
}
```

**Edit a file:**
```json
{
  "type": "file",
  "operation": "edit",
  "path": "report.md",
  "content": "# Updated Report\n\n..."
}
```

### `spawn_agent` -- Delegate to a Sub-Agent

Creates a new sub-agent instance to handle a specific subtask. The sub-agent gets its own conversation context and workspace, and its results are returned to the parent agent.

```json
{
  "type": "spawn_agent",
  "task": "Analyze the financial statements of AAPL for the last 3 years",
  "agentName": "financial-analyst"
}
```

### `message` -- Send a Message to the User

Returns a text message to the user without performing any side effects. Used for progress updates, clarifying questions, or intermediate summaries.

```json
{
  "type": "message",
  "text": "I found 23 results. Let me narrow them down to the top 5 based on funding and relevance."
}
```

### `done` -- Signal Task Completion

Signals that the agent has finished the task. The `text` field contains the final summary or result.

```json
{
  "type": "done",
  "text": "Report written to report.md. It covers the top 5 AI startups in Montreal with funding details, team size, and product descriptions."
}
```

---

## Configuration

WD Agent stores its configuration in `~/.wdagent/config.json`. This file is created automatically on first run.

### Default Configuration

```json
{
  "anthropicApiKey": "sk-ant-api03-...",
  "apiKeys": {
    "exa": "your-exa-key",
    "tavily": "your-tavily-key",
    "firecrawl": "your-firecrawl-key",
    "openrouter": "your-openrouter-key",
    "fmp": "your-fmp-key",
    "eodhd": "your-eodhd-key"
  },
  "model": "claude-opus-4-6-20250219",
  "maxSteps": 50,
  "confirmShell": true,
  "conversationsDir": ".conversations"
}
```

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `anthropicApiKey` | `string` | `""` | Your Anthropic API key for Claude Opus 4.6. **Required.** |
| `apiKeys` | `object` | `{}` | API keys for WorthDoing Capabilities providers. Only keys for capabilities you want to use are needed. |
| `apiKeys.exa` | `string` | `undefined` | API key for [Exa](https://exa.ai/) neural search |
| `apiKeys.tavily` | `string` | `undefined` | API key for [Tavily](https://tavily.com/) web search |
| `apiKeys.firecrawl` | `string` | `undefined` | API key for [Firecrawl](https://firecrawl.dev/) web scraping |
| `apiKeys.openrouter` | `string` | `undefined` | API key for [OpenRouter](https://openrouter.ai/) multi-model access |
| `apiKeys.openalex` | `string` | `undefined` | API key for [OpenAlex](https://openalex.org/) (optional -- free tier available) |
| `apiKeys.fmp` | `string` | `undefined` | API key for [Financial Modeling Prep](https://financialmodelingprep.com/) |
| `apiKeys.eodhd` | `string` | `undefined` | API key for [EODHD](https://eodhd.com/) financial data |
| `model` | `string` | `"claude-opus-4-6-20250219"` | The Anthropic model ID to use. Defaults to Claude Opus 4.6. |
| `maxSteps` | `number` | `50` | Maximum number of think-act-observe cycles per conversation before the agent stops. |
| `confirmShell` | `boolean` | `true` | When `true`, the agent asks for user confirmation before executing shell commands. |
| `conversationsDir` | `string` | `".conversations"` | Directory where conversation workspaces are stored (relative to CWD). |

### Modifying Configuration

You can edit `~/.wdagent/config.json` directly, or use the `/config` slash command in interactive mode:

```
You: /config set maxSteps 100
Config updated: maxSteps = 100

You: /config set apiKeys.exa your-exa-key-here
Config updated: apiKeys.exa = your-exa-key-here

You: /config show
Current configuration:
  model:            claude-opus-4-6-20250219
  maxSteps:         100
  confirmShell:     true
  conversationsDir: .conversations
  apiKeys:          exa, tavily (2 configured)
```

---

## Example Session

Here is a realistic terminal session demonstrating how WD Agent researches a topic and produces a deliverable:

```
$ wdagent

  ╔══════════════════════════════════════════════╗
  ║           WD Agent v0.1.0                    ║
  ║   Powered by Claude Opus 4.6                 ║
  ║   Type /help for commands                    ║
  ╚══════════════════════════════════════════════╝

You: Find the 3 most cited papers on retrieval-augmented generation
     published in 2024-2025, summarize each, and write a report.

  [Step 1]
  [Think] I need to search for highly-cited RAG papers from 2024-2025.
          I'll use OpenAlex to search academic works since it has
          citation data.
  [Act]   capability → openalex.works
          { "query": "retrieval augmented generation", "filter": "from_publication_date:2024-01-01", "sort": "cited_by_count:desc", "per_page": 3 }
  [Result] Found 3 papers:
           1. "RAG-2: Scaling Retrieval-Augmented Generation" (cited: 847)
           2. "Self-RAG: Learning to Retrieve, Generate, and Critique" (cited: 612)
           3. "CRAG: Corrective Retrieval Augmented Generation" (cited: 498)
  [Time]  1,240ms

  [Step 2]
  [Think] I have the top 3 papers with their metadata. Let me get
          the full abstracts and details for each paper. I'll search
          for each paper individually to get complete information.
  [Act]   capability → exa.search
          { "query": "RAG-2 Scaling Retrieval-Augmented Generation paper 2024", "numResults": 1, "type": "neural" }
  [Result] Found paper URL: https://arxiv.org/abs/2407.12345
  [Time]  890ms

  [Step 3]
  [Think] Let me scrape the arxiv page to get the full abstract.
  [Act]   capability → firecrawl.scrape
          { "url": "https://arxiv.org/abs/2407.12345" }
  [Result] Got full paper abstract and metadata (2.4KB)
  [Time]  2,100ms

  [Step 4-6]
  ... (similar searches for papers 2 and 3) ...

  [Step 7]
  [Think] I now have detailed information on all 3 papers including
          titles, authors, abstracts, citation counts, and key
          contributions. Let me write a comprehensive report.
  [Act]   file → write → rag-papers-report.md
  [Result] Created rag-papers-report.md (4,231 bytes)
  [Time]  15ms

  [Step 8]
  [Think] The report is complete. Let me present the summary.
  [Act]   done
  [Done]  Report written to rag-papers-report.md

          Summary of findings:
          1. RAG-2 (847 citations) - Scales RAG to massive corpora
             with hierarchical retrieval and adaptive chunking.
          2. Self-RAG (612 citations) - Teaches LLMs to self-reflect
             on when and what to retrieve, improving factual accuracy.
          3. CRAG (498 citations) - Adds a corrective retrieval step
             that evaluates and refines retrieved documents before
             generation.

  Session saved: .conversations/b7e2f1a4-.../

You: /steps

  Step  Action          Target                Duration  Status
  1     capability      openalex.works        1,240ms   success
  2     capability      exa.search            890ms     success
  3     capability      firecrawl.scrape      2,100ms   success
  4     capability      exa.search            920ms     success
  5     capability      firecrawl.scrape      1,980ms   success
  6     capability      exa.search            850ms     success
  7     file            write → report.md     15ms      success
  8     done            --                    0ms       success

  Total: 8 steps, 7,995ms

You: /exit
  Session saved. Goodbye.
```

---

## Safety

WD Agent includes multiple safety mechanisms to prevent accidental or malicious damage to your system.

### Blocked Shell Commands

The following patterns are blocked and will never be executed, regardless of what Claude requests:

| Blocked Pattern | Reason |
|----------------|--------|
| `rm -rf /` | Recursive deletion of root filesystem |
| `rm -rf /*` | Recursive deletion of all root-level directories |
| `mkfs` | Formatting a filesystem |
| `dd if=` | Raw disk write (can destroy partitions) |
| `:(){` | Fork bomb |
| `> /dev/sda` | Direct write to disk device |
| `chmod -R 777 /` | Removing all file permissions system-wide |
| `chown -R` | Recursive ownership change |
| `shutdown` / `reboot` / `halt` / `poweroff` | System power commands |
| `init 0` / `init 6` | System runlevel changes |

### Workspace Isolation

- All file operations are restricted to the workspace directory.
- Path traversal attempts (e.g., `../../etc/passwd`) are detected and blocked.
- File paths are resolved using `path.resolve()` and verified to start with the workspace root.

### Shell Command Confirmation

When `confirmShell` is `true` (default), the agent will ask for your explicit confirmation before executing any shell command:

```
[Act] shell → npm install express
  Allow this command? [y/N]: y
[Result] added 64 packages in 2.1s
```

### Output Limits

- Shell command output (stdout) is truncated to **10,000 characters** to prevent memory issues.
- Shell command stderr is truncated to **5,000 characters**.
- File reads are truncated to **50,000 characters**.
- Shell commands have a **30-second timeout** to prevent hangs.
- The output buffer is limited to **5MB** per command.

### Step Limit

The `maxSteps` configuration (default: 50) prevents infinite loops. If the agent reaches this limit, it stops and reports what it accomplished.

---

## Roadmap

### Q2 2026

- [ ] Plugin system for custom capabilities
- [ ] Streaming responses (token-by-token display)
- [ ] Multi-file workspace templates
- [ ] Conversation branching (fork a conversation at any step)
- [ ] Export conversations to Markdown/PDF

### Q3 2026

- [ ] Web UI dashboard for conversation management
- [ ] Parallel sub-agent execution
- [ ] Memory system (cross-conversation knowledge persistence)
- [ ] Tool-use verification (human-in-the-loop for capability calls)
- [ ] Custom system prompts per conversation

### Q4 2026

- [ ] Team mode (shared conversations and workspaces)
- [ ] Remote execution (run agents on cloud infrastructure)
- [ ] Webhook triggers (start agent tasks via HTTP)
- [ ] Integration with CI/CD pipelines
- [ ] Audit log export and compliance features

---

## Contributing

We welcome contributions from the community. Here's how to get started:

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Worth-Doing/wd-agent.git
cd wd-agent

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode (auto-rebuild on changes)
npm run dev

# Run tests
npm test

# Type-check without emitting
npm run typecheck
```

### Project Structure

```
wd-agent/
├── src/
│   ├── index.ts                 Public API exports
│   ├── agent/
│   │   ├── types.ts             Core type definitions
│   │   └── loop.ts              The main agent loop
│   ├── cli/
│   │   └── app.ts               CLI entry point and interactive REPL
│   ├── config/
│   │   └── settings.ts          Configuration loading and saving
│   ├── runtime/
│   │   ├── executor.ts          Action dispatcher
│   │   ├── shell.ts             Shell command runner with safety checks
│   │   ├── capabilities.ts      WorthDoing Capabilities bridge
│   │   └── files.ts             File I/O handler with path security
│   └── utils/
│       ├── colors.ts            Terminal color helpers
│       └── logger.ts            Structured JSON logger
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── LICENSE
```

### Guidelines

1. **TypeScript only** -- all code must be written in TypeScript with strict mode enabled.
2. **No external runtime dependencies** beyond `@anthropic-ai/sdk` and `worthdoing-capabilities`. Keep the dependency tree minimal.
3. **Test your changes** -- run `npm test` before submitting a PR.
4. **Sequential by design** -- do not introduce parallelism into the agent loop. The sequential nature is a feature, not a limitation.
5. **Safety first** -- any new action type must include appropriate safety checks and output limits.

### Submitting a Pull Request

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Make your changes and add tests.
4. Run `npm test && npm run typecheck` to verify everything passes.
5. Commit with a clear message describing the change.
6. Open a pull request against `main`.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

Copyright (c) 2026 [WorthDoing AI](https://worthdoing.ai)

---

<p align="center">
  <img src="https://raw.githubusercontent.com/Worth-Doing/brand-assets/main/png/variants/04-horizontal.png" alt="WorthDoing.ai" width="300" />
</p>

<p align="center">
  Built with conviction by <a href="https://worthdoing.ai">WorthDoing AI</a>
</p>

<p align="center">
  <a href="https://worthdoing.ai">Website</a> &middot;
  <a href="https://github.com/Worth-Doing">GitHub</a> &middot;
  <a href="https://github.com/Worth-Doing/wd-agent">Repository</a>
</p>
