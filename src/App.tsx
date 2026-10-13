import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader, type AppView } from "./components/AppHeader";
import { ActionToolbar, type DownloadKind, type SampleKind } from "./components/ActionToolbar";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { JsonInputEditor } from "./components/JsonInputEditor";
import { QueryEditor } from "./components/QueryEditor";
import { QueryResultsEditor } from "./components/QueryResultsEditor";
import { CompareView } from "./components/CompareView";
import { StatusBar } from "./components/StatusBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { Toaster } from "./components/Toaster";
import type { CodeEditorHandle } from "./components/editor/CodeEditor";
import { useTheme } from "./hooks/useTheme";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useHotkeys } from "./hooks/useHotkeys";
import { analyzeJson, useJsonDocument } from "./hooks/useJsonDocument";
import { formatBytes, formatJson, minifyJson, type JsonSyntaxError } from "./lib/json";
import { collectFieldNames } from "./lib/jsonPath";
import { QueryClient, SupersededError } from "./lib/query/client";
import { copyText, readClipboardText } from "./lib/clipboard";
import { downloadText, pickFile, readJsonFile, timestampedName } from "./lib/file";
import { SAMPLE_JSON_TEXT, generateDataset } from "./lib/sampleData";
import {
  MAX_PERSISTED_INPUT,
  loadSettings,
  readStorage,
  removeStorage,
  writeStorage,
  type SavedQuery,
  type Settings,
  type Workspace,
} from "./lib/storage";
import { toast } from "./lib/toast";
import { SHORTCUTS } from "./shortcuts";
import type { InputViewMode, MobileTab, ResultFormat, ResultViewMode, RunState } from "./types";
import { cx } from "./components/ui";

const DEFAULT_QUERY = ".users[] | select(.active == true)";
const MAX_HISTORY = 50;

function describeError(e: JsonSyntaxError): string {
  return `Line ${e.line}, column ${e.column}: ${e.message}`;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const isMobile = useMediaQuery("(max-width: 767px)");

  /* ---------------- Settings & persisted state ---------------- */
  const [settings, setSettings] = useState<Settings>(loadSettings);
  useEffect(() => void writeStorage("settings", settings), [settings]);
  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const [initialWorkspace] = useState(() => (settings.persistWorkspace ? readStorage<Partial<Workspace> | null>("workspace", null) : null));
  const [input, setInput] = useState(initialWorkspace?.input ?? SAMPLE_JSON_TEXT);
  const [query, setQuery] = useState(initialWorkspace?.query ?? DEFAULT_QUERY);
  const [compareLeft, setCompareLeft] = useState(initialWorkspace?.compareLeft ?? "");
  const [compareRight, setCompareRight] = useState(initialWorkspace?.compareRight ?? "");
  const [history, setHistory] = useState<string[]>(() => readStorage("history", []));
  const [snippets, setSnippets] = useState<SavedQuery[]>(() => readStorage("snippets", []));

  useEffect(() => void writeStorage("history", history), [history]);
  useEffect(() => void writeStorage("snippets", snippets), [snippets]);

  // Workspace persistence (debounced; very large inputs are skipped).
  const persistWarned = useRef(false);
  useEffect(() => {
    if (!settings.persistWorkspace) return;
    const id = setTimeout(() => {
      const fits = (t: string) => t.length <= MAX_PERSISTED_INPUT;
      const ws: Workspace = {
        input: fits(input) ? input : "",
        query,
        compareLeft: fits(compareLeft) ? compareLeft : "",
        compareRight: fits(compareRight) ? compareRight : "",
      };
      const ok = writeStorage("workspace", ws);
      if ((!ok || !fits(input)) && !persistWarned.current) {
        persistWarned.current = true;
        toast.info("Input too large to remember", "It won't be restored after a reload (limit 2 MB).");
      }
    }, 600);
    return () => clearTimeout(id);
  }, [input, query, compareLeft, compareRight, settings.persistWorkspace]);

  /* ---------------- UI state ---------------- */
  const [view, setView] = useState<AppView>("playground");
  const [mobileTab, setMobileTab] = useState<MobileTab>("input");
  const [inputView, setInputView] = useState<InputViewMode>("code");
  const [resultView, setResultView] = useState<ResultViewMode>("code");
  const [resultFormat, setResultFormat] = useState<ResultFormat>("pretty");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const inputEditor = useRef<CodeEditorHandle>(null);
  const queryEditor = useRef<CodeEditorHandle>(null);

  /* ---------------- Input analysis ---------------- */
  const doc = useJsonDocument(input);
  const fields = useMemo(() => (doc.parsed ? collectFieldNames(doc.parsed.value) : []), [doc.parsed]);

  // Latest values for stable callbacks.
  const latest = useRef({ input, query, settings });
  latest.current = { input, query, settings };

  /** Replace the input through the editor so the change is undoable. */
  const setInputText = useCallback((text: string) => {
    if (inputEditor.current) inputEditor.current.setValue(text);
    setInput(text);
  }, []);

  const setQueryText = useCallback((text: string) => {
    if (queryEditor.current) queryEditor.current.setValue(text);
    setQuery(text);
  }, []);

  const revealError = useCallback((e: JsonSyntaxError) => {
    setView("playground");
    setMobileTab("input");
    setInputView((m) => (m === "tree" ? "code" : m));
    requestAnimationFrame(() => inputEditor.current?.revealOffset(e.offset, e.length));
  }, []);

  const jumpToError = useCallback(() => {
    const v = analyzeJson(latest.current.input).validation;
    if (v.status === "invalid") revealError(v.error);
  }, [revealError]);

  /* ---------------- Query engine ---------------- */
  const client = useMemo(() => new QueryClient(), []);
  const [jqVersion, setJqVersion] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const timedOut = useRef(new Set<string>());

  useEffect(() => {
    client.ready().then(setJqVersion, (e) => setEngineError(errorMessage(e)));
    return () => client.dispose();
  }, [client]);

  const addToHistory = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setHistory((h) => [trimmed, ...h.filter((x) => x !== trimmed)].slice(0, MAX_HISTORY));
  }, []);

  const runQuery = useCallback(
    async (manual: boolean, override?: string) => {
      const { input: text, settings: s } = latest.current;
      const q = override ?? latest.current.query;
      if (manual) {
        timedOut.current.delete(q);
        const v = analyzeJson(text).validation;
        if (v.status === "invalid") {
          setRun({
            status: "done",
            query: q,
            manual,
            outcome: { outputs: [], warnings: [], durationMs: 0, error: { kind: "input", message: `The input is not valid JSON. ${describeError(v.error)}` } },
          });
          return;
        }
      }
      setRun((prev) => ({
        status: "running",
        query: q,
        previous: prev.status === "done" ? prev.outcome : prev.status === "running" ? prev.previous : null,
      }));
      try {
        const outcome = await client.run(text, q, { sortKeys: s.sortKeys, slurp: s.slurp });
        setRun({ status: "done", outcome, query: q, manual });
        if (manual && !outcome.error) addToHistory(q);
      } catch (e) {
        if (e instanceof SupersededError) return;
        setRun({
          status: "done",
          query: q,
          manual,
          outcome: { outputs: [], warnings: [], durationMs: 0, error: { kind: "internal", message: errorMessage(e) } },
        });
      }
    },
    [client, addToHistory],
  );

  const runManual = useCallback(() => {
    void runQuery(true);
    if (isMobile) setMobileTab("result");
  }, [runQuery, isMobile]);

  const cancelQuery = useCallback(() => {
    client.cancel();
    setRun((prev) => (prev.status === "running" && prev.previous ? { status: "done", outcome: prev.previous, query: prev.query, manual: true } : { status: "idle" }));
    toast.info("Query stopped");
  }, [client]);

  // Auto-run: after the input has been validated and the query has settled.
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);
  // Queries that timed out are not re-run automatically (they'd just hang again).
  useEffect(() => {
    if (run.status === "done" && run.outcome.error?.kind === "timeout") timedOut.current.add(run.query);
  }, [run]);
  useEffect(() => {
    if (!settings.autoRun || doc.pending || doc.validation.status === "invalid") return;
    if (timedOut.current.has(debouncedQuery)) return;
    void runQuery(false, debouncedQuery);
    // doc.validation changes identity whenever the analysed text changes.
  }, [settings.autoRun, settings.sortKeys, settings.slurp, debouncedQuery, doc.validation, doc.pending, runQuery]);

  // Record auto-run queries in history once they've stayed unchanged for a moment.
  useEffect(() => {
    if (run.status !== "done" || run.manual || run.outcome.error) return;
    const q = run.query;
    const id = setTimeout(() => addToHistory(q), 2500);
    return () => clearTimeout(id);
  }, [run, addToHistory]);

  const runExample = useCallback(
    (q: string) => {
      setQueryText(q);
      void runQuery(true, q);
      if (isMobile) setMobileTab("result");
    },
    [setQueryText, runQuery, isMobile],
  );

  /* ---------------- Results ---------------- */
  const shownOutcome = run.status === "done" ? run.outcome : run.status === "running" ? run.previous : null;
  const resultText = useMemo(() => {
    if (!shownOutcome) return "";
    if (resultFormat === "compact") return shownOutcome.outputs.join("\n");
    return shownOutcome.outputs
      .map((o) => {
        const r = formatJson(o, { indent: settings.indent, style: settings.formatStyle });
        return r.ok ? r.text : o;
      })
      .join("\n");
  }, [shownOutcome, resultFormat, settings.indent, settings.formatStyle]);

  const copyResult = useCallback(() => {
    copyText(resultText).then(
      () => toast.success("Result copied to clipboard"),
      (e) => toast.error("Copy failed", errorMessage(e)),
    );
  }, [resultText]);

  const downloadResult = useCallback(() => {
    const multiple = (shownOutcome?.outputs.length ?? 0) > 1;
    const name = timestampedName("jq-result", multiple ? "jsonl" : "json");
    // Multiple outputs are saved one compact value per line (JSON Lines) so the file stays parseable.
    downloadText(multiple ? shownOutcome!.outputs.join("\n") + "\n" : resultText, name, multiple ? "application/x-ndjson" : "application/json");
    toast.success("Download started", name);
  }, [resultText, shownOutcome]);

  const clearResult = useCallback(() => {
    client.cancel();
    setRun({ status: "idle" });
  }, [client]);

  /* ---------------- Input actions ---------------- */
  const formatInput = useCallback(() => {
    const { input: text, settings: s } = latest.current;
    const r = formatJson(text, { indent: s.indent, style: s.formatStyle });
    if (r.ok) {
      if (r.text !== text) setInputText(r.text);
      toast.success("Formatted", `${s.indent === "tab" ? "Tabs" : `${s.indent} spaces`} · ${s.formatStyle}`);
    } else if (r.error) {
      toast.error("Can't format invalid JSON", describeError(r.error));
      revealError(r.error);
    } else toast.info("Nothing to format — the input is empty");
  }, [setInputText, revealError]);

  const minifyInput = useCallback(() => {
    const text = latest.current.input;
    const r = minifyJson(text);
    if (r.ok) {
      setInputText(r.text);
      const saved = text.length - r.text.length;
      toast.success("Minified", saved > 0 ? `${formatBytes(saved)} of whitespace removed` : "Already minified");
    } else if (r.error) {
      toast.error("Can't minify invalid JSON", describeError(r.error));
      revealError(r.error);
    } else toast.info("Nothing to minify — the input is empty");
  }, [setInputText, revealError]);

  const validateInput = useCallback(() => {
    const { validation, stats } = analyzeJson(latest.current.input);
    if (validation.status === "valid") toast.success("Valid JSON", `${stats.lines.toLocaleString()} lines · ${formatBytes(stats.bytes)}`);
    else if (validation.status === "empty") toast.info("The input is empty");
    else {
      toast.error("Invalid JSON", describeError(validation.error));
      revealError(validation.error);
    }
  }, [revealError]);

  const loadText = useCallback(
    (text: string, label: string) => {
      setView("playground");
      setInputText(text);
      setMobileTab("input");
      toast.success(label, formatBytes(new Blob([text]).size));
    },
    [setInputText],
  );

  const loadFile = useCallback(
    async (file: File) => {
      try {
        const text = await readJsonFile(file);
        loadText(text, `Loaded ${file.name}`);
        const v = analyzeJson(text).validation;
        if (v.status === "invalid") toast.error(`${file.name} contains invalid JSON`, describeError(v.error));
      } catch (e) {
        toast.error("Import failed", errorMessage(e));
      }
    },
    [loadText],
  );

  const importFile = useCallback(async () => {
    const file = await pickFile();
    if (file) await loadFile(file);
  }, [loadFile]);

  const loadSample = useCallback(
    (kind: SampleKind) => {
      if (kind === "sample") {
        loadText(SAMPLE_JSON_TEXT, "Sample dataset loaded");
        return;
      }
      // Yield a frame so the menu closes before generating.
      requestAnimationFrame(() => loadText(generateDataset(kind), `Generated ${kind.toLocaleString()} records`));
    },
    [loadText],
  );

  const pasteInput = useCallback(async () => {
    try {
      const text = await readClipboardText();
      if (!text) {
        toast.info("The clipboard is empty");
        return;
      }
      setInputText(text);
      const v = analyzeJson(text).validation;
      if (v.status === "invalid") toast.error("Pasted text isn't valid JSON", describeError(v.error));
      else toast.success("Pasted from clipboard");
    } catch (e) {
      toast.error("Couldn't read the clipboard", errorMessage(e));
    }
  }, [setInputText]);

  const clearInput = useCallback(() => {
    setInputText("");
    inputEditor.current?.focus();
  }, [setInputText]);

  const copyInput = useCallback(() => {
    const text = latest.current.input;
    if (!text) return toast.info("Nothing to copy — the input is empty");
    copyText(text).then(
      () => toast.success("Input copied to clipboard"),
      (e) => toast.error("Copy failed", errorMessage(e)),
    );
  }, []);

  const downloadInput = useCallback((kind: DownloadKind) => {
    const { input: text, settings: s } = latest.current;
    if (!text.trim()) return toast.info("Nothing to download — the input is empty");
    let out = text;
    if (kind !== "raw") {
      const r = kind === "formatted" ? formatJson(text, { indent: s.indent, style: s.formatStyle }) : minifyJson(text);
      if (!r.ok) {
        if (r.error) toast.error("Can't download invalid JSON as " + kind, describeError(r.error));
        return;
      }
      out = r.text;
    }
    const name = timestampedName(kind === "minified" ? "data.min" : "data");
    downloadText(out, name);
    toast.success("Download started", name);
  }, []);

  const usePath = useCallback(
    (path: string) => {
      setQueryText(path);
      void runQuery(true, path);
      if (isMobile) setMobileTab("result");
    },
    [setQueryText, runQuery, isMobile],
  );

  /* ---------------- Snippets & history ---------------- */
  const saveSnippet = useCallback((name: string) => {
    const q = latest.current.query.trim();
    if (!q) return;
    setSnippets((list) => [{ id: crypto.randomUUID?.() ?? String(Date.now()), name, query: q, createdAt: Date.now() }, ...list.filter((s) => s.query !== q)]);
    toast.success("Query saved", name);
  }, []);
  const deleteSnippet = useCallback((id: string) => setSnippets((list) => list.filter((s) => s.id !== id)), []);
  const clearHistory = useCallback(() => setHistory([]), []);
  const clearQuery = useCallback(() => {
    setQueryText("");
    queryEditor.current?.focus();
  }, [setQueryText]);

  const clearLocalData = useCallback(() => {
    ["workspace", "history", "snippets", "settings"].forEach(removeStorage);
    setHistory([]);
    setSnippets([]);
    updateSettings({ persistWorkspace: false });
    toast.success("Local data cleared", "Workspace saving has been turned off.");
  }, [updateSettings]);

  /* ---------------- Keyboard shortcuts ---------------- */
  const focusPanel = useCallback((tab: MobileTab) => {
    setView("playground");
    setMobileTab(tab);
    requestAnimationFrame(() => {
      if (tab === "input") inputEditor.current?.focus();
      else if (tab === "query") queryEditor.current?.focus();
      else document.querySelector<HTMLElement>('[aria-label="Query result (read-only)"]')?.focus();
    });
  }, []);

  useHotkeys([
    { combo: SHORTCUTS.runQuery.combo, handler: runManual, allowInInputs: true },
    { combo: SHORTCUTS.format.combo, handler: formatInput },
    { combo: SHORTCUTS.minify.combo, handler: minifyInput },
    { combo: SHORTCUTS.validate.combo, handler: validateInput },
    { combo: SHORTCUTS.importFile.combo, handler: () => void importFile(), allowInInputs: true },
    { combo: SHORTCUTS.download.combo, handler: () => downloadInput("formatted"), allowInInputs: true },
    { combo: SHORTCUTS.focusInput.combo, handler: () => focusPanel("input"), allowInInputs: true },
    { combo: SHORTCUTS.focusQuery.combo, handler: () => focusPanel("query"), allowInInputs: true },
    { combo: SHORTCUTS.focusResults.combo, handler: () => focusPanel("result"), allowInInputs: true },
    { combo: SHORTCUTS.shortcuts.combo, handler: () => setShortcutsOpen((o) => !o), allowInInputs: true },
  ]);

  /* ---------------- Render ---------------- */
  const compileError = useMemo(
    () => (run.status === "done" && run.outcome.error?.kind === "compile" ? { query: run.query, error: run.outcome.error } : null),
    [run],
  );

  const inputPanel = (
    <JsonInputEditor
      editorRef={inputEditor}
      value={input}
      onChange={setInput}
      doc={doc}
      settings={settings}
      viewMode={inputView}
      onViewModeChange={setInputView}
      isMobile={isMobile}
      onUsePath={usePath}
      onPaste={pasteInput}
      onClear={clearInput}
      onImport={importFile}
      onLoadSample={() => loadSample("sample")}
      onFile={loadFile}
      onJumpToError={jumpToError}
      onFoldAll={() => inputEditor.current?.foldAll()}
      onUnfoldAll={() => inputEditor.current?.unfoldAll()}
      onSearch={() => inputEditor.current?.openSearch()}
    />
  );

  const queryPanel = (
    <QueryEditor
      editorRef={queryEditor}
      value={query}
      onChange={setQuery}
      settings={settings}
      fields={fields}
      compileError={compileError}
      history={history}
      snippets={snippets}
      onRunExample={runExample}
      onClearHistory={clearHistory}
      onSaveSnippet={saveSnippet}
      onDeleteSnippet={deleteSnippet}
      onClear={clearQuery}
    />
  );

  const resultsPanel = (
    <QueryResultsEditor
      run={run}
      text={resultText}
      settings={settings}
      viewMode={resultView}
      onViewModeChange={setResultView}
      format={resultFormat}
      onFormatChange={setResultFormat}
      onCopy={copyResult}
      onDownload={downloadResult}
      onClear={clearResult}
      onRunExample={runExample}
      onUsePath={usePath}
    />
  );

  const resultCount = shownOutcome?.outputs.length ?? 0;

  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <AppHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        view={view}
        onViewChange={setView}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <div className={cx("flex min-h-0 flex-1 flex-col", view !== "playground" && "hidden")}>
        <ActionToolbar
          indent={settings.indent}
          formatStyle={settings.formatStyle}
          autoRun={settings.autoRun}
          running={run.status === "running"}
          onIndentChange={(indent) => updateSettings({ indent })}
          onFormatStyleChange={(formatStyle) => updateSettings({ formatStyle })}
          onAutoRunChange={(autoRun) => updateSettings({ autoRun })}
          onFormat={formatInput}
          onMinify={minifyInput}
          onValidate={validateInput}
          onLoadSample={loadSample}
          onImport={importFile}
          onCopy={copyInput}
          onDownload={downloadInput}
          onRun={runManual}
          onCancel={cancelQuery}
        />
        <WorkspaceLayout
          isMobile={isMobile}
          mobileTab={mobileTab}
          onMobileTabChange={setMobileTab}
          input={inputPanel}
          query={queryPanel}
          results={resultsPanel}
          inputBadge={doc.validation.status === "invalid" ? <span className="size-1.5 rounded-full bg-danger" aria-label="Invalid JSON" /> : null}
          resultBadge={
            shownOutcome?.error ? (
              <span className="size-1.5 rounded-full bg-danger" aria-label="Query error" />
            ) : resultCount > 0 ? (
              <span className="rounded-full bg-surface-3 px-1.5 text-[10px] tabular-nums text-fg-muted">{resultCount > 999 ? "999+" : resultCount}</span>
            ) : null
          }
        />
      </div>

      {view === "compare" && (
        <CompareView
          left={compareLeft}
          right={compareRight}
          onLeftChange={setCompareLeft}
          onRightChange={setCompareRight}
          currentInput={input}
          settings={settings}
          isMobile={isMobile}
        />
      )}

      <StatusBar
        validation={doc.validation}
        run={run}
        indent={settings.indent}
        theme={theme}
        jqVersion={jqVersion}
        engineError={engineError}
        onJumpToError={jumpToError}
      />

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onChange={updateSettings} onClearData={clearLocalData} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Toaster />
    </div>
  );
}
