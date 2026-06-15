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

const STOP_WORDS = new Set(
  "the a an and or of to in for on with by from about into over after before is are was were be been being as at that this these those it its their his her our your you we they i what which who whom when where why how can could should would may might 的 了 和 是 在 对 与 及 或 一个 一种 哪些 什么 如何 为什么 请 帮 我 这个 那个".split(/\s+/)
);

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

function titleFromHtml(html, fallback) {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(match?.[1] || fallback || "Untitled").slice(0, 160);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; LocalMiroThinker/0.2; +http://localhost)",
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function callLLM(config, messages, schemaHint = "") {
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
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.llmApiKey}`,
      },
      body: JSON.stringify(body),
    },
    70000
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM ${response.status}: ${text.slice(0, 500)}`);
  }
  const json = await response.json();
  return json.choices?.[0]?.message?.content || "";
}

async function testLLM(config) {
  if (!config.llmApiKey) return { ok: false, message: "API Key is empty." };
  const content = await callLLM(
    { ...DEFAULTS, ...config, maxTokens: 32 },
    [{ role: "user", content: "Reply with OK only." }]
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

async function planQueries(config, question, round, evidence, gaps, messages) {
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
      'Schema: {"intent":"short intent","queries":["query"],"adversarial_queries":["counter query"],"must_verify":["claim type"],"query_count_reason":"why this many","reasoning_summary":"brief visible planning rationale"}'
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
  } catch {
    return { intent: "Research the question with external evidence.", queries: fallback, adversarialQueries: adversarialFallback, mustVerify: [] };
  }
}

async function searchDuckDuckGo(query, limit) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url);
  const html = await response.text();
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

async function searchPubMed(query, limit) {
  const term = query.replace(/\bsite:pubmed\.ncbi\.nlm\.nih\.gov\b/gi, "").replace(/\bpubmed\b/gi, "").trim() || query;
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${limit}&term=${encodeURIComponent(term)}`;
  const searchRes = await fetchWithTimeout(searchUrl);
  const searchJson = await searchRes.json();
  const ids = searchJson.esearchresult?.idlist || [];
  if (!ids.length) return [];
  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`;
  const summaryRes = await fetchWithTimeout(summaryUrl);
  const summaryJson = await summaryRes.json();
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

async function searchSerper(config, query, limit) {
  const response = await fetchWithTimeout("https://google.serper.dev/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": config.serperApiKey },
    body: JSON.stringify({ q: query, num: limit }),
  });
  if (!response.ok) throw new Error(`Serper ${response.status}`);
  const json = await response.json();
  return (json.organic || []).slice(0, limit).map((item) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet || "",
    query,
  }));
}

async function searchTavily(config, query, limit) {
  const response = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: config.tavilyApiKey, query, max_results: limit, include_answer: false }),
  });
  if (!response.ok) throw new Error(`Tavily ${response.status}`);
  const json = await response.json();
  return (json.results || []).slice(0, limit).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.content || "",
    query,
  }));
}

async function runSearch(config, query, limit) {
  const jobs = [];
  if (detectAcademicIntent(query)) jobs.push(searchPubMed(query, Math.min(limit, 5)).catch(() => []));
  if (config.searchProvider === "serper" && config.serperApiKey) jobs.push(searchSerper(config, query, limit));
  else if (config.searchProvider === "tavily" && config.tavilyApiKey) jobs.push(searchTavily(config, query, limit));
  else jobs.push(searchDuckDuckGo(query, limit));
  const groups = await Promise.all(jobs);
  return uniqueBy(groups.flat(), (r) => r.url);
}

async function readPage(result, question) {
  try {
    const response = await fetchWithTimeout(result.url, {}, 18000);
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("text/html")) {
      return { ...result, ok: false, text: result.snippet || "", error: `HTTP ${response.status}` };
    }
    const html = await response.text();
    const text = stripHtml(html).slice(0, 22000);
    return {
      ...result,
      ok: true,
      title: result.title || titleFromHtml(html, result.url),
      text,
      score: scoreText(question, `${result.title} ${result.snippet} ${text}`),
    };
  } catch (error) {
    return { ...result, ok: false, text: result.snippet || "", error: error.message };
  }
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

async function analyzeGaps(config, question, evidence, round, messages) {
  const compact = evidence.slice(0, 16).map((e, i) => ({
    id: i + 1,
    title: e.title,
    url: e.url,
    passages: e.passages,
  }));
  const fallbackEnough = round >= Number(config.maxRounds || DEFAULTS.maxRounds) || evidence.length >= 10;
  if (!config.llmApiKey) {
    return { enough: fallbackEnough && round >= Number(config.minRounds || DEFAULTS.minRounds), gaps: fallbackEnough ? [] : ["more direct evidence", "primary source", "conflicting evidence"], nextFocus: [] };
  }
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
    'Schema: {"enough":false,"confidence":0.0,"gaps":["short gap"],"next_focus":["search phrase"],"reason":"short reason","reasoning_summary":"brief visible judgment summary","working_conclusion":"tentative conclusion so far"}'
  );
  const parsed = parseJsonLoose(text, {});
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

async function synthesize(config, question, evidence, trace, messages) {
  const cited = evidence.slice(0, 18).map((e, i) => ({
    id: i + 1,
    title: e.title,
    url: e.url,
    query: e.query,
    passages: e.passages,
  }));
  if (!config.llmApiKey) {
    return [
      "未配置大模型 API，所以这里只返回检索证据摘要。",
      "",
      ...cited.map((e) => `[${e.id}] ${e.title}\n${e.url}\n${e.passages?.[0] || ""}`),
    ].join("\n");
  }
  return callLLM({ ...config, maxTokens: Number(config.maxTokens || DEFAULTS.maxTokens) }, [
    {
      role: "system",
      content: `You are a careful local deep-research agent. Answer in the user's language. Use supplied evidence for factual claims and cite sources as [1], [2]. If evidence is incomplete, say what is missing. Be complete rather than terse when the question is broad. Thinking mode is ${config.thinkingMode ? "deep: include stronger caveats and verification details" : "balanced"}.`,
    },
    {
      role: "user",
      content:
        "Conversation context:\n" +
        recentContext(messages) +
        "\n\nLatest question:\n" +
        question +
        "\n\nRetrieval trace:\n" +
        JSON.stringify(trace, null, 2) +
        "\n\nEvidence:\n" +
        JSON.stringify(cited, null, 2) +
        "\n\nWrite the final answer with citations and a short verification note.",
    },
  ]);
}

async function research(payload, emit) {
  const config = { ...DEFAULTS, ...(payload.config || {}) };
  const rawQuestion = String(payload.question || "").trim();
  const attachmentsText = attachmentContext(payload.attachments);
  const question = attachmentsText ? `${rawQuestion}\n\n${attachmentsText}` : rawQuestion;
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (!rawQuestion) throw new Error("Question is required.");

  const trace = [];
  let evidence = [];
  let gaps = [];
  const maxRounds = Number(config.maxRounds || DEFAULTS.maxRounds);

  emit("phase", { label: "问题增强与自动规划", detail: "系统会根据证据缺口自动决定是否继续检索，最多到安全上限。" });
  for (let round = 1; round <= maxRounds; round++) {
    const plan = await planQueries(config, question, round, evidence, gaps, messages);
    trace.push({ round, intent: plan.intent, queries: plan.queries, adversarialQueries: plan.adversarialQueries, mustVerify: plan.mustVerify });
    emit("plan", { round, ...plan });

    const allQueries = uniqueBy([...(plan.queries || []), ...(plan.adversarialQueries || [])], (query) => String(query).toLowerCase());
    const searchGroups = await Promise.allSettled(allQueries.map((query) => runSearch(config, query, Number(config.resultsPerQuery || DEFAULTS.resultsPerQuery))));
    const results = uniqueBy(searchGroups.flatMap((item) => (item.status === "fulfilled" ? item.value : [])), (r) => r.url?.replace(/#.*$/, ""));
    emit("search", { round, count: results.length, results: results.slice(0, 14) });

    const rankedResults = results
      .map((r) => ({ ...r, searchScore: scoreText(question, `${r.title} ${r.snippet} ${r.url}`) }))
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, Number(config.pagesPerRound || DEFAULTS.pagesPerRound));

    emit("phase", { label: `第 ${round} 轮阅读`, detail: `读取 ${rankedResults.length} 个候选页面并抽取相关段落。` });
    const pages = await Promise.all(rankedResults.map((r) => readPage(r, question)));
    const newEvidence = pages
      .filter((p) => p.ok && (p.text || p.snippet))
      .map((p) => ({ ...p, passages: pickPassages(question, p) }))
      .filter((p) => p.score > 0 || p.passages?.[0])
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    evidence = uniqueBy([...evidence, ...newEvidence], (e) => e.url?.replace(/#.*$/, ""))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 40);
    emit("evidence", { round, evidence: evidence.slice(0, 14) });

    const gapCheck = await analyzeGaps(config, question, evidence, round, messages);
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
    });
    if (config.autoResearch !== false && gapCheck.enough) break;
    if (config.autoResearch === false && round >= Number(config.minRounds || DEFAULTS.minRounds)) break;
  }

  emit("phase", { label: "综合与校验", detail: "按证据强度组织答案，并标记不确定点。" });
  const answer = await synthesize(config, question, evidence, trace, messages);
  emit("final", { answer, trace, evidence: evidence.slice(0, 18) });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
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
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      });
      try {
        await research(payload, (event, data) => sse(res, event, data));
        res.end();
      } catch (error) {
        sse(res, "error", { message: error.message });
        res.end();
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
