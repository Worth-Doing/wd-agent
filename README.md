<p align="center">
  <img src="https://raw.githubusercontent.com/Worth-Doing/brand-assets/main/png/variants/04-horizontal.png" alt="WorthDoing.ai" width="600" />
</p>

<h1 align="center">WD Agent</h1>

<p align="center">
  <strong>A local AI agent operating system for your terminal — powered by native tool_use.</strong>
</p>

<p align="center">
  <em>Think. Act. Execute. Persist. — All powered by Claude's structured tool_use API and WorthDoing Capabilities.</em>
</p>

<br />

<!-- ════════════════════════════════════════════════════════════════════════ -->
<!--                          BADGE ROWS                                    -->
<!-- ════════════════════════════════════════════════════════════════════════ -->

<p align="center">
  <img src="https://img.shields.io/badge/Built%20by-WorthDoing.ai-0055FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzAwNTVGRiIvPjx0ZXh0IHg9IjUiIHk9IjE4IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiPnc8L3RleHQ+PC9zdmc+" alt="Built by WorthDoing.ai" />
  <img src="https://img.shields.io/badge/v1.0.0-00C853?style=for-the-badge" alt="v1.0.0" />
  <img src="https://img.shields.io/badge/Claude%20Opus%204.6-191919?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude Opus 4.6" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node%2018%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 18+" />
  <img src="https://img.shields.io/badge/npm-wd--agent-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="npm wd-agent" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/22%2B%20Capabilities-6C47FF?style=flat-square" alt="22+ Capabilities" />
  <img src="https://img.shields.io/badge/Native%20tool__use-FF6D00?style=flat-square" alt="Native tool_use" />
  <img src="https://img.shields.io/badge/Context%20auto--compaction-00897B?style=flat-square" alt="Context auto-compaction" />
  <img src="https://img.shields.io/badge/Token%20tracking-E91E63?style=flat-square" alt="Token tracking" />
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

**v1.0.0** marks a fundamental architecture shift: the engine now communicates with Claude through Anthropic's **native `tool_use` API** instead of prompting for raw JSON. Claude returns structured `ToolUseBlock` objects that are dispatched directly -- no regex parsing, no markdown fence extraction, no fragility. Context is managed automatically via **auto-compaction** inspired by the Claude Code architecture, keeping long sessions efficient without manual intervention.

### The Agent Loop

WD Agent operates through a continuous **Think --> Act --> Observe --> Persist** loop:

1. **Think** -- Claude Opus 4.6 (or any of 350+ models via OpenRouter) reasons about your request, analyzes prior results, and selects a tool call as its next action.
2. **Act** -- The selected tool is executed locally: a shell command, a capability call, a file operation, or a direct response.
3. **Observe** -- The result of the tool execution (stdout, API response, file contents) is sent back to Claude via the `tool_result` protocol.
4. **Persist** -- Every thought, tool call, and result is recorded in structured JSON files on disk. Nothing is ephemeral. Everything is replayable.

The loop continues autonomously until the task is complete or the agent explicitly calls `task_complete`. There is no parallelism, no background jobs, no async fan-out. Each step completes fully before the next begins. This makes every session **deterministic, debuggable, and auditable**.

### Design Principles

- **Native tool_use, not JSON prompting.** All agent actions are declared as Anthropic tools. Claude returns structured `ToolUseBlock` objects that are dispatched without parsing. Results flow back via `tool_result` messages.
- **Context auto-compaction.** When conversation context exceeds ~80K tokens, older messages are automatically summarized and replaced, keeping the agent responsive across long sessions.
- **Token-aware execution.** Every API call tracks input tokens, output tokens, and estimated cost. Session totals are always visible.
- **Never hardcodes API calls.** All external service access goes through the WorthDoing Capabilities SDK, ensuring a unified interface, consistent error handling, and clean separation of concerns.
- **Shell execution with safety controls.** Dangerous commands are blocked. User confirmation is required by default. Output is truncated to prevent memory issues.
- **File operations with workspace isolation.** Path traversal is blocked. All reads and writes are confined to the conversation workspace directory.
- **Persistent conversations.** Every session creates a self-contained folder with the full message log, step-by-step execution trace, structured debug logs, and any files the agent produced.

### What Makes WD Agent Different?

| Traditional Chatbot | WD Agent v1.0.0 |
|:-----|:-----|
| Generates text and stops | Executes a multi-step plan autonomously via native tool_use |
| Fragile JSON parsing of LLM output | Structured ToolUseBlock dispatch -- zero parsing errors |
| No context management | Auto-compaction at ~80K tokens, inspired by Claude Code |
| No cost visibility | Real-time token tracking with per-response and session totals |
| No access to external tools | 22+ capabilities spanning search, finance, research, scraping, and LLMs |
| Cloud-hosted, opaque | Local-first, fully inspectable, every step logged to disk |
| Single model, single provider | Dual provider support -- Anthropic direct or OpenRouter with 350+ models |
| No persistent state | File-based conversation memory with resume, replay, and branching |
| No file output | Creates real files, runs real commands, produces real deliverables |

<br />

---

<br />

## Quick Start

```bash
# Install globally
npm install -g wd-agent

# Launch interactive agent
wdagent
```

<br />

---

<br />

## Architecture

```
User --> CLI --> Agent Loop --> Claude (tool_use API)
                    |               ^
             Action Executor    tool_result
            +-------+-------+
         Shell  Capabilities  Files
                    |
      WorthDoing Capabilities SDK
```

### Detailed Architecture

```
                        +-------------+
                        |   You (CLI) |
                        +------+------+
                               |
                        +------v------+
                        |  Agent Loop |
                        |  +--------+ |
                        |  | Think  |-+---> Claude Opus 4.6 (tool_use API)
                        |  | Act    | |    (or any OpenRouter model)
                        |  |Observe | |        |
                        |  |Persist | |   tool_result
                        |  +--------+ |        |
                        +------+------+<-------+
                               |
                  +------------+------------+
                  |            |            |
            +-----v-----+ +---v---+ +-----v------+
            |   Shell    | | Files | | Capabilities|
            |  Executor  | |Handler| |   Bridge    |
            +-----------+ +-------+ +-----+------+
                                          |
                        +-----------------v------------------+
                        |     WorthDoing Capabilities SDK     |
                        +------------------------------------+
                        | Exa . Tavily . Firecrawl            |
                        | OpenRouter . OpenAlex               |
                        | FMP . EODHD . Documents             |
                        +------------------------------------+
```

### Data Flow (Native tool_use)

```
 User Input
     |
     v
 +------------------+    +----------------------+    +-------------------+
 |  1. Build Context |--->|  2. Send to Claude   |--->|  3. Receive       |
 |  (system prompt + |    |  (messages array +   |    |  ToolUseBlock     |
 |   history +       |    |   tools definition)  |    |  {name, input}    |
 |   tool_results)   |    |                      |    |                   |
 +------------------+    +----------------------+    +--------+----------+
                                                              |
 +------------------+    +----------------------+    +--------v----------+
 |  6. Loop back or |<---|  5. Send tool_result  |<---|  4. Execute the   |
 |  task_complete    |    |  message back to      |    |  tool (shell /    |
 |  to user          |    |  Claude               |    |  capability /     |
 +------------------+    +----------------------+    |  file / respond)  |
                                                      +-------------------+
```

### Context Compaction Flow

```
 Context exceeds ~80K tokens
     |
     v
 +------------------------+    +-------------------------+
 | Summarize older msgs   |--->| Replace with compact    |
 | (keep last 6 messages) |    | summary message         |
 +------------------------+    +-------------------------+
     |
     v
 Continue agent loop with reduced context
 (token savings logged to session)
```

### Persistence Layer

```
.conversations/
+-- a1b2c3d4-5678-90ab-cdef-1234567890ab/
    +-- history.json      Full message log (user + assistant + tool_use + tool_result)
    +-- steps.json        Every think/act/observe cycle with timing
    +-- agent.log         Structured debug log (JSON lines)
    +-- report.md         Example: a file the agent created
    +-- data/
        +-- prices.csv    Example: another file the agent created
```

<br />

---

<br />

## Native Tool Use

**v1.0.0 replaces raw JSON prompting with Anthropic's native `tool_use` protocol.** This is the single largest architectural change in the project's history.

### The Problem with JSON Prompting (v0.x)

In previous versions, the system prompt instructed Claude to return a JSON object with `thought` and `action` fields. The agent had to:

- Parse raw text output as JSON
- Handle markdown code fences (```` ```json ... ``` ````) wrapping the response
- Deal with multiple JSON objects in a single response
- Recover from malformed JSON, trailing commas, unescaped strings
- Retry on parse failures, wasting tokens and latency

### The tool_use Solution (v1.0.0)

Claude now receives a formal `tools` array defining each action as a typed tool with a JSON Schema for its input. When Claude decides to act, it returns a `ToolUseBlock` object -- a structured, validated, machine-readable instruction. No parsing required.

### The 6 Tools

| Tool | Purpose | Input Schema |
|:-----|:--------|:-------------|
| `respond` | Send a message to the user (progress update, clarification, partial result) | `{ message: string }` |
| `task_complete` | Signal that the task is finished and deliver the final answer | `{ result: string }` |
| `use_capability` | Call any WorthDoing Capability via `provider.method` syntax | `{ name: string, input: object }` |
| `shell_execute` | Run a shell command in the workspace directory | `{ command: string }` |
| `write_file` | Create or overwrite a file in the workspace | `{ path: string, content: string }` |
| `read_file` | Read the contents of a file in the workspace | `{ path: string }` |

### How It Works

1. **Tool definition** -- At session start, the agent registers all 6 tools with Claude using Anthropic's `tools` parameter, each with a `name`, `description`, and `input_schema`.

2. **Claude responds with tool_use** -- Instead of free-form text, Claude returns a message containing a `ToolUseBlock`:
   ```
   stop_reason: "tool_use"
   content: [
     TextBlock { text: "I need to search for..." }     // thought
     ToolUseBlock { id: "toolu_01X...", name: "use_capability",
       input: { name: "exa.search", input: { query: "...", numResults: 10 } } }
   ]
   ```

3. **Execution** -- The agent dispatches the tool call to the appropriate executor based on the tool `name`. No string matching, no regex, no parsing.

4. **tool_result** -- The execution result is sent back to Claude as a `tool_result` message, keyed by the `tool_use_id`:
   ```
   { role: "user", content: [
     { type: "tool_result", tool_use_id: "toolu_01X...",
       content: "{ success: true, output: {...}, duration_ms: 1340 }" }
   ]}
   ```

5. **Loop** -- Claude sees the result and decides the next tool call, or calls `task_complete` to finish.

### Why This Matters

- **Zero parse failures.** ToolUseBlock objects are always valid -- no malformed JSON, no fence-wrapped output, no ambiguity.
- **Type-safe dispatch.** Each tool has a schema. Invalid inputs are rejected before execution.
- **Cleaner conversation history.** The message log contains structured tool_use and tool_result entries instead of raw JSON strings.
- **Better model performance.** Claude is optimized for its native tool_use protocol and produces more reliable, focused actions through it.

<br />

---

<br />

## Context Management

WD Agent v1.0.0 includes an automatic context compaction system inspired by the Claude Code architecture. Long-running sessions no longer degrade or hit context limits.

### Auto-Compaction

When the conversation context exceeds approximately **80,000 tokens**, the agent automatically:

1. **Preserves** the last 6 messages (the most recent and relevant context)
2. **Summarizes** all older messages into a compact system-level summary
3. **Replaces** the old messages with the summary, dramatically reducing token count
4. **Continues** the agent loop seamlessly -- Claude sees the summary plus recent context

The compaction is transparent. The agent does not pause or ask for confirmation. A log entry records the compaction event, including tokens before and after.

### Token Usage Tracking

Every API call to Claude is tracked with full token accounting:

| Metric | Description |
|:-------|:------------|
| **Input tokens** | Tokens sent to Claude (system prompt + conversation + tools) |
| **Output tokens** | Tokens received from Claude (thoughts + tool calls) |
| **Estimated cost** | Calculated from the model's per-token pricing |
| **Session total** | Cumulative input, output, and cost across all steps |

Token usage is displayed after each response and available at any time via the `/tokens` command.

### Why Compaction Matters

Without compaction, long sessions (10+ steps with large tool results) can exceed the model's context window or become prohibitively expensive. Auto-compaction keeps the effective context under control while preserving the essential information the agent needs to continue working.

<br />

---

<br />

## Response Rendering

v1.0.0 introduces a redesigned terminal output format with distinct visual elements for each type of content.

### Rendering Elements

| Element | Format | Description |
|:--------|:-------|:------------|
| **Thoughts** | `dim italic` | Claude's internal reasoning, displayed in dim italic text |
| **Actions** | `bold action badge` | Tool calls displayed as action badges with timing |
| **Responses** | `left-border` | Agent messages rendered with a `\|` left border, word-wrapped with markdown support |
| **Errors** | `red thick border` | Errors rendered with a red thick `\|` left border for high visibility |
| **Token usage** | `dim footer` | Input/output token counts and cost displayed after each response |
| **Session bar** | `status line` | Persistent status showing model, step count, and session tokens |

### Example Output

```
  Thinking...

  use_capability exa.search                                         1,340ms

  | Found 15 results covering quantum computing breakthroughs
  | in 2026. The most relevant results focus on IBM, Google,
  | IonQ, and PsiQuantum. Let me scrape the top articles for
  | detailed information.
  |
  tokens: 1,247 in / 156 out (~$0.02)

  shell_execute ls -la                                                 42ms

  | The workspace contains 3 files from previous steps.
  | I'll now write the final report.
  |
  tokens: 2,891 in / 89 out (~$0.04)

  write_file quantum-report.md                                         18ms

  | Report written to quantum-report.md (5,847 bytes).
  |
  | Key findings:
  | 1. IBM Eagle R2 -- 1,386 logical qubits with error correction
  | 2. Google Willow -- Quantum supremacy in materials simulation
  | 3. IonQ Forte Enterprise -- First commercial 64-qubit trapped ion
  |
  tokens: 3,102 in / 234 out (~$0.05)
  session total: 7,240 in / 479 out (~$0.11)
```

### Error Rendering

```
  shell_execute rm -rf /                                            BLOCKED

  | Command blocked by safety filter.
  | Pattern matched: "rm -rf /"
  | This command would recursively delete the root filesystem.
  |
```

<br />

---

<br />

## First Launch Experience

When you run `wdagent` for the first time, a guided setup flow walks you through configuration:

### Step 1: Choose Your Provider

```
  +======================================================+
  |              WD Agent v1.0.0                         |
  |   Welcome! Let's get you set up.                     |
  +======================================================+

  Choose your LLM provider:

    1. Anthropic   (Direct Claude API -- recommended)
    2. OpenRouter   (350+ models: Claude, GPT, Gemini, Llama, Mistral, DeepSeek...)

  Selection: 1
```

### Step 2: Enter Your API Key

```
  Enter your Anthropic API key: sk-ant-api03-...
  API key validated. Connected to Claude Opus 4.6.
  Key saved to ~/.wdagent/config.json.
```

### Step 3: (OpenRouter Only) Scrollable Model Selector

If you chose OpenRouter, a scrollable interactive model selector appears:

```
  Fetching available models from OpenRouter...

  +---------------------------------------------------------------+
  |  Available Models (350+)                    [Type to filter]   |
  +---------------------------------------------------------------+
  |    anthropic/claude-opus-4-6      1M ctx    $15 / $75         |
  |  > anthropic/claude-sonnet-4      200K ctx  $3  / $15         |
  |    openai/gpt-4o                  128K ctx  $5  / $15         |
  |    google/gemini-2.5-pro          1M ctx    $1.25 / $10       |
  |    meta-llama/llama-4-maverick    1M ctx    $0.20 / $0.60     |
  |    mistralai/mistral-large        128K ctx  $2  / $6          |
  |    deepseek/deepseek-r1           64K ctx   $0.55 / $2.19     |
  |    qwen/qwen-2.5-72b             128K ctx  $0.30 / $0.50     |
  |    cohere/command-r-plus          128K ctx  $2.50 / $10       |
  |    perplexity/sonar-pro           128K ctx  $3  / $15         |
  |    01-ai/yi-large                 32K ctx   $3  / $3          |
  |    nvidia/llama-3.1-nemotron-70b  128K ctx  $0.20 / $0.20    |
  |    microsoft/phi-4               16K ctx   $0.07 / $0.14     |
  |    inflection/inflection-3.0     128K ctx  $3  / $3           |
  |    databricks/dbrx-instruct      32K ctx   $0.60 / $0.60     |
  |                                                     [v more]  |
  +---------------------------------------------------------------+
  | arrows/j/k scroll | PgUp/PgDn jump | type to filter | Enter   |
  +---------------------------------------------------------------+

  Selected: anthropic/claude-sonnet-4
```

### Step 4: System Info Panel

```
  +--------------------------------------------------+
  |  System Information                               |
  |                                                   |
  |  OS:        macOS 15.2 (Darwin 25.2.0)            |
  |  Node:      v22.4.0                               |
  |  Shell:     /bin/zsh                               |
  |  Workspace: /Users/you/projects                    |
  |  Provider:  Anthropic (Claude Opus 4.6)            |
  |  Engine:    Native tool_use (v1.0.0)               |
  |  Caps:      22 capabilities available              |
  |  Config:    ~/.wdagent/config.json                 |
  +--------------------------------------------------+

  Ready. Type your message or /help for commands.
```

<br />

---

<br />

## Dual Provider Support

WD Agent supports two LLM providers, switchable at any time.

### Anthropic (Direct Claude API)

- Direct access to Claude Opus 4.6 with 1M token context
- Full native `tool_use` support with structured ToolUseBlock dispatch
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
- Scrollable interactive model selector with real-time filtering
- Requires an `OPENROUTER_API_KEY`

### OpenRouter Model Selection

The `/model` command launches a scrollable interactive selector:

```
You: /model

  Current model: anthropic/claude-opus-4-6

  +---------------------------------------------------------------+
  |  Available Models (via OpenRouter)           [Type to filter]  |
  +---------------------------------------------------------------+
  |  > anthropic/claude-opus-4-6       1M ctx    $15/$75          |
  |    anthropic/claude-sonnet-4       200K ctx  $3/$15           |
  |    anthropic/claude-haiku-3.5      200K ctx  $0.80/$4         |
  |    openai/gpt-4o                   128K ctx  $5/$15           |
  |    google/gemini-2.5-pro           1M ctx    $1.25/$10        |
  |    meta-llama/llama-4-maverick     1M ctx    $0.20/$0.60      |
  |    mistralai/mistral-large         128K ctx  $2/$6            |
  |    deepseek/deepseek-r1            64K ctx   $0.55/$2.19      |
  |    qwen/qwen-2.5-72b              128K ctx  $0.30/$0.50      |
  |    cohere/command-r-plus           128K ctx  $2.50/$10        |
  |    perplexity/sonar-pro            128K ctx  $3/$15           |
  |    nvidia/llama-3.1-nemotron-70b   128K ctx  $0.20/$0.20     |
  |    microsoft/phi-4                16K ctx   $0.07/$0.14      |
  |    inflection/inflection-3.0      128K ctx  $3/$3            |
  |    databricks/dbrx-instruct       32K ctx   $0.60/$0.60      |
  |                                                     [v more]  |
  +---------------------------------------------------------------+
  | up/down scroll | PgUp/PgDn jump | type to filter | Esc cancel |
  +---------------------------------------------------------------+
```

**Navigation:**

| Key | Action |
|:----|:-------|
| `Up` / `Down` | Scroll through models one at a time |
| `PageUp` / `PageDown` | Jump through the list in large increments |
| Type any text | Filter/search models in real-time |
| `Enter` | Select the highlighted model |
| `Escape` | Cancel and keep the current model |

The viewport displays **15 models at a time** with scroll indicators (`[^ more]` / `[v more]`) showing when there are models above or below the visible area.

```
  Switched to: anthropic/claude-sonnet-4
  tokens: session costs will now use sonnet-4 pricing ($3/$15 per 1M)
```

<br />

---

<br />

## Available Capabilities

WD Agent ships with **22+ capabilities** through the [WorthDoing Capabilities](https://github.com/Worth-Doing/worthdoing-capabilities) SDK. Each capability is invoked through the `use_capability` tool using `provider.method` syntax (e.g., `exa.search`, `fmp.quote`).

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

### Built-in Tools (No API Key Needed)

| Tool | Description |
|:-----|:------------|
| `respond` | Send a progress update or clarifying question to the user |
| `task_complete` | Signal that the task is complete and deliver the final result |
| `shell_execute` | Execute any shell command in the workspace directory (with safety controls) |
| `read_file` | Read any file in the workspace |
| `write_file` | Create or overwrite a file in the workspace |
| `use_capability` | Call any WorthDoing Capability via `provider.method` syntax |

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
| `/model` | Browse and switch models with the scrollable interactive selector |
| `/tokens` | Show token usage for the current session (input, output, cost) |
| `/compact` | Trigger context compaction manually (auto-compaction runs at ~80K tokens) |
| `/workspace` | Show workspace path and list files in the current conversation directory |
| `/config` | View or modify configuration (API keys, model, max steps, etc.) |
| `/caps` | List all available capabilities and their required API keys |
| `/steps` | Show all steps taken in the current conversation with timing |
| `/clear` | Clear the terminal screen |
| `/exit` | Exit the agent (conversation is automatically saved) |

### Usage Example

```
You: /tokens

  Session Token Usage
  +--------------------------------------------------+
  |  Steps completed:  7                              |
  |  Input tokens:     12,847                         |
  |  Output tokens:    1,923                          |
  |  Estimated cost:   $0.34                          |
  |  Context size:     ~45K tokens                    |
  |  Compactions:      0                              |
  +--------------------------------------------------+

You: /compact

  Context compacted.
  Before: ~45,230 tokens (23 messages)
  After:  ~8,120 tokens (7 messages: 1 summary + 6 recent)
  Saved:  ~37,110 tokens

You: /workspace

  Workspace: .conversations/a1b2c3d4-5678-90ab-cdef-1234567890ab/
  Files:
    history.json         (24.3 KB)
    steps.json           (18.7 KB)
    agent.log            (12.1 KB)
    quantum-report.md    (5.8 KB)
    data/prices.csv      (2.1 KB)

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

## Action Types (Native Tools)

The agent communicates through Anthropic's native `tool_use` protocol. Each action is a structured tool call with typed inputs, dispatched directly by the agent runtime.

### `shell_execute` -- Execute a Shell Command

Runs a command in the workspace directory using `child_process.exec`. Output (stdout + stderr) is captured and returned as a `tool_result`. Subject to safety filtering and optional user confirmation.

```
Claude returns:
  ToolUseBlock {
    name: "shell_execute",
    input: { command: "ls -la" }
  }

Agent sends back:
  tool_result {
    content: "{ success: true, output: { stdout: '...', exitCode: 0 }, duration_ms: 45 }"
  }
```

### `use_capability` -- Call a WorthDoing Capability

Invokes a capability from the WorthDoing Capabilities SDK. The `name` field uses `provider.method` syntax. The `input` field is passed directly to the capability method.

```
Claude returns:
  ToolUseBlock {
    name: "use_capability",
    input: {
      name: "exa.search",
      input: { query: "transformer architecture papers 2026", numResults: 10 }
    }
  }

Agent sends back:
  tool_result {
    content: "{ success: true, output: { results: [...] }, duration_ms: 1340 }"
  }
```

### `write_file` -- Create or Overwrite a File

Writes content to a file within the workspace directory. Paths are resolved relative to the workspace root. Path traversal (e.g., `../../etc/passwd`) is detected and blocked.

```
Claude returns:
  ToolUseBlock {
    name: "write_file",
    input: {
      path: "report.md",
      content: "# AI Startups in Montreal\n\n## 1. Mila-Spinoff AI\n..."
    }
  }
```

### `read_file` -- Read a File

Reads the contents of a file within the workspace directory. Output is truncated to prevent loading enormous files into context.

```
Claude returns:
  ToolUseBlock {
    name: "read_file",
    input: { path: "data/prices.csv" }
  }
```

### `respond` -- Send a Message to the User

Returns a text message without performing any side effects. Used for progress updates, clarifying questions, or intermediate summaries.

```
Claude returns:
  ToolUseBlock {
    name: "respond",
    input: { message: "I found 23 results. Let me narrow them down to the top 5." }
  }
```

### `task_complete` -- Signal Task Completion

Signals that the agent has finished the task. The loop terminates and the final result is presented.

```
Claude returns:
  ToolUseBlock {
    name: "task_complete",
    input: { result: "Report written to report.md. It covers the top 5 AI startups..." }
  }
```

<br />

---

<br />

## Example Session

### Research Task: Quantum Computing Breakthroughs

```
$ wdagent

  +======================================================+
  |              WD Agent v1.0.0                         |
  |   Powered by Claude Opus 4.6 (1M context)           |
  |   Engine: native tool_use | Type /help for commands  |
  +======================================================+

You: Research quantum computing breakthroughs in 2026 and write a summary report.

  Thinking...

  I need to search for the latest quantum computing breakthroughs.
  I'll use Exa's neural search for high-quality, recent results.

  use_capability exa.search                                         1,120ms
  { query: "quantum computing breakthroughs 2026", numResults: 15 }

  | Found 15 results covering IBM, Google, IonQ, and PsiQuantum.
  | Let me get the full content of the top 5 most relevant articles.
  |
  tokens: 1,892 in / 134 out (~$0.03)

  use_capability firecrawl.scrape                                   2,340ms
  { url: "https://example.com/ibm-quantum-2026-breakthrough" }

  | Scraped article: 3.2KB of clean markdown content.
  | IBM Eagle R2 achieves 1,386 logical qubits with error correction.
  |
  tokens: 3,247 in / 98 out (~$0.05)

  ... (steps 3-6: scraping and analyzing 4 more breakthrough articles) ...

  write_file quantum-breakthroughs-2026.md                             18ms

  | Created quantum-breakthroughs-2026.md (5,847 bytes)
  |
  tokens: 8,934 in / 412 out (~$0.14)

  task_complete

  | Report written to quantum-breakthroughs-2026.md
  |
  | Key findings:
  | 1. IBM Eagle R2 -- 1,386 logical qubits with error correction
  | 2. Google Willow -- Quantum supremacy in materials simulation
  | 3. IonQ Forte Enterprise -- First commercial 64-qubit trapped ion
  | 4. PsiQuantum -- Photonic quantum chip at room temperature
  | 5. Microsoft-Quantinuum -- Topological qubit milestone
  |
  tokens: 9,102 in / 267 out (~$0.15)
  session total: 24,891 in / 1,823 out (~$0.42) | 8 steps | 0 compactions
```

### Finance Task: Stock Analysis

```
You: Get me a full analysis of AAPL -- current price, company profile,
     and last 3 quarters of financials. Write it to aapl-analysis.md.

  Thinking...

  use_capability fmp.quote                                            680ms

  | AAPL: $247.32 (+1.23%) | Vol: 52.3M | MCap: $3.78T
  |
  tokens: 1,456 in / 67 out (~$0.02)

  use_capability fmp.profile                                          520ms

  | Apple Inc. | CEO: Tim Cook | Sector: Technology | Employees: 164,000
  |
  tokens: 2,103 in / 54 out (~$0.03)

  use_capability fmp.financialStatements                              740ms

  | Q1 2026: Rev $124.3B, NI $33.9B
  | Q4 2025: Rev $95.4B, NI $24.1B
  | Q3 2025: Rev $85.8B, NI $21.4B
  |
  tokens: 3,891 in / 112 out (~$0.06)

  write_file aapl-analysis.md                                          12ms

  | Created aapl-analysis.md (3,921 bytes)
  |
  tokens: 4,234 in / 287 out (~$0.07)

  task_complete

  | Full analysis written to aapl-analysis.md
  |
  tokens: 4,301 in / 45 out (~$0.07)
  session total: 15,985 in / 565 out (~$0.25) | 5 steps | 0 compactions
```

### Long Session with Context Compaction

```
You: Analyze the entire S&P 500 -- get sector breakdown, top gainers,
     and write individual reports for each sector.

  ... (steps 1-18: fetching data for 11 sectors) ...

  tokens: 78,234 in / 4,567 out (~$1.24)

  [auto-compact] Context exceeded ~80K tokens.
  Compacted: 42 messages -> 7 messages (1 summary + 6 recent)
  Before: ~82,340 tokens | After: ~12,890 tokens | Saved: ~69,450 tokens

  ... (steps 19-25: writing sector reports) ...

  task_complete

  | All 11 sector reports written to the workspace.
  |
  session total: 94,230 in / 8,901 out (~$1.82) | 25 steps | 1 compaction
```

<br />

---

<br />

## Conversation System

Every conversation creates a self-contained workspace folder. By default, workspaces are stored in `.conversations/` relative to your current working directory.

### Folder Structure

```
.conversations/
+-- a1b2c3d4-5678-90ab-cdef-1234567890ab/
    +-- history.json      Full message log (user + assistant + tool_use + tool_result)
    +-- steps.json        Every think/act/observe cycle with timing data
    +-- agent.log         Structured debug log (JSON lines format)
    +-- report.md         Example: a file the agent created
    +-- data/
        +-- prices.csv    Example: another file the agent created
```

### history.json

The complete conversation log. In v1.0.0, entries include structured `tool_use` and `tool_result` messages instead of raw JSON strings:

```json
[
  {
    "role": "user",
    "content": "Research the top 5 AI startups in Montreal and write a report.",
    "timestamp": "2026-04-13T14:20:00.000Z"
  },
  {
    "role": "assistant",
    "content": [
      { "type": "text", "text": "I need to search for AI startups in Montreal..." },
      { "type": "tool_use", "id": "toolu_01X...", "name": "use_capability",
        "input": { "name": "exa.search", "input": { "query": "top AI startups Montreal 2026" } } }
    ],
    "timestamp": "2026-04-13T14:20:02.000Z"
  },
  {
    "role": "user",
    "content": [
      { "type": "tool_result", "tool_use_id": "toolu_01X...",
        "content": "{ \"success\": true, \"output\": { \"results\": [...] }, \"duration_ms\": 1240 }" }
    ],
    "timestamp": "2026-04-13T14:20:03.240Z"
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
    "thought": "I need to search for AI startups in Montreal. I'll use Exa's neural search.",
    "tool": "use_capability",
    "input": { "name": "exa.search", "input": { "query": "top AI startups Montreal 2026", "numResults": 15 } },
    "result": {
      "success": true,
      "output": { "results": ["..."] },
      "duration_ms": 1240
    },
    "tokens": { "input": 1892, "output": 134, "cost": 0.031 }
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
  "status": "completed",
  "tokens": { "input": 24891, "output": 1823, "cost": 0.42 },
  "compactions": 0
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
  "conversationsDir": ".conversations",
  "autoCompact": true,
  "compactThreshold": 80000
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
| `autoCompact` | `boolean` | `true` | Enable automatic context compaction when context exceeds the threshold. |
| `compactThreshold` | `number` | `80000` | Token count threshold that triggers auto-compaction (~80K tokens). |

### Modifying Configuration

Edit `~/.wdagent/config.json` directly, or use the `/config` slash command:

```
You: /config set maxSteps 100
Config updated: maxSteps = 100

You: /config set autoCompact false
Config updated: autoCompact = false

You: /config set apiKeys.exa your-exa-key-here
Config updated: apiKeys.exa = your-exa-key-here

You: /config show
Current configuration:
  provider:          anthropic
  model:             claude-opus-4-6-20250219
  maxSteps:          100
  confirmShell:      true
  conversationsDir:  .conversations
  autoCompact:       true
  compactThreshold:  80000
  apiKeys:           exa, tavily (2 configured)
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
  shell_execute npm install express
  Allow this command? [y/N]: y

  | added 64 packages in 2.1s
  |
  tokens: 2,340 in / 45 out (~$0.04)
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

The following is a detailed walkthrough of exactly what happens during every agent cycle in the native `tool_use` architecture.

### Step 1: User Message --> Context Builder

Your message (or the initial task from `wdagent run`) is added to the conversation history. The context builder assembles the full payload:

- **System prompt** -- Instructs Claude on its role, available capabilities, safety rules, and workspace context
- **Tools definition** -- The 6 tools (`respond`, `task_complete`, `use_capability`, `shell_execute`, `write_file`, `read_file`) with their JSON Schemas
- **Conversation history** -- Every prior user message, assistant response, `tool_use` block, and `tool_result`
- **Token budget check** -- If context exceeds the compaction threshold, auto-compaction runs before the API call

### Step 2: Context --> Claude (tool_use API)

The assembled context is sent to Claude Opus 4.6 (or your chosen OpenRouter model) using the Anthropic Messages API with the `tools` parameter. Claude is free to return text (thoughts) and/or a `ToolUseBlock` (action).

### Step 3: Claude --> ToolUseBlock

Claude returns a message with `stop_reason: "tool_use"` containing one or more content blocks:

- **TextBlock** -- Claude's reasoning/thought (displayed as dim italic text in the terminal)
- **ToolUseBlock** -- The structured tool call with `id`, `name`, and `input`

No parsing is required. The SDK provides typed objects directly.

### Step 4: ToolUseBlock --> Executor

The `ActionExecutor` dispatches the tool call based on its `name`:

- **shell_execute** -- Passed to `ShellExecutor` which validates against the blocked command list, optionally confirms with the user, then runs via `child_process.exec` with timeout and output limits.
- **use_capability** -- Passed to `CapabilitiesBridge` which resolves `provider.method`, validates the input, calls the WorthDoing Capabilities SDK, and returns the structured result.
- **write_file** / **read_file** -- Passed to `FileHandler` which validates the path (no traversal), then performs the operation within the workspace.
- **respond** -- Displayed to the user with left-border rendering, no side effects.
- **task_complete** -- Terminates the loop and displays the final result.

### Step 5: Result --> tool_result Message

The execution result (success/failure, output data, duration) is:

1. Serialized as a structured `StepRecord` with token counts
2. Appended to `steps.json` on disk
3. Sent back to Claude as a `tool_result` message keyed by the `tool_use_id`
4. Token usage is tracked and displayed in the terminal

### Step 6: Loop or Return

If the tool was `task_complete`, the loop terminates and the final message is displayed. Otherwise, control returns to **Step 1** with the enriched conversation context, and Claude reasons about the next tool call.

<br />

---

<br />

## Comparison

How WD Agent v1.0.0 compares to other tools in the ecosystem:

| Feature | WD Agent v1.0.0 | ChatGPT | Claude Code | Cursor |
|:--------|:--------:|:-------:|:-----------:|:------:|
| Native tool_use protocol | Yes | N/A | Yes | No |
| Context auto-compaction | Yes | No | Yes | No |
| Token usage tracking | Yes | No | Yes | No |
| Local-first execution | Yes | No | Yes | No |
| Capability-based architecture | Yes | No | No | No |
| 350+ model support | Yes | No | No | No |
| Scrollable model selector | Yes | No | No | Yes |
| Academic research (OpenAlex) | Yes | No | No | No |
| Financial data (FMP, EODHD) | Yes | No | No | No |
| Web scraping (Firecrawl) | Yes | No | No | No |
| Persistent conversations | Yes | Yes | No | No |
| Left-border response rendering | Yes | No | Yes | No |
| Open source | Yes | No | Yes | No |
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
+-- src/
|   +-- index.ts                 Public API exports
|   +-- agent/
|   |   +-- types.ts             Core type definitions
|   |   +-- loop.ts              The main agent loop (native tool_use)
|   |   +-- tools.ts             Tool definitions (6 tools with JSON Schemas)
|   |   +-- compact.ts           Context compaction engine
|   |   +-- tokens.ts            Token tracking and cost estimation
|   +-- cli/
|   |   +-- app.ts               CLI entry point and interactive REPL
|   |   +-- render.ts            Response rendering (left-border, badges, dim)
|   |   +-- selector.ts          Scrollable model selector (15-item viewport)
|   +-- config/
|   |   +-- settings.ts          Configuration loading and saving
|   +-- runtime/
|   |   +-- executor.ts          Tool call dispatcher
|   |   +-- shell.ts             Shell command runner with safety checks
|   |   +-- capabilities.ts      WorthDoing Capabilities bridge
|   |   +-- files.ts             File I/O handler with path security
|   +-- utils/
|       +-- colors.ts            Terminal color helpers
|       +-- logger.ts            Structured JSON logger
+-- package.json
+-- tsconfig.json
+-- tsup.config.ts
+-- vitest.config.ts
+-- LICENSE
```

### Guidelines

1. **TypeScript only** -- All code must be written in TypeScript with strict mode enabled.
2. **Minimal dependencies** -- No external runtime dependencies beyond `@anthropic-ai/sdk` and `worthdoing-capabilities`. Keep the dependency tree clean.
3. **Test your changes** -- Run `npm test` before submitting a PR.
4. **Sequential by design** -- Do not introduce parallelism into the agent loop. The sequential nature is a deliberate architectural choice.
5. **Native tool_use only** -- All new agent actions must be implemented as tools with proper JSON Schemas. Do not add JSON-prompt-based actions.
6. **Safety first** -- Any new tool must include appropriate safety checks and output limits.

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
