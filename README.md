<p align="center">
  <img src="https://raw.githubusercontent.com/Worth-Doing/brand-assets/main/png/variants/04-horizontal.png" alt="WorthDoing.ai" width="600" />
</p>

<h1 align="center">WD Agent</h1>

<p align="center">
  <strong>A local AI agent operating system for your terminal.</strong>
</p>

<p align="center">
  <em>Think. Act. Execute. Persist. — All powered by Claude and WorthDoing Capabilities.</em>
</p>

<br />

<!-- ════════════════════════════════════════════════════════════════════════ -->
<!--                          BADGE ROWS                                    -->
<!-- ════════════════════════════════════════════════════════════════════════ -->

<p align="center">
  <img src="https://img.shields.io/badge/Built%20by-WorthDoing.ai-0055FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzAwNTVGRiIvPjx0ZXh0IHg9IjUiIHk9IjE4IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiPnc8L3RleHQ+PC9zdmc+" alt="Built by WorthDoing.ai" />
  <img src="https://img.shields.io/badge/Claude%20Opus%204.6-191919?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude Opus 4.6" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node%2018%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 18+" />
  <img src="https://img.shields.io/badge/npm-wd--agent-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="npm wd-agent" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/22%2B%20Capabilities-6C47FF?style=flat-square" alt="22+ Capabilities" />
  <img src="https://img.shields.io/badge/Local--first-22C55E?style=flat-square" alt="Local-first" />
  <img src="https://img.shields.io/badge/Zero%20cloud%20dependency-16A34A?style=flat-square" alt="Zero cloud dependency" />
  <img src="https://img.shields.io/badge/OpenRouter%20350%2B%20models-7C3AED?style=flat-square" alt="OpenRouter 350+ models" />
  <img src="https://img.shields.io/badge/Sequential%20execution-2563EB?style=flat-square" alt="Sequential execution" />
  <img src="https://img.shields.io/badge/File--based%20memory-F59E0B?style=flat-square" alt="File-based memory" />
  <img src="https://img.shields.io/badge/Interactive%20CLI-0D9488?style=flat-square" alt="Interactive CLI" />
</p>

<br />

---

<br />

## What is WD Agent?

**WD Agent is NOT a chatbot.** It is a **local agent operating system** that runs entirely on your machine, using large language models as a reasoning engine and WorthDoing Capabilities as an execution layer.

### The Agent Loop

WD Agent operates through a continuous **Think --> Act --> Observe --> Persist** loop:

1. **Think** -- Claude Opus 4.6 (or any of 350+ models via OpenRouter) reasons about your request, analyzes prior results, and decides the single best next action.
2. **Act** -- The chosen action is executed locally: a shell command, a capability call, a file operation, or a sub-agent delegation.
3. **Observe** -- The result of the action (stdout, API response, file contents) is captured and fed back into the conversation context.
4. **Persist** -- Every thought, action, and result is recorded in structured JSON files on disk. Nothing is ephemeral. Everything is replayable.

The loop continues autonomously until the task is complete or the agent explicitly signals `done`. There is no parallelism, no background jobs, no async fan-out. Each step completes fully before the next begins. This makes every session **deterministic, debuggable, and auditable**.

### Design Principles

- **Never hardcodes API calls.** All external service access goes through the WorthDoing Capabilities SDK, ensuring a unified interface, consistent error handling, and clean separation of concerns.
- **Shell execution with safety controls.** Dangerous commands are blocked. User confirmation is required by default. Output is truncated to prevent memory issues.
- **File operations with workspace isolation.** Path traversal is blocked. All reads and writes are confined to the conversation workspace directory.
- **Persistent conversations.** Every session creates a self-contained folder with the full message log, step-by-step execution trace, structured debug logs, and any files the agent produced.

### What Makes WD Agent Different?

| Traditional Chatbot | WD Agent |
|:-----|:-----|
| Generates text and stops | Executes a multi-step plan autonomously |
| No access to external tools | 22+ capabilities spanning search, finance, research, scraping, and LLMs |
| Cloud-hosted, opaque | Local-first, fully inspectable, every step logged to disk |
| Single model, single provider | Dual provider support -- Anthropic direct or OpenRouter with 350+ models |
| No persistent state | File-based conversation memory with resume, replay, and branching |
| No file output | Creates real files, runs real commands, produces real deliverables |
| No sub-task delegation | Spawns sub-agents for parallel workstreams |

<br />

---

<br />

## Quick Start

```bash
# Install globally
npm install -g wd-agent

# Launch interactive agent
wdagent

# Or run a task directly
wdagent run "Research the top 5 AI frameworks and write a comparison report"
```

<br />

---

<br />

## First Launch Experience

When you run `wdagent` for the first time, a guided setup flow walks you through configuration:

### Step 1: Choose Your Provider

```
  ╔══════════════════════════════════════════════════════╗
  ║              WD Agent v0.1.0                        ║
  ║   Welcome! Let's get you set up.                    ║
  ╚══════════════════════════════════════════════════════╝

  Choose your LLM provider:

    1. Anthropic   (Direct Claude API — recommended)
    2. OpenRouter   (350+ models: Claude, GPT, Gemini, Llama, Mistral, DeepSeek...)

  Selection: 1
```

### Step 2: Enter Your API Key

```
  Enter your Anthropic API key: sk-ant-api03-...
  API key validated. Connected to Claude Opus 4.6.
  Key saved to ~/.wdagent/config.json.
```

### Step 3: (OpenRouter Only) Interactive Model Browser

If you chose OpenRouter, an interactive model browser appears:

```
  Fetching available models from OpenRouter...

  ┌───────────────────────────────────────────────────────────────┐
  │  #   Model                          Context    $/1M tokens   │
  ├───────────────────────────────────────────────────────────────┤
  │  1   anthropic/claude-opus-4-6      1M         $15 / $75     │
  │  2   anthropic/claude-sonnet-4      200K       $3  / $15     │
  │  3   openai/gpt-4o                  128K       $5  / $15     │
  │  4   google/gemini-2.5-pro          1M         $1.25 / $10   │
  │  5   meta-llama/llama-4-maverick    1M         $0.20 / $0.60 │
  │  6   mistralai/mistral-large        128K       $2  / $6      │
  │  7   deepseek/deepseek-r1           64K        $0.55 / $2.19 │
  │  ...                                                          │
  │  [↑/↓ to scroll, / to filter, Enter to select]               │
  └───────────────────────────────────────────────────────────────┘

  Selected: anthropic/claude-opus-4-6
```

### Step 4: System Info Panel

```
  ┌──────────────────────────────────────────────────┐
  │  System Information                               │
  │                                                   │
  │  OS:        macOS 15.2 (Darwin 25.2.0)            │
  │  Node:      v22.4.0                               │
  │  Shell:     /bin/zsh                               │
  │  Workspace: /Users/you/projects                    │
  │  Provider:  Anthropic (Claude Opus 4.6)            │
  │  Caps:      22 capabilities available              │
  │  Config:    ~/.wdagent/config.json                 │
  └──────────────────────────────────────────────────┘

  Ready. Type your message or /help for commands.
```

<br />

---

<br />

## Dual Provider Support

WD Agent supports two LLM providers, switchable at any time.

### Anthropic (Direct Claude API)

- Direct access to Claude Opus 4.6 with 1M token context
- Lowest latency, most reliable for the primary reasoning engine
- Requires an `ANTHROPIC_API_KEY`

### OpenRouter (350+ Models)

- Access to **350+ language models** from every major provider:
  - **Anthropic:** Claude Opus, Sonnet, Haiku
  - **OpenAI:** GPT-4o, GPT-4 Turbo, o1, o3
  - **Google:** Gemini 2.5 Pro, Gemini 2.5 Flash
  - **Meta:** Llama 4 Maverick, Llama 4 Scout, Llama 3.3
  - **Mistral:** Mistral Large, Medium, Small, Codestral
  - **DeepSeek:** DeepSeek R1, DeepSeek V3
  - **Qwen, Cohere, Perplexity, 01.AI, and hundreds more**
- Interactive model browser with pricing, context length, and filtering
- Requires an `OPENROUTER_API_KEY`

### Switching Models at Runtime

Use the `/model` slash command inside any session to browse and switch models on the fly:

```
You: /model

  Current model: anthropic/claude-opus-4-6

  ┌───────────────────────────────────────────────────────────────┐
  │  Available Models (via OpenRouter)                            │
  │  [Type to filter, ↑/↓ to navigate, Enter to select]         │
  │                                                               │
  │  > claude                                                     │
  │                                                               │
  │  1. anthropic/claude-opus-4-6       1M ctx    $15/$75        │
  │  2. anthropic/claude-sonnet-4       200K ctx  $3/$15         │
  │  3. anthropic/claude-haiku-3.5      200K ctx  $0.80/$4       │
  └───────────────────────────────────────────────────────────────┘

  Switched to: anthropic/claude-sonnet-4
```

<br />

---

<br />

## Architecture

```
                        ┌─────────────┐
                        │   You (CLI)  │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │  Agent Loop  │
                        │  ┌────────┐  │
                        │  │ Think  │──┼──► Claude Opus 4.6
                        │  │  Act   │  │   (or any OpenRouter model)
                        │  │Observe │  │
                        │  │Persist │  │
                        │  └────────┘  │
                        └──────┬──────┘
                               │
                  ┌────────────┼────────────┐
                  │            │            │
            ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
            │   Shell    │ │ Files │ │Capabilities│
            │  Executor  │ │Handler│ │   Bridge   │
            └───────────┘ └───────┘ └─────┬─────┘
                                          │
                        ┌─────────────────▼──────────────────┐
                        │     WorthDoing Capabilities SDK     │
                        ├────────────────────────────────────┤
                        │ Exa · Tavily · Firecrawl           │
                        │ OpenRouter · OpenAlex               │
                        │ FMP · EODHD · Documents             │
                        └────────────────────────────────────┘
```

### Data Flow (Detailed)

```
 User Input
     │
     ▼
 ┌──────────────────┐    ┌──────────────────────┐    ┌──────────────────┐
 │  1. Build Context │───▶│  2. Send to Claude    │───▶│  3. Parse JSON   │
 │  (system prompt + │    │  (system prompt +     │    │  {thought, action}│
 │   history +       │    │   full conversation   │    │                   │
 │   prior results)  │    │   context)            │    │                   │
 └──────────────────┘    └──────────────────────┘    └────────┬─────────┘
                                                               │
 ┌──────────────────┐    ┌──────────────────────┐    ┌────────▼─────────┐
 │  6. Loop back to  │◀──│  5. Append result to  │◀──│  4. Execute the  │
 │  step 1, or       │    │  conversation store   │    │  action (shell / │
 │  return "done"    │    │  + steps.json         │    │  capability /    │
 │  to user          │    │                       │    │  file / agent)   │
 └──────────────────┘    └──────────────────────┘    └──────────────────┘
```

### Persistence Layer

```
.conversations/
└── a1b2c3d4-5678-90ab-cdef-1234567890ab/
    ├── history.json      Full message log (user + assistant + system)
    ├── steps.json        Every think/act/observe cycle with timing
    ├── agent.log         Structured debug log (JSON lines)
    ├── report.md         Example: a file the agent created
    └── data/
        └── prices.csv    Example: another file the agent created
```

<br />

---

<br />

## Available Capabilities

WD Agent ships with **22+ capabilities** through the [WorthDoing Capabilities](https://github.com/Worth-Doing/worthdoing-capabilities) SDK. Each capability is invoked using `provider.method` syntax (e.g., `exa.search`, `fmp.quote`).

### Search & Discovery

| Capability | Methods | Description | Required Key |
|:-----------|:--------|:------------|:-------------|
| **exa** | `search`, `findSimilar`, `contents`, `answer` | Semantic web search powered by Exa's neural index. Supports similarity search, full content retrieval, and direct RAG-based answers. | `EXA_API_KEY` |
| **tavily** | `search`, `extract` | AI-powered real-time web search optimized for agent workflows. Returns structured answers with source citations. | `TAVILY_API_KEY` |

### Web Scraping & Crawling

| Capability | Methods | Description | Required Key |
|:-----------|:--------|:------------|:-------------|
| **firecrawl** | `scrape`, `search`, `map` | Industrial-grade web scraping. Converts any URL to clean markdown, searches the web with scraping, and maps all URLs on a domain. | `FIRECRAWL_API_KEY` |

### AI & Language Models

| Capability | Methods | Description | Required Key |
|:-----------|:--------|:------------|:-------------|
| **openrouter** | `chat`, `models` | Access 350+ language models (Claude, GPT, Gemini, Llama, Mistral, DeepSeek, and more) through a unified API. List models with pricing and context info. | `OPENROUTER_API_KEY` |

### Academic Research

| Capability | Methods | Description | Required Key |
|:-----------|:--------|:------------|:-------------|
| **openalex** | `works`, `authors`, `institutions` | Search 250M+ scholarly papers, authors, and institutions from the OpenAlex academic graph. Includes citation counts, abstracts, affiliations, and open access links. | None (free) |

### Financial Data

| Capability | Methods | Description | Required Key |
|:-----------|:--------|:------------|:-------------|
| **fmp** | `quote`, `profile`, `financialStatements`, `historicalPrices` | Real-time stock quotes, company profiles (CEO, sector, market cap), income/balance/cashflow statements, and historical OHLCV price data. | `FMP_API_KEY` |
| **eodhd** | `eod`, `fundamentals`, `search` | End-of-day historical price data across global exchanges, deep fundamental data (financials, valuation ratios, dividends), and ticker search. | `EODHD_API_KEY` |

### Document Generation

| Capability | Methods | Description | Required Key |
|:-----------|:--------|:------------|:-------------|
| **documents** | `generateLatex` | Generate production-quality LaTeX documents from structured input. Useful for academic papers, reports, and formatted deliverables. | None |

### Built-in Actions (No API Key Needed)

| Action | Description |
|:-------|:------------|
| `shell` | Execute any shell command in the workspace directory (with safety controls) |
| `file.read` | Read any file in the workspace |
| `file.write` | Create or overwrite a file in the workspace |
| `file.edit` | Edit an existing file in the workspace |
| `spawn_agent` | Delegate a subtask to a new sub-agent with its own context |
| `message` | Send a progress update or clarifying question to the user |
| `done` | Signal that the task is complete |

<br />

---

<br />

## CLI Commands

| Command | Description | Example |
|:--------|:------------|:--------|
| `wdagent` | Launch interactive mode (default) | `wdagent` |
| `wdagent run "task"` | Execute a task non-interactively (agent runs to completion) | `wdagent run "Summarize today's tech news"` |
| `wdagent list` | List all saved conversations with ID, date, steps, status, and title | `wdagent list` |
| `wdagent resume <id>` | Resume a previous conversation by its ID | `wdagent resume a1b2c3d4` |
| `wdagent help` | Show help and usage information | `wdagent help` |
| `wdagent version` | Show the installed version | `wdagent version` |

### Examples

```bash
# Start a new interactive session
wdagent

# Run a one-shot task
wdagent run "Find the current stock price of AAPL and write it to price.txt"

# List all previous sessions
wdagent list
#   ID         Created       Steps  Status     Title
#   a1b2c3d4   2026-04-13    7      completed  Research AI startups
#   e5f6g7h8   2026-04-12    3      paused     Stock analysis
#   f9g0h1i2   2026-04-11    12     completed  Transformer papers review

# Resume a paused session
wdagent resume e5f6g7h8
```

<br />

---

<br />

## Interactive Commands (Slash Commands)

Inside interactive mode, the following slash commands are available:

| Command | Description |
|:--------|:------------|
| `/help` | Show all available slash commands and their descriptions |
| `/new` | Start a new conversation (archives the current one) |
| `/list` | List all saved conversations with ID, title, step count, and status |
| `/resume <id>` | Resume a previous conversation by its ID |
| `/model` | Browse and switch models interactively (OpenRouter provider) |
| `/config` | View or modify configuration (API keys, model, max steps, etc.) |
| `/caps` | List all available capabilities and their required API keys |
| `/steps` | Show all steps taken in the current conversation with timing |
| `/clear` | Clear the terminal screen |
| `/exit` | Exit the agent (conversation is automatically saved) |

### Usage Example

```
You: /caps

Available Capabilities:
  exa.search              Neural web search
  exa.findSimilar         Find similar pages
  exa.contents            Get page contents
  exa.answer              Direct answer via RAG
  tavily.search           Real-time web search
  tavily.extract          Extract from URLs
  firecrawl.scrape        Scrape URL to markdown
  firecrawl.search        Search + scrape
  firecrawl.map           Map domain URLs
  openrouter.chat         Chat completion (350+ models)
  openrouter.models       List models
  openalex.works          Search academic papers
  openalex.authors        Search authors
  openalex.institutions   Search institutions
  fmp.quote               Real-time stock quote
  fmp.profile             Company profile
  fmp.financialStatements Financial statements
  fmp.historicalPrices    Historical price data
  eodhd.eod              End-of-day prices
  eodhd.fundamentals     Fundamental data
  eodhd.search           Search tickers
  documents.generateLatex Generate LaTeX documents
```

<br />

---

<br />

## Action Types

The agent communicates its intentions through structured JSON action objects. Each action has a `type` field that determines how it is executed.

### `shell` -- Execute a Shell Command

Runs a command in the workspace directory using `child_process.exec`. Output (stdout + stderr) is captured and returned as the observation. Subject to safety filtering and optional user confirmation.

```json
{
  "thought": "I need to check what files exist in the workspace.",
  "action": {
    "type": "shell",
    "command": "ls -la"
  }
}
```

**Result:**
```json
{
  "success": true,
  "output": { "stdout": "total 24\ndrwxr-xr-x  5 user  staff  160 Apr 13 14:20 .\n...", "stderr": "", "exitCode": 0 },
  "duration_ms": 45
}
```

### `capability` -- Call a WorthDoing Capability

Invokes a capability from the WorthDoing Capabilities SDK. The `name` field uses `provider.method` syntax. The `input` field is passed directly to the capability method.

```json
{
  "thought": "I need to search for recent papers on transformer architectures.",
  "action": {
    "type": "capability",
    "name": "exa.search",
    "input": {
      "query": "transformer architecture papers 2026",
      "numResults": 10,
      "type": "neural"
    }
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

Performs file I/O within the workspace directory. Paths are resolved relative to the workspace root. Path traversal (e.g., `../../etc/passwd`) is detected and blocked.

```json
{
  "thought": "I have all the data I need. Let me write the report.",
  "action": {
    "type": "file",
    "operation": "write",
    "path": "report.md",
    "content": "# AI Startups in Montreal\n\n## 1. Mila-Spinoff AI\n..."
  }
}
```

### `message` -- Send a Message to the User

Returns a text message without performing any side effects. Used for progress updates, clarifying questions, or intermediate summaries.

```json
{
  "thought": "I should let the user know what I found before proceeding.",
  "action": {
    "type": "message",
    "text": "I found 23 results. Let me narrow them down to the top 5 based on funding and relevance."
  }
}
```

### `done` -- Signal Task Completion

Signals that the agent has finished the task. The loop terminates and the final message is presented.

```json
{
  "thought": "The report is complete with all 5 startups covered.",
  "action": {
    "type": "done",
    "text": "Report written to report.md. It covers the top 5 AI startups in Montreal with funding details, team size, and product descriptions."
  }
}
```

<br />

---

<br />

## Example Sessions

### Research Task: Quantum Computing Breakthroughs

```
$ wdagent

  ╔══════════════════════════════════════════════════════╗
  ║              WD Agent v0.1.0                        ║
  ║   Powered by Claude Opus 4.6 (1M context)          ║
  ║   Type /help for commands                           ║
  ╚══════════════════════════════════════════════════════╝

You: Research quantum computing breakthroughs in 2026 and write a summary report.

  [Step 1]
  [Think] I need to search for the latest quantum computing breakthroughs.
          I'll use Exa's neural search for high-quality, recent results.
  [Act]   capability -> exa.search
          { "query": "quantum computing breakthroughs 2026", "numResults": 15 }
  [Result] Found 15 results covering IBM, Google, IonQ, and PsiQuantum.
  [Time]  1,120ms

  [Step 2]
  [Think] Let me get the full content of the top 5 most relevant articles
          to extract detailed information.
  [Act]   capability -> firecrawl.scrape
          { "url": "https://example.com/ibm-quantum-2026-breakthrough" }
  [Result] Scraped article: 3.2KB of clean markdown content.
  [Time]  2,340ms

  [Step 3-6]
  ... (scraping and analyzing 4 more breakthrough articles) ...

  [Step 7]
  [Think] I now have comprehensive data on 5 major breakthroughs. I'll
          write a structured report with an executive summary, individual
          sections for each breakthrough, and a forward-looking analysis.
  [Act]   file -> write -> quantum-breakthroughs-2026.md
  [Result] Created quantum-breakthroughs-2026.md (5,847 bytes)
  [Time]  18ms

  [Step 8]
  [Done]  Report written to quantum-breakthroughs-2026.md

          Key findings:
          1. IBM Eagle R2 — 1,386 logical qubits with error correction
          2. Google Willow — Quantum supremacy in materials simulation
          3. IonQ Forte Enterprise — First commercial 64-qubit trapped ion
          4. PsiQuantum — Photonic quantum chip at room temperature
          5. Microsoft-Quantinuum — Topological qubit milestone

  Session saved: .conversations/c4d5e6f7-.../
```

### Finance Task: Stock Analysis

```
You: Get me a full analysis of AAPL — current price, company profile,
     and last 3 quarters of financials. Write it to aapl-analysis.md.

  [Step 1]
  [Think] I'll start by getting the real-time quote for AAPL.
  [Act]   capability -> fmp.quote
          { "symbol": "AAPL" }
  [Result] AAPL: $247.32 (+1.23%) | Vol: 52.3M | MCap: $3.78T
  [Time]  680ms

  [Step 2]
  [Think] Now let me get the company profile for sector, CEO, and description.
  [Act]   capability -> fmp.profile
          { "symbol": "AAPL" }
  [Result] Apple Inc. | CEO: Tim Cook | Sector: Technology | Employees: 164,000
  [Time]  520ms

  [Step 3]
  [Think] Now I need the last 3 quarters of financial statements.
  [Act]   capability -> fmp.financialStatements
          { "symbol": "AAPL", "type": "income", "period": "quarter", "limit": 3 }
  [Result] Q1 2026: Rev $124.3B, NI $33.9B | Q4 2025: Rev $95.4B, NI $24.1B | ...
  [Time]  740ms

  [Step 4]
  [Think] I have all the data. Let me compile a comprehensive analysis.
  [Act]   file -> write -> aapl-analysis.md
  [Result] Created aapl-analysis.md (3,921 bytes)
  [Time]  12ms

  [Step 5]
  [Done]  Full analysis written to aapl-analysis.md

  Session saved: .conversations/d8e9f0a1-.../
```

### Academic Task: Research Paper Discovery

```
You: Find the 3 most cited papers about transformer architectures
     published in 2024-2025, and summarize each one.

  [Step 1]
  [Think] I'll use OpenAlex to search for transformer architecture papers
          sorted by citation count to find the most influential work.
  [Act]   capability -> openalex.works
          { "query": "transformer architecture", "filter": "from_publication_date:2024-01-01",
            "sort": "cited_by_count:desc", "per_page": 3 }
  [Result] Found 3 papers:
           1. "Efficient Transformers: A Survey" (cited: 1,247)
           2. "FlashAttention-3: Fast Exact Attention" (cited: 893)
           3. "Mixture of Experts Meets Transformers" (cited: 671)
  [Time]  1,540ms

  [Step 2-4]
  ... (fetching full abstracts and details via Exa and Firecrawl) ...

  [Step 5]
  [Think] I have detailed information on all 3 papers. Let me write
          comprehensive summaries covering the key contributions.
  [Act]   file -> write -> transformer-papers-review.md
  [Result] Created transformer-papers-review.md (4,580 bytes)
  [Time]  14ms

  [Step 6]
  [Done]  Review written to transformer-papers-review.md

          Summary:
          1. Efficient Transformers (1,247 cites) — Comprehensive taxonomy
             of efficient attention mechanisms, linear transformers, and
             sparse attention patterns.
          2. FlashAttention-3 (893 cites) — Hardware-aware exact attention
             algorithm achieving 2x speedup over FlashAttention-2 on H100.
          3. MoE Transformers (671 cites) — Scaling to 1T+ parameters with
             sparse mixture-of-experts routing, achieving GPT-4 quality at
             1/3 the compute cost.

  Session saved: .conversations/e2f3a4b5-.../
```

<br />

---

<br />

## Conversation System

Every conversation creates a self-contained workspace folder. By default, workspaces are stored in `.conversations/` relative to your current working directory.

### Folder Structure

```
.conversations/
└── a1b2c3d4-5678-90ab-cdef-1234567890ab/
    ├── history.json      Full message log (user + assistant + system)
    ├── steps.json        Every think/act/observe cycle with timing data
    ├── agent.log         Structured debug log (JSON lines format)
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

A structured execution trace. Each entry is a `StepRecord`:

```json
[
  {
    "step": 1,
    "timestamp": "2026-04-13T14:20:02.000Z",
    "thought": "I need to search for AI startups in Montreal. I'll use Exa's neural search for relevant results.",
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

Each conversation tracks metadata as a `ConversationMeta` object:

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

<br />

---

<br />

## Configuration

WD Agent stores its configuration in `~/.wdagent/config.json`. This file is created automatically on first launch.

### Default Configuration

```json
{
  "provider": "anthropic",
  "anthropicApiKey": "sk-ant-api03-...",
  "openrouterApiKey": "",
  "model": "claude-opus-4-6-20250219",
  "apiKeys": {
    "exa": "",
    "tavily": "",
    "firecrawl": "",
    "openrouter": "",
    "fmp": "",
    "eodhd": ""
  },
  "maxSteps": 50,
  "confirmShell": true,
  "conversationsDir": ".conversations"
}
```

### Configuration Fields

| Field | Type | Default | Description |
|:------|:-----|:--------|:------------|
| `provider` | `string` | `"anthropic"` | LLM provider: `"anthropic"` or `"openrouter"` |
| `anthropicApiKey` | `string` | `""` | Your Anthropic API key for Claude. **Required if provider is anthropic.** |
| `openrouterApiKey` | `string` | `""` | Your OpenRouter API key. **Required if provider is openrouter.** |
| `model` | `string` | `"claude-opus-4-6-20250219"` | The model ID to use. Any Anthropic model or OpenRouter model ID. |
| `apiKeys` | `object` | `{}` | API keys for WorthDoing Capabilities providers. Only needed for capabilities you use. |
| `apiKeys.exa` | `string` | `""` | API key for [Exa](https://exa.ai/) neural search |
| `apiKeys.tavily` | `string` | `""` | API key for [Tavily](https://tavily.com/) AI search |
| `apiKeys.firecrawl` | `string` | `""` | API key for [Firecrawl](https://firecrawl.dev/) web scraping |
| `apiKeys.openrouter` | `string` | `""` | API key for [OpenRouter](https://openrouter.ai/) multi-model access |
| `apiKeys.fmp` | `string` | `""` | API key for [Financial Modeling Prep](https://financialmodelingprep.com/) |
| `apiKeys.eodhd` | `string` | `""` | API key for [EODHD](https://eodhd.com/) financial data |
| `maxSteps` | `number` | `50` | Maximum think-act-observe cycles per conversation before auto-stop. |
| `confirmShell` | `boolean` | `true` | Require user confirmation before executing shell commands. |
| `conversationsDir` | `string` | `".conversations"` | Directory for conversation workspaces (relative to CWD). |

### Modifying Configuration

Edit `~/.wdagent/config.json` directly, or use the `/config` slash command:

```
You: /config set maxSteps 100
Config updated: maxSteps = 100

You: /config set apiKeys.exa your-exa-key-here
Config updated: apiKeys.exa = your-exa-key-here

You: /config show
Current configuration:
  provider:         anthropic
  model:            claude-opus-4-6-20250219
  maxSteps:         100
  confirmShell:     true
  conversationsDir: .conversations
  apiKeys:          exa, tavily (2 configured)
```

<br />

---

<br />

## Safety

WD Agent includes multiple layers of safety to prevent accidental or malicious damage to your system.

### Blocked Shell Commands

The following patterns are blocked and will **never** be executed, regardless of what the LLM requests:

| Blocked Pattern | Reason |
|:----------------|:-------|
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

- All file operations are restricted to the conversation workspace directory.
- Path traversal attempts (e.g., `../../etc/passwd`) are detected and blocked.
- File paths are resolved using `path.resolve()` and verified to start with the workspace root before any read or write proceeds.

### Shell Command Confirmation

When `confirmShell` is `true` (default), the agent asks for explicit user confirmation before executing any shell command:

```
[Act] shell -> npm install express
  Allow this command? [y/N]: y
[Result] added 64 packages in 2.1s
```

### Output Limits

| Limit | Value | Purpose |
|:------|:------|:--------|
| Shell stdout | 10,000 chars | Prevent memory exhaustion from verbose commands |
| Shell stderr | 5,000 chars | Capture meaningful errors without overflow |
| File read | 50,000 chars | Prevent loading enormous files into context |
| Shell timeout | 30 seconds | Prevent hanging on long-running commands |
| Output buffer | 5 MB | Hard cap on any single command's output |

### Step Limit

The `maxSteps` configuration (default: 50) prevents infinite loops. If the agent reaches this limit, it stops and reports what it accomplished so far.

<br />

---

<br />

## How It Works Under The Hood

The following is a detailed walkthrough of exactly what happens during every agent cycle.

### Step 1: User Message --> Context Builder

Your message (or the initial task from `wdagent run`) is added to the conversation history. The context builder assembles the full payload:

- **System prompt** -- Instructs Claude on its role, available actions, capabilities, safety rules, and output format
- **Conversation history** -- Every prior user message, assistant response, and observation
- **Previous results** -- The outputs of all prior actions, serialized as structured JSON

### Step 2: Context --> Claude

The assembled context is sent to Claude Opus 4.6 (or your chosen OpenRouter model). The system prompt demands a JSON response with exactly two fields: `thought` and `action`.

### Step 3: Claude --> Structured JSON

Claude returns a JSON object:

```json
{
  "thought": "I need to search for recent quantum computing papers...",
  "action": {
    "type": "capability",
    "name": "openalex.works",
    "input": { "query": "quantum computing 2026", "sort": "cited_by_count:desc" }
  }
}
```

The response is parsed and validated. If parsing fails, the agent retries with an error message appended to context.

### Step 4: Action --> Executor

The `ActionExecutor` dispatches the action based on its `type`:

- **shell** -- Passed to `ShellExecutor` which validates against the blocked command list, optionally confirms with the user, then runs via `child_process.exec` with timeout and output limits.
- **capability** -- Passed to `CapabilitiesBridge` which resolves `provider.method`, validates the input, calls the WorthDoing Capabilities SDK, and returns the structured result.
- **file** -- Passed to `FileHandler` which validates the path (no traversal), then performs the read/write/edit operation within the workspace.
- **spawn_agent** -- Creates a new sub-agent instance with its own conversation context, runs it to completion, and returns the result.
- **message** -- Displayed to the user immediately, no side effects.
- **done** -- Terminates the loop.

### Step 5: Result --> Conversation Store

The action result (success/failure, output data, duration) is:

1. Serialized as a structured `StepRecord`
2. Appended to `steps.json` on disk
3. Added to the conversation history as an observation message
4. Added to the in-memory context for the next iteration

### Step 6: Loop or Return

If the action type was `done`, the loop terminates and the final message is displayed. Otherwise, control returns to **Step 1** with the enriched conversation context, and Claude reasons about the next action.

<br />

---

<br />

## Comparison

How WD Agent compares to other tools in the ecosystem:

| Feature | WD Agent | ChatGPT | Claude Code | Cursor |
|:--------|:--------:|:-------:|:-----------:|:------:|
| Local-first execution | Yes | No | Yes | No |
| Capability-based architecture | Yes | No | No | No |
| 350+ model support | Yes | No | No | No |
| Academic research (OpenAlex) | Yes | No | No | No |
| Financial data (FMP, EODHD) | Yes | No | No | No |
| Web scraping (Firecrawl) | Yes | No | No | No |
| Persistent conversations | Yes | Yes | No | No |
| Sub-agent delegation | Yes | No | No | No |
| Open source | Yes | No | Yes | No |
| Interactive model browser | Yes | No | No | Yes |
| File-based audit trail | Yes | No | No | No |
| Zero cloud dependency | Yes | No | Yes | No |
| Shell execution with safety | Yes | No | Yes | No |
| Structured step replay | Yes | No | No | No |
| Resume any conversation | Yes | Yes | No | No |

<br />

---

<br />

## Roadmap

### Q2 2026

- [ ] Plugin system for custom capabilities
- [ ] Streaming responses (token-by-token display)
- [ ] Multi-file workspace templates
- [ ] Conversation branching (fork at any step)
- [ ] Export conversations to Markdown / PDF / HTML
- [ ] Configurable system prompts per conversation

### Q3 2026

- [ ] Web UI dashboard for conversation management
- [ ] Parallel sub-agent execution
- [ ] Cross-conversation memory system (knowledge persistence)
- [ ] Human-in-the-loop verification for capability calls
- [ ] Webhook triggers (start tasks via HTTP)
- [ ] Integration with CI/CD pipelines

### Q4 2026

- [ ] Team mode (shared conversations and workspaces)
- [ ] Remote execution (run agents on cloud infrastructure)
- [ ] Audit log export and compliance features
- [ ] Custom capability authoring (bring your own APIs)
- [ ] Agent-to-agent communication protocol
- [ ] Voice interface support

<br />

---

<br />

## Contributing

We welcome contributions from the community. Here is how to get started:

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

1. **TypeScript only** -- All code must be written in TypeScript with strict mode enabled.
2. **Minimal dependencies** -- No external runtime dependencies beyond `@anthropic-ai/sdk` and `worthdoing-capabilities`. Keep the dependency tree clean.
3. **Test your changes** -- Run `npm test` before submitting a PR.
4. **Sequential by design** -- Do not introduce parallelism into the agent loop. The sequential nature is a deliberate architectural choice.
5. **Safety first** -- Any new action type must include appropriate safety checks and output limits.

### Submitting a Pull Request

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run `npm test && npm run typecheck` to verify everything passes
5. Commit with a clear message describing the change
6. Open a pull request against `main`

<br />

---

<br />

## License

MIT License. See [LICENSE](LICENSE) for details.

Copyright (c) 2026 [WorthDoing AI](https://worthdoing.ai)

<br />

---

<br />

<p align="center">
  <img src="https://raw.githubusercontent.com/Worth-Doing/brand-assets/main/png/variants/04-horizontal.png" alt="WorthDoing.ai" width="300" />
</p>

<p align="center">
  <strong>Built with conviction by <a href="https://worthdoing.ai">WorthDoing AI</a></strong>
</p>

<p align="center">
  <a href="https://worthdoing.ai">Website</a> &middot;
  <a href="https://github.com/Worth-Doing">GitHub</a> &middot;
  <a href="https://github.com/Worth-Doing/wd-agent">Repository</a> &middot;
  <a href="https://www.npmjs.com/package/wd-agent">npm</a>
</p>

<p align="center">
  <sub>If WD Agent is useful to you, consider giving it a star on GitHub.</sub>
</p>
