"use client";

/**
 * ModelSelector Component
 * Improved model selection with logos, capabilities, and descriptions.
 * More engaging than plain text dropdowns.
 */
export default function ModelSelector({
  models = [],
  selectedModel,
  onSelectModel,
  label = "Select a model",
}) {
  const modelIcons = {
    sonnet: "🎵",
    haiku: "🐦",
    opus: "🎭",
    "gpt-4": "🧠",
    "gpt-3.5": "⚡",
  };

  const modelCapabilities = {
    sonnet: ["Fast", "Balanced", "~200K context"],
    haiku: ["Lightweight", "Quick", "~100K context"],
    opus: ["Most capable", "Reasoning", "~200K context"],
    "gpt-4": ["Reasoning", "Vision", "~128K context"],
    "gpt-3.5": ["Fast", "Cost-effective", "~16K context"],
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <label style={{ fontSize: "var(--fs-12)", fontWeight: "600", color: "var(--soft-ink)" }}>
        {label}
      </label>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "var(--space-2)",
        }}
      >
        {models.map((model) => (
          <button
            key={model.id}
            onClick={() => onSelectModel(model.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-3)",
              border: selectedModel === model.id ? `2px solid var(--accent)` : "1px solid var(--line)",
              backgroundColor:
                selectedModel === model.id
                  ? "color-mix(in oklab, var(--accent) 12%, var(--panel))"
                  : "transparent",
              borderRadius: "var(--radius-control)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (selectedModel !== model.id) {
                e.currentTarget.style.backgroundColor = "var(--surface-2)";
              }
            }}
            onMouseLeave={(e) => {
              if (selectedModel !== model.id) {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            {/* Model icon */}
            <div style={{ fontSize: "24px" }}>
              {modelIcons[model.id] || "🤖"}
            </div>

            {/* Model name */}
            <div
              style={{
                fontSize: "var(--fs-13)",
                fontWeight: "600",
                color: "var(--ink)",
                textAlign: "center",
              }}
            >
              {model.label}
            </div>

            {/* Capabilities: tags */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", width: "100%" }}>
              {(modelCapabilities[model.id] || []).slice(0, 2).map((capability, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: "var(--fs-11)",
                    color: "var(--soft-ink)",
                    backgroundColor: "var(--surface-2)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {capability}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
