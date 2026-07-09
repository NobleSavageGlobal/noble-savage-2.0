"use client";

/**
 * EmptyState Component
 * Friendly empty state with illustration, message, and CTA.
 * Reduces user confusion and guides next action.
 */
export default function EmptyState({
  icon = "📭",
  title = "Nothing here yet",
  description = "Start by performing an action or creating new content.",
  ctaLabel = "Get started",
  ctaAction,
  variant = "default", // "default" | "onboarding" | "error"
}) {
  const variants = {
    default: {
      bgColor: "var(--surface-2)",
      borderColor: "var(--line)",
      textColor: "var(--soft-ink)",
      ctaBg: "var(--accent)",
      ctaText: "var(--on-accent)",
    },
    onboarding: {
      bgColor: "color-mix(in oklab, var(--accent) 8%, var(--panel))",
      borderColor: "color-mix(in oklab, var(--accent) 20%, var(--line))",
      textColor: "var(--ink)",
      ctaBg: "var(--accent)",
      ctaText: "var(--on-accent)",
    },
    error: {
      bgColor: "color-mix(in oklab, var(--danger) 8%, var(--panel))",
      borderColor: "color-mix(in oklab, var(--danger) 20%, var(--line))",
      textColor: "var(--danger)",
      ctaBg: "var(--danger)",
      ctaText: "var(--on-accent)",
    },
  };

  const style = variants[variant] || variants.default;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-5)",
        padding: "var(--space-8) var(--space-4)",
        minHeight: "300px",
        backgroundColor: style.bgColor,
        border: `1px dashed ${style.borderColor}`,
        borderRadius: "var(--radius-card)",
        textAlign: "center",
      }}
    >
      {/* Icon */}
      <div style={{ fontSize: "48px" }}>{icon}</div>

      {/* Text */}
      <div style={{ maxWidth: "280px" }}>
        <h3 style={{ fontSize: "var(--fs-18)", fontWeight: "600", color: style.textColor, margin: 0 }}>
          {title}
        </h3>
        <p style={{ fontSize: "var(--fs-14)", color: style.textColor, margin: "var(--space-2) 0 0", opacity: 0.8 }}>
          {description}
        </p>
      </div>

      {/* CTA Button */}
      {ctaAction && (
        <button
          onClick={ctaAction}
          style={{
            padding: "var(--space-3) var(--space-5)",
            backgroundColor: style.ctaBg,
            color: style.ctaText,
            border: "none",
            borderRadius: "var(--radius-control)",
            fontSize: "var(--fs-14)",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
            e.currentTarget.style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
