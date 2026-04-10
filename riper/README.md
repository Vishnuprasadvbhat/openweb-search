# RIPER — Research Intelligence Pipeline

A local 6-stage research tool that analyzes a mission, searches the web, scrapes sources, and synthesizes a Perplexity-style report.

## Quick Start

### 1. Prerequisites
- Node.js 18+ installed → https://nodejs.org
- An Anthropic API key → https://console.anthropic.com

### 2. Install

```bash
cd riper
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Open `.env` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
FIRECRAWL_API_KEY=           # optional — leave blank for fallback
PORT=3000                    # optional
```

### 4. Run

```bash
npm start
```

Then open → **http://localhost:3000**

---

## Pipeline Stages

| Stage | What happens |
|-------|-------------|
| S1 Mission | Parses your `.md` file or pasted text |
| S2 Analyze | Claude extracts intent + generates search queries |
| S3 Search | Claude uses `web_search` to find real URLs |
| S4 Scrape | Firecrawl (or Claude fallback) extracts page content |
| S5 Synthesize | Claude synthesizes a cited report from all sources |
| S6 Export | Download as `results.json` or `report.md` |

---

## Firecrawl (Optional)

Without a Firecrawl key the pipeline uses Claude's built-in `web_search` tool to fetch and summarize pages — this works well for most missions.

With a Firecrawl key you get:
- Full page markdown extraction
- Configurable crawl depth (follow links)
- PDF ingestion
- Pagination handling

Get a key at https://firecrawl.dev — you can paste it in the UI sidebar at runtime, or set it in `.env`.

---

## Example Mission File

Create a file called `mission.md`:

```markdown
## Research Mission

**Goal**: Understand the current state of RAG (Retrieval Augmented Generation) 
architectures used in production AI systems in 2025.

**Topics**:
- Vector database comparison (Pinecone, Weaviate, Qdrant, pgvector)
- Chunking strategies and their impact on retrieval quality
- Hybrid search (BM25 + dense retrieval)
- Re-ranking models
- Agentic RAG patterns

**Target sites**: arxiv.org, huggingface.co, langchain.com, llamaindex.ai

**Output**: Focus on practical implementation trade-offs, benchmarks, and 
real-world usage patterns.
```

Upload it in the sidebar or paste the content directly.

---

## Exporting Results

After a run, use the Export buttons to download:

- **results.json** — full structured data (analysis, URLs, scraped content summary, synthesis) — feed back into future runs to refine queries
- **report.md** — clean markdown report ready to share or paste into Notion/Obsidian

---

## Troubleshooting

**"Server offline" badge** → Make sure `npm start` is running and you're on http://localhost:3000

**"No API key" badge** → Check that `ANTHROPIC_API_KEY` is set correctly in `.env` (no quotes around the value)

**No URLs found** → Try a more specific mission with explicit topic keywords

**Scraping errors** → Some sites block scrapers; the pipeline continues with successfully scraped sources
