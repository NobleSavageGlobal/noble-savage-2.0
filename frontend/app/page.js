"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import LibraryDashboard from "../components/LibraryDashboard";
import MessageRenderer from "../components/MessageRenderer";
import useWorkspaceAttachments from "../hooks/useWorkspaceAttachments";
import { readErrorMessage } from "../lib/apiError";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api-proxy";
const STARTER_PROMPTS = [
  "Map my highest-leverage move for today and what it unblocks.",
  "Turn my scattered priorities into a hard-first execution sequence.",
  "Draft a concise morning brief from my current board state.",
];
const USE_CASE_CHIPS = [
  "Daily brief",
  "Decision memo",
  "Board audit",
  "Risk review",
  "Client outreach",
  "Meeting prep",
];
const PLACEHOLDER_EXAMPLES = [
  "Ask: What is my one highest-leverage move right now?",
  "Paste a client brief and ask for an execution plan.",
  "Drop files or links to build a project-ready synthesis.",
];
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES_PER_MESSAGE = 10;
const WORKSPACE_LIMIT = 5 * 1024 * 1024 * 1024;
const FILE_ACCEPT = {
  documents: ".pdf,.doc,.docx,.txt,.md,.rtf,.odt",
  images: "image/*",
  code: ".js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.c,.cpp,.css,.html,.json,.yml,.yaml,.sql",
  data: ".csv,.tsv,.xlsx,.xls,.parquet,.json",
};

const DEFAULT_PROJECTS = [
  {
    id: "project-personal-os",
    name: "Personal OS",
    icon: "NS",
    color: "#0f766e",
    description: "Personal operating system and execution layer.",
    members: [],
    defaultModel: "sonnet",
    instructions: {
      systemPrompt: "Operate as a direct chief-of-staff. Prioritize sequencing and execution.",
      outputStyle: "structured",
      toolsEnabled: {
        search: true,
        vision: true,
        code: true,
        canvas: false,
      },
      quickToggles: {
        concise: false,
        citeSources: true,
        useTables: false,
      },
      language: "English",
    },
    knowledgeFileIds: [],
  },
  {
    id: "project-client-ops",
    name: "Client Ops",
    icon: "CO",
    color: "#0e7490",
    description: "Client delivery, support workflows, and outreach.",
    members: [],
    defaultModel: "haiku",
    instructions: {
      systemPrompt: "Focus on client clarity, concise communication, and explicit next actions.",
      outputStyle: "concise",
      toolsEnabled: {
        search: true,
        vision: false,
        code: false,
        canvas: false,
      },
      quickToggles: {
        concise: true,
        citeSources: false,
        useTables: true,
      },
      language: "English",
    },
    knowledgeFileIds: [],
  },
  {
    id: "project-research",
    name: "Archive Research",
    icon: "AR",
    color: "#7c3aed",
    description: "Evidence maps, source synthesis, and archival workflows.",
    members: [],
    defaultModel: "opus",
    instructions: {
      systemPrompt: "Prioritize source-backed reasoning and evidence integrity.",
      outputStyle: "analytical",
      toolsEnabled: {
        search: true,
        vision: true,
        code: false,
        canvas: false,
      },
      quickToggles: {
        concise: false,
        citeSources: true,
        useTables: true,
      },
      language: "English",
    },
    knowledgeFileIds: [],
  },
];

function createThread(title = "New thread", projectId = DEFAULT_PROJECTS[0].id) {
  return {
    id: safeId(),
    projectId,
    title,
    messages: [],
    attachments: [],
    linkCards: [],
    draft: "",
    notes: "",
    pinned: false,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** idx;
  return `${value.toFixed(value >= 100 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function extractUrls(text = "") {
  const matches = text.match(/https?:\/\/[^\s]+/g);
  return matches ? [...new Set(matches)] : [];
}

function normalize(text = "") {
  return text.toLowerCase().trim();
}

function fuzzyScore(query, value) {
  if (!query) return 1;
  const q = normalize(query);
  const v = normalize(value);
  if (!q || !v) return 0;
  if (v.includes(q)) return 100 + q.length;

  let qi = 0;
  let streak = 0;
  let score = 0;
  for (let i = 0; i < v.length && qi < q.length; i += 1) {
    if (v[i] === q[qi]) {
      qi += 1;
      streak += 1;
      score += 2 + streak;
    } else {
      streak = 0;
    }
  }
  if (qi !== q.length) return 0;
  return score;
}

function ageBucket(ts) {
  const now = new Date();
  const date = new Date(ts);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.floor((startToday - startDate) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days <= 7) return "thisWeek";
  return "older";
}

function hasArtifact(text = "") {
  return /```|^\s*\|.+\|\s*$/m.test(text);
}

function safeId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `ns-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildInstructionPrefix(project) {
  if (!project?.instructions) return "";
  const { systemPrompt, outputStyle, quickToggles, language } = project.instructions;
  const directives = [];
  if (systemPrompt?.trim()) directives.push(`System instructions: ${systemPrompt.trim()}`);
  if (outputStyle) directives.push(`Output style: ${outputStyle}`);
  if (quickToggles?.concise) directives.push("Be concise.");
  if (quickToggles?.citeSources) directives.push("Always cite sources.");
  if (quickToggles?.useTables) directives.push("Use tables when comparing options.");
  if (language?.trim()) directives.push(`Respond in ${language.trim()}.`);
  return directives.length ? `[Project context]\n${directives.join("\n")}\n[/Project context]\n\n` : "";
}

export default function Home() {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [sessionMessage, setSessionMessage] = useState("");
  const [projects, setProjects] = useState(DEFAULT_PROJECTS);
  const [threads, setThreads] = useState([createThread("Command thread", DEFAULT_PROJECTS[0].id)]);
  const [activeProjectId, setActiveProjectId] = useState(DEFAULT_PROJECTS[0].id);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [renamingThreadId, setRenamingThreadId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [threadMenu, setThreadMenu] = useState({ open: false, threadId: "", x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [mainView, setMainView] = useState("conversation");
  const [composerText, setComposerText] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [composerFocused, setComposerFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [lastInteractionAt, setLastInteractionAt] = useState(Date.now());
  const [dragOverComposer, setDragOverComposer] = useState(false);
  const [dragAttachmentId, setDragAttachmentId] = useState("");
  const [activeTool, setActiveTool] = useState("search");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [theme, setTheme] = useState("light");
  const [densityMode, setDensityMode] = useState("comfortable");
  const [titleEditing, setTitleEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [activeModel, setActiveModel] = useState("sonnet");
  const [composerModel, setComposerModel] = useState("sonnet");
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState({
    pinned: false,
    today: false,
    thisWeek: false,
    older: false,
    archived: false,
  });
  const [railTab, setRailTab] = useState("artifact");
  const [railPinned, setRailPinned] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [assistantName] = useState("Assistant");
  const textareaRef = useRef(null);
  const messagesFrameRef = useRef(null);
  const generationAbortRef = useRef(null);
  const streamTimerRef = useRef(null);

  const densityStorageKey = token ? `ns_density_${token.slice(-12)}` : "ns_density";

  useEffect(() => {
    const existing = window.localStorage.getItem("ns_access_token") || "";
    const savedTheme = window.localStorage.getItem("ns_theme");
    const savedDensity = window.localStorage.getItem("ns_density") || "comfortable";
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
    setToken(existing);
    setTheme(nextTheme);
    setDensityMode(savedDensity);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.dataset.density = savedDensity;
    setSessionChecking(false);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.density = densityMode;
    window.localStorage.setItem(densityStorageKey, densityMode);
    window.localStorage.setItem("ns_density", densityMode);
  }, [densityMode, densityStorageKey]);

  useEffect(() => {
    if (!token) return;
    const stored = window.localStorage.getItem(densityStorageKey);
    if (stored === "comfortable" || stored === "compact") {
      setDensityMode(stored);
      document.documentElement.dataset.density = stored;
    }
  }, [densityStorageKey, token]);

  useEffect(() => {
    function closeMenus() {
      setThreadMenu((current) => (current.open ? { ...current, open: false } : current));
      setTemplateMenuOpen(false);
      setProjectMenuOpen(false);
    }

    window.addEventListener("click", closeMenus);
    return () => window.removeEventListener("click", closeMenus);
  }, []);

  const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0] || null;
  const projectThreads = threads.filter((thread) => thread.projectId === activeProjectId);
  const workspace = activeProject?.name || "Personal OS";

  useEffect(() => {
    if (!threads.length) {
      const seed = createThread("Command thread", activeProjectId || DEFAULT_PROJECTS[0].id);
      setThreads([seed]);
      setActiveThreadId(seed.id);
      return;
    }

    const visible = threads.filter((thread) => thread.projectId === activeProjectId && !thread.archived);
    if (!visible.length) {
      const seed = createThread("New thread", activeProjectId || DEFAULT_PROJECTS[0].id);
      setThreads((current) => [seed, ...current]);
      setActiveThreadId(seed.id);
      return;
    }

    const activeStillVisible = visible.some((thread) => thread.id === activeThreadId);
    if (!activeThreadId || !activeStillVisible) {
      setActiveThreadId(visible[0].id);
    }
  }, [activeProjectId, activeThreadId, threads]);

  useEffect(() => {
    if (!activeProject) return;
    const nextModel = activeProject.defaultModel || "sonnet";
    setActiveModel(nextModel);
    setComposerModel(nextModel);
  }, [activeProject]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    async function verifySession() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 401) {
          logout("Your session expired. Please sign in again.");
          return;
        }
        if (!res.ok) {
          setSessionMessage("Authenticated, but profile check is temporarily unavailable.");
          return;
        }
        setSessionMessage("");
      } catch {
        if (!cancelled) {
          setSessionMessage("Unable to verify session health right now.");
        }
      }
    }

    verifySession();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submitAuth(e) {
    e.preventDefault();
    setError("");
    setAuthLoading(true);
    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const payload = mode === "register" ? { email, password, name } : { email, password };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const message = await readErrorMessage(res, "Authentication failed");
        setError(message);
        return;
      }

      const data = await res.json();
      window.localStorage.setItem("ns_access_token", data.access_token);
      setToken(data.access_token);
      setPassword("");
      setSessionMessage("");
    } catch {
      setError("Unable to reach authentication service. Check network and try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  function logout(reason = "") {
    window.localStorage.removeItem("ns_access_token");
    setToken("");
    setSessionMessage(reason);
    setError("");
  }

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0] || null;
  const activeMessages = activeThread?.messages || [];
  const lastAssistantMessage = [...activeMessages].reverse().find((m) => m.role === "assistant") || null;
  const sourceItems = lastAssistantMessage?.citations || [];
  const artifactItems = lastAssistantMessage && hasArtifact(lastAssistantMessage.content)
    ? [lastAssistantMessage.content]
    : [];

  useEffect(() => {
    if (!activeThread) return;
    const savedDraft = window.localStorage.getItem(`ns_draft_${activeThread.id}`) || "";
    setComposerText(activeThread.draft || savedDraft);
  }, [activeThread]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 24;
    const minHeight = lineHeight + 18;
    const maxHeight = lineHeight * 12 + 18;
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [composerText]);

  useEffect(() => {
    if (!activeThread) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(`ns_draft_${activeThread.id}`, composerText);
      setThreads((current) => current.map((thread) => {
        if (thread.id !== activeThread.id) return thread;
        if (thread.draft === composerText) return thread;
        let nextTitle = thread.title;
        if (composerText.trim() && !thread.messages.length) {
          nextTitle = thread.title.startsWith("(unsent)")
            ? thread.title
            : `(unsent) ${composerText.trim().slice(0, 48)}`;
        }
        return {
          ...thread,
          draft: composerText,
          title: nextTitle,
          updatedAt: Date.now(),
        };
      }));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeThread, composerText]);

  useEffect(() => {
    if (composerText.trim()) return;
    const elapsed = Date.now() - lastInteractionAt;
    const wait = Math.max(4000 - elapsed, 0);
    const timer = window.setTimeout(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
      setLastInteractionAt(Date.now());
    }, wait || 4000);
    return () => window.clearTimeout(timer);
  }, [composerText, lastInteractionAt, placeholderIndex]);

  useEffect(() => {
    if (!activeThread) return;
    const shouldOpen = railPinned || artifactItems.length > 0 || sourceItems.length > 0 || files.length > 0;
    setRailOpen(shouldOpen);
  }, [activeThread, artifactItems.length, sourceItems.length, files.length, railPinned]);

  function updateActiveThread(updater) {
    setThreads((current) => current.map((thread) => {
      if (thread.id !== activeThreadId) return thread;
      return updater(thread);
    }));
  }

  const updateThreadById = useCallback((threadId, updater) => {
    setThreads((current) => current.map((thread) => {
      if (thread.id !== threadId) return thread;
      return updater(thread);
    }));
  }, []);

  const updateProjectById = useCallback((projectId, updater) => {
    setProjects((current) => current.map((project) => {
      if (project.id !== projectId) return project;
      return updater(project);
    }));
  }, []);

  const {
    uploadCategory,
    setUploadCategory,
    workspaceFiles,
    fileLookup,
    selectedLibraryFiles,
    lastSelectedLibraryIndex,
    setLastSelectedLibraryIndex,
    libraryView,
    setLibraryView,
    libraryFilters,
    setLibraryFilters,
    globalDropVisible,
    selectedRailFileId,
    setSelectedRailFileId,
    attachmentError,
    composerFileInputRef,
    dashboardFileInputRef,
    artifactFileInputRef,
    queueFiles,
    openUploadPicker,
    handlePickerSelection,
    openFilePreview,
    addFileToNewChat,
    markFilesUsedInThread,
    downloadFile,
    deleteFile,
    toggleLibrarySelection,
    handleLibraryBulkAction,
  } = useWorkspaceAttachments({
    activeThread,
    activeThreadId,
    mainView,
    railTab,
    workspace,
    maxFileSize: MAX_FILE_SIZE,
    maxFilesPerMessage: MAX_FILES_PER_MESSAGE,
    workspaceLimit: WORKSPACE_LIMIT,
    updateThreadById,
    setThreads,
    setActiveThreadId,
    setMainView,
    setRailTab,
    setRailOpen,
    createThread,
  });

  const composerAttachmentIds = activeThread?.attachments || [];
  const files = composerAttachmentIds.map((id) => fileLookup[id]).filter(Boolean);

  const persistUnsentThread = useCallback((threadId, draft) => {
    if (!threadId) return;
    updateThreadById(threadId, (thread) => {
      if (!draft.trim()) return { ...thread, draft: draft || "" };
      const shouldMarkUnsent = !thread.messages.length;
      const nextTitle = shouldMarkUnsent
        ? `(unsent) ${draft.trim().slice(0, 48)}`
        : thread.title;
      return {
        ...thread,
        draft,
        title: nextTitle,
        updatedAt: Date.now(),
      };
    });
    window.localStorage.setItem(`ns_draft_${threadId}`, draft || "");
  }, [updateThreadById]);

  const handleNewThread = useCallback(() => {
    if (activeThreadId) {
      persistUnsentThread(activeThreadId, composerText);
    }
    const next = createThread("New thread", activeProjectId);
    const savedDraft = window.localStorage.getItem(`ns_draft_${next.id}`) || "";
    next.draft = savedDraft;
    setThreads((current) => [next, ...current]);
    setActiveThreadId(next.id);
    setComposerText(savedDraft);
    setTitleEditing(true);
    setDraftTitle(next.title);
  }, [activeProjectId, activeThreadId, composerText, persistUnsentThread]);

  useEffect(() => {
    const handler = (event) => {
      const key = event.key.toLowerCase();
      const command = event.metaKey || event.ctrlKey;
      if (command && key === "n") {
        event.preventDefault();
        handleNewThread();
      }
      if (command && key === "k") {
        event.preventDefault();
        const input = document.getElementById("thread-search");
        input?.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNewThread]);

  function saveTitle() {
    if (!activeThread) return;
    const nextTitle = draftTitle.trim() || "Untitled thread";
    updateActiveThread((thread) => ({ ...thread, title: nextTitle, updatedAt: Date.now() }));
    setTitleEditing(false);
  }

  function setThreadNotes(value) {
    updateActiveThread((thread) => ({ ...thread, notes: value }));
  }

  function removeAttachment(attachmentId) {
    updateActiveThread((thread) => ({
      ...thread,
      attachments: thread.attachments.filter((item) => item !== attachmentId),
      updatedAt: Date.now(),
    }));
  }

  function reorderAttachment(dragId, hoverId) {
    if (!dragId || !hoverId || dragId === hoverId) return;
    updateActiveThread((thread) => {
      const fromIndex = thread.attachments.findIndex((item) => item === dragId);
      const toIndex = thread.attachments.findIndex((item) => item === hoverId);
      if (fromIndex < 0 || toIndex < 0) return thread;
      const next = [...thread.attachments];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...thread, attachments: next, updatedAt: Date.now() };
    });
  }

  async function addLinkCard(url) {
    if (!activeThreadId || !url) return;
    const base = {
      id: safeId(),
      url,
      title: new URL(url).hostname,
      description: "Fetching preview...",
      status: "loading",
    };
    updateThreadById(activeThreadId, (thread) => ({
      ...thread,
      linkCards: [base, ...(thread.linkCards || []).filter((item) => item.url !== url)],
      updatedAt: Date.now(),
    }));

    try {
      const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false&meta=true`);
      const data = await res.json();
      const card = {
        ...base,
        title: data?.data?.title || base.title,
        description: data?.data?.description || data?.data?.publisher || "Preview ready",
        image: data?.data?.image?.url || "",
        status: "ready",
      };
      updateThreadById(activeThreadId, (thread) => ({
        ...thread,
        linkCards: (thread.linkCards || []).map((item) => (item.id === base.id ? card : item)),
      }));
    } catch {
      updateThreadById(activeThreadId, (thread) => ({
        ...thread,
        linkCards: (thread.linkCards || []).map((item) => (
          item.id === base.id ? { ...item, status: "fallback", description: "Preview unavailable" } : item
        )),
      }));
    }
  }

  function ingestUrls(text) {
    extractUrls(text).forEach((url) => {
      addLinkCard(url);
    });
  }

  function handlePaste(event) {
    event.stopPropagation();
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const text = clipboard.getData("text") || "";
    ingestUrls(text);

    const pastedFiles = [];
    for (const item of clipboard.items || []) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length) {
      queueFiles(pastedFiles, "composer");
    }
  }

  function handleComposerDrop(event) {
    event.preventDefault();
    setDragOverComposer(false);

    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles?.length) {
      queueFiles(droppedFiles, "composer");
    }
    const droppedText = event.dataTransfer?.getData("text") || "";
    if (droppedText) {
      setComposerText((prev) => `${prev}${prev ? "\n" : ""}${droppedText}`);
      ingestUrls(droppedText);
    }
  }

  function stopGeneration() {
    if (generationAbortRef.current) {
      generationAbortRef.current.abort();
      generationAbortRef.current = null;
    }
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setSendLoading(false);
  }

  async function streamIntoMessage(threadId, messageId, text, citations) {
    const tokens = text.match(/\S+\s*/g) || [text];
    const total = tokens.length;
    let cursor = 0;

    return new Promise((resolve) => {
      function pushFrame() {
        cursor = Math.min(total, cursor + Math.max(1, Math.ceil(total / 90)));
        const chunk = tokens.slice(0, cursor).join("");
        updateThreadById(threadId, (thread) => ({
          ...thread,
          messages: thread.messages.map((message) => (
            message.id === messageId
              ? { ...message, content: chunk, citations, streaming: cursor < total, ts: Date.now() }
              : message
          )),
          updatedAt: Date.now(),
        }));

        if (cursor >= total || !generationAbortRef.current) {
          if (streamTimerRef.current) {
            window.clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
          }
          resolve();
        }
      }

      pushFrame();
      streamTimerRef.current = window.setInterval(pushFrame, 22);
    });
  }

  async function requestAssistantAndStream(question, threadId, assistantMessageId) {
    const controller = new AbortController();
    generationAbortRef.current = controller;

    const contextualQuestion = `${buildInstructionPrefix(activeProject)}${question}`;

    const res = await fetch(`${API_BASE}/api/assistant/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: contextualQuestion, model: composerModel }),
      signal: controller.signal,
    });

    if (res.status === 401) {
      logout("Your session expired. Please sign in again.");
      throw new Error("unauthorized");
    }

    const body = await res.json().catch(() => ({}));
    const output = body.answer || body.detail || "No response returned.";
    const citations = body.citations || [];
    await streamIntoMessage(threadId, assistantMessageId, output, citations);

    if (!res.ok) {
      setComposerError(await readErrorMessage(res, "Assistant request failed."));
    }
  }

  async function sendMessage() {
    if (!token || !activeThread || !composerText.trim() || sendLoading) return;

    const question = composerText.trim();
    const threadId = activeThread.id;
    const attachedIds = [...(activeThread.attachments || [])].slice(0, MAX_FILES_PER_MESSAGE);
    const userMessage = {
      id: safeId(),
      role: "user",
      content: question,
      attachments: attachedIds,
      ts: Date.now(),
    };
    const assistantMessage = {
      id: safeId(),
      role: "assistant",
      content: "",
      citations: [],
      streaming: true,
      ts: Date.now(),
    };

    updateThreadById(threadId, (thread) => ({
      ...thread,
      title: thread.messages.length ? thread.title : question.slice(0, 56),
      messages: [...thread.messages, userMessage, assistantMessage],
      attachments: [],
      updatedAt: Date.now(),
    }));
    markFilesUsedInThread(attachedIds, threadId);
    setComposerText("");
    setComposerError("");
    setSendLoading(true);
    window.localStorage.setItem(`ns_draft_${threadId}`, "");

    try {
      await requestAssistantAndStream(question, threadId, assistantMessage.id);
    } catch (err) {
      if (err?.name === "AbortError") {
        setComposerError("Generation stopped.");
        return;
      }
      updateThreadById(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) => (
          message.id === assistantMessage.id
            ? { ...message, content: "Assistant request failed due to network error.", streaming: false }
            : message
        )),
        updatedAt: Date.now(),
      }));
      setComposerError("Unable to connect to assistant service.");
    } finally {
      generationAbortRef.current = null;
      setSendLoading(false);
    }
  }

  async function regenerateAssistantFrom(messageIndex) {
    if (!activeThread) return;
    const threadId = activeThread.id;
    const assistantMessage = activeThread.messages[messageIndex];
    if (!assistantMessage || assistantMessage.role !== "assistant") return;

    const previousUser = [...activeThread.messages.slice(0, messageIndex)].reverse().find((m) => m.role === "user");
    if (!previousUser) return;

    setSendLoading(true);
    setComposerError("");
    updateThreadById(threadId, (thread) => ({
      ...thread,
      messages: thread.messages.map((message, idx) => (
        idx === messageIndex
          ? { ...message, content: "", citations: [], streaming: true, ts: Date.now() }
          : message
      )),
      updatedAt: Date.now(),
    }));

    try {
      await requestAssistantAndStream(previousUser.content, threadId, assistantMessage.id);
    } catch (err) {
      if (err?.name !== "AbortError") {
        setComposerError("Unable to regenerate this response.");
      }
    } finally {
      generationAbortRef.current = null;
      if (streamTimerRef.current) {
        window.clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      setSendLoading(false);
    }
  }

  async function editUserMessageAndRegenerate(messageIndex, nextText) {
    if (!activeThread || !nextText.trim()) return;
    const threadId = activeThread.id;
    const newAssistant = {
      id: safeId(),
      role: "assistant",
      content: "",
      citations: [],
      streaming: true,
      ts: Date.now(),
    };

    updateThreadById(threadId, (thread) => {
      const trimmed = thread.messages.slice(0, messageIndex + 1).map((msg, idx) => (
        idx === messageIndex ? { ...msg, content: nextText.trim(), ts: Date.now() } : msg
      ));
      return {
        ...thread,
        messages: [...trimmed, newAssistant],
        updatedAt: Date.now(),
      };
    });

    setSendLoading(true);
    setComposerError("");

    try {
      await requestAssistantAndStream(nextText.trim(), threadId, newAssistant.id);
    } catch (err) {
      if (err?.name !== "AbortError") {
        setComposerError("Unable to regenerate after edit.");
      }
    } finally {
      generationAbortRef.current = null;
      if (streamTimerRef.current) {
        window.clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      setSendLoading(false);
    }
  }

  async function handleMessageThumb(messageIndex, direction) {
    if (!activeThread) return;
    const msg = activeThread.messages[messageIndex];
    if (!msg) return;

    updateThreadById(activeThread.id, (thread) => ({
      ...thread,
      messages: thread.messages.map((message, idx) => (
        idx === messageIndex ? { ...message, feedback: direction, updatedAt: Date.now() } : message
      )),
    }));

    try {
      await fetch(`${API_BASE}/api/signals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: direction === "up" ? "accept" : "dismiss",
          target: msg.id,
          agent: "assistant-ui",
          notes: `message feedback: ${direction}`,
        }),
      });
    } catch {
      // Keep interaction non-blocking even if analytics write fails.
    }
  }

  function handleMessageMoreAction(messageIndex, action) {
    if (!activeThread) return;
    const message = activeThread.messages[messageIndex];
    if (!message) return;

    if (action === "pin") {
      updateThreadById(activeThread.id, (thread) => ({
        ...thread,
        messages: thread.messages.map((m, idx) => (idx === messageIndex ? { ...m, pinned: !m.pinned } : m)),
      }));
      return;
    }

    if (action === "copy-link") {
      const link = `${window.location.origin}${window.location.pathname}#m-${message.id}`;
      navigator.clipboard.writeText(link);
      return;
    }

    if (action === "export-md") {
      const title = (activeThread.title || "message").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
      const blob = new Blob([message.content || ""], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${title}-${messageIndex + 1}.md`;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (action === "delete") {
      updateThreadById(activeThread.id, (thread) => ({
        ...thread,
        messages: thread.messages.filter((_, idx) => idx !== messageIndex),
      }));
    }
  }

  const visibleThreads = projectThreads.filter((thread) => !thread.archived);
  const archivedThreads = projectThreads.filter((thread) => thread.archived);

  const searchedThreads = visibleThreads
    .map((thread) => {
      const haystack = `${thread.title}\n${thread.messages.map((m) => m.content).join("\n")}`;
      return { thread, score: fuzzyScore(searchQuery, haystack) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.thread.updatedAt - a.thread.updatedAt;
    })
    .map((item) => item.thread);

  const archivedMatches = searchQuery.trim()
    ? archivedThreads
      .map((thread) => {
        const haystack = `${thread.title}\n${thread.messages.map((m) => m.content).join("\n")}`;
        return { thread, score: fuzzyScore(searchQuery, haystack) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.thread.updatedAt - a.thread.updatedAt)
      .map((item) => item.thread)
    : [];

  const pinned = searchedThreads.filter((thread) => thread.pinned).sort((a, b) => b.updatedAt - a.updatedAt);

  const grouped = {
    today: searchedThreads.filter((thread) => !thread.pinned && ageBucket(thread.updatedAt) === "today"),
    thisWeek: searchedThreads.filter((thread) => !thread.pinned && ageBucket(thread.updatedAt) === "thisWeek"),
    older: searchedThreads.filter((thread) => ageBucket(thread.updatedAt) === "older"),
  };

  function selectThread(threadId) {
    if (activeThreadId && activeThreadId !== threadId) {
      persistUnsentThread(activeThreadId, composerText);
    }
    setActiveThreadId(threadId);
    setMainView("conversation");
    setMenuOpen(false);
  }

  function setThreadPinned(threadId, pinnedValue) {
    updateThreadById(threadId, (thread) => ({
      ...thread,
      pinned: pinnedValue,
      updatedAt: Date.now(),
    }));
  }

  function setThreadArchived(threadId, archivedValue) {
    updateThreadById(threadId, (thread) => ({
      ...thread,
      archived: archivedValue,
      updatedAt: Date.now(),
    }));
  }

  function startRenameThread(thread) {
    setRenamingThreadId(thread.id);
    setRenameDraft(thread.title || "");
    setThreadMenu({ open: false, threadId: "", x: 0, y: 0 });
  }

  function saveRenameThread(threadId) {
    const nextTitle = renameDraft.trim() || "Untitled thread";
    updateThreadById(threadId, (thread) => ({
      ...thread,
      title: nextTitle,
      updatedAt: Date.now(),
    }));
    setRenamingThreadId("");
    setRenameDraft("");
  }

  function duplicateThread(threadId) {
    const source = threads.find((thread) => thread.id === threadId);
    if (!source) return;
    const copy = {
      ...source,
      id: safeId(),
      title: `${source.title} (copy)`,
      archived: false,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setThreads((current) => [copy, ...current]);
    setActiveProjectId(copy.projectId);
    setActiveThreadId(copy.id);
  }

  function moveThreadToProject(threadId, projectId) {
    updateThreadById(threadId, (thread) => ({
      ...thread,
      projectId,
      archived: false,
      updatedAt: Date.now(),
    }));
    if (activeThreadId === threadId) {
      setActiveProjectId(projectId);
      setActiveThreadId(threadId);
    }
  }

  function deleteThread(threadId) {
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    if (activeThreadId === threadId) {
      setActiveThreadId("");
    }
  }

  function saveActiveThreadAsTemplate() {
    if (!activeThread || !activeProject) return;
    const firstUserMessage = activeThread.messages.find((message) => message.role === "user");
    const starterPrompt = (firstUserMessage?.content || activeThread.draft || "").trim();
    const template = {
      id: safeId(),
      name: `${activeThread.title || "Thread"} template`,
      projectId: activeProject.id,
      projectName: activeProject.name,
      starterPrompt,
      instructions: JSON.parse(JSON.stringify(activeProject.instructions || {})),
      defaultModel: activeProject.defaultModel || "sonnet",
      createdAt: Date.now(),
    };
    setTemplates((current) => [template, ...current]);
  }

  function createThreadFromTemplate(template) {
    if (!template) return;
    setActiveProjectId(template.projectId);
    updateProjectById(template.projectId, (project) => ({
      ...project,
      instructions: { ...(template.instructions || project.instructions || {}) },
      defaultModel: template.defaultModel || project.defaultModel,
    }));
    const next = createThread(template.name.replace(/ template$/i, ""), template.projectId);
    next.draft = template.starterPrompt || "";
    setThreads((current) => [next, ...current]);
    setActiveThreadId(next.id);
    setComposerText(next.draft);
    setTemplateMenuOpen(false);
    setMainView("conversation");
  }

  function applyStarterPrompt(prompt) {
    setComposerText(prompt);
    setLastInteractionAt(Date.now());
  }

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    window.localStorage.setItem("ns_theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  function applyFollowupSuggestion(suggestion, messageContent) {
    const trimmedSuggestion = suggestion.trim();
    const excerpt = (messageContent || "").trim().slice(0, 240);
    const nextPrompt = excerpt
      ? `${trimmedSuggestion}:\n\n${excerpt}`
      : trimmedSuggestion;
    setComposerText(nextPrompt);
    setLastInteractionAt(Date.now());
    textareaRef.current?.focus();
  }

  function updateActiveProjectInstructions(nextInstructions) {
    if (!activeProject) return;
    updateProjectById(activeProject.id, (project) => ({
      ...project,
      instructions: {
        ...project.instructions,
        ...nextInstructions,
      },
    }));
  }

  function updateProjectKnowledge(fileId, checked) {
    if (!activeProject) return;
    updateProjectById(activeProject.id, (project) => {
      const current = new Set(project.knowledgeFileIds || []);
      if (checked) {
        current.add(fileId);
      } else {
        current.delete(fileId);
      }
      return {
        ...project,
        knowledgeFileIds: [...current],
      };
    });
  }

  function setProjectDefaultModel(model) {
    if (!activeProject) return;
    updateProjectById(activeProject.id, (project) => ({ ...project, defaultModel: model }));
    setActiveModel(model);
    setComposerModel(model);
  }

  if (sessionChecking) {
    return (
      <main>
        <section className="panel" style={{ maxWidth: 560, margin: "24px auto" }}>
          <h1>Noble Savage OS</h1>
          <p className="notice">Restoring secure session and checking the AI console...</p>
        </section>
      </main>
    );
  }

  if (!token) {
    return (
      <main>
        <section className="panel" style={{ maxWidth: 560, margin: "24px auto" }}>
          <h1>Noble Savage OS</h1>
          <p className="notice">Sign in to activate your AI-operated command center.</p>
          <form onSubmit={submitAuth} className="shell" style={{ marginTop: 12 }}>
            <div className="controls">
              <button type="button" className={mode === "login" ? "primary" : ""} onClick={() => setMode("login")}>
                Login
              </button>
              <button type="button" className={mode === "register" ? "primary" : ""} onClick={() => setMode("register")}>
                Register
              </button>
            </div>
            {mode === "register" ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
              />
            ) : null}
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email"
              required
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              minLength={12}
              required
            />
            {mode === "register" ? (
              <p className="notice" style={{ margin: 0 }}>
                Use 12+ characters with upper, lower, number, and symbol.
              </p>
            ) : null}
            {sessionMessage ? <p className="status-error" style={{ margin: 0 }}>{sessionMessage}</p> : null}
            {error ? <p className="status-error" style={{ margin: 0 }}>{error}</p> : null}
            <button className="primary" type="submit" disabled={authLoading}>
              {mode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell ${leftCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`library ${leftCollapsed ? "is-collapsed" : ""}`}>
        <div className="library-top">
          <div className="workspace-switcher">
            <button
              type="button"
              className="project-switcher-trigger"
              onClick={() => setProjectMenuOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={projectMenuOpen}
            >
              <span className="workspace-avatar" style={{ background: activeProject?.color || "var(--accent-cta)" }}>
                {activeProject?.icon || "NS"}
              </span>
              {!leftCollapsed ? (
                <span className="project-switcher-name">{activeProject?.name || "Project"}</span>
              ) : null}
              {!leftCollapsed ? <span className="project-caret">▾</span> : null}
            </button>
            <button
              type="button"
              className="ghost icon-toggle"
              onClick={() => setLeftCollapsed((v) => !v)}
              aria-label="Toggle sidebar"
            >
              {leftCollapsed ? ">" : "<"}
            </button>
          </div>
          {projectMenuOpen && !leftCollapsed ? (
            <div className="project-switcher-menu" role="menu" aria-label="Projects">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`project-menu-item ${project.id === activeProjectId ? "active" : ""}`}
                  onClick={() => {
                    setActiveProjectId(project.id);
                    setProjectMenuOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <span className="workspace-avatar" style={{ background: project.color }}>{project.icon}</span>
                  <span>
                    <strong>{project.name}</strong>
                    <small>{project.description}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="new-thread-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="new-thread"
              onClick={() => setTemplateMenuOpen((value) => !value)}
            >
              <span>New thread</span>
              {!leftCollapsed ? <span className="shortcut">⌘N</span> : null}
            </button>
            {templateMenuOpen && !leftCollapsed ? (
              <div className="new-thread-menu">
                <button
                  type="button"
                  onClick={() => {
                    handleNewThread();
                    setTemplateMenuOpen(false);
                  }}
                >
                  Blank
                </button>
                <div className="new-thread-divider" />
                {templates.length ? templates.slice(0, 12).map((template) => (
                  <button key={template.id} type="button" onClick={() => createThreadFromTemplate(template)}>
                    <span>{template.name}</span>
                    <small>{template.projectName}</small>
                  </button>
                )) : <p className="muted">No templates yet. Save any thread as template.</p>}
              </div>
            ) : null}
          </div>
          {!leftCollapsed ? (
            <button
              type="button"
              className={`ghost ${mainView === "library" ? "active-tab" : ""}`}
              onClick={() => setMainView("library")}
            >
              Library dashboard
            </button>
          ) : null}
          {!leftCollapsed ? (
            <label className="search-wrap" htmlFor="thread-search">
              <input
                id="thread-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search threads"
              />
              <span className="shortcut">⌘K</span>
            </label>
          ) : null}
        </div>

        {!leftCollapsed ? (
          <div className="library-scroll">
            <div className="library-section">
              <p className="section-label">Pinned</p>
              <div className="thread-list">
                {pinned.length ? pinned.map((thread) => (
                  <div
                    key={thread.id}
                    className={`thread-item ${activeThreadId === thread.id ? "active" : ""}`}
                    onClick={() => selectThread(thread.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setThreadMenu({ open: true, threadId: thread.id, x: e.clientX, y: e.clientY });
                    }}
                  >
                    {renamingThreadId === thread.id ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => saveRenameThread(thread.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRenameThread(thread.id);
                          if (e.key === "Escape") {
                            setRenamingThreadId("");
                            setRenameDraft("");
                          }
                        }}
                      />
                    ) : (
                      <span>{thread.title}</span>
                    )}
                  </div>
                )) : <p className="muted">No active threads yet.</p>}
              </div>
            </div>

            {[
              ["today", "Today"],
              ["thisWeek", "This Week"],
              ["older", "Older"],
            ].map(([key, label]) => (
              <div key={key} className="library-section">
                <button
                  type="button"
                  className="section-toggle"
                  onClick={() => setHistoryCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))}
                >
                  <span>{label}</span>
                  <span>{historyCollapsed[key] ? "+" : "-"}</span>
                </button>
                {!historyCollapsed[key] ? (
                  <div className="thread-list">
                    {grouped[key].length ? grouped[key].map((thread) => (
                      <div
                        key={thread.id}
                        className={`thread-item ${activeThreadId === thread.id ? "active" : ""}`}
                        onClick={() => selectThread(thread.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setThreadMenu({ open: true, threadId: thread.id, x: e.clientX, y: e.clientY });
                        }}
                      >
                        {renamingThreadId === thread.id ? (
                          <input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => saveRenameThread(thread.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveRenameThread(thread.id);
                              if (e.key === "Escape") {
                                setRenamingThreadId("");
                                setRenameDraft("");
                              }
                            }}
                          />
                        ) : (
                          <span>{thread.title}</span>
                        )}
                      </div>
                    )) : <p className="muted">None</p>}
                  </div>
                ) : null}
              </div>
            ))}

            {searchQuery.trim() ? (
              <div className="library-section">
                <button
                  type="button"
                  className="section-toggle"
                  onClick={() => setHistoryCollapsed((prev) => ({ ...prev, archived: !prev.archived }))}
                >
                  <span>Archived Matches</span>
                  <span>{historyCollapsed.archived ? "+" : "-"}</span>
                </button>
                {!historyCollapsed.archived ? (
                  <div className="thread-list">
                    {archivedMatches.length ? archivedMatches.map((thread) => (
                      <div key={thread.id} className="thread-item archived-result">
                        <span>{thread.title}</span>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setThreadArchived(thread.id, false);
                            selectThread(thread.id);
                          }}
                        >
                          Restore
                        </button>
                      </div>
                    )) : <p className="muted">No archived matches.</p>}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="library-bottom">
          <button type="button" className="ghost" onClick={() => setMenuOpen((v) => !v)}>
            User menu
          </button>
          <button type="button" className="ghost" onClick={toggleTheme}>
            Theme: {theme}
          </button>
          <button type="button" className="ghost" onClick={() => logout()}>
            Settings / Logout
          </button>
          {menuOpen ? <p className="muted">Profile, billing, and shortcuts are available here.</p> : null}
        </div>
      </aside>

      <section className="conversation-region">
        <header className="conversation-header">
          <div className="thread-title-wrap">
            {titleEditing ? (
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setTitleEditing(false);
                }}
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="title-button"
                onClick={() => {
                  setDraftTitle(activeThread?.title || "Untitled thread");
                  setTitleEditing(true);
                }}
              >
                {activeThread?.title || "Untitled thread"}
              </button>
            )}
          </div>
          <div className="header-actions">
            <select value={activeModel} onChange={(e) => setActiveModel(e.target.value)}>
              <option value="sonnet">Claude 3.5 Sonnet</option>
              <option value="haiku">Claude 3.5 Haiku</option>
              <option value="opus">Claude 3 Opus</option>
            </select>
            <div className="density-toggle" role="group" aria-label="Density mode">
              <button
                type="button"
                className={densityMode === "comfortable" ? "primary" : "ghost"}
                onClick={() => setDensityMode("comfortable")}
              >
                Comfortable
              </button>
              <button
                type="button"
                className={densityMode === "compact" ? "primary" : "ghost"}
                onClick={() => setDensityMode("compact")}
              >
                Compact
              </button>
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => activeThread && setThreadPinned(activeThread.id, !activeThread.pinned)}
            >
              {activeThread?.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => activeThread && setThreadArchived(activeThread.id, true)}
            >
              Archive
            </button>
            <button type="button" className="ghost" onClick={saveActiveThreadAsTemplate}>Save as template</button>
            <button type="button" className="ghost">Share</button>
            <button type="button" className="ghost">Menu</button>
          </div>
        </header>

        <div className="messages-frame" ref={messagesFrameRef}>
          <div className="messages-inner">
            {sessionMessage ? <p className="notice">{sessionMessage}</p> : null}
            {composerError ? <p className="status-error">{composerError}</p> : null}
            {attachmentError ? <p className="status-error">{attachmentError}</p> : null}

            {mainView === "library" ? (
              <LibraryDashboard
                files={[...workspaceFiles].sort((a, b) => b.createdAt - a.createdAt)}
                threads={threads}
                selected={selectedLibraryFiles}
                lastSelectedIndex={lastSelectedLibraryIndex}
                setLastSelectedIndex={setLastSelectedLibraryIndex}
                onToggleSelect={toggleLibrarySelection}
                onBulkAction={handleLibraryBulkAction}
                onOpen={openFilePreview}
                onAddToNewChat={addFileToNewChat}
                onDownload={downloadFile}
                onDelete={deleteFile}
                view={libraryView}
                setView={setLibraryView}
                filters={libraryFilters}
                setFilters={setLibraryFilters}
                onPickUpload={openUploadPicker}
                formatBytes={formatBytes}
              />
            ) : !activeMessages.length ? (
              <section className="empty-state">
                <h2>Start with intent, not noise.</h2>
                <p className="notice">Pick a starter or a use-case chip to begin this thread.</p>
                <div className="starter-grid">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" className="starter-card" onClick={() => applyStarterPrompt(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="chip-row">
                  {USE_CASE_CHIPS.map((chip) => (
                    <button key={chip} type="button" className="chip" onClick={() => applyStarterPrompt(`Help me with ${chip.toLowerCase()}.`)}>
                      {chip}
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <MessageRenderer
                messages={activeMessages}
                assistantName={assistantName}
                fileLookup={fileLookup}
                onOpenAttachment={openFilePreview}
                isStreaming={sendLoading}
                onRegenerate={regenerateAssistantFrom}
                onEditSave={editUserMessageAndRegenerate}
                onThumb={handleMessageThumb}
                onMoreAction={handleMessageMoreAction}
                onFollowup={applyFollowupSuggestion}
                scrollHostRef={messagesFrameRef}
              />
            )}
          </div>
        </div>

        <footer className="composer-wrap">
          <div
            className={`composer-inner composer-shell ${dragOverComposer ? "drag-over" : ""}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOverComposer(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverComposer(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setDragOverComposer(false);
              }
            }}
            onDrop={handleComposerDrop}
          >
            {files.length ? (
              <div className="attachment-row" role="list">
                {files.map((file) => (
                  <article
                    key={file.id}
                    className="attachment-chip"
                    title={file.name}
                    draggable
                    onDragStart={() => setDragAttachmentId(file.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      reorderAttachment(dragAttachmentId, file.id);
                      setDragAttachmentId("");
                    }}
                  >
                    {file.previewUrl ? (
                      <Image src={file.previewUrl} alt={file.name} className="chip-thumb" width={28} height={28} unoptimized />
                    ) : (
                      <span className="chip-icon">📎</span>
                    )}
                    <div className="chip-meta">
                      <span className="chip-name">{file.name}</span>
                      <span className="chip-size">{formatBytes(file.size)} · {file.progress}%</span>
                      <div className="chip-progress-track">
                        <span className="chip-progress-fill" style={{ width: `${file.progress}%` }} />
                      </div>
                    </div>
                    <button type="button" className="chip-remove" onClick={() => removeAttachment(file.id)}>×</button>
                  </article>
                ))}
              </div>
            ) : null}

            {activeThread?.linkCards?.length ? (
              <div className="link-card-row">
                {activeThread.linkCards.map((card) => (
                  <article key={card.id} className="link-card">
                    {card.image ? <Image src={card.image} alt={card.title} className="link-thumb" width={42} height={42} unoptimized /> : null}
                    <div>
                      <strong>{card.title}</strong>
                      <p className="muted">{card.description}</p>
                      <a href={card.url} target="_blank" rel="noreferrer">{card.url}</a>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="composer-grid">
              <div className="composer-input-wrap">
                <textarea
                  ref={textareaRef}
                  value={composerText}
                  onChange={(e) => {
                    setComposerText(e.target.value);
                    setLastInteractionAt(Date.now());
                  }}
                  onFocus={() => setComposerFocused(true)}
                  onBlur={() => setComposerFocused(false)}
                  onPaste={handlePaste}
                  placeholder={PLACEHOLDER_EXAMPLES[placeholderIndex]}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.shiftKey) return;
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <div className="composer-under">
                  {composerFocused ? <span className="hint">⌘+Enter to send, Shift+Enter for newline</span> : <span />}
                  <div className="controls">
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} aria-label="Upload type filter">
                      <option value="documents">Documents</option>
                      <option value="images">Images</option>
                      <option value="code">Code</option>
                      <option value="data">Data</option>
                    </select>
                    <button type="button" className="ghost attach-label" onClick={() => openUploadPicker("composer")}>Attach files</button>
                  </div>
                </div>
              </div>

              <aside className="composer-actions-rail">
                <select value={composerModel} onChange={(e) => setComposerModel(e.target.value)} aria-label="Model selector">
                  <option value="sonnet">Claude 3.5 Sonnet</option>
                  <option value="haiku">Claude 3.5 Haiku</option>
                  <option value="opus">Claude 3 Opus</option>
                </select>
                <select value={activeTool} onChange={(e) => setActiveTool(e.target.value)} aria-label="Tools selector">
                  <option value="search">Search</option>
                  <option value="vision">Vision</option>
                  <option value="code">Code</option>
                  <option value="canvas">Canvas</option>
                </select>
                <button
                  type="button"
                  className={`send-or-stop ${sendLoading ? "is-stop" : ""}`}
                  onClick={sendLoading ? stopGeneration : sendMessage}
                  disabled={!sendLoading && !composerText.trim() && !files.length}
                  aria-label={sendLoading ? "Stop generation" : "Send message"}
                >
                  {sendLoading ? <span className="stop-square" /> : "➤"}
                </button>
              </aside>
            </div>

            <div className="composer-states">
              <span className={`state-chip ${!composerText.trim() && !files.length && !sendLoading ? "on" : ""}`}>empty</span>
              <span className={`state-chip ${composerFocused ? "on" : ""}`}>focused</span>
              <span className={`state-chip ${files.length > 0 ? "on" : ""}`}>with-attachment</span>
              <span className={`state-chip ${sendLoading ? "on" : ""}`}>generating</span>
            </div>
          </div>
        </footer>
      </section>

      <aside className={`workspace-rail ${railOpen ? "open" : ""}`} aria-hidden={!railOpen}>
        <div className="rail-head">
          <strong>Workspace</strong>
          <div className="controls">
            <button type="button" className="ghost" onClick={() => setRailPinned((v) => !v)}>{railPinned ? "Unpin" : "Pin"}</button>
            <button type="button" className="ghost" onClick={() => setRailOpen(false)}>Hide</button>
          </div>
        </div>
        <div className="rail-tabs">
          {[
            ["artifact", "Artifact"],
            ["sources", "Sources"],
            ["files", "Files"],
            ["notes", "Notes"],
            ["instructions", "Instructions"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`ghost ${railTab === value ? "active-tab" : ""}`}
              onClick={() => setRailTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="rail-content">
          {railTab === "artifact" ? (
            <>
              <div className="controls">
                <button type="button" onClick={() => openUploadPicker("artifact")}>Attach file to artifact</button>
              </div>
              {artifactItems.length ? artifactItems.map((artifact, idx) => (
                <pre key={`${idx}-${artifact.slice(0, 24)}`} className="rail-pre">{artifact}</pre>
              )) : <p className="muted">No artifact detected in this thread yet.</p>}
            </>
          ) : null}

          {railTab === "sources" ? (
            sourceItems.length ? sourceItems.map((source) => (
              <article key={source.id || source.title} className="rail-card">
                <strong>{source.title}</strong>
              </article>
            )) : <p className="muted">No citations detected yet.</p>
          ) : null}

          {railTab === "files" ? (
            workspaceFiles.length ? (
              <>
                {selectedRailFileId && fileLookup[selectedRailFileId] ? (
                  <article className="rail-card rail-preview-card">
                    <strong>{fileLookup[selectedRailFileId].name}</strong>
                    <p className="muted">{formatBytes(fileLookup[selectedRailFileId].size)} · {fileLookup[selectedRailFileId].kind}</p>
                    {fileLookup[selectedRailFileId].previewUrl ? (
                      <Image
                        src={fileLookup[selectedRailFileId].previewUrl}
                        alt={fileLookup[selectedRailFileId].name}
                        width={320}
                        height={180}
                        className="rail-preview-image"
                        unoptimized
                      />
                    ) : null}
                    {fileLookup[selectedRailFileId].lineCount ? <p className="muted">{fileLookup[selectedRailFileId].lineCount} lines</p> : null}
                    {fileLookup[selectedRailFileId].rowCount ? <p className="muted">{fileLookup[selectedRailFileId].rowCount} rows</p> : null}
                    {fileLookup[selectedRailFileId].extractReady ? <span className="badge">{fileLookup[selectedRailFileId].extractBadge}</span> : null}
                  </article>
                ) : null}
                {workspaceFiles.map((file) => (
                  <article key={file.id} className="rail-card" onClick={() => setSelectedRailFileId(file.id)}>
                    <strong>{file.name}</strong>
                    <p className="muted">{formatBytes(file.size)} · {file.progress}%</p>
                  </article>
                ))}
              </>
            ) : <p className="muted">No files in workspace yet.</p>
          ) : null}

          {railTab === "notes" ? (
            <textarea
              value={activeThread?.notes || ""}
              onChange={(e) => setThreadNotes(e.target.value)}
              rows={12}
              placeholder="Capture notes, follow-ups, and project context here."
            />
          ) : null}

          {railTab === "instructions" && activeProject ? (
            <section className="project-instructions-panel">
              <div className="instructions-heading">
                <span className="workspace-avatar" style={{ background: activeProject.color }}>{activeProject.icon}</span>
                <div>
                  <strong>{activeProject.name}</strong>
                  <p className="muted">{activeProject.description}</p>
                </div>
              </div>

              <label className="instructions-field">
                <span>System prompt / instructions</span>
                <textarea
                  rows={5}
                  value={activeProject.instructions?.systemPrompt || ""}
                  onChange={(e) => updateActiveProjectInstructions({ systemPrompt: e.target.value })}
                />
              </label>

              <div className="instructions-grid">
                <label className="instructions-field">
                  <span>Output style</span>
                  <select
                    value={activeProject.instructions?.outputStyle || "structured"}
                    onChange={(e) => updateActiveProjectInstructions({ outputStyle: e.target.value })}
                  >
                    <option value="concise">Concise</option>
                    <option value="structured">Structured</option>
                    <option value="analytical">Analytical</option>
                    <option value="narrative">Narrative</option>
                  </select>
                </label>

                <label className="instructions-field">
                  <span>Default model</span>
                  <select
                    value={activeProject.defaultModel || "sonnet"}
                    onChange={(e) => setProjectDefaultModel(e.target.value)}
                  >
                    <option value="sonnet">Claude 3.5 Sonnet</option>
                    <option value="haiku">Claude 3.5 Haiku</option>
                    <option value="opus">Claude 3 Opus</option>
                  </select>
                </label>
              </div>

              <div className="instructions-block">
                <span className="section-label">Tools enabled</span>
                <div className="instructions-checks">
                  {[
                    ["search", "Search"],
                    ["vision", "Vision"],
                    ["code", "Code"],
                    ["canvas", "Canvas"],
                  ].map(([key, label]) => (
                    <label key={key} className="check-line">
                      <input
                        type="checkbox"
                        checked={Boolean(activeProject.instructions?.toolsEnabled?.[key])}
                        onChange={(e) => updateActiveProjectInstructions({
                          toolsEnabled: {
                            ...(activeProject.instructions?.toolsEnabled || {}),
                            [key]: e.target.checked,
                          },
                        })}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="instructions-block">
                <span className="section-label">Quick toggles</span>
                <div className="instructions-checks">
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={Boolean(activeProject.instructions?.quickToggles?.concise)}
                      onChange={(e) => updateActiveProjectInstructions({
                        quickToggles: {
                          ...(activeProject.instructions?.quickToggles || {}),
                          concise: e.target.checked,
                        },
                      })}
                    />
                    <span>Be concise</span>
                  </label>
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={Boolean(activeProject.instructions?.quickToggles?.citeSources)}
                      onChange={(e) => updateActiveProjectInstructions({
                        quickToggles: {
                          ...(activeProject.instructions?.quickToggles || {}),
                          citeSources: e.target.checked,
                        },
                      })}
                    />
                    <span>Always cite sources</span>
                  </label>
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={Boolean(activeProject.instructions?.quickToggles?.useTables)}
                      onChange={(e) => updateActiveProjectInstructions({
                        quickToggles: {
                          ...(activeProject.instructions?.quickToggles || {}),
                          useTables: e.target.checked,
                        },
                      })}
                    />
                    <span>Use tables when comparing</span>
                  </label>
                </div>
              </div>

              <label className="instructions-field">
                <span>Respond in language</span>
                <input
                  value={activeProject.instructions?.language || "English"}
                  onChange={(e) => updateActiveProjectInstructions({ language: e.target.value })}
                  placeholder="English"
                />
              </label>

              <div className="instructions-block">
                <span className="section-label">Attached knowledge files</span>
                {workspaceFiles.length ? (
                  <div className="instructions-checks">
                    {workspaceFiles.slice(0, 20).map((file) => (
                      <label key={file.id} className="check-line">
                        <input
                          type="checkbox"
                          checked={(activeProject.knowledgeFileIds || []).includes(file.id)}
                          onChange={(e) => updateProjectKnowledge(file.id, e.target.checked)}
                        />
                        <span>{file.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No files uploaded yet.</p>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </aside>

      {!railOpen ? (
        <button type="button" className="workspace-trigger" onClick={() => setRailOpen(true)}>
          Open Workspace
        </button>
      ) : null}

      <input
        ref={composerFileInputRef}
        type="file"
        multiple
        hidden
        accept={FILE_ACCEPT[uploadCategory] || "*/*"}
        onChange={(e) => handlePickerSelection(e, "composer")}
      />
      <input
        ref={dashboardFileInputRef}
        type="file"
        multiple
        hidden
        accept={FILE_ACCEPT[uploadCategory] || "*/*"}
        onChange={(e) => handlePickerSelection(e, "dashboard")}
      />
      <input
        ref={artifactFileInputRef}
        type="file"
        multiple
        hidden
        accept={FILE_ACCEPT[uploadCategory] || "*/*"}
        onChange={(e) => handlePickerSelection(e, "artifact")}
      />

      {globalDropVisible ? (
        <div className="global-drop-overlay" role="status" aria-live="polite">
          <div className="global-drop-target">
            <h3>Drop files to upload</h3>
            <p>
              Target: {mainView === "library" ? "Library" : railTab === "artifact" ? "Artifact" : "Composer"}
            </p>
            <p className="notice">Limits: 50MB per file, 10 files per message, 5GB workspace.</p>
          </div>
        </div>
      ) : null}

      {threadMenu.open ? (
        <div className="thread-context-menu" style={{ left: threadMenu.x, top: threadMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              const target = threads.find((thread) => thread.id === threadMenu.threadId);
              if (target) startRenameThread(target);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              const target = threads.find((thread) => thread.id === threadMenu.threadId);
              if (target) setThreadPinned(target.id, !target.pinned);
              setThreadMenu({ open: false, threadId: "", x: 0, y: 0 });
            }}
          >
            Pin / Unpin
          </button>
          <div className="new-thread-divider" />
          <div className="thread-menu-subhead">Move to project</div>
          {projects
            .filter((project) => project.id !== (threads.find((thread) => thread.id === threadMenu.threadId)?.projectId || ""))
            .map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  moveThreadToProject(threadMenu.threadId, project.id);
                  setThreadMenu({ open: false, threadId: "", x: 0, y: 0 });
                }}
              >
                {project.name}
              </button>
            ))}
          <div className="new-thread-divider" />
          <button
            type="button"
            onClick={() => {
              duplicateThread(threadMenu.threadId);
              setThreadMenu({ open: false, threadId: "", x: 0, y: 0 });
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => {
              setThreadArchived(threadMenu.threadId, true);
              setThreadMenu({ open: false, threadId: "", x: 0, y: 0 });
            }}
          >
            Archive
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              deleteThread(threadMenu.threadId);
              setThreadMenu({ open: false, threadId: "", x: 0, y: 0 });
            }}
          >
            Delete
          </button>
        </div>
      ) : null}

      <div className="mobile-logout">
        <button onClick={() => logout()}>Logout</button>
      </div>
    </main>
  );
}
