const themes = {
  light: {
    ink: "#0f172a",
    soft: "#334155",
    paper: "#f1f5f9",
    panel: "#ffffff",
    line: "#cbd5e1",
    surface2: "#eef4fb",
    accent: "#0f766e",
    accentCta: "#0f766e",
    onAccent: "#ffffff",
    danger: "#b91c1c",
  },
  dark: {
    ink: "#f1f5f9",
    soft: "#cbd5e1",
    paper: "#0b1220",
    panel: "#111827",
    line: "#334155",
    surface2: "#1e293b",
    accent: "#34d399",
    accentCta: "#0f766e",
    onAccent: "#ffffff",
    danger: "#fca5a5",
  },
};

const pairs = [
  { name: "Body text on paper", fg: "ink", bg: "paper", min: 7 },
  { name: "Body text on panel", fg: "ink", bg: "panel", min: 7 },
  { name: "Body text on surface-2", fg: "ink", bg: "surface2", min: 7 },
  { name: "Secondary text on paper", fg: "soft", bg: "paper", min: 4.5 },
  { name: "Secondary text on panel", fg: "soft", bg: "panel", min: 4.5 },
  { name: "Secondary text on surface-2", fg: "soft", bg: "surface2", min: 4.5 },
  { name: "Active accent text on panel", fg: "accent", bg: "panel", min: 4.5 },
  { name: "Primary CTA text", fg: "onAccent", bg: "accentCta", min: 4.5 },
  { name: "Danger text on panel", fg: "danger", bg: "panel", min: 4.5 },
  { name: "Danger text on paper", fg: "danger", bg: "paper", min: 4.5 },
];

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "").trim();
  const normalized = cleaned.length === 3
    ? cleaned.split("").map((char) => `${char}${char}`).join("")
    : cleaned;
  const int = parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function channelToLinear(channel) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rl = channelToLinear(r);
  const gl = channelToLinear(g);
  const bl = channelToLinear(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(foreground, background) {
  const l1 = luminance(foreground);
  const l2 = luminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

let hasFailures = false;

for (const [themeName, tokens] of Object.entries(themes)) {
  console.log(`\nTheme: ${themeName}`);
  for (const pair of pairs) {
    const fg = tokens[pair.fg];
    const bg = tokens[pair.bg];
    const ratio = contrastRatio(fg, bg);
    const pass = ratio >= pair.min;
    if (!pass) hasFailures = true;
    const status = pass ? "PASS" : "FAIL";
    console.log(`${status} ${pair.name}: ${ratio.toFixed(2)} (min ${pair.min}) [${fg} on ${bg}]`);
  }
}

if (hasFailures) {
  console.error("\nContrast audit failed: one or more pairs are below required minimum.");
  process.exit(1);
}

console.log("\nContrast audit passed.");
