// ─── RIPER — Local Dev Server ─────────────────────────────────────────────────
// Proxies calls to Anthropic & Firecrawl so the browser never touches API keys.
//
// Usage:
//   cp .env.example .env      # add your ANTHROPIC_API_KEY
//   npm install
//   npm start
//   open http://localhost:3000
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3004;

// ── Structured Logger ─────────────────────────────────────────────────────────
const LOG_FILE = path.join(__dirname, 'riper.log');

function rlog(level, endpoint, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    endpoint,
    ...details,
  };
  const line = JSON.stringify(entry);
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Fetch with timeout helper ─────────────────────────────────────────────────
async function fetchWithTimeout(url, opts = {}, timeoutMs = 120000) {
  const { AbortController: AC } = await import('abort-controller').catch(() => ({ AbortController: globalThis.AbortController }));
  const controller = new (AC || AbortController)();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Request logging middleware ─────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api/')) {
      rlog('info', req.path, {
        method: req.method,
        status: res.statusCode,
        latencyMs: Date.now() - start,
        model: req.body?.model || null,
      });
    }
  });
  next();
});

// ── GET /api/profile/:company ─────────────────────────────────────────────────
// Loads a company-specific .md profile from /profiles directory.
// :company must resolve to a real filename — path traversal is blocked.
app.get('/api/profile/:company', (req, res) => {
  // Sanitize: strip any path separators or dots to prevent traversal
  const safeName = req.params.company.replace(/[/\\\.]/g, '');
  if (!safeName) {
    return res.status(400).json({ error: 'Invalid company name.' });
  }

  const profilesDir = path.resolve(__dirname, '../profiles');
  const profilePath = path.join(profilesDir, `${safeName}.md`);

  // Ensure the resolved path is actually inside profiles/ using path.relative
  // (startsWith is fragile on Windows with mixed-case drive letters)
  const rel = path.relative(profilesDir, profilePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    rlog('warn', '/api/profile/:company', { error: 'Path traversal attempt', name: req.params.company });
    return res.status(400).json({ error: 'Invalid company name.' });
  }

  if (fs.existsSync(profilePath)) {
    rlog('info', '/api/profile/:company', { company: safeName });
    return res.json({ profile: fs.readFileSync(profilePath, 'utf8') });
  } else {
    rlog('warn', '/api/profile/:company', { error: 'Profile not found', company: safeName });
    return res.status(404).json({ error: `Profile not found for: ${safeName}` });
  }
});

// ── GET /api/profiles (list available) ───────────────────────────────────────
app.get('/api/profiles', (req, res) => {
  const profilesDir = path.resolve(__dirname, '../profiles');
  try {
    const files = fs.readdirSync(profilesDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));
    res.json({ profiles: files });
  } catch {
    res.json({ profiles: [] });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
    hf: !!process.env.HF_TOKEN,
  });
});

// ── Proxy: Anthropic /v1/messages ─────────────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    rlog('error', '/api/claude', { error: 'ANTHROPIC_API_KEY not set' });
    return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY not set in .env' } });
  }

  try {
    const payload = req.body;
    // NOTE: No model override — the frontend specifies the model per-call
    // (Haiku for cheap analysis, Sonnet for search/audit)

    rlog('info', '/api/claude', { model: payload.model, max_tokens: payload.max_tokens });

    const upstream = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            apiKey,
        'anthropic-version':    '2023-06-01',
        'anthropic-beta':       'web-search-2025-03-05',
      },
      body: JSON.stringify(payload),
    }, 120000);

    const data = await upstream.json();

    if (upstream.status !== 200) {
      rlog('warn', '/api/claude', { status: upstream.status, error: data.error?.message || 'upstream error' });
    }

    res.status(upstream.status).json(data);
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    rlog('error', '/api/claude', { error: err.message, timeout: isTimeout });
    res.status(isTimeout ? 504 : 500).json({ error: { message: isTimeout ? 'Anthropic request timed out (120s)' : err.message } });
  }
});

// ── Proxy: Hugging Face /v1/chat/completions ──────────────────────────────────
app.post('/api/hf/chat', async (req, res) => {
  const token = process.env.HF_TOKEN;
  if (!token) {
    rlog('error', '/api/hf/chat', { error: 'HF_TOKEN not set' });
    return res.status(500).json({ error: { message: 'HF_TOKEN not set in .env' } });
  }

  try {
    rlog('info', '/api/hf/chat', { model: req.body?.model, max_tokens: req.body?.max_tokens });

    const upstream = await fetchWithTimeout('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(req.body)
    }, 180000); // HF can be slow — 3 min timeout

    const data = await upstream.json();

    if (upstream.status !== 200) {
      rlog('warn', '/api/hf/chat', { status: upstream.status, error: typeof data.error === 'string' ? data.error : data.error?.message });
    }

    res.status(upstream.status).json(data);
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    rlog('error', '/api/hf/chat', { error: err.message, timeout: isTimeout });
    res.status(isTimeout ? 504 : 500).json({ error: { message: isTimeout ? 'HF request timed out (180s)' : err.message } });
  }
});

// ── Proxy: Firecrawl /v1/scrape ───────────────────────────────────────────────
app.post('/api/firecrawl/scrape', async (req, res) => {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'No Firecrawl API key configured in .env.' });
  }

  try {
    rlog('info', '/api/firecrawl/scrape', { url: req.body?.url });

    const upstream = await fetchWithTimeout('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    }, 90000);

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    rlog('error', '/api/firecrawl/scrape', { error: err.message, timeout: isTimeout, url: req.body?.url });
    res.status(isTimeout ? 504 : 500).json({ success: false, error: isTimeout ? 'Firecrawl request timed out (90s)' : err.message });
  }
});

// ── Proxy: Firecrawl /v1/crawl (depth crawl) ──────────────────────────────────
app.post('/api/firecrawl/crawl', async (req, res) => {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'No Firecrawl API key configured in .env.' });
  }

  try {
    rlog('info', '/api/firecrawl/crawl', { url: req.body?.url });

    const upstream = await fetchWithTimeout('https://api.firecrawl.dev/v1/crawl', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    }, 120000);

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    rlog('error', '/api/firecrawl/crawl', { error: err.message, timeout: isTimeout });
    res.status(isTimeout ? 504 : 500).json({ success: false, error: isTimeout ? 'Firecrawl crawl timed out (120s)' : err.message });
  }
});

// ── Proxy: Firecrawl GET /v1/crawl/:id (poll status) ─────────────────────────
app.get('/api/firecrawl/crawl/:id', async (req, res) => {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'No Firecrawl API key configured in .env.' });
  }

  try {
    const upstream = await fetchWithTimeout(`https://api.firecrawl.dev/v1/crawl/${req.params.id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    }, 30000);

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    rlog('error', '/api/firecrawl/crawl/:id', { error: err.message, timeout: isTimeout });
    res.status(isTimeout ? 504 : 500).json({ success: false, error: isTimeout ? 'Poll timed out (30s)' : err.message });
  }
});

// ── Catch-all → index.html ─────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  rlog('info', 'startup', {
    port: PORT,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
    hf: !!process.env.HF_TOKEN,
  });
  console.log(`
╔══════════════════════════════════════════════╗
║   RIPER — Research Intelligence Pipeline     ║
╠══════════════════════════════════════════════╣
║   Server  →  http://localhost:${PORT}           ║
║   Health  →  http://localhost:${PORT}/health    ║
╠══════════════════════════════════════════════╣
║   Anthropic key : ${process.env.ANTHROPIC_API_KEY ? '✓ loaded' : '✗ MISSING (.env)'}               ║
║   Firecrawl key : ${process.env.FIRECRAWL_API_KEY ? '✓ loaded' : '○ not set (fallback mode)'}        ║
║   Hugging Face  : ${process.env.HF_TOKEN ? '✓ loaded' : '✗ MISSING (.env)'}               ║
║   Log file      : riper.log                   ║
╚══════════════════════════════════════════════╝
`);
});
