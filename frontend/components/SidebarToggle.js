"use client";

/**
 * SidebarToggle — Simple button to collapse/expand right sidebar
 * Place this in the workspace rail header
 */
export default function SidebarToggle({ isOpen, onToggle, label = "Workspace panel" }) {
  return (
    <button
      className="sidebar-collapse-button"
      onClick={onToggle}
      title={isOpen ? `Hide ${label} (Cmd+Shift+R)` : `Show ${label} (Cmd+Shift+R)`}
      aria-label={isOpen ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={isOpen}
    >
      {isOpen ? "✕" : "⋯"}
    </button>
  );
}
