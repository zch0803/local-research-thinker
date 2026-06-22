import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

async function readIndexHtml() {
  return readFile(new URL("../public/index.html", import.meta.url), "utf8");
}

function element(value = "") {
  const classes = new Set();
  return {
    value,
    textContent: "",
    innerHTML: "",
    dataset: {},
    disabled: false,
    title: "",
    className: "",
    scrollHeight: 0,
    scrollTop: 0,
    clientHeight: 0,
    offsetTop: 0,
    type: "button",
    children: [],
    attributes: new Map(),
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      },
      contains(name) {
        return classes.has(name);
      },
    },
    append(...items) {
      this.children.push(...items);
    },
    appendChild(item) {
      this.children.push(item);
      return item;
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    scrollTo() {},
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
    getAttribute(name) {
      return this.attributes.get(name);
    },
  };
}

async function loadHarness(config = {}) {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const elements = new Map();
  for (const id of [
    "llmBaseUrl",
    "llmModel",
    "llmApiKey",
    "searchProvider",
    "serperApiKey",
    "tavilyApiKey",
    "thinkingMode",
    "chatModeButton",
    "researchModeButton",
    "runButton",
    "composerModel",
    "modelPreset",
    "customPresetName",
    "sessions",
    "messages",
    "questionNav",
    "attachmentList",
    "attachFile",
    "taskForm",
  ]) {
    elements.set(id, element());
  }
  elements.get("thinkingMode").setAttribute("aria-pressed", "false");

  const localStorageData = new Map([
    ["local-mirothinker-config", JSON.stringify(config)],
    ["local-mirothinker-sessions", "[]"],
  ]);

  const document = {
    querySelector(selector) {
      return elements.get(selector.slice(1)) || element();
    },
    createElement(tagName) {
      return element(tagName);
    },
  };

  const context = vm.createContext({
    Blob,
    Date,
    DOMParser: function DOMParser() {},
    JSON,
    Map,
    Math,
    RegExp,
    Set,
    String,
    URL,
    TextDecoder,
    console,
    document,
    localStorage: {
      getItem(key) {
        return localStorageData.get(key) ?? null;
      },
      setItem(key, value) {
        localStorageData.set(key, String(value));
      },
    },
    navigator: {},
    window: {
      alert(message) {
        throw new Error(`Unexpected alert: ${message}`);
      },
      renderMathInElement: null,
    },
    CSS: {
      escape(value) {
        return String(value);
      },
    },
    NodeFilter: {
      SHOW_TEXT: 4,
      FILTER_REJECT: 2,
      FILTER_ACCEPT: 1,
    },
  });

  const testSource = source.replace(/\nloadDefaults\(\);\s*$/, "");
  vm.runInContext(
    `${testSource}
globalThis.__appTest = {
  state,
  applyPreset,
  beginResearchJob: typeof beginResearchJob === "function" ? beginResearchJob : undefined,
  createSession,
  deleteSession,
  findAssistantMessage: typeof findAssistantMessage === "function" ? findAssistantMessage : undefined,
  handleResearchEvent,
  parseSse,
  saveCustomPreset,
  saveConfig,
  selectPresetForCurrentConfig,
  stopCurrentResearch,
};
`,
    context
  );

  return { app: context.__appTest, elements, localStorageData };
}

test("switching from a custom preset restores the target preset API key", async () => {
  const { app, elements } = await loadHarness({
    llmBaseUrl: "https://api.deepseek.com/v1",
    llmModel: "deepseek-v4-flash",
    llmApiKey: "deepseek-key",
    modelPresetApiKeys: { "builtin-1": "deepseek-key" },
    customModelPresets: [
      {
        id: "custom-relay",
        label: "Relay",
        baseUrl: "https://relay.example/v1",
        model: "relay-model",
        apiKey: "custom-key",
        kind: "custom",
      },
    ],
  });

  app.state.defaultModelPresets = [
    { id: "builtin-1", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash", kind: "builtin" },
  ];
  app.state.customModelPresets = app.state.config.customModelPresets;
  app.state.modelPresetApiKeys = app.state.config.modelPresetApiKeys;
  elements.get("modelPreset").value = "builtin-1";
  elements.get("composerModel").value = "builtin-1";
  elements.get("llmApiKey").value = "deepseek-key";

  app.applyPreset("custom-relay");
  assert.equal(app.state.config.llmApiKey, "custom-key");

  app.applyPreset("builtin-1");
  assert.equal(app.state.config.llmApiKey, "deepseek-key");
});

test("saving a new custom preset does not overwrite the selected builtin API key", async () => {
  const { app, elements } = await loadHarness({
    llmBaseUrl: "https://api.deepseek.com/v1",
    llmModel: "deepseek-v4-flash",
    llmApiKey: "deepseek-key",
    modelPresetApiKeys: { "builtin-1": "deepseek-key" },
    customModelPresets: [],
  });

  app.state.defaultModelPresets = [
    { id: "builtin-1", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash", kind: "builtin" },
  ];
  app.state.customModelPresets = [];
  app.state.modelPresetApiKeys = app.state.config.modelPresetApiKeys;
  app.state.activeModelPresetId = "builtin-1";
  elements.get("modelPreset").value = "builtin-1";
  elements.get("composerModel").value = "builtin-1";
  elements.get("customPresetName").value = "Relay";
  elements.get("llmBaseUrl").value = "https://relay.example/v1";
  elements.get("llmModel").value = "relay-model";
  elements.get("llmApiKey").value = "custom-key";

  app.saveCustomPreset();

  assert.equal(app.state.modelPresetApiKeys["builtin-1"], "deepseek-key");
});

test("settings save button does not submit the dialog form", async () => {
  const html = await readIndexHtml();
  assert.match(html, /<button[^>]+id="saveSettings"[^>]+type="button"/);
});

test("research jobs are tracked independently per session", async () => {
  const { app } = await loadHarness();
  assert.equal(typeof app.beginResearchJob, "function");
  app.state.sessions = [
    {
      id: "one",
      title: "One",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      messages: [{ id: "a-one", role: "assistant", content: "Working", createdAt: "2026-01-01T00:00:00.000Z" }],
    },
    {
      id: "two",
      title: "Two",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      messages: [{ id: "a-two", role: "assistant", content: "Working", createdAt: "2026-01-02T00:00:00.000Z" }],
    },
  ];
  const firstController = { aborted: false, abort() { this.aborted = true; } };
  const secondController = { aborted: false, abort() { this.aborted = true; } };
  app.beginResearchJob("one", "a-one", firstController, "research");
  app.beginResearchJob("two", "a-two", secondController, "research");

  app.state.activeId = "two";
  app.stopCurrentResearch();

  assert.equal(firstController.aborted, false);
  assert.equal(secondController.aborted, true);
  assert.equal(app.state.sessions[0].messages[0].done, undefined);
  assert.equal(app.state.sessions[1].messages[0].done, true);
});

test("research events update their original session even after switching sessions", async () => {
  const { app } = await loadHarness();
  app.state.sessions = [
    {
      id: "one",
      title: "One",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      messages: [{ id: "a-one", role: "assistant", content: "Working", createdAt: "2026-01-01T00:00:00.000Z" }],
    },
    {
      id: "two",
      title: "Two",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      messages: [],
    },
  ];
  const job = app.beginResearchJob("one", "a-one", { abort() {} }, "research");

  app.state.activeId = "two";
  app.handleResearchEvent(job, "final", { answer: "Done", evidence: [], trace: [] });

  assert.equal(app.state.sessions[0].messages[0].content, "Done");
  assert.equal(app.state.sessions[0].messages[0].done, true);
  assert.equal(app.state.sessions[1].messages.length, 0);
});

test("SSE parser flushes a final event without a trailing blank line", async () => {
  const { app } = await loadHarness();
  app.state.sessions = [
    {
      id: "one",
      title: "One",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      messages: [{ id: "a-one", role: "assistant", content: "Working", createdAt: "2026-01-01T00:00:00.000Z" }],
    },
  ];
  const job = app.beginResearchJob("one", "a-one", { abort() {} }, "research");
  const encoded = new TextEncoder().encode('event: final\ndata: {"answer":"Done","evidence":[],"trace":[]}');
  const response = {
    ok: true,
    body: {
      getReader() {
        let sent = false;
        return {
          async read() {
            if (sent) return { done: true };
            sent = true;
            return { done: false, value: encoded };
          },
        };
      },
    },
  };

  await app.parseSse(response, job);

  assert.equal(app.state.sessions[0].messages[0].content, "Done");
  assert.equal(app.state.sessions[0].messages[0].done, true);
});

test("deleting the active session selects a remaining session", async () => {
  const { app } = await loadHarness();
  app.state.sessions = [
    { id: "one", title: "One", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", messages: [] },
    { id: "two", title: "Two", createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", messages: [] },
  ];
  app.state.activeId = "one";

  app.deleteSession("one", { confirm: () => true, render: false });

  assert.deepEqual(app.state.sessions.map((session) => session.id), ["two"]);
  assert.equal(app.state.activeId, "two");
});
