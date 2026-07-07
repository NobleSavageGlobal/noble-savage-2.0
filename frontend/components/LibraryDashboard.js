"use client";

import Image from "next/image";

function matchesDate(file, dateFilter) {
  if (dateFilter === "all") return true;
  const now = Date.now();
  const age = now - file.createdAt;
  if (dateFilter === "24h") return age <= 24 * 60 * 60 * 1000;
  if (dateFilter === "7d") return age <= 7 * 24 * 60 * 60 * 1000;
  if (dateFilter === "30d") return age <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

function typeIcon(type) {
  if (type === "image") return "🖼";
  if (type === "document") return "📄";
  if (type === "code") return "</>";
  if (type === "data") return "📊";
  if (type === "audio") return "🎧";
  return "📎";
}

export default function LibraryDashboard({
  files,
  threads,
  selected,
  lastSelectedIndex,
  setLastSelectedIndex,
  onToggleSelect,
  onBulkAction,
  onOpen,
  onAddToNewChat,
  onDownload,
  onDelete,
  view,
  setView,
  filters,
  setFilters,
  onPickUpload,
  formatBytes,
}) {
  const filtered = files.filter((file) => {
    if (filters.type !== "all" && file.kind !== filters.type) return false;
    if (filters.source !== "all" && file.source !== filters.source) return false;
    if (!matchesDate(file, filters.date)) return false;
    if (filters.project !== "all" && (file.project || "none") !== filters.project) return false;
    return true;
  });

  const recent = [...files].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

  function threadUsage(fileId) {
    return threads
      .filter((thread) => thread.messages.some((message) => (message.attachments || []).includes(fileId)))
      .map((thread) => thread.title)
      .slice(0, 3);
  }

  return (
    <section className="library-dashboard">
      <header className="library-dash-head">
        <div>
          <h2>Library</h2>
          <p className="notice">All uploads and generated artifacts in one place.</p>
        </div>
        <div className="controls">
          <button type="button" className={view === "grid" ? "primary" : ""} onClick={() => setView("grid")}>Grid</button>
          <button type="button" className={view === "list" ? "primary" : ""} onClick={() => setView("list")}>List</button>
          <button type="button" className="primary" onClick={() => onPickUpload("dashboard")}>Upload files</button>
        </div>
      </header>

      <div className="library-filters">
        <select value={filters.type} onChange={(e) => setFilters((v) => ({ ...v, type: e.target.value }))}>
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="document">Documents</option>
          <option value="code">Code</option>
          <option value="data">Data</option>
          <option value="audio">Audio</option>
        </select>
        <select value={filters.source} onChange={(e) => setFilters((v) => ({ ...v, source: e.target.value }))}>
          <option value="all">Any source</option>
          <option value="uploaded">Uploaded</option>
          <option value="generated">Generated</option>
        </select>
        <select value={filters.date} onChange={(e) => setFilters((v) => ({ ...v, date: e.target.value }))}>
          <option value="all">Any date</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7d</option>
          <option value="30d">Last 30d</option>
        </select>
        <select value={filters.project} onChange={(e) => setFilters((v) => ({ ...v, project: e.target.value }))}>
          <option value="all">Any project</option>
          <option value="none">No project</option>
          <option value="Personal OS">Personal OS</option>
          <option value="Client Ops">Client Ops</option>
          <option value="Archive Research">Archive Research</option>
        </select>
      </div>

      {selected.length ? (
        <div className="library-bulk-row">
          <span>{selected.length} selected</span>
          <div className="controls">
            <button type="button" onClick={() => onBulkAction("add-to-chat")}>Add to chat</button>
            <button type="button" onClick={() => onBulkAction("move-project")}>Move to project</button>
            <button type="button" onClick={() => onBulkAction("delete")}>Delete</button>
          </div>
        </div>
      ) : null}

      {!files.length ? (
        <div className="library-empty-inviting">
          <h3>Your workspace library starts here</h3>
          <p className="notice">Upload your first file, or explore recent activity from active threads.</p>
          <button type="button" className="primary" onClick={() => onPickUpload("dashboard")}>Upload your first file</button>
          <div className="library-recent-row">
            {[
              { name: "Morning-Brief.pdf", kind: "document" },
              { name: "Roadmap.csv", kind: "data" },
              { name: "Architecture.ts", kind: "code" },
            ].map((item) => (
              <article key={item.name} className="recent-placeholder">
                <strong>{item.name}</strong>
                <p>{typeIcon(item.kind)} {item.kind}</p>
              </article>
            ))}
          </div>
        </div>
      ) : view === "grid" ? (
        <div className="library-grid">
          {filtered.map((file, index) => {
            const usage = threadUsage(file.id);
            return (
              <article key={file.id} className={`file-card ${selected.includes(file.id) ? "selected" : ""}`}>
                <label className="file-select">
                  <input
                    type="checkbox"
                    checked={selected.includes(file.id)}
                    onChange={(e) => onToggleSelect(file.id, index, e.nativeEvent.shiftKey, lastSelectedIndex)}
                    onClick={() => setLastSelectedIndex(index)}
                  />
                </label>
                <div className="file-preview">
                  {file.previewUrl && file.kind === "image" ? (
                    <Image src={file.previewUrl} alt={file.name} width={220} height={120} className="file-preview-img" unoptimized />
                  ) : (
                    <div className="file-preview-fallback">
                      <span>{typeIcon(file.kind)}</span>
                      <small>
                        {file.kind === "code" && file.lineCount ? `${file.lineCount} lines` : null}
                        {file.kind === "data" && file.rowCount ? `${file.rowCount} rows` : null}
                        {file.kind === "document" ? "PDF / DOCX" : null}
                      </small>
                    </div>
                  )}
                </div>
                <div className="file-meta">
                  <strong title={file.name}>{file.name}</strong>
                  <p>{formatBytes(file.size)} · {file.kind}</p>
                  <div className="file-progress-track">
                    <span className="file-progress-fill" style={{ width: `${file.progress || 0}%` }} />
                  </div>
                  <p>{file.progress || 0}% uploaded</p>
                  {file.extractReady ? <span className="badge">Extraction ready</span> : null}
                  <p className="muted">Used in: {usage.length ? usage.join(", ") : "none"}</p>
                </div>
                <div className="controls file-actions">
                  <button type="button" onClick={() => onOpen(file.id)}>Open</button>
                  <button type="button" onClick={() => onAddToNewChat(file.id)}>Add to new chat</button>
                  <button type="button" onClick={() => onDownload(file.id)}>Download</button>
                  <button type="button" onClick={() => onDelete(file.id)}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="library-list">
          {filtered.map((file, index) => {
            const usage = threadUsage(file.id);
            return (
              <article key={file.id} className={`file-row ${selected.includes(file.id) ? "selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={selected.includes(file.id)}
                  onChange={(e) => onToggleSelect(file.id, index, e.nativeEvent.shiftKey, lastSelectedIndex)}
                  onClick={() => setLastSelectedIndex(index)}
                />
                <span>{typeIcon(file.kind)}</span>
                <strong title={file.name}>{file.name}</strong>
                <span>{formatBytes(file.size)}</span>
                <span>{file.extractReady ? "ready" : file.processing ? `${file.progress || 0}%` : "uploaded"}</span>
                <span title={usage.join(", ")}>{usage.length ? usage.join(", ") : "none"}</span>
                <div className="controls">
                  <button type="button" onClick={() => onOpen(file.id)}>Open</button>
                  <button type="button" onClick={() => onDownload(file.id)}>Download</button>
                  <button type="button" onClick={() => onDelete(file.id)}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {files.length ? (
        <section className="library-recent-block">
          <h3>Recent files</h3>
          <div className="library-recent-row">
            {recent.map((file) => (
              <button key={file.id} type="button" className="recent-file-chip" onClick={() => onOpen(file.id)}>
                {typeIcon(file.kind)} {file.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
