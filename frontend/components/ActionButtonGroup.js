"use client";

/**
 * ActionButtonGroup Component
 * Clear iconography and labels for chat actions.
 * More discoverable than raw checkmarks or generic buttons.
 */
function ActionButton({ icon, label, onClick, variant = "default" }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        padding: "8px 12px",
        border: variant === "active" ? "2px solid var(--accent)" : "1px solid var(--line)",
        backgroundColor: variant === "active" ? "color-mix(in oklab, var(--accent) 12%, var(--panel))" : "transparent",
        borderRadius: "var(--radius-control)",
        cursor: "pointer",
        fontSize: "var(--fs-12)",
        fontWeight: "500",
        color: variant === "active" ? "var(--accent)" : "var(--soft-ink)",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (variant !== "active") {
          e.currentTarget.style.backgroundColor = "var(--surface-2)";
          e.currentTarget.style.color = "var(--ink)";
        }
      }}
      onMouseLeave={(e) => {
        if (variant !== "active") {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--soft-ink)";
        }
      }}
      title={label}
    >
      <span style={{ fontSize: "18px" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function ActionButtonGroup({
  onAddToBoard,
  onExport,
  onAddToCalendar,
  onCopy,
  onFeedback,
  isActive = {},
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-2)",
        flexWrap: "wrap",
        padding: "var(--space-3)",
        backgroundColor: "var(--surface-2)",
        borderRadius: "var(--radius-control)",
      }}
    >
      <ActionButton
        icon="📋"
        label="Board"
        onClick={() => onAddToBoard?.()}
        variant={isActive.board ? "active" : "default"}
      />
      <ActionButton
        icon="📊"
        label="Export"
        onClick={() => onExport?.()}
        variant={isActive.export ? "active" : "default"}
      />
      <ActionButton
        icon="📅"
        label="Calendar"
        onClick={() => onAddToCalendar?.()}
        variant={isActive.calendar ? "active" : "default"}
      />
      <ActionButton
        icon="📋"
        label="Copy"
        onClick={() => onCopy?.()}
        variant={isActive.copy ? "active" : "default"}
      />
      <ActionButton
        icon="👍"
        label="Helpful"
        onClick={() => onFeedback?.(true)}
        variant={isActive.helpful ? "active" : "default"}
      />
      <ActionButton
        icon="👎"
        label="Not helpful"
        onClick={() => onFeedback?.(false)}
        variant={isActive.notHelpful ? "active" : "default"}
      />
    </div>
  );
}
