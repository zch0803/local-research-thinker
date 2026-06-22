# Local Research Agent

Local Research Agent is a local web research agent inspired by the retrieval style of multi-round research workflows. It runs as a lightweight local web app, supports public LLM APIs such as DeepSeek, Gemini, and other OpenAI-compatible endpoints, and focuses on retrieval strategy rather than just a single-pass answer.

## What This Project Tries To Do

This project is built around one core idea:

> A good research assistant should not only search more, but search more skeptically, search in rounds, read evidence, notice gaps, and decide what to verify next.

The goal is to make the visible workflow feel closer to a real research process:

- understand the question in context
- plan multiple search directions
- generate adversarial / falsification queries
- read candidate pages instead of only using snippets
- keep a rolling evidence pool
- decide whether the current evidence is enough
- continue searching when the answer is still weak
- produce a cited final answer

## Product Design Philosophy

The interface is designed around long-form iterative research, not one-shot chat.

### 1. Conversations are assets

- Multi-session history is stored locally in the browser.
- Sessions can be searched, exported, imported, and reused.
- A single conversation can contain many follow-up questions without overwriting earlier results.

### 2. The input box should stay usable

- The composer stays at the bottom of the workbench.
- The conversation area scrolls independently.
- History controls stay available without forcing you to scroll back to the page top.

### 3. Research should be visible

- Retrieval and thinking traces are shown under each answer.
- During research, the center pane shows round-by-round progress summaries instead of just raw query strings.
- The UI emphasizes: current reasoning, tentative conclusion, and next search direction.

### 4. Retrieval should be model-guided, not only hard-coded

- The app does have safe upper limits for rounds and page reads.
- But the decision to continue or stop is made by evidence sufficiency analysis, not only by a fixed preset loop.
- Thinking mode raises the verification bar and encourages deeper search.

### 5. Local-first practicality

- No database is required.
- History lives in browser localStorage.
- The Windows launcher can start and stop the app without requiring manual terminal use.

## Retrieval Strategy

This is the most important part of the project.

### Overview

For each user question, the system runs a multi-round retrieval loop:

1. understand the latest question together with recent conversation context
2. generate diverse normal queries
3. generate adversarial queries
4. run web search and academic search when needed
5. fetch and read selected pages
6. extract relevant passages
7. rank and accumulate evidence
8. analyze evidence gaps
9. decide whether another round is needed
10. synthesize the final answer with citations

### Query Planning

The planner does not rely on a single keyword expansion. It uses:

- the latest user question
- recent conversation context
- titles of already collected evidence
- open evidence gaps from earlier rounds

It produces:

- normal queries for coverage
- adversarial queries for falsification
- must-verify items
- a visible reasoning summary for the UI

### Adversarial Retrieval

This project explicitly includes adversarial retrieval.

Instead of only searching for supporting evidence, it also searches for:

- criticism
- contradiction
- counter-evidence
- failed replication
- controversy
- limitations
- alternative explanations
- negative results

This matters because many research agents look good on easy questions but become overconfident when they only gather confirming evidence.

### Academic / PubMed Retrieval

When the query looks biomedical, clinical, or literature-oriented, the system supplements normal web search with PubMed E-utilities.

That means academic questions can pull from:

- standard search engine results
- PubMed records directly

This is especially useful for:

- disease / biomarker questions
- evidence-based medicine
- trial / cohort / meta-analysis queries
- DOI / PMID / paper lookup

### Reading Instead of Snippet-Only Search

The system does not stop at the search result snippet.

After ranking candidate results, it:

- fetches the page
- extracts readable text
- scores the page against the research question
- selects relevant passages
- stores evidence for later synthesis

### Gap Analysis

After each round, the model judges whether the evidence is sufficient.

It asks questions like:

- Do we still need exact names or dates?
- Are the numbers still weak?
- Do we have primary sources?
- Do we have conflicting evidence?
- Is the answer missing official confirmation?

If the answer is still weak, the next round is planned around the detected gaps.

### Final Synthesis

The final answer is produced only after the retrieval loop has accumulated enough evidence or hit the safe limit.

The synthesis step:

- answers in the user language
- uses the evidence pool
- adds source citations like `[1]`, `[2]`
- includes verification-aware wording when evidence is incomplete

## Current Features

- Multi-session conversation history
- Local import / export for history JSON
- Export current session as Markdown / HTML / PDF
- Export single answers as Markdown
- Searchable history sidebar
- Fast question locator rail
- File upload for text attachments
- Model presets
- API connectivity test
- Thinking mode toggle
- Markdown rendering including tables
- Retrieval / thinking trace folding
- Compact message actions:
  - copy question
  - edit question back into composer
  - copy answer
  - export answer as Markdown
- `Enter` to send, `Shift+Enter` to insert newline
- Windows launcher with Start / Open / Stop

## Supported Model Endpoints

The app currently supports OpenAI-compatible chat completion APIs.

Common presets include:

- DeepSeek v4 Flash
- DeepSeek v4 Pro
- Gemini 3.1 Pro
- Gemini 3.5 Flash
- Gemini 2.5 Pro
- Gemini 2.5 Flash
- generic OpenAI-compatible endpoints

## Search Providers

### DuckDuckGo HTML

- free
- no API key required
- simple default option
- not guaranteed to be stable long-term

### Serper

- requires API key
- Google-backed results

### Tavily

- requires API key
- useful for research-style search

### PubMed

- automatically used for academic / biomedical intent
- powered by NCBI E-utilities
- no separate PubMed API key is required in this app

## Quick Start

```bash
npm start
```

Then open:

```text
http://localhost:5173
```

## Example DeepSeek Configuration

Fill these in the settings dialog:

- Base URL: `https://api.deepseek.com/v1`
- Model: `deepseek-v4-flash`
- API Key: your DeepSeek API key

Or use environment variables:

```powershell
$env:LLM_BASE_URL="https://api.deepseek.com/v1"
$env:LLM_MODEL="deepseek-v4-flash"
$env:DEEPSEEK_API_KEY="sk-..."
npm start
```

## Local Data Storage

- conversation history is stored in browser `localStorage`
- launcher port settings are stored in `launcher.config`
- exported JSON / Markdown / HTML / PDF files are your portable backup/share format

## Build Windows Distribution

To generate the latest Windows package:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-distribution.ps1
```

Output:

- folder: `dist\LocalResearchAgent`
- zip: `dist\LocalResearchAgent-win-x64.zip`
- launcher: `dist\LocalResearchAgent\LocalResearchAgentLauncher.exe`

The launcher bundles `node.exe`, so the target Windows machine usually does not need a separate Node.js installation.

## GitHub Publishing Recommendation

For GitHub, the recommended structure is:

- commit source code to the repository
- keep `dist/` out of normal source control
- upload the Windows zip package to GitHub Releases

This keeps the repository smaller and cleaner while still giving users a direct downloadable Windows build.

## Deploy On Another Computer

See:

- [DEPLOYMENT.md](./DEPLOYMENT.md)

## Recommended GitHub Repository Name

If you want a short, clear English repository name, my recommendation is:

`local-research-thinker`

It is simple, descriptive, and closer to the product behavior than a generic name like `web-research-app`.

