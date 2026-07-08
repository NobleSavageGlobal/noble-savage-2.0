"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import mermaid from "mermaid";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

let mermaidInitialized = false;

function slugify(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "section";
}

function extractHeadings(content = "") {
  const rows = content.split("\n");
  const seen = new Map();
  const headings = [];

  for (const row of rows) {
    const match = row.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    if (level > 4) continue;
    const text = match[2].trim();
    if (!text) continue;
    const base = slugify(text);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    headings.push({ level, text, id });
  }

  return headings;
}

function buildFollowupSuggestions(content = "") {
  const lower = content.toLowerCase();
  if (lower.includes("pros") || lower.includes("strategy") || lower.includes("plan")) {
    return ["Give me the counter-case", "Turn this into a checklist", "What is the first concrete step?"];
  }
  if (lower.includes("error") || lower.includes("bug") || lower.includes("trace")) {
    return ["Explain this simply", "Show likely root causes", "Give me the smallest safe fix first"];
  }
  return ["Explain this simply", "Give me the counter-case", "Turn this into a checklist"];
}

function detectLanguageFromFilename(filename = "") {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    php: "php",
    sh: "bash",
    bash: "bash",
    yml: "yaml",
    yaml: "yaml",
    json: "json",
    md: "markdown",
    sql: "sql",
    html: "html",
    css: "css",
    mermaid: "mermaid",
  };
  return map[ext] || "text";
}

function parseFenceHeader(language = "", meta = "") {
  const cleanLanguage = (language || "").trim();
  const cleanMeta = (meta || "").trim();

  const patterns = [
    /(?:title|file|filename)=['"]?([^'"\s]+)['"]?/i,
    /(?:title|file|filename):\s*['"]?([^'"\s]+)['"]?/i,
    /\b([\w.-]+\.[A-Za-z0-9]+)\b/,
  ];

  let filename = "";
  for (const pattern of patterns) {
    const match = cleanMeta.match(pattern);
    if (match?.[1]) {
      filename = match[1];
      break;
    }
  }

  // Support fences like ```title.ts with no explicit language label.
  if (!filename && cleanLanguage.includes(".")) {
    filename = cleanLanguage;
  }

  const resolvedLanguage = cleanLanguage && !cleanLanguage.includes(".")
    ? cleanLanguage
    : detectLanguageFromFilename(filename);

  return {
    filename,
    language: resolvedLanguage,
  };
}

function flattenChildrenText(children) {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (!children) return "";
  if (Array.isArray(children)) {
    return children.map((child) => flattenChildrenText(child)).join("");
  }
  if (typeof children === "object" && "props" in children) {
    return flattenChildrenText(children.props?.children);
  }
  return "";
}

function headingClasses(level, children) {
  const text = flattenChildrenText(children).toLowerCase().trim();
  const classes = [`md-heading`, `md-heading-l${level}`];
  if (text.includes("immediate action") || text.includes("next action") || text.includes("action plan")) {
    classes.push("md-heading-actions");
  }
  return classes.join(" ");
}

function parseImmediateActions(content = "") {
  const lines = content.split("\n");
  const headingIndex = lines.findIndex((line) => /^\s{0,3}#{1,6}\s+immediate actions\s*$/i.test(line.trim()));
  if (headingIndex < 0) {
    return { tasks: [], contentWithoutActions: content };
  }

  const tasks = [];
  let index = headingIndex + 1;
  while (index < lines.length && lines[index].trim() === "") {
    index += 1;
  }

  let endIndex = index;
  for (let i = index; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^\s{0,3}#{1,6}\s+/.test(trimmed)) {
      break;
    }
    const match = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (match) {
      tasks.push(match[1].trim());
      endIndex = i + 1;
      continue;
    }
    if (trimmed === "") {
      endIndex = i + 1;
      continue;
    }
    break;
  }

  if (!tasks.length) {
    return { tasks: [], contentWithoutActions: content };
  }

  const without = [...lines.slice(0, headingIndex), ...lines.slice(endIndex)].join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { tasks, contentWithoutActions: without || content };
}

function stripLineRanges(lines = [], ranges = []) {
  if (!ranges.length) return lines.join("\n");
  const ordered = [...ranges]
    .map((range) => ({ start: Math.max(0, range.start), end: Math.max(0, range.end) }))
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const range of ordered) {
    if (!merged.length || range.start > merged[merged.length - 1].end) {
      merged.push({ ...range });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, range.end);
    }
  }

  const keep = [];
  let cursor = 0;
  for (const range of merged) {
    if (cursor < range.start) keep.push(...lines.slice(cursor, range.start));
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < lines.length) keep.push(...lines.slice(cursor));
  return keep.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function parseSchedule(content = "") {
  const lines = content.split("\n");
  const headingIndex = lines.findIndex((line) => /^\s{0,3}#{1,6}\s+(today'?s\s+schedule|schedule|timeline)\s*$/i.test(line.trim()));
  if (headingIndex < 0) {
    return { entries: [], consumedRange: null };
  }

  const entries = [];
  let index = headingIndex + 1;
  while (index < lines.length && lines[index].trim() === "") {
    index += 1;
  }

  let endIndex = index;
  for (let i = index; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^\s{0,3}#{1,6}\s+/.test(trimmed)) break;
    const match = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (match) {
      const raw = match[1].trim();
      const timed = raw.match(/^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?:\s*(?:-|–|—|:))\s*(.+)$/i);
      entries.push({
        time: timed?.[1]?.trim() || "",
        text: timed?.[2]?.trim() || raw,
      });
      endIndex = i + 1;
      continue;
    }
    if (trimmed === "") {
      endIndex = i + 1;
      continue;
    }
    break;
  }

  if (!entries.length) {
    return { entries: [], consumedRange: null };
  }

  return {
    entries,
    consumedRange: { start: headingIndex, end: endIndex },
  };
}

function parseDocumentAnalysis(content = "") {
  const lines = content.split("\n");
  const sectionMap = {
    findings: /^(?:key\s+)?findings?$/i,
    risks: /^risks?$/i,
    questions: /^open\s+questions?$/i,
    sources: /^sources?$/i,
  };
  const sections = {
    findings: [],
    risks: [],
    questions: [],
    sources: [],
  };
  const ranges = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].trim().match(/^\s{0,3}#{1,6}\s+(.+)$/);
    if (!match) continue;
    const headingText = match[1].trim();
    const key = Object.keys(sectionMap).find((candidate) => sectionMap[candidate].test(headingText));
    if (!key || sections[key].length) continue;

    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") {
      j += 1;
    }

    let end = j;
    for (; j < lines.length; j += 1) {
      const row = lines[j];
      const trimmed = row.trim();
      if (/^\s{0,3}#{1,6}\s+/.test(trimmed)) break;
      const listMatch = row.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        sections[key].push(listMatch[1].trim());
        end = j + 1;
        continue;
      }
      if (trimmed) {
        sections[key].push(trimmed);
        end = j + 1;
        continue;
      }
      end = j + 1;
    }

    if (sections[key].length) {
      ranges.push({ start: i, end });
    }
  }

  const hasAny = Object.values(sections).some((items) => items.length);
  return {
    sections,
    consumedRanges: hasAny ? ranges : [],
  };
}

function parseStructuredAssistantContent(content = "") {
  const immediate = parseImmediateActions(content);
  const schedule = parseSchedule(immediate.contentWithoutActions || content);
  const analysis = parseDocumentAnalysis(immediate.contentWithoutActions || content);

  const lines = (immediate.contentWithoutActions || content).split("\n");
  const ranges = [];
  if (schedule.consumedRange) ranges.push(schedule.consumedRange);
  if (analysis.consumedRanges.length) ranges.push(...analysis.consumedRanges);

  const contentWithoutWidgets = stripLineRanges(lines, ranges);
  return {
    immediateActions: immediate.tasks,
    scheduleEntries: schedule.entries,
    analysisSections: analysis.sections,
    contentWithoutWidgets: contentWithoutWidgets || immediate.contentWithoutActions || content,
  };
}

function toSafeFileName(base = "actions") {
  return base.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "actions";
}

function buildCalendarIcs(tasks = []) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
  const dtStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Noble Savage OS//Immediate Actions//EN",
  ];

  tasks.forEach((task, idx) => {
    const eventStart = new Date(start.getTime() + idx * 60 * 60 * 1000);
    const eventEnd = new Date(eventStart.getTime() + 45 * 60 * 1000);
    const fmt = (date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${Date.now()}-${idx}@noblesavage`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${fmt(eventStart)}`);
    lines.push(`DTEND:${fmt(eventEnd)}`);
    lines.push(`SUMMARY:${task.replace(/[\n\r]+/g, " ")}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function ImmediateActionsWidget({ tasks = [], threadTitle = "immediate-actions" }) {
  const [items, setItems] = useState(
    tasks.map((task, index) => ({ id: `${index}-${task.slice(0, 24)}`, text: task, done: false })),
  );

  useEffect(() => {
    setItems(tasks.map((task, index) => ({ id: `${index}-${task.slice(0, 24)}`, text: task, done: false })));
  }, [tasks]);

  function toggleDone(id) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  }

  function moveItem(id, direction) {
    setItems((current) => {
      const idx = current.findIndex((item) => item.id === id);
      if (idx < 0) return current;
      const nextIndex = direction === "up" ? idx - 1 : idx + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(idx, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  }

  function exportWordDoc() {
    const content = ["Immediate Actions", "", ...items.map((item, idx) => `${idx + 1}. ${item.done ? "[x]" : "[ ]"} ${item.text}`)].join("\n");
    const blob = new Blob([content], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${toSafeFileName(threadTitle)}-immediate-actions.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportCalendar() {
    const active = items.filter((item) => !item.done).map((item) => item.text);
    const payload = buildCalendarIcs(active.length ? active : items.map((item) => item.text));
    const blob = new Blob([payload], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${toSafeFileName(threadTitle)}-immediate-actions.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="immediate-actions-widget" aria-label="Immediate Actions widget">
      <header className="immediate-actions-head">
        <h3>Immediate Actions</h3>
        <div className="controls">
          <button type="button" onClick={exportWordDoc}>Export to Word</button>
          <button type="button" className="primary" onClick={exportCalendar}>Add to Calendar</button>
        </div>
      </header>
      <div className="immediate-actions-list">
        {items.map((item, idx) => (
          <article key={item.id} className={`immediate-action-item ${item.done ? "done" : ""}`}>
            <label>
              <input type="checkbox" checked={item.done} onChange={() => toggleDone(item.id)} />
              <span>{item.text}</span>
            </label>
            <div className="controls">
              <button type="button" onClick={() => moveItem(item.id, "up")} disabled={idx === 0}>↑</button>
              <button type="button" onClick={() => moveItem(item.id, "down")} disabled={idx === items.length - 1}>↓</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ScheduleWidget({ entries = [], threadTitle = "schedule" }) {
  const [items, setItems] = useState(
    entries.map((entry, index) => ({
      id: `${index}-${entry.text.slice(0, 24)}`,
      time: entry.time || "",
      text: entry.text,
      done: false,
    })),
  );

  useEffect(() => {
    setItems(entries.map((entry, index) => ({
      id: `${index}-${entry.text.slice(0, 24)}`,
      time: entry.time || "",
      text: entry.text,
      done: false,
    })));
  }, [entries]);

  function toggleDone(id) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  }

  function moveItem(id, direction) {
    setItems((current) => {
      const idx = current.findIndex((item) => item.id === id);
      if (idx < 0) return current;
      const nextIndex = direction === "up" ? idx - 1 : idx + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(idx, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  }

  function exportCalendar() {
    const active = items.filter((item) => !item.done).map((item) => item.text);
    const payload = buildCalendarIcs(active.length ? active : items.map((item) => item.text));
    const blob = new Blob([payload], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${toSafeFileName(threadTitle)}-schedule.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!items.length) return null;

  return (
    <section className="schedule-widget" aria-label="Schedule widget">
      <header className="schedule-widget-head">
        <h3>Schedule</h3>
        <div className="controls">
          <button type="button" className="primary" onClick={exportCalendar}>Add to Calendar</button>
        </div>
      </header>
      <div className="schedule-list">
        {items.map((item, idx) => (
          <article key={item.id} className={`schedule-item ${item.done ? "done" : ""}`}>
            <label className="schedule-item-main">
              <input type="checkbox" checked={item.done} onChange={() => toggleDone(item.id)} />
              <span className="schedule-text-wrap">
                {item.time ? <strong>{item.time}</strong> : null}
                <span>{item.text}</span>
              </span>
            </label>
            <div className="controls">
              <button type="button" onClick={() => moveItem(item.id, "up")} disabled={idx === 0}>↑</button>
              <button type="button" onClick={() => moveItem(item.id, "down")} disabled={idx === items.length - 1}>↓</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const DOCUMENT_ANALYSIS_TABS = [
  { key: "findings", label: "Key Findings" },
  { key: "risks", label: "Risks" },
  { key: "questions", label: "Open Questions" },
  { key: "sources", label: "Sources" },
];

function DocumentAnalysisWidget({ sections = {}, threadTitle = "analysis" }) {
  const firstTab = DOCUMENT_ANALYSIS_TABS.find((tab) => (sections[tab.key] || []).length)?.key || "findings";
  const [activeTab, setActiveTab] = useState(firstTab);
  const [flagged, setFlagged] = useState({});

  useEffect(() => {
    const nextFirst = DOCUMENT_ANALYSIS_TABS.find((tab) => (sections[tab.key] || []).length)?.key || "findings";
    setActiveTab(nextFirst);
    setFlagged({});
  }, [sections]);

  const hasAny = DOCUMENT_ANALYSIS_TABS.some((tab) => (sections[tab.key] || []).length);
  if (!hasAny) return null;

  const activeItems = sections[activeTab] || [];

  function toggleFlag(item) {
    setFlagged((current) => ({ ...current, [item]: !current[item] }));
  }

  function exportSection() {
    const items = sections[activeTab] || [];
    const title = DOCUMENT_ANALYSIS_TABS.find((tab) => tab.key === activeTab)?.label || "Analysis";
    const body = [`${title}`, "", ...items.map((item, idx) => `${idx + 1}. ${item}`)].join("\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${toSafeFileName(threadTitle)}-${toSafeFileName(activeTab)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="analysis-widget" aria-label="Document analysis widget">
      <header className="analysis-widget-head">
        <h3>Document analysis</h3>
        <div className="controls">
          <button type="button" onClick={exportSection}>Export active section</button>
        </div>
      </header>
      <div className="analysis-tab-row" role="tablist" aria-label="Analysis sections">
                    {DOCUMENT_ANALYSIS_TABS.map((tab) => {
          const count = (sections[tab.key] || []).length;
          if (!count) return null;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`analysis-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.label}</span>
              <small>{count}</small>
            </button>
          );
        })}
      </div>
      <div className="analysis-list">
        {activeItems.map((item, idx) => (
          <article key={`${activeTab}-${idx}`} className={`analysis-item ${flagged[item] ? "flagged" : ""}`}>
            <p>{item}</p>
            <button type="button" onClick={() => toggleFlag(item)}>{flagged[item] ? "Unflag" : "Flag"}</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function CitationSuperscripts({ citations = [], onSourceOpen = () => {} }) {
  const [openId, setOpenId] = useState("");

  if (!citations.length) return null;

  return (
    <span className="citation-superscripts">
      {citations.map((source, idx) => {
        const sourceId = source.id || `${source.title || "source"}-${idx}`;
        const url = source.url || "";
        let domain = "source";
        try {
          domain = url ? new URL(url).hostname : "source";
        } catch {
          domain = "source";
        }
        return (
          <span
            key={sourceId}
            className="citation-sup-wrap"
            onMouseEnter={() => setOpenId(sourceId)}
            onMouseLeave={() => setOpenId("")}
          >
            <sup>
              <button
                type="button"
                className="citation-sup"
                onClick={() => {
                  onSourceOpen(source, idx);
                  if (url) window.open(url, "_blank", "noopener,noreferrer");
                }}
              >
                {idx + 1}
              </button>
            </sup>
            {openId === sourceId ? (
              <div className="source-hover-card">
                <strong>{source.title || `Source ${idx + 1}`}</strong>
                <p>{domain}</p>
                <p className="source-excerpt">{source.excerpt || "No excerpt available for this citation."}</p>
              </div>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

function MermaidBlock({ chart }) {
  const [svg, setSvg] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!chart.trim()) return;
    if (!mermaidInitialized) {
      mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "neutral" });
      mermaidInitialized = true;
    }

    const id = `m-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, chart)
      .then(({ svg: svgOutput }) => setSvg(svgOutput))
      .catch(() => {
        setSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="64"><text x="16" y="36" font-size="14">Unable to render diagram.</text></svg>`);
      });
  }, [chart]);

  if (!svg) return <div className="mermaid-loading">Rendering diagram...</div>;

  return (
    <>
      <button type="button" className="mermaid-wrap" onClick={() => setExpanded(true)}>
        <span dangerouslySetInnerHTML={{ __html: svg }} />
      </button>
      {expanded ? (
        <div className="lightbox" onClick={() => setExpanded(false)}>
          <div className="lightbox-content mermaid-expanded" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="lightbox-close" onClick={() => setExpanded(false)}>Close</button>
            <span dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function CodeBlock({ language, meta, code }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const parsed = useMemo(() => parseFenceHeader(language, meta), [language, meta]);

  const lines = code.split("\n");
  const collapsed = !expanded && lines.length > 40;

  return (
    <div className="code-block-wrap">
      <div className="code-header">
        <span>{parsed.filename || parsed.language || "code"}</span>
        <div className="code-actions">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1000);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button">Open in Canvas</button>
        </div>
      </div>
      <SyntaxHighlighter language={parsed.language || "text"} style={oneDark} customStyle={{ margin: 0, borderRadius: 0 }}>
        {collapsed ? `${lines.slice(0, 40).join("\n")}\n...` : code}
      </SyntaxHighlighter>
      {lines.length > 40 ? (
        <button type="button" className="expand-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : `... ${lines.length - 40} more lines`}
        </button>
      ) : null}
    </div>
  );
}

function MarkdownBody({ content, onOpenImage }) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);
  const lines = content.split("\n");
  const collapsed = !expanded && lines.length > 48;
  const displayContent = collapsed ? lines.slice(0, 48).join("\n") : content;
  const headings = useMemo(() => extractHeadings(content), [content]);
  const showToc = content.length > 800 && headings.length >= 2;
  const headingCursorRef = useRef(0);

  headingCursorRef.current = 0;

  function jumpToSection(id) {
    const scrollToTarget = () => {
      const target = containerRef.current?.querySelector(`#${id}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (collapsed) {
      setExpanded(true);
      window.setTimeout(scrollToTarget, 80);
      return;
    }
    scrollToTarget();
  }

  return (
    <div className="md-layout" ref={containerRef}>
      <div className="md-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code({ node, inline, className, children, ...props }) {
              if (inline) {
                return <code className="inline-code" {...props}>{children}</code>;
              }
              const raw = String(children || "").replace(/\n$/, "");
              const lang = node?.lang || className?.replace("language-", "") || "";
              const meta = node?.meta || "";
              const parsed = parseFenceHeader(lang, meta);
              if (parsed.language === "mermaid") {
                return <MermaidBlock chart={raw} />;
              }
              return <CodeBlock language={lang} meta={meta} code={raw} />;
            },
            img({ src = "", alt = "" }) {
              return (
                <button type="button" className="md-image-wrap" onClick={() => onOpenImage(src, alt)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={alt} loading="lazy" className="md-image" />
                </button>
              );
            },
            h1({ children, ...props }) {
              const entry = headings[headingCursorRef.current] || { id: `section-${headingCursorRef.current}` };
              headingCursorRef.current += 1;
              return <h1 id={entry.id} className={headingClasses(1, children)} {...props}>{children}</h1>;
            },
            h2({ children, ...props }) {
              const entry = headings[headingCursorRef.current] || { id: `section-${headingCursorRef.current}` };
              headingCursorRef.current += 1;
              return <h2 id={entry.id} className={headingClasses(2, children)} {...props}>{children}</h2>;
            },
            h3({ children, ...props }) {
              const entry = headings[headingCursorRef.current] || { id: `section-${headingCursorRef.current}` };
              headingCursorRef.current += 1;
              return <h3 id={entry.id} className={headingClasses(3, children)} {...props}>{children}</h3>;
            },
            h4({ children, ...props }) {
              const entry = headings[headingCursorRef.current] || { id: `section-${headingCursorRef.current}` };
              headingCursorRef.current += 1;
              return <h4 id={entry.id} className={headingClasses(4, children)} {...props}>{children}</h4>;
            },
          }}
        >
          {displayContent}
        </ReactMarkdown>
        {lines.length > 48 ? (
          <button type="button" className="expand-toggle" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : `... ${lines.length - 48} more lines`}
          </button>
        ) : null}
      </div>
      {showToc ? (
        <aside className="message-toc" aria-label="Table of contents">
          <p className="toc-label">On this response</p>
          <div className="toc-list">
            {headings.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`toc-item level-${item.level}`}
                onClick={() => jumpToSection(item.id)}
              >
                {item.text}
              </button>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function MessageRow({
  message,
  index,
  assistantName,
  fileLookup,
  onOpenAttachment,
  onCopy,
  onRegenerate,
  onTransform,
  onEditSave,
  onThumb,
  onMoreAction,
  onBranch,
  onCreateArtifact,
  onSourceOpen,
  onFollowup = () => {},
}) {
  const [hovered, setHovered] = useState(false);
  const [showFullDate, setShowFullDate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [draft, setDraft] = useState(message.content || "");
  const [imageLightbox, setImageLightbox] = useState({ src: "", alt: "" });
  const hoverTimerRef = useRef(null);

  useEffect(() => {
    setDraft(message.content || "");
  }, [message.content]);

  const ts = message.ts ? new Date(message.ts) : new Date();
  const shortTs = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fullTs = ts.toLocaleString();

  const isUser = message.role === "user";
  const {
    immediateActions,
    scheduleEntries,
    analysisSections,
    contentWithoutWidgets,
  } = useMemo(
    () => (
      isUser
        ? {
            immediateActions: [],
            scheduleEntries: [],
            analysisSections: { findings: [], risks: [], questions: [], sources: [] },
            contentWithoutWidgets: message.content || "",
          }
        : parseStructuredAssistantContent(message.content || "")
    ),
    [isUser, message.content],
  );

  return (
    <article
      className={`message-shell ${isUser ? "user" : "assistant"}`}
      id={`m-${message.id}`}
      data-pinned={message.pinned ? "true" : "false"}
      data-agent={isUser ? "false" : "true"}
      onMouseEnter={() => {
        setHovered(true);
        hoverTimerRef.current = window.setTimeout(() => setShowFullDate(true), 2000);
      }}
      onMouseLeave={() => {
        setHovered(false);
        setShowFullDate(false);
        if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
      }}
    >
      <div className="message-avatar" aria-hidden="true">
        {isUser ? "Y" : "A"}
      </div>
      <div className={`message-main ${isUser ? "" : "assistant-main"}`.trim()}>
        <div className="message-meta-row">
          <span className={`role-label ${isUser ? "" : "assistant-role-label"}`.trim()}>{isUser ? "You" : assistantName}</span>
          {hovered ? <span className="msg-time">{showFullDate ? fullTs : shortTs}</span> : null}
        </div>

        {editing && isUser ? (
          <div className="edit-wrap">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} />
            <div className="controls">
              <button type="button" className="primary" onClick={() => {
                onEditSave(index, draft);
                setEditing(false);
              }}>
                Save and regenerate
              </button>
              <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <MarkdownBody
              content={contentWithoutWidgets || ""}
              onOpenImage={(src, alt) => setImageLightbox({ src, alt })}
            />
            {!isUser && immediateActions.length ? (
              <ImmediateActionsWidget tasks={immediateActions} threadTitle={assistantName || "assistant"} />
            ) : null}
            {!isUser && scheduleEntries.length ? (
              <ScheduleWidget entries={scheduleEntries} threadTitle={assistantName || "assistant"} />
            ) : null}
            {!isUser && Object.values(analysisSections || {}).some((items) => items?.length) ? (
              <DocumentAnalysisWidget sections={analysisSections} threadTitle={assistantName || "assistant"} />
            ) : null}
            {message.attachments?.length ? (
              <div className="message-attachment-row">
                {message.attachments.map((fileId) => {
                  const file = fileLookup[fileId];
                  if (!file) return null;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      className="message-attachment-chip"
                      onClick={() => onOpenAttachment(file.id)}
                    >
                      <span>{file.kind === "image" ? "🖼" : file.kind === "code" ? "</>" : file.kind === "data" ? "📊" : "📄"}</span>
                      <span title={file.name}>{file.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <CitationSuperscripts citations={message.citations || []} onSourceOpen={onSourceOpen} />
            {!isUser && !message.streaming ? (
              <div className="followup-row" aria-label="Follow-up suggestions">
                {buildFollowupSuggestions(message.content || "").slice(0, 3).map((suggestion) => (
                  <button
                    key={`${message.id}-${suggestion}`}
                    type="button"
                    className="followup-chip"
                    onClick={() => onFollowup(suggestion, message.content || "")}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className={`message-actions ${hovered ? "visible" : ""}`}>
        <button type="button" onClick={() => onCopy(message.content || "")}>Copy</button>
        {!isUser ? <button type="button" onClick={() => onRegenerate(index)}>Retry</button> : null}
        {!isUser ? <button type="button" onClick={() => onTransform(index, "shorter")}>Make shorter</button> : null}
        {!isUser ? <button type="button" onClick={() => onTransform(index, "deeper")}>Go deeper</button> : null}
        {!isUser ? <button type="button" onClick={() => onTransform(index, "table")}>Format as table</button> : null}
        {isUser ? <button type="button" onClick={() => setEditing(true)}>Edit</button> : null}
        <button type="button" onClick={() => onThumb(index, "up")}>👍</button>
        <button type="button" onClick={() => onThumb(index, "down")}>👎</button>
        <div className="more-wrap">
          <button type="button" onClick={() => setMoreOpen((v) => !v)}>⋯</button>
          {moreOpen ? (
            <div className="more-menu">
              <button type="button" onClick={() => { onMoreAction(index, "pin"); setMoreOpen(false); }}>
                {message.pinned ? "Unpin" : "Pin"}
              </button>
              <button type="button" onClick={() => { onMoreAction(index, "copy-link"); setMoreOpen(false); }}>Copy deep link</button>
              {!isUser ? <button type="button" onClick={() => { onBranch(index); setMoreOpen(false); }}>Start branch from here</button> : null}
              {!isUser ? <button type="button" onClick={() => { onCreateArtifact(index); setMoreOpen(false); }}>Create artifact draft</button> : null}
              <button type="button" onClick={() => { onMoreAction(index, "export-md"); setMoreOpen(false); }}>Export markdown</button>
              <button type="button" onClick={() => { onMoreAction(index, "delete"); setMoreOpen(false); }}>Delete</button>
            </div>
          ) : null}
        </div>
      </div>

      {imageLightbox.src ? (
        <div className="lightbox" onClick={() => setImageLightbox({ src: "", alt: "" })}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="lightbox-close" onClick={() => setImageLightbox({ src: "", alt: "" })}>Close</button>
            <Image src={imageLightbox.src} alt={imageLightbox.alt || "Preview image"} width={1280} height={800} className="lightbox-image" unoptimized />
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function MessageRenderer({
  messages,
  assistantName = "Assistant",
  fileLookup = {},
  onOpenAttachment = () => {},
  onRegenerate,
  onTransform = () => {},
  onEditSave,
  onThumb,
  onMoreAction,
  onBranch = () => {},
  onCreateArtifact = () => {},
  onSourceOpen = () => {},
  onFollowup = () => {},
  isStreaming,
  scrollHostRef,
}) {
  const containerRef = useRef(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [showNewPill, setShowNewPill] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(500);
  const [virtualOffset, setVirtualOffset] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setViewportHeight(Math.max(220, Math.floor(entry.contentRect.height)));
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const scrollNode = scrollHostRef?.current || containerRef.current;

  useEffect(() => {
    if (!scrollNode) return;
    if (isPinnedToBottom) {
      scrollNode.scrollTop = scrollNode.scrollHeight;
      setShowNewPill(false);
      return;
    }
    setShowNewPill(true);
  }, [isPinnedToBottom, isStreaming, messages, scrollNode]);

  const virtualized = messages.length > 500;
  const itemHeight = 260;
  const overscan = 4;
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
  const virtualStart = Math.max(0, Math.floor(virtualOffset / itemHeight) - overscan);
  const virtualEnd = Math.min(messages.length, virtualStart + visibleCount);
  const virtualItems = messages.slice(virtualStart, virtualEnd);

  useEffect(() => {
    if (!scrollNode) return;
    const handleScroll = () => {
      const node = scrollNode;
      const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
      setIsPinnedToBottom(nearBottom);
      if (nearBottom) setShowNewPill(false);
    };
    scrollNode.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollNode.removeEventListener("scroll", handleScroll);
  }, [scrollNode]);

  function handleScroll(e) {
    const node = e.currentTarget;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
    setIsPinnedToBottom(nearBottom);
    if (nearBottom) setShowNewPill(false);
  }

  function handleCopy(text) {
    navigator.clipboard.writeText(text || "");
  }

  return (
    <div className="message-renderer" ref={containerRef} onScroll={handleScroll}>
      {virtualized ? (
        <div
          className="virtualized-container"
          style={{ height: viewportHeight }}
          onScroll={(e) => {
            setVirtualOffset(e.currentTarget.scrollTop);
            handleScroll(e);
          }}
        >
          <div style={{ height: messages.length * itemHeight, position: "relative" }}>
            <div style={{ transform: `translateY(${virtualStart * itemHeight}px)` }}>
              {virtualItems.map((message, idx) => (
                <div className="virtualized-row" key={message.id}>
                  <MessageRow
                    message={message}
                    index={virtualStart + idx}
                    assistantName={assistantName}
                    fileLookup={fileLookup}
                    onOpenAttachment={onOpenAttachment}
                    onCopy={handleCopy}
                    onRegenerate={onRegenerate}
                    onTransform={onTransform}
                    onEditSave={onEditSave}
                    onThumb={onThumb}
                    onMoreAction={onMoreAction}
                    onBranch={onBranch}
                    onCreateArtifact={onCreateArtifact}
                    onSourceOpen={onSourceOpen}
                    onFollowup={onFollowup}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="message-list-advanced">
          {messages.map((message, idx) => (
            <MessageRow
              key={message.id}
              message={message}
              index={idx}
              assistantName={assistantName}
              fileLookup={fileLookup}
              onOpenAttachment={onOpenAttachment}
              onCopy={handleCopy}
              onRegenerate={onRegenerate}
              onTransform={onTransform}
              onEditSave={onEditSave}
              onThumb={onThumb}
              onMoreAction={onMoreAction}
              onBranch={onBranch}
              onCreateArtifact={onCreateArtifact}
              onSourceOpen={onSourceOpen}
              onFollowup={onFollowup}
            />
          ))}
        </div>
      )}

      {showNewPill ? (
        <button
          type="button"
          className="new-messages-pill"
          onClick={() => {
            const node = scrollHostRef?.current || containerRef.current;
            if (!node) return;
            node.scrollTop = node.scrollHeight;
            setIsPinnedToBottom(true);
            setShowNewPill(false);
          }}
        >
          ↓ New messages
        </button>
      ) : null}
    </div>
  );
}
