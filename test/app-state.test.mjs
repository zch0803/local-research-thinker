import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

function element(value = "") {
  return {
    value,
    textContent: "",
    innerHTML: "",
    dataset: {},
    disabled: false,
    title: "",
    className: "",
    type: "button",
    children: [],
    attributes: new Map(),
    append(...items) {
      this.children.push(...items);
    },
    appendChild(item) {
      this.children.push(item);
      return item;
    },
    addEventListener() {},
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
    },
  });

  const testSource = source.replace(/\nloadDefaults\(\);\s*$/, "");
  vm.runInContext(
    `${testSource}
globalThis.__appTest = {
  state,
  applyPreset,
  createSession,
  deleteSession,
  saveCustomPreset,
  saveConfig,
  selectPresetForCurrentConfig,
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
