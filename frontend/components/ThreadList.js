"use client";

/**
 * ThreadItem Component
 * Single thread row with preview, timestamp, and metadata.
 * Better visual hierarchy than generic text.
 */
function ThreadItem({
  id,
  title,
  preview,
  lastActivity,
  isActive = false,
  isUnread = false,
  messageCount = 0,
  onClick,
}) {
  const formatTime = (date) => {
    if (!date) return "";
    const now = new Date();
    const diff = now - new Date(date);
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        width: "100%",
        padding: "var(--space-3)",
        border: isActive ? "1px solid var(--accent)" : "1px solid var(--line)",
        backgroundColor: isActive ? "color-mix(in oklab, var(--accent) 12%, var(--panel))" : "transparent",
        borderRadius: "var(--radius-control)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        textAlign: "left",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "var(--surface-2)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      {/* Row 1: Title + metadata */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--fs-14)",
              fontWeight: "600",
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
        </div>
        {isUnread && (
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "var(--accent)",
              flexShrink: 0,
            }}
            title="Unread"
          />
        )}
      </div>

      {/* Row 2: Preview text */}
      {preview && (
        <div
          style={{
            fontSize: "var(--fs-12)",
            color: "var(--soft-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 1,
            lineClamp: 1,
          }}
        >
          {preview}
        </div>
      )}

      {/* Row 3: Metadata footer */}
      <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "var(--fs-12)", color: "var(--soft-ink)" }}>
        {lastActivity && <span>{formatTime(lastActivity)}</span>}
        {messageCount > 0 && <span>{messageCount} messages</span>}
      </div>
    </button>
  );
}

/**
 * ThreadList Component
 * Vertical list of threads with search and filtering.
 */
export default function ThreadList({
  threads = [],
  activeThreadId,
  onSelectThread,
  onNewThread,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      {/* Action: New Thread */}
      <button
        onClick={onNewThread}
        style={{
          width: "100%",
          padding: "var(--space-3)",
          backgroundColor: "var(--accent)",
          color: "var(--on-accent)",
          border: "none",
          borderRadius: "var(--radius-control)",
          fontSize: "var(--fs-14)",
          fontWeight: "600",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.9";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        + New thread
      </button>

      {/* Thread items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {threads.length === 0 ? (
          <div style={{ padding: "var(--space-4)", color: "var(--soft-ink)", fontSize: "var(--fs-12)" }}>
            No threads yet. Start a new conversation.
          </div>
        ) : (
          threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              id={thread.id}
              title={thread.title || "Untitled thread"}
              preview={thread.preview}
              lastActivity={thread.lastActivity}
              isActive={activeThreadId === thread.id}
              isUnread={thread.unread}
              messageCount={thread.messageCount}
              onClick={() => onSelectThread(thread.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
