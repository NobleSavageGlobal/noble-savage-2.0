"use client";

import { useCallback, useState } from "react";

/**
 * CollapsibleSidebar Component
 * Groups related actions into collapsible sections with icons.
 * Reduces visual density and improves information hierarchy.
 */
export default function CollapsibleSidebar({
  sections = [],
  onSelectProject,
  onSelectAction,
  onToggleLibrary,
  activeProject,
}) {
  const [expandedSections, setExpandedSections] = useState({
    projects: true,
    actions: true,
    settings: false,
  });

  const toggleSection = useCallback((sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  const sectionIcons = {
    projects: "📋",
    actions: "⚡",
    settings: "⚙️",
    workspace: "💼",
  };

  return (
    <aside
      style={{
        width: "240px",
        backgroundColor: "var(--panel)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        maxHeight: "100vh",
        overflowY: "auto",
        padding: "var(--space-4)",
        gap: "var(--space-4)",
      }}
    >
      {/* Header */}
      <div style={{ paddingBottom: "var(--space-4)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontSize: "var(--fs-18)", fontWeight: "700", color: "var(--ink)" }}>
          NS OS
        </div>
        <div style={{ fontSize: "var(--fs-12)", color: "var(--soft-ink)", marginTop: "var(--space-1)" }}>
          Operator Console
        </div>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.id}>
          {/* Section Header: Collapsible */}
          <button
            onClick={() => toggleSection(section.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              width: "100%",
              border: "none",
              background: "transparent",
              padding: "var(--space-2)",
              cursor: "pointer",
              fontSize: "var(--fs-12)",
              fontWeight: "600",
              color: "var(--soft-ink)",
              transition: "color 0.15s ease",
              borderRadius: "var(--radius-control)",
            }}
            onMouseEnter={(e) => (e.target.style.color = "var(--ink)")}
            onMouseLeave={(e) => (e.target.style.color = "var(--soft-ink)")}
          >
            <span>{sectionIcons[section.id] || "📌"}</span>
            <span style={{ flex: 1, textAlign: "left" }}>{section.label}</span>
            <span
              style={{
                transform: expandedSections[section.id] ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            >
              ▼
            </span>
          </button>

          {/* Section Items: Expandable */}
          {expandedSections[section.id] && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => (item.action ? item.action() : onSelectProject?.(item.id))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    width: "100%",
                    padding: "var(--space-2) var(--space-3)",
                    border: activeProject === item.id ? "1px solid var(--accent)" : "1px solid transparent",
                    backgroundColor:
                      activeProject === item.id
                        ? "color-mix(in oklab, var(--accent) 12%, var(--panel))"
                        : "transparent",
                    color: activeProject === item.id ? "var(--accent)" : "var(--soft-ink)",
                    fontSize: "var(--fs-14)",
                    borderRadius: "var(--radius-control)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "color-mix(in oklab, var(--accent) 8%, var(--panel))";
                    e.currentTarget.style.color = "var(--ink)";
                  }}
                  onMouseLeave={(e) => {
                    if (activeProject !== item.id) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--soft-ink)";
                    }
                  }}
                >
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      style={{
                        marginLeft: "auto",
                        padding: "2px 6px",
                        backgroundColor: "var(--accent)",
                        color: "var(--on-accent)",
                        fontSize: "var(--fs-12)",
                        fontWeight: "600",
                        borderRadius: "var(--radius-pill)",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Footer Actions */}
      <div style={{ display: "flex", gap: "var(--space-2)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--line)" }}>
        <button
          onClick={() => onToggleLibrary?.()}
          style={{
            flex: 1,
            padding: "var(--space-3)",
            backgroundColor: "var(--surface-2)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-control)",
            color: "var(--ink)",
            fontSize: "var(--fs-12)",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent)";
            e.currentTarget.style.color = "var(--on-accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--surface-2)";
            e.currentTarget.style.color = "var(--ink)";
          }}
        >
          📚 Library
        </button>
      </div>
    </aside>
  );
}
