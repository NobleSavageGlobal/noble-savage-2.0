"use client";

/**
 * TokenIndicator Component
 * Floating indicator showing token usage and rate limits.
 * Positioned in chat header, always visible without obscuring content.
 */
export default function TokenIndicator({ used = 0, limit = 8000, status = "normal" }) {
  const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const remaining = Math.max(0, limit - used);

  // Status colors: normal (green) → warning (yellow) → critical (red)
  let statusColor = "#34d399"; // emerald
  let statusBg = "#ecfdf5";
  if (status === "warning" || percentage >= 75) {
    statusColor = "#f59e0b"; // amber
    statusBg = "#fffbeb";
  }
  if (status === "critical" || percentage >= 90) {
    statusColor = "#ef4444"; // red
    statusBg = "#fef2f2";
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        backgroundColor: statusBg,
        border: `1px solid ${statusColor}`,
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: "500",
        color: statusColor,
        whiteSpace: "nowrap",
      }}
      title={`${remaining} tokens remaining of ${limit}`}
    >
      {/* Visual indicator dot */}
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: statusColor,
          flexShrink: 0,
        }}
      />
      {/* Text: usage / limit */}
      <span>{used}</span>
      <span style={{ opacity: 0.6 }}>/ {limit}</span>
      {/* Optional: show percentage for critical state */}
      {percentage >= 75 && <span style={{ opacity: 0.6 }}>({percentage}%)</span>}
    </div>
  );
}
