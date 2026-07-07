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
    return ["Give me a counter-argument", "Turn this into a checklist", "What is the first concrete step?"];
  }
  if (lower.includes("error") || lower.includes("bug") || lower.includes("trace")) {
    return ["Explain in simpler terms", "Show me likely root causes", "Give me a minimal fix first"];
  }
  return ["Explain in simpler terms", "Give me a counter-argument", "Turn this into a checklist"];
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

function CitationSuperscripts({ citations = [] }) {
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
        setSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="64"><text x="16" y="36" font-size="14">Unable to render Mermaid diagram.</text></svg>`);
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
          <button type="button">Open in canvas</button>
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
              return <h1 id={entry.id} {...props}>{children}</h1>;
            },
            h2({ children, ...props }) {
              const entry = headings[headingCursorRef.current] || { id: `section-${headingCursorRef.current}` };
              headingCursorRef.current += 1;
              return <h2 id={entry.id} {...props}>{children}</h2>;
            },
            h3({ children, ...props }) {
              const entry = headings[headingCursorRef.current] || { id: `section-${headingCursorRef.current}` };
              headingCursorRef.current += 1;
              return <h3 id={entry.id} {...props}>{children}</h3>;
            },
            h4({ children, ...props }) {
              const entry = headings[headingCursorRef.current] || { id: `section-${headingCursorRef.current}` };
              headingCursorRef.current += 1;
              return <h4 id={entry.id} {...props}>{children}</h4>;
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
  onEditSave,
  onThumb,
  onMoreAction,
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

  return (
    <article
      className={`message-shell ${isUser ? "user" : "assistant"}`}
      id={`m-${message.id}`}
      data-pinned={message.pinned ? "true" : "false"}
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
      <div className="message-main">
        <div className="message-meta-row">
          <span className="role-label">{isUser ? "You" : assistantName}</span>
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
                Save + regenerate
              </button>
              <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <MarkdownBody
              content={message.content || ""}
              onOpenImage={(src, alt) => setImageLightbox({ src, alt })}
            />
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
            <CitationSuperscripts citations={message.citations || []} />
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
        {!isUser ? <button type="button" onClick={() => onRegenerate(index)}>Regenerate</button> : null}
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
              <button type="button" onClick={() => { onMoreAction(index, "copy-link"); setMoreOpen(false); }}>Copy link</button>
              <button type="button" onClick={() => { onMoreAction(index, "export-md"); setMoreOpen(false); }}>Export .md</button>
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
  onEditSave,
  onThumb,
  onMoreAction,
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
                    onEditSave={onEditSave}
                    onThumb={onThumb}
                    onMoreAction={onMoreAction}
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
              onEditSave={onEditSave}
              onThumb={onThumb}
              onMoreAction={onMoreAction}
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
