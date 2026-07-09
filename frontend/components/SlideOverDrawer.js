"use client";

import { useCallback, useEffect } from "react";

/**
 * SlideOverDrawer Component
 * Responsive slide-over for library, settings, or supplementary content.
 * Collapses on mobile, restores desktop real estate.
 */
export default function SlideOverDrawer({
  isOpen = false,
  title = "Panel",
  onClose,
  children,
  position = "right", // "right" or "left"
  width = "320px",
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const isRtl = position === "left";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          zIndex: 999,
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          [position]: 0,
          width: width,
          height: "100vh",
          backgroundColor: "var(--panel)",
          borderLeft: position === "right" ? "1px solid var(--line)" : "none",
          borderRight: position === "left" ? "1px solid var(--line)" : "none",
          display: "flex",
          flexDirection: "column",
          zIndex: 1000,
          animation: `slideIn${isRtl ? "Left" : "Right"} 0.3s ease`,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-4)",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: "var(--fs-18)", fontWeight: "600" }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "var(--radius-control)",
              border: "1px solid var(--line)",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontSize: "var(--fs-16)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4)" }}>{children}</div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
