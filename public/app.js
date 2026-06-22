const $ = (selector) => document.querySelector(selector);

const storage = {
  config: "local-research-agent-config",
  sessions: "local-research-agent-sessions",
  active: "local-research-agent-active-session",
};

const state = {
  config: JSON.parse(localStorage.getItem(storage.config) || "{}"),
  sessions: JSON.parse(localStorage.getItem(storage.sessions) || "[]"),
  activeId: localStorage.getItem(storage.active),
  defaultModelPresets: [],
  customModelPresets: [],
  modelPresetApiKeys: {},
  activeModelPresetId: null,
  running: false,
  pendingAssistantId: null,
  abortController: null,
  stopRequested: false,
  researchJobs: new Map(),
  attachments: [],
  sessionQuery: "",
  traceOpenById: {},
  responseMode: "chat",
  sessionSearchTarget: null,
};

const fields = ["llmBaseUrl", "llmModel", "llmApiKey", "searchProvider", "serperApiKey", "tavilyApiKey"];

const STORAGE_LIMITS = {
  attachmentText: 0,
  detail: 2400,
  extra: 1200,
  passage: 900,
  query: 240,
  snippet: 600,
  title: 220,
  url: 1200,
};

function now() {
  return new Date().toISOString();
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneSessionWithFreshIds(session) {
  const nextId = uid();
  return {
    ...session,
    id: nextId,
    messages: (session.messages || []).map((message) => ({
      ...message,
      id: uid(),
    })),
  };
}

function truncateForStorage(value, limit) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 3))}...` : text;
}

function compactEvidenceForStorage(item = {}) {
  const passages = Array.isArray(item.passages)
    ? item.passages.slice(0, 3).map((passage) => truncateForStorage(passage, STORAGE_LIMITS.passage)).filter(Boolean)
    : [];
  const compact = {
    id: item.id,
    title: truncateForStorage(item.title || item.url || "Source", STORAGE_LIMITS.title),
    url: truncateForStorage(item.url || "", STORAGE_LIMITS.url),
    query: truncateForStorage(item.query || "", STORAGE_LIMITS.query),
    snippet: truncateForStorage(item.snippet || "", STORAGE_LIMITS.snippet),
    passages,
  };
  if (item.source) compact.source = truncateForStorage(item.source, 80);
  if (Number.isFinite(Number(item.score))) compact.score = Number(item.score);
  return compact;
}

function compactTraceExtra(extra) {
  if (typeof extra === "string") return truncateForStorage(extra, STORAGE_LIMITS.extra);
  if (!extra || typeof extra !== "object") return extra;
  return compactEvidenceForStorage(extra);
}

function compactTraceForStorage(trace = []) {
  return (trace || []).slice(-60).map((item) => ({
    ...item,
    title: truncateForStorage(item.title || "", STORAGE_LIMITS.title),
    detail: truncateForStorage(item.detail || "", STORAGE_LIMITS.detail),
    extras: Array.isArray(item.extras) ? item.extras.slice(0, 16).map(compactTraceExtra) : [],
    sources: Array.isArray(item.sources) ? item.sources.slice(0, 18).map(compactEvidenceForStorage) : [],
    readItems: Array.isArray(item.readItems)
      ? item.readItems.slice(0, 40).map((page) => ({
          key: truncateForStorage(page.key || page.url || page.title || "", STORAGE_LIMITS.url),
          title: truncateForStorage(page.title || page.url || "", STORAGE_LIMITS.title),
          url: truncateForStorage(page.url || "", STORAGE_LIMITS.url),
          ok: Boolean(page.ok),
          error: truncateForStorage(page.error || "", 260),
          timedOut: Boolean(page.timedOut),
        }))
      : undefined,
  }));
}

function compactAttachmentsForStorage(attachments = []) {
  return (attachments || []).map((file) => ({
    name: file.name,
    type: file.type,
    size: file.size,
    text: STORAGE_LIMITS.attachmentText ? truncateForStorage(file.text || "", STORAGE_LIMITS.attachmentText) : "",
  }));
}

function compactResearchContextForStorage(context) {
  if (!context) return null;
  return {
    ...context,
    evidence: Array.isArray(context.evidence) ? context.evidence.slice(0, 18).map(compactEvidenceForStorage) : [],
    trace: Array.isArray(context.trace) ? compactTraceForStorage(context.trace) : [],
  };
}

function compactSessionsForStorage() {
  return state.sessions.map((session) => ({
    ...session,
    messages: (session.messages || []).map((message) => ({
      ...message,
      attachments: compactAttachmentsForStorage(message.attachments || []),
      trace: compactTraceForStorage(message.trace || []),
      researchContext: compactResearchContextForStorage(message.researchContext),
    })),
  }));
}

function saveSessions() {
  try {
    localStorage.setItem(storage.sessions, JSON.stringify(compactSessionsForStorage()));
  } catch (error) {
    console.warn("Unable to persist sessions; keeping in-memory state.", error);
  }
  try {
    localStorage.setItem(storage.active, state.activeId || "");
  } catch (error) {
    console.warn("Unable to persist active session id.", error);
  }
}

function normalizeCustomPresets(presets = []) {
  return presets
    .filter((preset) => preset && (preset.label || preset.baseUrl || preset.model))
    .map((preset, index) => ({
      id: preset.id || `custom-${index + 1}-${uid()}`,
      label: String(preset.label || `Custom ${index + 1}`).trim(),
      baseUrl: String(preset.baseUrl || "").trim(),
      model: String(preset.model || "").trim(),
      apiKey: String(preset.apiKey || "").trim(),
      kind: "custom",
    }));
}

function allModelPresets() {
  return [
    ...state.defaultModelPresets,
    ...state.customModelPresets,
    { id: "__custom__", label: "Custom (unsaved)", baseUrl: "", model: "", kind: "placeholder" },
  ];
}

function modelPresetApiKey(preset) {
  if (!preset) return "";
  if (preset.kind === "custom") return preset.apiKey || "";
  return state.modelPresetApiKeys[preset.id] || "";
}

function rememberPresetApiKey(id, apiKey) {
  if (!id || id === "__custom__") return;
  const preset = allModelPresets().find((item) => item.id === id);
  if (!preset || preset.kind === "placeholder") return;
  if (preset.kind === "custom") {
    preset.apiKey = apiKey;
    return;
  }
  state.modelPresetApiKeys[id] = apiKey;
}

function rememberActivePresetApiKey() {
  const keyField = $("#llmApiKey");
  const apiKey = keyField ? keyField.value.trim() : state.config.llmApiKey || "";
  rememberPresetApiKey(state.activeModelPresetId, apiKey);
  state.config.modelPresetApiKeys = state.modelPresetApiKeys;
  state.config.customModelPresets = state.customModelPresets;
}

function exportSessions() {
  const payload = {
    format: "local-research-agent.sessions.v1",
    exportedAt: now(),
    sessions: state.sessions,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  link.href = url;
  link.download = `local-research-agent-sessions-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  const value = String(text || "");
  if (!value) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function sessionSlug(session) {
  const base = String(session?.title || "session")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "session";
}

function renderUserContentForHtml(text) {
  return `<p>${escapeHtml(String(text || "")).replace(/\n/g, "<br>")}</p>`;
}

function sessionToMarkdown(session) {
  const parts = [`# ${session.title || "Session"}`, ""];
  for (const message of session.messages || []) {
    if (message.role === "user") {
      parts.push("## User");
      parts.push(message.content || "");
    } else {
      parts.push("## Assistant");
      parts.push(message.content || "");
    }
    if (message.attachments?.length) {
      parts.push("");
      parts.push(`Attachments: ${message.attachments.map((file) => file.name).join(", ")}`);
    }
    parts.push("");
  }
  return parts.join("\n");
}

function sessionToHtmlDocument(session) {
  const body = (session.messages || [])
    .map((message) => {
      const heading = message.role === "user" ? "User" : "Assistant";
      const content = message.role === "assistant"
        ? renderMarkdown(message.content || "")
        : renderUserContentForHtml(message.content || "");
      const attachments = message.attachments?.length
        ? `<p><strong>Attachments:</strong> ${message.attachments.map((file) => escapeHtml(file.name)).join(", ")}</p>`
        : "";
      return `<section class="export-message"><h2>${heading}</h2>${content}${attachments}</section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(session.title || "Session")}</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; margin: 32px; color: #1c2430; line-height: 1.65; }
      h1 { font-size: 28px; margin: 0 0 24px; }
      h2 { font-size: 18px; margin: 0 0 10px; }
      section { margin: 0 0 24px; padding: 0 0 18px; border-bottom: 1px solid #d9e0e8; }
      pre { padding: 12px; background: #f8fafc; border: 1px solid #d9e0e8; border-radius: 8px; overflow: auto; }
      code { font-family: Consolas, monospace; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #d9e0e8; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: #f5f8fb; }
      a { color: #1967d2; text-decoration: none; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(session.title || "Session")}</h1>
    ${body}
  </body>
</html>`;
}

function exportActiveSessionMarkdown() {
  const session = activeSession();
  downloadTextFile(`${sessionSlug(session)}.md`, sessionToMarkdown(session), "text/markdown;charset=utf-8");
}

function exportActiveSessionHtml() {
  const session = activeSession();
  downloadTextFile(`${sessionSlug(session)}.html`, sessionToHtmlDocument(session), "text/html;charset=utf-8");
}

async function exportActiveSessionPdf() {
  const session = activeSession();
  const exportButton = document.getElementById("exportActivePdfButton");
  const originalText = exportButton?.textContent;

  if (exportButton) {
    exportButton.disabled = true;
    exportButton.textContent = "生成中...";
  }

  let container = null;
  try {
    const html2canvasLib = window.html2canvas;
    const jsPDFCtor = window.jspdf?.jsPDF;
    if (!html2canvasLib) throw new Error("html2canvas 未加载。");
    if (!jsPDFCtor) throw new Error("jsPDF 未加载。");

    const parsed = new DOMParser().parseFromString(sessionToHtmlDocument(session), "text/html");
    const exportStyles = `
      .pdf-export-root { font-family: "Segoe UI", Arial, sans-serif; color: #1c2430; line-height: 1.65; background: #fff; }
      .pdf-export-root h1 { font-size: 28px; margin: 0 0 24px; }
      .pdf-export-root h2 { font-size: 18px; margin: 0 0 10px; }
      .pdf-export-root section { margin: 0 0 24px; padding: 0 0 18px; border-bottom: 1px solid #d9e0e8; }
      .pdf-export-root p { margin: 0 0 12px; }
      .pdf-export-root pre { padding: 12px; background: #f8fafc; border: 1px solid #d9e0e8; border-radius: 8px; overflow: hidden; white-space: pre-wrap; }
      .pdf-export-root code { font-family: Consolas, monospace; }
      .pdf-export-root table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      .pdf-export-root th, .pdf-export-root td { border: 1px solid #d9e0e8; padding: 8px 10px; text-align: left; vertical-align: top; }
      .pdf-export-root th { background: #f5f8fb; }
      .pdf-export-root a { color: #1967d2; text-decoration: none; }
      .pdf-export-root .table-wrap { overflow: visible; }
    `;

    container = document.createElement("div");
    container.className = "pdf-export-root";
    container.style.cssText = `
      position: absolute;
      left: -10000px;
      top: 0;
      width: 794px;
      min-height: 1123px;
      padding: 32px;
      background: #ffffff;
      opacity: 1;
      pointer-events: none;
      z-index: 0;
    `;
    const style = document.createElement("style");
    style.textContent = exportStyles;
    container.appendChild(style);
    container.insertAdjacentHTML("beforeend", parsed.body.innerHTML);
    document.body.appendChild(container);

    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvasLib(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: container.scrollWidth,
      height: container.scrollHeight,
      windowWidth: Math.max(1024, container.scrollWidth),
      windowHeight: Math.max(768, container.scrollHeight),
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("PDF 渲染画布为空。");
    }

    const pdf = new jsPDFCtor({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;
    const pageCanvasHeight = Math.floor((contentHeight * canvas.width) / contentWidth);

    for (let sourceY = 0, pageIndex = 0; sourceY < canvas.height; sourceY += pageCanvasHeight, pageIndex += 1) {
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - sourceY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const context = pageCanvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      if (pageIndex > 0) pdf.addPage();
      const imageHeight = (sliceHeight * contentWidth) / canvas.width;
      pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", margin, margin, contentWidth, imageHeight);
    }

    pdf.save(`${sessionSlug(session)}.pdf`);
  } catch (error) {
    console.error("PDF generation error:", error);
    window.alert(`PDF 生成失败：${error.message}`);
  } finally {
    container?.remove();
    if (exportButton) {
      exportButton.disabled = false;
      exportButton.textContent = originalText || "PDF";
    }
  }
}

async function importSessions(file) {
  if (!file) return;
  const raw = await file.text();
  const parsed = JSON.parse(raw);
  const importedSessions = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.sessions)
      ? parsed.sessions
      : [];

  if (!importedSessions.length) {
    throw new Error("No sessions found in the selected file.");
  }

  const existingIds = new Set(state.sessions.map((session) => session.id));
  const normalized = importedSessions.map((session) => {
    if (!session || !Array.isArray(session.messages)) return null;
    const safeSession = {
      id: session.id || uid(),
      title: session.title || "Imported Session",
      createdAt: session.createdAt || now(),
      updatedAt: session.updatedAt || now(),
      messages: session.messages.map((message) => ({
        id: message.id || uid(),
        role: message.role || "assistant",
        content: message.content || "",
        attachments: message.attachments || [],
        trace: message.trace || [],
        researchContext: message.researchContext || null,
        done: message.done,
        createdAt: message.createdAt || now(),
        updatedAt: message.updatedAt,
      })),
    };
    return existingIds.has(safeSession.id) ? cloneSessionWithFreshIds(safeSession) : safeSession;
  }).filter(Boolean);

  state.sessions = [...normalized, ...state.sessions];
  if (!state.activeId && state.sessions.length) {
    state.activeId = state.sessions[0].id;
  }
  saveSessions();
  renderAll();
  return normalized.length;
}

function activeSession() {
  let session = state.sessions.find((item) => item.id === state.activeId);
  if (!session) session = createSession(false);
  return session;
}

function findSession(sessionId) {
  return state.sessions.find((item) => item.id === sessionId) || null;
}

function findAssistantMessage(sessionId, assistantId) {
  return findSession(sessionId)?.messages.find((item) => item.id === assistantId) || null;
}

function activeResearchJob() {
  return [...state.researchJobs.values()].find((job) => job.sessionId === state.activeId) || null;
}

function isSessionRunning(sessionId) {
  return [...state.researchJobs.values()].some((job) => job.sessionId === sessionId);
}

function isMessagePending(message) {
  return Boolean(message?.id && state.researchJobs.has(message.id) && !message.done);
}

function updateRunControls() {
  const job = activeResearchJob();
  const running = Boolean(job);
  state.running = running;
  state.pendingAssistantId = job?.assistantId || null;
  state.abortController = job?.controller || null;
  state.stopRequested = Boolean(job?.stopRequested);
  $("#chatModeButton").disabled = running;
  $("#researchModeButton").disabled = running;
  $("#runButton").disabled = false;
  $("#runButton").classList.toggle("running", running);
  $("#runButton").textContent = running ? "Stop" : state.responseMode === "research" ? "Research" : "Send";
}

function beginResearchJob(sessionId, assistantId, controller, mode = "research") {
  const job = { sessionId, assistantId, controller, mode, stopRequested: false };
  state.researchJobs.set(assistantId, job);
  updateRunControls();
  return job;
}

function completeResearchJob(job) {
  if (!job) return;
  if (state.researchJobs.get(job.assistantId) === job) {
    state.researchJobs.delete(job.assistantId);
  }
  if (state.pendingAssistantId === job.assistantId) state.pendingAssistantId = null;
  if (state.abortController === job.controller) state.abortController = null;
  updateRunControls();
}

function renderAfterSessionUpdate(sessionId) {
  renderSessions();
  if (state.activeId === sessionId) renderMessages();
  updateRunControls();
}

function createSession(render = true) {
  const session = { id: uid(), title: "新会话", createdAt: now(), updatedAt: now(), messages: [] };
  state.sessions.unshift(session);
  state.activeId = session.id;
  saveSessions();
  updateRunControls();
  if (render) renderAll();
  return session;
}

function setActiveSession(id, match = null) {
  state.activeId = id;
  state.sessionSearchTarget = match && state.sessionQuery.trim()
    ? { sessionId: id, messageId: match.messageId, query: state.sessionQuery.trim() }
    : null;
  saveSessions();
  updateRunControls();
  renderAll();
}

function deleteSession(id, options = {}) {
  const index = state.sessions.findIndex((session) => session.id === id);
  if (index < 0) return false;
  const session = state.sessions[index];
  const confirmDelete = options.confirm || window.confirm;
  if (!confirmDelete(`删除会话「${session.title || "未命名会话"}」？`)) return false;

  for (const message of session.messages || []) {
    delete state.traceOpenById[message.id];
  }
  for (const job of [...state.researchJobs.values()].filter((item) => item.sessionId === id)) {
    job.stopRequested = true;
    job.controller?.abort();
    completeResearchJob(job);
  }

  state.sessions.splice(index, 1);
  if (state.activeId === id) {
    state.sessionSearchTarget = null;
    state.activeId = state.sessions[Math.min(index, state.sessions.length - 1)]?.id || null;
    if (!state.activeId) createSession(false);
  }
  saveSessions();
  updateRunControls();
  if (options.render !== false) renderAll();
  return true;
}

function deleteUserTurn(messageId) {
  const session = activeSession();
  const index = session.messages.findIndex((item) => item.id === messageId);
  if (index < 0) return;
  const next = [...session.messages];
  next.splice(index, 1);
  while (index < next.length && next[index]?.role === "assistant") {
    const job = state.researchJobs.get(next[index].id);
    if (job) {
      job.stopRequested = true;
      job.controller?.abort();
      completeResearchJob(job);
    }
    delete state.traceOpenById[next[index].id];
    next.splice(index, 1);
  }
  session.messages = next;
  session.updatedAt = now();
  saveSessions();
  renderAll();
}

function deleteAssistantMessage(messageId) {
  const session = activeSession();
  const job = state.researchJobs.get(messageId);
  if (job) {
    job.stopRequested = true;
    job.controller?.abort();
    completeResearchJob(job);
  }
  session.messages = session.messages.filter((item) => item.id !== messageId);
  delete state.traceOpenById[messageId];
  session.updatedAt = now();
  saveSessions();
  renderAll();
}

function clearAssistantTrace(messageId) {
  const message = activeSession().messages.find((item) => item.id === messageId);
  if (!message) return;
  message.trace = [];
  delete state.traceOpenById[messageId];
  message.updatedAt = now();
  activeSession().updatedAt = now();
  saveSessions();
  renderAll();
}

async function loadDefaults() {
  const response = await fetch("/api/defaults");
  const { defaults } = await response.json();
  state.defaultModelPresets = (defaults.modelPresets || [])
    .filter((preset) => preset?.label !== "Custom")
    .map((preset, index) => ({
      ...preset,
      id: preset.id || `builtin-${index + 1}`,
      kind: "builtin",
    }));
  state.config = { ...defaults, ...state.config };
  state.customModelPresets = normalizeCustomPresets(state.config.customModelPresets || []);
  state.config.customModelPresets = state.customModelPresets;
  state.modelPresetApiKeys = state.config.modelPresetApiKeys && typeof state.config.modelPresetApiKeys === "object"
    ? { ...state.config.modelPresetApiKeys }
    : {};
  state.config.modelPresetApiKeys = state.modelPresetApiKeys;
  state.responseMode = state.config.responseMode || "chat";
  if (["deepseek-chat", "deepseek-reasoner"].includes(state.config.llmModel)) {
    state.config.llmBaseUrl = "https://api.deepseek.com/v1";
    state.config.llmModel = "deepseek-v4-flash";
  }
  populateModelPresets();
  syncConfigFields();
  if (!state.sessions.length) createSession(false);
  if (!state.sessions.some((item) => item.id === state.activeId)) state.activeId = state.sessions[0]?.id;
  saveSessions();
  renderAll();
}

function populateModelPresets() {
  const presets = allModelPresets();
  for (const id of ["composerModel", "modelPreset"]) {
    const select = $("#" + id);
    select.innerHTML = "";
    for (const preset of presets) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      select.appendChild(option);
    }
  }
  selectPresetForCurrentConfig();
}

function selectPresetForCurrentConfig() {
  const match = [...state.customModelPresets, ...state.defaultModelPresets].find(
    (preset) =>
      preset.baseUrl === state.config.llmBaseUrl &&
      preset.model === state.config.llmModel &&
      (preset.kind !== "custom" || preset.apiKey === state.config.llmApiKey)
  );
  const value = match?.id || "__custom__";
  state.activeModelPresetId = value;
  $("#composerModel").value = value;
  $("#modelPreset").value = value;
  $("#customPresetName").value = match?.kind === "custom" ? match.label : "";
}

function applyPreset(id) {
  const preset = allModelPresets().find((item) => item.id === id);
  if (!preset || preset.kind === "placeholder") return;
  rememberActivePresetApiKey();
  state.config.llmBaseUrl = preset.baseUrl;
  state.config.llmModel = preset.model;
  state.config.llmApiKey = modelPresetApiKey(preset);
  state.activeModelPresetId = preset.id;
  syncConfigFields();
  saveConfig();
}

function syncConfigFields() {
  for (const id of fields) {
    const el = $("#" + id);
    if (el) el.value = state.config[id] || "";
  }
  $("#thinkingMode").setAttribute("aria-pressed", String(Boolean(state.config.thinkingMode)));
  setResponseMode(state.responseMode || state.config.responseMode || "chat", false);
  selectPresetForCurrentConfig();
}

function saveConfig() {
  for (const id of fields) state.config[id] = $("#" + id).value.trim();
  rememberPresetApiKey(state.activeModelPresetId, state.config.llmApiKey);
  state.config.thinkingMode = $("#thinkingMode").getAttribute("aria-pressed") === "true";
  state.config.responseMode = state.responseMode;
  state.config.customModelPresets = state.customModelPresets;
  state.config.modelPresetApiKeys = state.modelPresetApiKeys;
  localStorage.setItem(storage.config, JSON.stringify(state.config));
  selectPresetForCurrentConfig();
}

function setResponseMode(mode, persist = true) {
  state.responseMode = mode === "research" ? "research" : "chat";
  $("#chatModeButton").setAttribute("aria-pressed", String(state.responseMode === "chat"));
  $("#researchModeButton").setAttribute("aria-pressed", String(state.responseMode === "research"));
  $("#thinkingMode").disabled = state.responseMode !== "research";
  $("#thinkingMode").title = state.responseMode === "research" ? "Thinking mode" : "Only used in research mode";
  if (!state.running) $("#runButton").textContent = state.responseMode === "research" ? "开始研究" : "发送";
  if (persist) saveConfig();
}

function saveCustomPreset() {
  const name = $("#customPresetName").value.trim();
  const baseUrl = $("#llmBaseUrl").value.trim();
  const model = $("#llmModel").value.trim();
  const apiKey = $("#llmApiKey").value.trim();
  if (!name || !baseUrl || !model) {
    window.alert("请先填写自定义名称、Base URL 和 Model。");
    return;
  }
  const existingId = $("#modelPreset").value;
  const preset = {
    id: state.customModelPresets.some((item) => item.id === existingId) ? existingId : `custom-${uid()}`,
    label: name,
    baseUrl,
    model,
    apiKey,
    kind: "custom",
  };
  const index = state.customModelPresets.findIndex((item) => item.id === preset.id);
  if (index >= 0) state.customModelPresets.splice(index, 1, preset);
  else state.customModelPresets.push(preset);
  state.config.customModelPresets = state.customModelPresets;
  populateModelPresets();
  $("#composerModel").value = preset.id;
  $("#modelPreset").value = preset.id;
  state.activeModelPresetId = preset.id;
  saveConfig();
}

function deleteCustomPreset() {
  const selectedId = $("#modelPreset").value;
  const index = state.customModelPresets.findIndex((item) => item.id === selectedId);
  if (index < 0) {
    window.alert("当前未选中可删除的自定义模型。");
    return;
  }
  state.customModelPresets.splice(index, 1);
  state.config.customModelPresets = state.customModelPresets;
  populateModelPresets();
  selectPresetForCurrentConfig();
  saveConfig();
}

function titleFromQuestion(text) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length > 28 ? compact.slice(0, 28) + "..." : compact || "新会话";
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
  return html;
}

function renderMath(root) {
  if (!root || typeof window.renderMathInElement !== "function") return;
  window.renderMathInElement(root, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
    ],
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    throwOnError: false,
    strict: "ignore",
    trust: true,
  });
}

function findSessionMatches(session, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return [];
  const matches = [];
  for (const message of session.messages || []) {
    const content = String(message.content || "");
    const lower = content.toLowerCase();
    let start = 0;
    while (start < lower.length) {
      const index = lower.indexOf(needle, start);
      if (index < 0) break;
      const previewStart = Math.max(0, index - 16);
      const previewEnd = Math.min(content.length, index + needle.length + 28);
      const preview = content.slice(previewStart, previewEnd).replace(/\s+/g, " ").trim();
      matches.push({
        messageId: message.id,
        role: message.role,
        index,
        preview: previewStart > 0 ? `...${preview}` : preview,
      });
      start = index + needle.length;
      if (matches.length >= 6) return matches;
    }
  }
  return matches;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderMarkdown(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let paragraph = [];
  let listItems = [];
  let codeLines = [];
  let inCodeBlock = false;
  let codeLanguage = "";
  let index = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  const flushCode = () => {
    const languageClass = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : "";
    blocks.push(`<pre><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
    codeLanguage = "";
  };

  while (index < lines.length) {
    const line = lines[index];
    const codeFence = line.match(/^```(.*)$/);
    if (codeFence) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
        codeLanguage = codeFence[1].trim();
      }
      index += 1;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      index += 1;
      continue;
    }

    const nextLine = lines[index + 1] || "";
    if (line.includes("|") && isTableSeparator(nextLine)) {
      flushParagraph();
      flushList();
      const headerCells = splitTableRow(line);
      const bodyRows = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        bodyRows.push(splitTableRow(lines[index]));
        index += 1;
      }
      const headerHtml = headerCells.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("");
      const bodyHtml = bodyRows
        .map((row) => `<tr>${headerCells.map((_, cellIndex) => `<td>${renderInlineMarkdown(row[cellIndex] || "")}</td>`).join("")}</tr>`)
        .join("");
      blocks.push(`<div class="table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2].trim())}</h${level}>`);
      index += 1;
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      listItems.push(bullet[1].trim());
      index += 1;
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      index += 1;
      continue;
    }

    paragraph.push(line.trim());
    index += 1;
  }

  if (inCodeBlock) flushCode();
  flushParagraph();
  flushList();
  return blocks.join("");
}

function renderSessions() {
  const list = $("#sessions");
  list.innerHTML = "";
  const query = state.sessionQuery.trim().toLowerCase();
  const sessions = state.sessions
    .map((session) => {
      const titleMatched = String(session.title || "").toLowerCase().includes(query);
      const matches = query ? findSessionMatches(session, query) : [];
      return { session, titleMatched, matches };
    })
    .filter(({ titleMatched, matches }) => !query || titleMatched || matches.length);

  for (const { session, matches } of sessions) {
    const card = document.createElement("div");
    card.className = `session-item${session.id === state.activeId ? " active" : ""}`;
    const activateSession = () => setActiveSession(session.id, matches[0] || null);
    card.addEventListener("click", activateSession);
    const button = document.createElement("button");
    button.className = "session-main";
    button.type = "button";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      activateSession();
    });
    const title = document.createElement("strong");
    title.textContent = session.title;
    const meta = document.createElement("span");
    meta.textContent = query && matches.length
      ? `${matches.length} 处命中 · ${session.messages.length} 条消息`
      : `${session.messages.length} 条消息`;
    button.append(title, meta);
    card.appendChild(button);
    const deleteButton = document.createElement("button");
    deleteButton.className = "session-delete";
    deleteButton.type = "button";
    deleteButton.title = "删除会话";
    deleteButton.setAttribute("aria-label", `删除会话 ${session.title || ""}`.trim());
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteSession(session.id);
    });
    card.appendChild(deleteButton);

    if (query && matches.length) {
      const hitList = document.createElement("div");
      hitList.className = "session-hit-list";
      for (const match of matches.slice(0, 3)) {
        const hit = document.createElement("button");
        hit.type = "button";
        hit.className = "session-hit";
        hit.textContent = `${match.role === "user" ? "问题" : "回答"} · ${match.preview}`;
        hit.addEventListener("click", (event) => {
          event.stopPropagation();
          setActiveSession(session.id, match);
        });
        hitList.appendChild(hit);
      }
      card.appendChild(hitList);
    }
    list.appendChild(card);
  }
}

function highlightQueryInElement(element, query) {
  const needle = String(query || "").trim();
  if (!needle) return;
  const pattern = new RegExp(escapeRegExp(needle), "gi");
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      const parentTag = node.parentElement?.tagName;
      if (parentTag === "CODE" || parentTag === "PRE" || parentTag === "MARK") return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest(".katex")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    const text = node.nodeValue;
    let lastIndex = 0;
    let changed = false;
    const fragment = document.createDocumentFragment();
    for (const match of text.matchAll(pattern)) {
      changed = true;
      const index = match.index || 0;
      if (index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
      const mark = document.createElement("mark");
      mark.textContent = text.slice(index, index + match[0].length);
      fragment.appendChild(mark);
      lastIndex = index + match[0].length;
    }
    if (!changed) continue;
    if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.parentNode.replaceChild(fragment, node);
  }
}

function locateSessionSearchTarget() {
  const target = state.sessionSearchTarget;
  if (!target || target.sessionId !== state.activeId) return;
  const box = $("#messages");
  const article = box.querySelector(`[data-id="${CSS.escape(target.messageId)}"]`);
  if (!article) return;
  box.scrollTo({ top: Math.max(0, article.offsetTop - 16), behavior: "smooth" });
  state.sessionSearchTarget = null;
}

function renderMessages() {
  const session = activeSession();
  const box = $("#messages");
  const previousTop = box.scrollTop;
  const previousHeight = box.scrollHeight;
  const stickToBottom = previousHeight - previousTop - box.clientHeight < 120;
  box.innerHTML = "";
  if (!session.messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "输入问题后，每一轮研究都会保存在这个会话里。检索过程会折叠在对应回答下面。";
    box.appendChild(empty);
    renderQuestionNav();
    return;
  }
  for (const message of session.messages) box.appendChild(renderMessage(message));
  renderQuestionNav();
  if (state.sessionSearchTarget?.sessionId === session.id) locateSessionSearchTarget();
  else if (stickToBottom) box.scrollTop = box.scrollHeight;
  else box.scrollTop = Math.max(0, previousTop + (box.scrollHeight - previousHeight));
  updateActiveQuestionMarker();
}

function renderMessage(message) {
  const article = document.createElement("article");
  article.className = `message ${message.role}`;
  article.dataset.id = message.id;
  if (message.role === "user") article.dataset.questionId = message.id;

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = message.role === "user" ? "你" : "研究结果";

  const content = document.createElement("div");
  content.className = "message-content";
  if (message.role === "assistant") {
    content.innerHTML = renderMarkdown(message.content || "");
  } else {
    content.textContent = message.content || "";
  }
  renderMath(content);
  if (state.sessionSearchTarget?.sessionId === state.activeId && state.sessionSearchTarget.messageId === message.id) {
    article.classList.add("search-target");
    highlightQueryInElement(content, state.sessionSearchTarget.query);
  }

  if (message.role === "assistant" && isMessagePending(message)) {
    const spinner = document.createElement("span");
    spinner.className = "message-spinner";
    spinner.setAttribute("aria-hidden", "true");
    label.prepend(spinner);
  }

  article.append(label, content);
  article.appendChild(renderMessageActions(message));

  if (message.attachments?.length) {
    const attachments = document.createElement("div");
    attachments.className = "message-attachments";
    for (const file of message.attachments) {
      const chip = document.createElement("span");
      chip.textContent = file.name;
      attachments.appendChild(chip);
    }
    article.appendChild(attachments);
  }

  if (message.role === "assistant" && message.trace?.length) {
    article.appendChild(renderTraceDetails(message));
  }

  return article;
}

function renderMessageActions(message) {
  const row = document.createElement("div");
  row.className = "message-actions";
  if (message.role === "assistant") {
    row.append(
      createMessageAction("⧉", "复制回答", async () => {
        await copyText(message.content || "");
      }),
      createMessageAction("↓", "导出为 Markdown", () => exportAnswerMarkdown(message)),
      createMessageAction("⌫", "删除检索过程", () => clearAssistantTrace(message.id), !message.trace?.length),
      createMessageAction("×", "删除回答", () => deleteAssistantMessage(message.id))
    );
  } else {
    row.append(
      createMessageAction("⧉", "复制问题", async () => {
        await copyText(message.content || "");
      }),
      createMessageAction("✎", "修改并回填", () => editQuestion(message)),
      createMessageAction("×", "删除问题与对应回答", () => deleteUserTurn(message.id))
    );
  }
  if (message.role !== "assistant") {
    row.appendChild(createMessageAction("↻", "重新发送", () => resendQuestion(message), isSessionRunning(state.activeId)));
  }
  return row;
}

function createMessageAction(icon, label, onClick, disabled = false) {
  const button = document.createElement("button");
  button.className = "message-action-button";
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.textContent = icon;
  button.disabled = Boolean(disabled);
  button.addEventListener("click", async () => {
    try {
      await onClick();
    } catch (error) {
      window.alert(error.message || "鎿嶄綔澶辫触");
    }
  });
  return button;
}

function editQuestion(message) {
  const question = $("#question");
  question.value = message.content || "";
  question.focus();
  question.setSelectionRange(question.value.length, question.value.length);
  document.querySelector(".composer")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function resendQuestion(message) {
  if (isSessionRunning(state.activeId)) return;
  const question = $("#question");
  question.value = String(message.content || "").trim();
  state.attachments = Array.isArray(message.attachments) ? [...message.attachments] : [];
  renderAttachmentList();
  $("#taskForm").requestSubmit();
}

function exportAnswerMarkdown(message) {
  const session = activeSession();
  const index = Math.max(1, session.messages.filter((item) => item.role === "assistant").indexOf(message) + 1);
  const title = session.title || "session";
  const content = `# ${title}\n\n## 鍥炵瓟 ${index}\n\n${message.content || ""}\n`;
  downloadTextFile(`${sessionSlug(session)}-answer-${index}.md`, content, "text/markdown;charset=utf-8");
}

function renderTraceProgress(item) {
  const progress = item.progress || {};
  const total = Number(progress.total || 0);
  const completed = Number(progress.completed || 0);
  const percent = Math.max(0, Math.min(100, Number(progress.percent || 0)));
  const wrap = document.createElement("div");
  wrap.className = "trace-progress";

  const bar = document.createElement("div");
  bar.className = "trace-progress-bar";
  const fill = document.createElement("span");
  fill.style.width = `${percent}%`;
  bar.appendChild(fill);

  const meta = document.createElement("div");
  meta.className = "trace-progress-meta";
  meta.textContent = total ? `${completed}/${total} · ${percent}%` : `${percent}%`;
  wrap.append(bar, meta);

  if (item.readItems?.length) {
    const details = document.createElement("details");
    details.className = "trace-read-details";
    const summary = document.createElement("summary");
    summary.textContent = "查看具体页面";
    details.appendChild(summary);

    const list = document.createElement("div");
    list.className = "trace-read-list";
    for (const page of item.readItems) {
      const row = document.createElement("div");
      row.className = `trace-read-item ${page.ok ? "ok" : "failed"}`;
      const title = page.url ? document.createElement("a") : document.createElement("span");
      title.textContent = page.title || page.url || "候选页面";
      if (page.url) {
        title.href = page.url;
        title.target = "_blank";
        title.rel = "noreferrer";
      }
      const status = document.createElement("small");
      status.textContent = page.ok ? "完成" : `跳过${page.error ? `：${page.error}` : ""}`;
      row.append(title, status);
      list.appendChild(row);
    }
    details.appendChild(list);
    wrap.appendChild(details);
  }
  return wrap;
}

function renderTraceDetails(message) {
  const trace = message.trace || [];
  const details = document.createElement("details");
  details.className = "trace-details";
  details.open = state.traceOpenById[message.id] ?? isMessagePending(message);
  details.addEventListener("toggle", () => {
    state.traceOpenById[message.id] = details.open;
  });
  const summary = document.createElement("summary");
  summary.textContent = `检索与思考过程（${trace.length} 条）`;
  details.appendChild(summary);

  const list = document.createElement("div");
  list.className = "trace-list";
  for (const item of trace) {
    const row = document.createElement("div");
    row.className = `trace-item ${item.kind || ""}`;
    const title = document.createElement("strong");
    title.textContent = item.title;
    const detail = document.createElement("p");
    detail.textContent = item.detail || "";
    row.append(title, detail);
    if (item.progress) row.appendChild(renderTraceProgress(item));
    if (item.extras?.length) {
      const chips = document.createElement("div");
      chips.className = "chips";
      for (const extra of item.extras.slice(0, 16)) {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = typeof extra === "string" ? extra : extra.title || extra.url || JSON.stringify(extra);
        chips.appendChild(chip);
      }
      row.appendChild(chips);
    }
    if (item.sources?.length) row.appendChild(renderSources(item.sources));
    list.appendChild(row);
  }
  details.appendChild(list);
  return details;
}

function renderSources(sources) {
  const wrap = document.createElement("div");
  wrap.className = "source-list";
  for (const item of sources.slice(0, 8)) {
    const a = document.createElement("a");
    a.href = item.url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = item.title || item.url;
    wrap.appendChild(a);
  }
  return wrap;
}

function renderAll() {
  renderSessions();
  renderMessages();
  renderAttachmentList();
}

function userQuestions() {
  return activeSession().messages.filter((message) => message.role === "user");
}

function renderQuestionNav() {
  const nav = $("#questionNav");
  if (!nav) return;
  nav.innerHTML = "";
  const questions = userQuestions();
  for (let index = 0; index < questions.length; index++) {
    const message = questions[index];
    const button = document.createElement("button");
    button.className = "question-line";
    button.type = "button";
    button.dataset.questionId = message.id;
    button.title = `闂 ${index + 1}: ${message.content.slice(0, 80)}`;
    button.addEventListener("click", () => scrollToQuestion(message.id));
    nav.appendChild(button);
  }
}

function scrollToQuestion(id) {
  const box = $("#messages");
  const target = box.querySelector(`[data-question-id="${CSS.escape(id)}"]`);
  if (!target) return;
  box.scrollTo({ top: target.offsetTop - 12, behavior: "smooth" });
  setActiveQuestion(id);
}

function setActiveQuestion(id) {
  for (const line of document.querySelectorAll(".question-line")) {
    line.classList.toggle("active", line.dataset.questionId === id);
  }
}

function updateActiveQuestionMarker() {
  const box = $("#messages");
  const questions = [...box.querySelectorAll("[data-question-id]")];
  if (!questions.length) return;
  const anchor = box.scrollTop + 72;
  let active = questions[0];
  for (const question of questions) {
    if (question.offsetTop <= anchor) active = question;
  }
  setActiveQuestion(active.dataset.questionId);
}

function pendingAssistant(job = activeResearchJob()) {
  if (!job) return null;
  return findAssistantMessage(job.sessionId, job.assistantId);
}

function updateAssistantMessage(job, text) {
  if (typeof job === "string") {
    text = job;
    job = activeResearchJob();
  }
  const message = pendingAssistant(job);
  if (!message) return;
  message.content = text;
  message.updatedAt = now();
  const session = findSession(job.sessionId);
  if (session) session.updatedAt = now();
  saveSessions();
  renderAfterSessionUpdate(job.sessionId);
}

function finishAssistantMessage(job, text) {
  if (typeof job === "string") {
    text = job;
    job = activeResearchJob();
  }
  const message = pendingAssistant(job);
  if (!message) {
    completeResearchJob(job);
    return;
  }
  message.content = text;
  message.done = true;
  message.updatedAt = now();
  const session = findSession(job.sessionId);
  if (session) session.updatedAt = now();
  completeResearchJob(job);
  saveSessions();
  renderAfterSessionUpdate(job.sessionId);
}

function addTrace(job, kind, title, detail, extras = [], sources = []) {
  if (typeof job === "string") {
    sources = extras;
    extras = detail;
    detail = title;
    title = kind;
    kind = job;
    job = activeResearchJob();
  }
  const message = pendingAssistant(job);
  if (!message) return;
  message.trace ||= [];
  message.trace.push({
    kind,
    title: truncateForStorage(title, STORAGE_LIMITS.title),
    detail: truncateForStorage(detail, STORAGE_LIMITS.detail),
    extras: Array.isArray(extras) ? extras.slice(0, 16).map(compactTraceExtra) : [],
    sources: Array.isArray(sources) ? sources.slice(0, 18).map(compactEvidenceForStorage) : [],
    at: now(),
  });
  saveSessions();
  renderAfterSessionUpdate(job.sessionId);
}

function updateReadProgressTrace(job, data) {
  if (!data) {
    data = job;
    job = activeResearchJob();
  }
  const message = pendingAssistant(job);
  if (!message) return;
  message.trace ||= [];
  let item = message.trace.find((entry) => entry.kind === "read-progress" && entry.round === data.round);
  if (!item) {
    item = {
      kind: "read-progress",
      round: data.round,
      title: `第 ${data.round} 轮网页阅读`,
      detail: "",
      readItems: [],
      progress: { completed: 0, total: Number(data.total || 0), percent: 0 },
      at: now(),
    };
    message.trace.push(item);
  }

  item.readItems ||= [];
  if (data.title || data.url || data.error) {
    const key = data.url || data.title || `read-${item.readItems.length}`;
    let page = item.readItems.find((entry) => entry.key === key);
    if (!page) {
      page = { key };
      item.readItems.push(page);
    }
    Object.assign(page, {
      title: data.title || data.url || "候选页面",
      url: data.url || "",
      ok: Boolean(data.ok),
      error: data.error || "",
      timedOut: Boolean(data.timedOut),
    });
  }

  const total = Number(data.total || item.progress?.total || 0);
  const completed = data.timedOut ? total : Math.min(Number(data.completed || item.progress?.completed || 0), total || Number(data.completed || 0));
  const okCount = item.readItems.filter((entry) => entry.ok).length;
  const failedCount = item.readItems.filter((entry) => !entry.ok).length;
  item.progress = {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
    timedOut: Boolean(data.timedOut),
  };
  item.detail = data.timedOut
    ? `本轮阅读达到安全时间，已处理 ${completed}/${total} 个页面，成功 ${okCount} 个，跳过 ${failedCount} 个。`
    : `已处理 ${completed}/${total} 个页面，成功 ${okCount} 个，跳过 ${failedCount} 个。`;
  item.updatedAt = now();
  saveSessions();
  renderAfterSessionUpdate(job.sessionId);
}

async function readAttachments(files) {
  const next = [];
  for (const file of files) {
    const isText = file.type.startsWith("text/") || /\.(txt|md|csv|json|xml|html|js|ts|py|java|c|cpp|h|css)$/i.test(file.name);
    let text = "";
    if (isText) text = await file.text();
    next.push({ name: file.name, type: file.type || "unknown", size: file.size, text: text.slice(0, 12000) });
  }
  state.attachments = next;
  renderAttachmentList();
}

function renderAttachmentList() {
  const list = $("#attachmentList");
  list.innerHTML = "";
  for (const file of state.attachments) {
    const chip = document.createElement("span");
    chip.textContent = file.name;
    list.appendChild(chip);
  }
}

function setRunning(value) {
  state.running = Boolean(value);
  updateRunControls();
}

function stopCurrentResearch() {
  const job = activeResearchJob();
  if (!job) return;
  job.stopRequested = true;
  job.controller?.abort();
  const message = pendingAssistant(job);
  if (message && !message.done) {
    message.content = "已手动停止当前研究。可以切换模型后重新发送。";
    message.done = true;
    message.updatedAt = now();
    const session = findSession(job.sessionId);
    if (session) session.updatedAt = now();
    saveSessions();
    renderAfterSessionUpdate(job.sessionId);
  }
  completeResearchJob(job);
}

function processSseChunk(chunk, job) {
  const event = chunk.match(/^event:\s*(.+)$/m)?.[1];
  const raw = [...chunk.matchAll(/^data:\s?(.*)$/gm)].map((match) => match[1]).join("\n");
  if (!event || !raw) return;
  handleResearchEvent(job, event, JSON.parse(raw));
}

async function parseSse(response, job = activeResearchJob()) {
  if (!response.ok) {
    const detail = response.text ? await response.text().catch(() => "") : "";
    throw new Error(detail || `Request failed with HTTP ${response.status || "error"}`);
  }
  if (!response.body?.getReader) throw new Error("Research response did not include a readable stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      processSseChunk(chunk, job);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) processSseChunk(buffer, job);
}

function handleResearchEvent(job, event, data) {
  if (typeof job === "string") {
    data = event;
    event = job;
    job = activeResearchJob();
  }
  if (event === "phase") {
    addTrace(job, "phase", data.label, data.detail);
    updateAssistantMessage(job, `${data.label}\n\n${data.detail || ""}`.trim());
    return;
  }
  if (event === "plan") {
    const normal = (data.queries || []).map((query) => `常规：${query}`);
    const adversarial = (data.adversarialQueries || []).map((query) => `对抗：${query}`);
    addTrace(job, "plan", `第 ${data.round} 轮查询计划`, data.intent || data.queryCountReason || "", [...normal, ...adversarial]);
    if (data.reasoningSummary || data.mustVerify?.length) {
      addTrace(
        job,
        "thinking",
        `第 ${data.round} 轮检索思路`,
        data.reasoningSummary || "",
        (data.mustVerify || []).map((item) => `核验：${item}`)
      );
    }
    updateAssistantMessage(
      job,
      [
        `第 ${data.round} 轮研究中`,
        "",
        data.reasoningSummary ? `当前思路：${data.reasoningSummary}` : "",
        data.intent ? `本轮目标：${data.intent}` : "",
        data.mustVerify?.length ? `重点核验：${data.mustVerify.slice(0, 3).join("；")}` : "",
      ].filter(Boolean).join("\n")
    );
    return;
  }
  if (event === "search") {
    addTrace(job, "search", `第 ${data.round} 轮搜索结果`, `找到 ${data.count} 条候选结果。`, (data.results || []).map((r) => r.title || r.url));
    return;
  }
  if (event === "read-progress") {
    updateReadProgressTrace(job, data);
    const completed = data.timedOut ? data.total : data.completed;
    const status = data.timedOut
      ? `本轮阅读达到安全时间，已处理 ${completed}/${data.total} 个候选页面。`
      : `阅读进度：${completed}/${data.total} 个候选页面。`;
    updateAssistantMessage(job, [`第 ${data.round} 轮阅读`, "", status].filter(Boolean).join("\n"));
    return;
  }
  if (event === "evidence") {
    const stats = data.pageStats
      ? `本轮尝试 ${data.pageStats.attempted} 页，成功 ${data.pageStats.succeeded} 页，失败 ${data.pageStats.failed} 页。`
      : "";
    addTrace(job, "evidence", `第 ${data.round} 轮证据更新`, `累计保留 ${data.evidence?.length || 0} 条高相关证据。${stats}`, [], data.evidence || []);
    return;
  }
  if (event === "gaps") {
    const label = data.enough ? "证据充分" : "继续补洞";
    const detail = data.enough ? `进入综合阶段。${data.reason || ""}` : `还需要补充：${data.reason || ""}`;
    addTrace(job, "gaps", label, detail, data.gaps || []);
    if (data.reasoningSummary) {
      addTrace(job, "thinking", `第 ${data.round} 轮判断依据`, data.reasoningSummary, data.gaps || []);
    }
    updateAssistantMessage(
      job,
      [
        `第 ${data.round} 轮研究小结`,
        "",
        data.workingConclusion ? `阶段结论：${data.workingConclusion}` : "",
        data.reasoningSummary ? `为什么这样判断：${data.reasoningSummary}` : "",
        data.nextFocus?.length ? `下一轮准备：${data.nextFocus.slice(0, 3).join("；")}` : "",
        data.enough ? "下一步：开始综合整理最终答案。" : "",
      ].filter(Boolean).join("\n")
    );
    return;
  }
  if (event === "final") {
    const message = pendingAssistant(job);
    if (message) {
      message.researchContext = {
        mode: data.directAnswerOnly ? "direct-answer" : "research",
        savedAt: now(),
        evidence: Array.isArray(data.evidence) ? data.evidence.slice(0, 18).map(compactEvidenceForStorage) : [],
        trace: Array.isArray(data.trace) ? compactTraceForStorage(data.trace) : [],
      };
    }
    finishAssistantMessage(job, data.answer);
    return;
  }
  if (event === "error") {
    finishAssistantMessage(job, `出错：${data.message}`);
  }
}

function handleEvent(event, data) {
  if (event === "phase") addTrace("phase", data.label, data.detail);
  if (event === "plan") {
    const normal = (data.queries || []).map((query) => `常规：${query}`);
    const adversarial = (data.adversarialQueries || []).map((query) => `对抗：${query}`);
    addTrace("plan", `第 ${data.round} 轮查询计划`, data.intent || data.queryCountReason || "", [...normal, ...adversarial]);
    updateAssistantMessage(`正在检索：第 ${data.round} 轮\n\n${[...normal, ...adversarial].join("\n")}`);
  }
  if (event === "search") {
    addTrace("search", `第 ${data.round} 轮搜索结果`, `找到 ${data.count} 条候选结果。`, (data.results || []).map((r) => r.title || r.url));
  }
  if (event === "evidence") {
    addTrace("evidence", `第 ${data.round} 轮证据更新`, `累计保留 ${data.evidence?.length || 0} 条高相关证据。`, [], data.evidence || []);
  }
  if (event === "gaps") {
    const label = data.enough ? "证据足够" : "继续补洞";
    const detail = data.enough ? `进入综合阶段。${data.reason || ""}` : `还需要补充：${data.reason || ""}`;
    addTrace("gaps", label, detail, data.gaps || []);
  }
  if (event === "final") {
    finishAssistantMessage(data.answer);
  }
  if (event === "error") {
    finishAssistantMessage(`出错：${data.message}`);
  }
}

async function testApi() {
  saveConfig();
  const status = $("#apiTestStatus");
  status.textContent = "娴嬭瘯涓?..";
  status.dataset.state = "pending";
  try {
    const response = await fetch("/api/test-llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config: state.config }),
    });
    const data = await response.json();
    status.textContent = data.ok ? "杩炴帴鎴愬姛" : data.message || "杩炴帴澶辫触";
    status.dataset.state = data.ok ? "ok" : "bad";
  } catch (error) {
    status.textContent = error.message;
    status.dataset.state = "bad";
  }
}

$("#settingsButton").addEventListener("click", () => $("#settingsDialog").showModal());
$("#saveSettings").addEventListener("click", saveConfig);
$("#testApiButton").addEventListener("click", testApi);
$("#saveCustomPresetButton").addEventListener("click", saveCustomPreset);
$("#deleteCustomPresetButton").addEventListener("click", deleteCustomPreset);
$("#newSessionButton").addEventListener("click", () => createSession(true));
$("#composerModel").addEventListener("change", (event) => applyPreset(event.target.value));
$("#modelPreset").addEventListener("change", (event) => applyPreset(event.target.value));
$("#chatModeButton").addEventListener("click", () => setResponseMode("chat"));
$("#researchModeButton").addEventListener("click", () => setResponseMode("research"));
$("#thinkingMode").addEventListener("click", () => {
  const next = $("#thinkingMode").getAttribute("aria-pressed") !== "true";
  $("#thinkingMode").setAttribute("aria-pressed", String(next));
  saveConfig();
});
$("#attachFile").addEventListener("change", (event) => readAttachments(event.target.files));
$("#sessionSearch").addEventListener("input", (event) => {
  state.sessionQuery = event.target.value;
  if (!state.sessionQuery.trim()) state.sessionSearchTarget = null;
  renderSessions();
});
$("#question").addEventListener("keydown", (event) => {
  if (event.isComposing) return;
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  if (isSessionRunning(state.activeId)) return;
  $("#taskForm").requestSubmit();
});
$("#runButton").addEventListener("click", (event) => {
  if (!activeResearchJob()) return;
  event.preventDefault();
  stopCurrentResearch();
});
$("#exportSessionsButton").addEventListener("click", exportSessions);
$("#exportActiveMarkdownButton").addEventListener("click", exportActiveSessionMarkdown);
$("#exportActiveHtmlButton").addEventListener("click", exportActiveSessionHtml);
$("#exportActivePdfButton").addEventListener("click", exportActiveSessionPdf);
$("#importSessionsFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  try {
    const count = await importSessions(file);
    if (count) window.alert(`Imported ${count} session(s).`);
  } catch (error) {
    window.alert(error.message || "Import failed.");
  } finally {
    event.target.value = "";
  }
});
$("#messages").addEventListener("scroll", updateActiveQuestionMarker);

$("#taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSessionRunning(state.activeId)) return;
  saveConfig();
  const question = $("#question").value.trim();
  if (!question) return;
  const submitMode = state.responseMode || "chat";

  const session = activeSession();
  if (session.title === "新会话") session.title = titleFromQuestion(question);
  const attachments = state.attachments;
  session.messages.push({ id: uid(), role: "user", content: question, attachments, createdAt: now() });
  const assistantId = uid();
  session.messages.push({
    id: assistantId,
    role: "assistant",
    content: submitMode === "research" ? "Starting research..." : "Answering from conversation context...",
    trace: [],
    createdAt: now(),
  });
  session.updatedAt = now();
  const controller = new AbortController();
  const job = beginResearchJob(session.id, assistantId, controller, submitMode);
  state.attachments = [];
  $("#attachFile").value = "";
  saveSessions();
  renderAll();
  $("#question").value = "";

  const payload = {
    mode: submitMode,
    question,
    attachments,
    messages: session.messages.filter((item) => item.id !== assistantId).map((item) => ({ role: item.role, content: item.content })),
    config: {
      ...state.config,
      autoResearch: submitMode === "research",
      maxRounds: state.config.thinkingMode ? 8 : 6,
      minRounds: state.config.thinkingMode ? 3 : 2,
      queriesPerRound: state.config.thinkingMode ? 6 : 5,
      resultsPerQuery: 6,
      pagesPerRound: state.config.thinkingMode ? 10 : 8,
      maxTokens: state.config.maxTokens || (state.config.thinkingMode ? 8192 : 6144),
    },
  };

  try {
    const response = await fetch("/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    await parseSse(response, job);
  } catch (error) {
    if (error.name === "AbortError" || job.stopRequested) {
      if (state.researchJobs.get(job.assistantId) === job) {
        finishAssistantMessage(job, "已手动停止当前研究。可以切换模型后重新发送。");
      }
    } else {
      handleResearchEvent(job, "error", { message: error.message });
    }
  } finally {
    if (state.researchJobs.get(job.assistantId) === job) {
      const message = pendingAssistant(job);
      if (message && !message.done) {
        finishAssistantMessage(job, "研究连接已结束，但没有收到最终回答。请重试或检查模型/API 配置。");
      } else {
        completeResearchJob(job);
      }
    }
    saveSessions();
    renderAll();
  }
});

loadDefaults();

