import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

const VENDOR_FILES = {
  "/vendor/html2canvas.min.js": [
    path.join(__dirname, "vendor", "html2canvas.min.js"),
    path.join(__dirname, "node_modules", "html2canvas", "dist", "html2canvas.min.js"),
  ],
  "/vendor/jspdf.umd.min.js": [
    path.join(__dirname, "vendor", "jspdf.umd.min.js"),
    path.join(__dirname, "node_modules", "jspdf", "dist", "jspdf.umd.min.js"),
  ],
  "/vendor/katex.min.js": [
    path.join(__dirname, "vendor", "katex.min.js"),
    path.join(__dirname, "node_modules", "katex", "dist", "katex.min.js"),
  ],
  "/vendor/auto-render.min.js": [
    path.join(__dirname, "vendor", "auto-render.min.js"),
    path.join(__dirname, "node_modules", "katex", "dist", "contrib", "auto-render.min.js"),
  ],
  "/vendor/katex.min.css": [
    path.join(__dirname, "vendor", "katex.min.css"),
    path.join(__dirname, "node_modules", "katex", "dist", "katex.min.css"),
  ],
  "/vendor/fonts/KaTeX_AMS-Regular.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_AMS-Regular.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_AMS-Regular.woff2"),
  ],
  "/vendor/fonts/KaTeX_Caligraphic-Bold.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Caligraphic-Bold.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Caligraphic-Bold.woff2"),
  ],
  "/vendor/fonts/KaTeX_Caligraphic-Regular.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Caligraphic-Regular.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Caligraphic-Regular.woff2"),
  ],
  "/vendor/fonts/KaTeX_Fraktur-Bold.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Fraktur-Bold.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Fraktur-Bold.woff2"),
  ],
  "/vendor/fonts/KaTeX_Fraktur-Regular.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Fraktur-Regular.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Fraktur-Regular.woff2"),
  ],
  "/vendor/fonts/KaTeX_Main-Bold.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Main-Bold.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Main-Bold.woff2"),
  ],
  "/vendor/fonts/KaTeX_Main-BoldItalic.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Main-BoldItalic.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Main-BoldItalic.woff2"),
  ],
  "/vendor/fonts/KaTeX_Main-Italic.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Main-Italic.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Main-Italic.woff2"),
  ],
  "/vendor/fonts/KaTeX_Main-Regular.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Main-Regular.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Main-Regular.woff2"),
  ],
  "/vendor/fonts/KaTeX_Math-BoldItalic.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Math-BoldItalic.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Math-BoldItalic.woff2"),
  ],
  "/vendor/fonts/KaTeX_Math-Italic.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Math-Italic.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Math-Italic.woff2"),
  ],
  "/vendor/fonts/KaTeX_SansSerif-Bold.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_SansSerif-Bold.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_SansSerif-Bold.woff2"),
  ],
  "/vendor/fonts/KaTeX_SansSerif-Italic.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_SansSerif-Italic.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_SansSerif-Italic.woff2"),
  ],
  "/vendor/fonts/KaTeX_SansSerif-Regular.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_SansSerif-Regular.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_SansSerif-Regular.woff2"),
  ],
  "/vendor/fonts/KaTeX_Script-Regular.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Script-Regular.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Script-Regular.woff2"),
  ],
  "/vendor/fonts/KaTeX_Size1-Regular.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Size1-Regular.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Size1-Regular.woff2"),
  ],
  "/vendor/fonts/KaTeX_Size2-Regular.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Size2-Regular.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Size2-Regular.woff2"),
  ],
  "/vendor/fonts/KaTeX_Size3-Regular.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Size3-Regular.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Size3-Regular.woff2"),
  ],
  "/vendor/fonts/KaTeX_Size4-Regular.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Size4-Regular.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Size4-Regular.woff2"),
  ],
  "/vendor/fonts/KaTeX_Typewriter-Regular.woff2": [
    path.join(__dirname, "vendor", "fonts", "KaTeX_Typewriter-Regular.woff2"),
    path.join(__dirname, "node_modules", "katex", "dist", "fonts", "KaTeX_Typewriter-Regular.woff2"),
  ],
};

const DEFAULTS = {
  llmBaseUrl: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
  llmModel: process.env.LLM_MODEL || "deepseek-v4-flash",
  llmApiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || "",
  searchProvider: process.env.SEARCH_PROVIDER || "duckduckgo",
  serperApiKey: process.env.SERPER_API_KEY || "",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
  autoResearch: true,
  maxTokens: 8192,
  maxRounds: 6,
  minRounds: 2,
  queriesPerRound: 5,
  resultsPerQuery: 6,
  pagesPerRound: 8,
  modelPresets: [
    { label: "DeepSeek v4 Flash", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash" },
    { label: "DeepSeek v4 Pro", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-pro" },
    { label: "Gemini 3.1 Pro", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-3.1-pro" },
    { label: "Gemini 3.5 Flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-3.5-flash" },
    { label: "Gemini 2.5 Pro", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-2.5-pro" },
    { label: "Gemini 2.5 Flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-2.5-flash" },
    { label: "OpenAI compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1" },
    { label: "Custom", baseUrl: "", model: "" },
  ],
};

const MAX_PAGE_BYTES = 1_500_000;
const MAX_PAGE_CHARS = 120_000;
const PAGE_READ_TIMEOUT_MS = 14_000;
const PAGE_READ_CONCURRENCY = 3;
const ROUND_READ_TIMEOUT_MS = 38_000;
const SEARCH_TIMEOUT_MS = 18_000;
const LLM_TIMEOUT_MS = 90_000;
const LLM_PLAN_TIMEOUT_MS = 55_000;
const LLM_JUDGMENT_TIMEOUT_MS = 25_000;
const LLM_FINAL_TIMEOUT_MS = 120_000;
const LLM_MAX_RESPONSE_CHARS = 2_000_000;

const STOP_WORDS = new Set(
  "the a an and or of to in for on with by from about into over after before is are was were be been being as at that this these those it its their his her our your you we they i what which who whom when where why how can could should would may might 的 了 和 是 在 对 与 及 或 一个 一种 哪些 什么 如何 为什么 请 帮 我 这个 那个".split(/\s+/)
);

const FINAL_CITATION_INSTRUCTIONS = [
  "Final citation rules:",
  "Every factual claim derived from retrieval evidence MUST include an inline citation immediately after the sentence or clause, using evidence ids like [1] or [2].",
  "Do not place citations only in a final bibliography; body conclusions must be marked where the evidence is used.",
  "End with a section titled \"References used\" (or the user's language equivalent, for example \"参考文献\") listing every cited source.",
  "Only include sources that are cited in the answer body; include each source id, title, and URL.",
  "If evidence does not support a claim, label it as uncertain instead of citing an unrelated source.",
].join("\n");

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function words(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function scoreText(query, text) {
  const q = words(query);
  const t = words(text);
  if (!q.length || !t.length) return 0;
  const freq = new Map();
  for (const token of t) freq.set(token, (freq.get(token) || 0) + 1);
  let score = 0;
  for (const token of q) {
    if (freq.has(token)) score += 1 + Math.log(1 + freq.get(token));
  }
  return score / Math.sqrt(t.length);
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function abortError(message = "Research aborted.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function mergeSignals(signals = []) {
  const active = signals.filter(Boolean);
  if (!active.length) return undefined;
  if (active.some((signal) => signal.aborted)) return AbortSignal.abort();
  if (AbortSignal.any) return AbortSignal.any(active);
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of active) signal.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

function titleFromHtml(html, fallback) {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(match?.[1] || fallback || "Untitled").slice(0, 160);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = mergeSignals([controller.signal, options.signal]);
  try {
    return await fetch(url, {
      ...options,
      signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; LocalMiroThinker/0.2; +http://localhost)",
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    if (options.signal?.aborted) throw abortError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function withTimeout(task, timeoutMs, label = "Operation") {
  let timer = null;
  try {
    return await Promise.race([
      task(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(url, options = {}, timeoutMs = 18000, maxChars = MAX_PAGE_CHARS, readOptions = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = mergeSignals([controller.signal, options.signal, readOptions.signal]);
  try {
    const response = await fetch(url, {
      ...options,
      signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; LocalMiroThinker/0.2; +http://localhost)",
        ...(options.headers || {}),
      },
    });
    const contentLength = Number(response.headers.get("content-length") || 0);
    const contentType = response.headers.get("content-type") || "";
    if (readOptions.htmlOnly && contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return { response, text: "", skipped: `Unsupported content type: ${contentType}` };
    }
    if (contentLength > MAX_PAGE_BYTES) {
      return { response, text: "", skipped: `Content too large: ${contentLength}` };
    }
    const text = await readResponseText(response, controller, maxChars);
    return { response, text };
  } catch (error) {
    if (options.signal?.aborted || readOptions.signal?.aborted) throw abortError();
    if (error?.name === "AbortError") {
      throw new Error(`Fetch timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function readResponseText(response, controller, maxChars = MAX_PAGE_CHARS) {
  if (!response.body?.getReader) {
    const text = await response.text();
    return text.slice(0, maxChars);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    if (chunk.value) {
      text += decoder.decode(chunk.value, { stream: true });
      if (text.length >= maxChars) {
        try {
          await reader.cancel();
        } catch {}
        controller.abort();
        return text.slice(0, maxChars);
      }
    }
  }
  text += decoder.decode();
  return text.slice(0, maxChars);
}

async function fetchRawWithTimeout(url, options = {}, timeoutMs = LLM_TIMEOUT_MS, maxChars = LLM_MAX_RESPONSE_CHARS) {
  const controller = new AbortController();
  let timedOut = false;
  let timer = null;
  const signal = mergeSignals([controller.signal, options.signal]);
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([
      fetch(url, {
        ...options,
        signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; LocalMiroThinker/0.2; +http://localhost)",
          ...(options.headers || {}),
        },
      }),
      timeout,
    ]);
    const text = await Promise.race([readResponseText(response, controller, maxChars), timeout]);
    return { response, text };
  } catch (error) {
    if (options.signal?.aborted) throw abortError();
    if (timedOut) throw new Error(`Request timed out after ${timeoutMs}ms`);
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}

async function callLLM(config, messages, schemaHint = "", options = {}) {
  if (!config.llmApiKey) return "";
  const url = `${config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: config.llmModel,
    messages: schemaHint
      ? [{ role: "system", content: `Return only valid JSON. ${schemaHint}` }, ...messages]
      : messages,
    temperature: Number(config.temperature ?? 0.2),
    max_tokens: Number(config.maxTokens ?? DEFAULTS.maxTokens),
  };
  const { response, text } = await fetchRawWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.llmApiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    },
    Number(options.timeoutMs || config.llmTimeoutMs || LLM_TIMEOUT_MS),
    Number(options.maxResponseChars || LLM_MAX_RESPONSE_CHARS)
  );
  if (!response.ok) {
    throw new Error(`LLM ${response.status}: ${text.slice(0, 500)}`);
  }
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`LLM returned invalid JSON: ${text.slice(0, 300)}`);
  }
  if (json.error?.message) {
    throw new Error(`LLM error: ${json.error.message}`);
  }
  return json.choices?.[0]?.message?.content || "";
}

async function testLLM(config) {
  if (!config.llmApiKey) return { ok: false, message: "API Key is empty." };
  const content = await callLLM(
    { ...DEFAULTS, ...config, maxTokens: 32 },
    [{ role: "user", content: "Reply with OK only." }],
    "",
    { timeoutMs: 30_000 }
  );
  return { ok: /ok/i.test(content), message: content || "No content returned." };
}

function parseJsonLoose(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return fallback;
    try {
      return JSON.parse(match[0]);
    } catch {
      return fallback;
    }
  }
}

function recentContext(messages = []) {
  return messages
    .slice(-6)
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${String(m.content || "").slice(0, 1200)}`)
    .join("\n\n");
}

function attachmentContext(attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length) return "";
  return attachments
    .slice(0, 6)
    .map((file) => {
      const name = String(file.name || "attachment");
      const type = String(file.type || "unknown");
      const text = String(file.text || "").slice(0, 12000);
      return `Attachment: ${name} (${type})\n${text || "[No readable text content]"}`;
    })
    .join("\n\n");
}

function detectAcademicIntent(question) {
  return /pubmed|pmid|doi|论文|文献|临床|meta[- ]?analysis|systematic review|trial|cohort|研究|biomarker|protein|gene|disease/i.test(question);
}

function heuristicQueries(question, round, gaps = [], context = "") {
  const base = question.replace(/\s+/g, " ").trim();
  const academic = detectAcademicIntent(`${question} ${context}`);
  const queries = [
    base,
    `${base} evidence source`,
    `${base} official data`,
    `${base} latest`,
  ];
  if (academic) {
    if (!/\bpubmed\b/i.test(base)) queries.unshift(`${base} PubMed`);
    queries.push(`${base} site:pubmed.ncbi.nlm.nih.gov`);
    queries.push(`${base} DOI systematic review`);
  } else {
    queries.push(`${base} site:edu OR site:gov`);
  }
  if (/[\u4e00-\u9fff]/.test(base)) {
    queries.push(`${base} 资料 来源`, `${base} 官方 数据`);
  }
  if (round > 1) {
    for (const gap of gaps.slice(0, 5)) queries.push(`${base} ${gap}`);
    queries.push(`"${base.slice(0, 90)}" verification`);
  }
  return uniqueBy(queries, (x) => x.toLowerCase()).slice(0, DEFAULTS.queriesPerRound);
}

function heuristicAdversarialQueries(question, gaps = [], context = "") {
  const base = question.replace(/\s+/g, " ").trim();
  const queries = [
    `${base} criticism limitations`,
    `${base} contradiction counter evidence`,
    `${base} failed replication controversy`,
    `${base} alternative explanation`,
  ];
  if (detectAcademicIntent(`${question} ${context}`)) {
    queries.push(`${base} negative results PubMed`);
    queries.push(`${base} systematic review limitations`);
  }
  if (/[\u4e00-\u9fff]/.test(base)) {
    queries.push(`${base} 争议 反证`);
    queries.push(`${base} 局限 质疑`);
  }
  for (const gap of gaps.slice(0, 3)) queries.push(`${base} ${gap} counter evidence`);
  return uniqueBy(queries, (x) => x.toLowerCase()).slice(0, 3);
}

async function planQueries(config, question, round, evidence, gaps, messages, signal) {
  const context = recentContext(messages);
  const fallback = heuristicQueries(question, round, gaps, context);
  const adversarialFallback = heuristicAdversarialQueries(question, gaps, context);
  try {
    const text = await callLLM(
      config,
      [
        {
          role: "user",
          content:
            `You are planning web retrieval for a research agent. Create diverse queries. If the topic is biomedical or academic, include PubMed/DOI-style queries. Use conversation context for follow-up questions. Also create adversarial queries that try to falsify, contradict, or find limitations in the likely answer. Thinking mode: ${config.thinkingMode ? "deep, prefer extra verification" : "balanced"}.\n` +
            JSON.stringify(
              {
                current_question: question,
                conversation_context: context,
                round,
                current_evidence_titles: evidence.slice(0, 12).map((e) => e.title),
                gaps,
              },
              null,
              2
            ),
        },
      ],
      'Schema: {"intent":"short intent","queries":["query"],"adversarial_queries":["counter query"],"must_verify":["claim type"],"query_count_reason":"why this many","reasoning_summary":"brief visible planning rationale"}',
      { timeoutMs: LLM_PLAN_TIMEOUT_MS, signal }
    );
    const parsed = parseJsonLoose(text, {});
    const queries = Array.isArray(parsed.queries) ? parsed.queries : [];
    const adversarialQueries = Array.isArray(parsed.adversarial_queries) ? parsed.adversarial_queries : [];
    return {
      intent: parsed.intent || "Research the question with external evidence.",
      queries: uniqueBy([...queries, ...fallback], (x) => String(x).toLowerCase()).slice(0, Number(config.queriesPerRound || DEFAULTS.queriesPerRound)),
      adversarialQueries: uniqueBy([...adversarialQueries, ...adversarialFallback], (x) => String(x).toLowerCase()).slice(0, config.thinkingMode ? 4 : 3),
      mustVerify: Array.isArray(parsed.must_verify) ? parsed.must_verify : [],
      queryCountReason: parsed.query_count_reason || "",
      reasoningSummary: parsed.reasoning_summary || "",
    };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return { intent: "Research the question with external evidence.", queries: fallback, adversarialQueries: adversarialFallback, mustVerify: [] };
  }
}

async function searchDuckDuckGo(query, limit, signal) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const { text: html } = await fetchTextWithTimeout(url, { signal }, 18000);
  const blocks = html.split(/result__body/g).slice(1);
  return blocks
    .map((block) => {
      const href = block.match(/class="result__a"[^>]*href="([^"]+)"/)?.[1];
      const title = stripHtml(block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/)?.[1] || "");
      const snippet = stripHtml(block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)?.[1] || "");
      let link = href ? href.replace(/&amp;/g, "&") : "";
      try {
        const u = new URL(link, "https://duckduckgo.com");
        const uddg = u.searchParams.get("uddg");
        if (uddg) link = uddg;
      } catch {}
      return { title, url: link, snippet, query };
    })
    .filter((r) => /^https?:\/\//.test(r.url))
    .slice(0, limit);
}

async function searchPubMed(query, limit, signal) {
  const term = query.replace(/\bsite:pubmed\.ncbi\.nlm\.nih\.gov\b/gi, "").replace(/\bpubmed\b/gi, "").trim() || query;
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${limit}&term=${encodeURIComponent(term)}`;
  const { text: searchText } = await fetchRawWithTimeout(searchUrl, { signal }, SEARCH_TIMEOUT_MS);
  const searchJson = JSON.parse(searchText);
  const ids = searchJson.esearchresult?.idlist || [];
  if (!ids.length) return [];
  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`;
  const { text: summaryText } = await fetchRawWithTimeout(summaryUrl, { signal }, SEARCH_TIMEOUT_MS);
  const summaryJson = JSON.parse(summaryText);
  return ids.map((id) => {
    const item = summaryJson.result?.[id] || {};
    return {
      title: item.title || `PubMed ${id}`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      snippet: [item.fulljournalname, item.pubdate, ...(item.authors || []).slice(0, 3).map((a) => a.name)].filter(Boolean).join(" | "),
      query,
      source: "pubmed",
    };
  });
}

async function searchSerper(config, query, limit, signal) {
  const { response, text } = await fetchRawWithTimeout("https://google.serper.dev/search", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", "x-api-key": config.serperApiKey },
    body: JSON.stringify({ q: query, num: limit }),
  }, SEARCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Serper ${response.status}`);
  const json = JSON.parse(text);
  return (json.organic || []).slice(0, limit).map((item) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet || "",
    query,
  }));
}

async function searchTavily(config, query, limit, signal) {
  const { response, text } = await fetchRawWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: config.tavilyApiKey, query, max_results: limit, include_answer: false }),
  }, SEARCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Tavily ${response.status}`);
  const json = JSON.parse(text);
  return (json.results || []).slice(0, limit).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.content || "",
    query,
  }));
}

async function runSearch(config, query, limit, signal) {
  throwIfAborted(signal);
  const jobs = [];
  if (detectAcademicIntent(query)) jobs.push(searchPubMed(query, Math.min(limit, 5), signal).catch((error) => {
    if (error?.name === "AbortError") throw error;
    return [];
  }));
  if (config.searchProvider === "serper" && config.serperApiKey) jobs.push(searchSerper(config, query, limit, signal));
  else if (config.searchProvider === "tavily" && config.tavilyApiKey) jobs.push(searchTavily(config, query, limit, signal));
  else jobs.push(searchDuckDuckGo(query, limit, signal));
  const groups = await Promise.all(jobs);
  throwIfAborted(signal);
  return uniqueBy(groups.flat(), (r) => r.url);
}

async function readPage(result, question, timeoutMs = PAGE_READ_TIMEOUT_MS, signal) {
  try {
    throwIfAborted(signal);
    const { response, text: html, skipped } = await fetchTextWithTimeout(result.url, {}, timeoutMs, MAX_PAGE_CHARS, { htmlOnly: true, signal });
    throwIfAborted(signal);
    if (skipped) return { ...result, ok: false, text: result.snippet || "", error: skipped };
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType))) {
      return { ...result, ok: false, text: result.snippet || "", error: `HTTP ${response.status}` };
    }
    const text = stripHtml(html).slice(0, 22000);
    return {
      ...result,
      ok: true,
      title: result.title || titleFromHtml(html, result.url),
      text,
      score: scoreText(question, `${result.title} ${result.snippet} ${text}`),
    };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return { ...result, ok: false, text: result.snippet || "", error: error.message };
  }
}

async function readPagesWithProgress(results, question, emit, round, signal) {
  const total = results.length;
  if (!total) return [];
  throwIfAborted(signal);
  const pages = new Array(total);
  const startedAt = Date.now();
  const deadline = startedAt + ROUND_READ_TIMEOUT_MS;
  const concurrency = Math.min(PAGE_READ_CONCURRENCY, total);
  let cursor = 0;
  let completed = 0;
  let timedOut = false;

  const markProgress = (index, page) => {
    completed += 1;
    const elapsedMs = Date.now() - startedAt;
    emit("read-progress", {
      round,
      completed,
      total,
      elapsedMs,
      ok: Boolean(page?.ok),
      title: results[index]?.title || results[index]?.url || "",
      url: results[index]?.url || "",
      error: page?.ok ? "" : page?.error || "Page read failed.",
    });
  };

  const worker = async () => {
    try {
      while (!timedOut && cursor < total) {
        throwIfAborted(signal);
        const index = cursor;
        cursor += 1;
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          timedOut = true;
          break;
        }
        const timeoutMs = Math.max(4_000, Math.min(PAGE_READ_TIMEOUT_MS, remainingMs));
        try {
          const page = await readPage(results[index], question, timeoutMs, signal);
          throwIfAborted(signal);
          pages[index] = page;
          if (!timedOut) markProgress(index, page);
        } catch (error) {
          if (error?.name === "AbortError") throw error;
          pages[index] = {
            ...results[index],
            ok: false,
            text: results[index]?.snippet || "",
            error: `Read failed: ${error.message}`,
          };
          if (!timedOut) markProgress(index, pages[index]);
        }
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      throw error;
    }
  };

  let roundTimer = null;
  await Promise.race([
    Promise.all(Array.from({ length: concurrency }, () => worker())),
    new Promise((resolve) => {
      roundTimer = setTimeout(() => {
        timedOut = true;
        resolve();
      }, ROUND_READ_TIMEOUT_MS);
    }),
  ]);
  if (roundTimer) clearTimeout(roundTimer);
  throwIfAborted(signal);

  const timeoutFallbacks = [];
  for (let index = 0; index < total; index += 1) {
    if (pages[index]) continue;
    pages[index] = {
      ...results[index],
      ok: false,
      text: results[index]?.snippet || "",
      error: "Round read timeout; skipped unfinished page.",
    };
    timeoutFallbacks.push(results[index]?.title || results[index]?.url || "");
  }

  if (timeoutFallbacks.length) {
    emit("read-progress", {
      round,
      completed,
      total,
      elapsedMs: Date.now() - startedAt,
      ok: false,
      timedOut: true,
      title: "",
      url: "",
      error: `Skipped ${timeoutFallbacks.length} unfinished page(s) after the round timeout.`,
    });
  }
  return pages;
}

function pickPassages(question, page) {
  const sentences = String(page.text || page.snippet || "")
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 60 && s.length < 700);
  const ranked = sentences
    .map((text) => ({ text, score: scoreText(question, text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  return ranked.length ? ranked.map((p) => p.text) : [String(page.snippet || page.text || "").slice(0, 500)];
}

function compactEvidenceForModel(evidence = [], options = {}) {
  const maxItems = Number(options.maxItems || 10);
  const maxPassages = Number(options.maxPassages || 2);
  const maxPassageChars = Number(options.maxPassageChars || 280);
  const maxTitleChars = Number(options.maxTitleChars || 160);
  return evidence.slice(0, maxItems).map((item, index) => ({
    id: item.id || index + 1,
    title: String(item.title || "").slice(0, maxTitleChars),
    url: item.url,
    query: item.query,
    passages: (item.passages || []).slice(0, maxPassages).map((passage) => String(passage || "").slice(0, maxPassageChars)),
  }));
}

function compactTraceForModel(trace = [], options = {}) {
  const maxRounds = Number(options.maxRounds || 8);
  return trace.slice(-maxRounds).map((item) => ({
    round: item.round,
    intent: item.intent,
    queries: (item.queries || []).slice(0, 4),
    adversarialQueries: (item.adversarialQueries || []).slice(0, 3),
    mustVerify: (item.mustVerify || []).slice(0, 4),
  }));
}

function fallbackGapCheck(config, evidence, round, reason = "") {
  const minRounds = Number(config.minRounds || DEFAULTS.minRounds);
  const maxRounds = Number(config.maxRounds || DEFAULTS.maxRounds);
  const enough = round >= maxRounds || (round >= minRounds && evidence.length >= 12);
  const gaps = enough ? [] : ["more direct evidence", "primary source", "conflicting evidence", "updated source"];
  return {
    enough,
    confidence: enough ? 0.55 : 0.25,
    gaps,
    nextFocus: gaps,
    reason: reason || (enough ? "Reached safety limit; synthesizing with available evidence." : "Judgment model did not return in time; continuing retrieval with conservative gaps."),
    reasoningSummary: reason || (enough ? "Reached the configured search limit." : "The judgment step was degraded to a conservative heuristic so the task can continue."),
    workingConclusion: "",
    fallback: true,
  };
}

function fallbackAnswerFromEvidence(error, evidence = []) {
  const cited = compactEvidenceForModel(evidence, { maxItems: 12, maxPassages: 2, maxPassageChars: 360 });
  return [
    `模型综合输出超时或失败：${error.message}`,
    "",
    "下面先返回已检索到的证据摘要，避免本次研究结果丢失：",
    "",
    "参考文献（已检索证据）:",
    "",
    ...cited.map((item) => [
      `[${item.id}] ${item.title}`,
      item.url,
      ...(item.passages || []),
    ].join("\n")),
  ].join("\n");
}

async function analyzeGaps(config, question, evidence, round, messages, signal) {
  const compact = compactEvidenceForModel(evidence, { maxItems: 12, maxPassages: 2, maxPassageChars: 260 });
  const fallbackEnough = round >= Number(config.maxRounds || DEFAULTS.maxRounds) || evidence.length >= 10;
  if (!config.llmApiKey) {
    return { enough: fallbackEnough && round >= Number(config.minRounds || DEFAULTS.minRounds), gaps: fallbackEnough ? [] : ["more direct evidence", "primary source", "conflicting evidence"], nextFocus: [] };
  }
  let parsed = {};
  try {
    throwIfAborted(signal);
    const text = await callLLM(
      config,
      [
        {
          role: "user",
          content:
            `Decide whether the current evidence is sufficient to answer the user's latest question. Be strict: continue if the answer needs exact names, dates, numbers, primary literature, or if evidence is weak. Stop only when a reliable answer can be written. Thinking mode: ${config.thinkingMode ? "deep verification, higher bar to stop" : "balanced"}.\n` +
            JSON.stringify({ question, conversation_context: recentContext(messages), round, evidence: compact }, null, 2),
        },
      ],
      'Schema: {"enough":false,"confidence":0.0,"gaps":["short gap"],"next_focus":["search phrase"],"reason":"short reason","reasoning_summary":"brief visible judgment summary","working_conclusion":"tentative conclusion so far"}',
      { timeoutMs: LLM_JUDGMENT_TIMEOUT_MS, signal }
    );
    throwIfAborted(signal);
    parsed = parseJsonLoose(text, {});
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return fallbackGapCheck(config, evidence, round, `Judgment step timed out or failed: ${error.message}`);
  }
  const enoughByModel = Boolean(parsed.enough) && Number(parsed.confidence || 0) >= 0.65;
  return {
    enough: enoughByModel && round >= Number(config.minRounds || DEFAULTS.minRounds),
    confidence: Number(parsed.confidence || 0),
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 6) : [],
    nextFocus: Array.isArray(parsed.next_focus) ? parsed.next_focus.slice(0, 6) : [],
    reason: parsed.reason || "",
    reasoningSummary: parsed.reasoning_summary || "",
    workingConclusion: parsed.working_conclusion || "",
  };
}

async function synthesize(config, question, evidence, trace, messages, signal) {
  const cited = compactEvidenceForModel(evidence, { maxItems: config.thinkingMode ? 12 : 10, maxPassages: 2, maxPassageChars: config.thinkingMode ? 320 : 260 });
  const compactTrace = compactTraceForModel(trace, { maxRounds: config.thinkingMode ? 8 : 6 });
  if (!config.llmApiKey) {
    return [
      "未配置大模型 API，所以这里只返回检索证据摘要。",
      "",
      "参考文献（已检索证据）:",
      "",
      ...cited.map((e) => `[${e.id}] ${e.title}\n${e.url}\n${e.passages?.[0] || ""}`),
    ].join("\n");
  }
  throwIfAborted(signal);
  return callLLM({ ...config, maxTokens: Number(config.maxTokens || DEFAULTS.maxTokens) }, [
    {
      role: "system",
      content: `You are a careful local deep-research agent. Answer in the user's language. Use supplied evidence for factual claims. If evidence is incomplete, say what is missing. Be complete rather than terse when the question is broad. Thinking mode is ${config.thinkingMode ? "deep: include stronger caveats and verification details" : "balanced"}.\n\n${FINAL_CITATION_INSTRUCTIONS}`,
    },
    {
      role: "user",
      content:
        "Conversation context:\n" +
        recentContext(messages) +
        "\n\nLatest question:\n" +
        question +
        "\n\nRetrieval trace:\n" +
        JSON.stringify(compactTrace, null, 2) +
        "\n\nEvidence:\n" +
        JSON.stringify(cited, null, 2) +
        "\n\n" +
        FINAL_CITATION_INSTRUCTIONS +
        "\n\nWrite the final answer with inline citations, a short verification note, and a References used section.",
    },
  ], "", { timeoutMs: LLM_FINAL_TIMEOUT_MS, signal });
}

async function answerFromContext(config, question, messages, signal) {
  if (!config.llmApiKey) {
    return "尚未配置大模型 API，普通模式无法直接作答。请先在设置中填写可用的模型配置。";
  }
  throwIfAborted(signal);
  return callLLM(
    { ...config, maxTokens: Number(config.maxTokens || DEFAULTS.maxTokens) },
    [
      {
        role: "system",
        content:
          "You are a helpful local assistant. Answer in the user's language. Use the conversation context when it matters. Be direct, clear, and honest about uncertainty. Do not claim web verification unless retrieval evidence is explicitly provided.",
      },
      {
        role: "user",
        content:
          "Conversation context:\n" +
          recentContext(messages) +
          "\n\nLatest question:\n" +
          question +
          "\n\nProvide the best direct answer based on the existing conversation only.",
      },
    ],
    "",
    { timeoutMs: LLM_FINAL_TIMEOUT_MS, signal }
  );
}

async function research(payload, emit, signal) {
  const config = { ...DEFAULTS, ...(payload.config || {}) };
  const rawQuestion = String(payload.question || "").trim();
  const attachmentsText = attachmentContext(payload.attachments);
  const question = attachmentsText ? `${rawQuestion}\n\n${attachmentsText}` : rawQuestion;
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const mode = payload.mode === "chat" ? "chat" : payload.mode === "research" ? "research" : "research";
  const directAnswerOnly = Boolean(payload.directAnswerOnly);
  const seedEvidence = Array.isArray(payload.seedEvidence) ? payload.seedEvidence : [];
  const seedTrace = Array.isArray(payload.seedTrace) ? payload.seedTrace : [];
  if (!rawQuestion) throw new Error("Question is required.");

  const trace = directAnswerOnly ? [...seedTrace] : [];
  let evidence = directAnswerOnly ? [...seedEvidence] : [];
  let gaps = [];
  const maxRounds = Number(config.maxRounds || DEFAULTS.maxRounds);

  if (mode === "chat") {
    emit("phase", {
      label: "普通模式回答",
      detail: "基于当前会话上下文直接作答，不发起新的网页检索。",
    });
    let answer = "";
    try {
      answer = await answerFromContext(config, question, messages, signal);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      answer = `出错：${error.message}`;
    }
    emit("final", { answer, trace: [], evidence: [], directAnswerOnly: false, mode: "chat" });
    return;
  }

  if (directAnswerOnly) {
    if (!evidence.length) throw new Error("No saved evidence is available for direct answer mode.");
    emit("phase", {
      label: "基于当前证据直接作答",
      detail: `复用上一轮保留的 ${evidence.length} 条证据，不再发起新的网页检索。`,
    });
    let answer = "";
    try {
      answer = await synthesize(config, question, evidence, trace, messages, signal);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      answer = fallbackAnswerFromEvidence(error, evidence);
    }
    emit("final", { answer, trace, evidence: evidence.slice(0, 18), directAnswerOnly: true });
    return;
  }

  emit("phase", { label: "问题增强与自动规划", detail: "系统会根据证据缺口自动决定是否继续检索，最多到安全上限。" });
  for (let round = 1; round <= maxRounds; round++) {
    throwIfAborted(signal);
    const plan = await planQueries(config, question, round, evidence, gaps, messages, signal);
    trace.push({ round, intent: plan.intent, queries: plan.queries, adversarialQueries: plan.adversarialQueries, mustVerify: plan.mustVerify });
    emit("plan", { round, ...plan });

    const allQueries = uniqueBy([...(plan.queries || []), ...(plan.adversarialQueries || [])], (query) => String(query).toLowerCase());
    const searchGroups = await Promise.allSettled(allQueries.map((query) => runSearch(config, query, Number(config.resultsPerQuery || DEFAULTS.resultsPerQuery), signal)));
    throwIfAborted(signal);
    const results = uniqueBy(searchGroups.flatMap((item) => (item.status === "fulfilled" ? item.value : [])), (r) => r.url?.replace(/#.*$/, ""));
    emit("search", { round, count: results.length, results: results.slice(0, 14) });

    const rankedResults = results
      .map((r) => ({ ...r, searchScore: scoreText(question, `${r.title} ${r.snippet} ${r.url}`) }))
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, Number(config.pagesPerRound || DEFAULTS.pagesPerRound));

    emit("phase", { label: `第 ${round} 轮阅读`, detail: `读取 ${rankedResults.length} 个候选页面并抽取相关段落。` });
    const pages = await readPagesWithProgress(rankedResults, question, emit, round, signal);
    throwIfAborted(signal);
    const newEvidence = pages
      .filter((p) => p.ok && (p.text || p.snippet))
      .map((p) => ({ ...p, passages: pickPassages(question, p) }))
      .filter((p) => p.score > 0 || p.passages?.[0])
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    evidence = uniqueBy([...evidence, ...newEvidence], (e) => e.url?.replace(/#.*$/, ""))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 40);
    emit("evidence", {
      round,
      evidence: evidence.slice(0, 14),
      pageStats: {
        attempted: rankedResults.length,
        succeeded: pages.filter((p) => p.ok).length,
        failed: pages.filter((p) => !p.ok).length,
      },
    });

    emit("phase", { label: `第 ${round} 轮证据判断`, detail: "正在让模型判断证据是否足够；若 25 秒内没有返回，将自动继续下一轮或降级处理。" });
    const gapCheck = await analyzeGaps(config, question, evidence, round, messages, signal);
    throwIfAborted(signal);
    gaps = uniqueBy([...(gapCheck.nextFocus || []), ...(gapCheck.gaps || [])], (x) => String(x).toLowerCase()).slice(0, 8);
    emit("gaps", {
      round,
      enough: gapCheck.enough,
      confidence: gapCheck.confidence,
      reason: gapCheck.reason,
      gaps,
      nextFocus: gapCheck.nextFocus || [],
      reasoningSummary: gapCheck.reasoningSummary,
      workingConclusion: gapCheck.workingConclusion,
      fallback: Boolean(gapCheck.fallback),
    });
    if (config.autoResearch !== false && gapCheck.enough) break;
    if (config.autoResearch === false && round >= Number(config.minRounds || DEFAULTS.minRounds)) break;
  }

  emit("phase", { label: "综合与校验", detail: "按证据强度组织答案，并标记不确定点。" });
  let answer = "";
  try {
    answer = await synthesize(config, question, evidence, trace, messages, signal);
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    answer = fallbackAnswerFromEvidence(error, evidence);
  }
  emit("final", { answer, trace, evidence: evidence.slice(0, 18), directAnswerOnly: false });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (VENDOR_FILES[url.pathname]) {
    const filePath = VENDOR_FILES[url.pathname].find((candidate) => existsSync(candidate));
    if (!filePath) {
      res.writeHead(404);
      res.end("Vendor file not found");
      return;
    }
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
    return;
  }
  const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(__dirname, "public", path.normalize(safePath).replace(/^(\.\.[/\\])+/, ""));
  if (!filePath.startsWith(path.join(__dirname, "public")) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const data = await readFile(filePath);
  res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/defaults") return sendJson(res, 200, { defaults: DEFAULTS });
    if (req.method === "POST" && req.url === "/api/test-llm") {
      const payload = await readBody(req);
      const result = await testLLM(payload.config || {});
      return sendJson(res, result.ok ? 200 : 400, result);
    }
    if (req.method === "POST" && req.url === "/api/research") {
      const payload = await readBody(req);
      const requestController = new AbortController();
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      });
      res.on("close", () => requestController.abort());
      const emit = (event, data) => {
        if (requestController.signal.aborted || res.destroyed || res.writableEnded) return;
        sse(res, event, data);
      };
      try {
        await research(payload, emit, requestController.signal);
        if (!res.destroyed && !res.writableEnded) res.end();
      } catch (error) {
        if (error?.name !== "AbortError" && !res.destroyed && !res.writableEnded) {
          sse(res, "error", { message: error.message });
          res.end();
        }
      }
      return;
    }
    if (req.method === "GET") return serveStatic(req, res);
    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Local MiroThinker is running at http://localhost:${PORT}`);
});
