const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function resolveApiBase(runtimeHostname = ""): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (LOCAL_HOSTS.has(runtimeHostname)) {
    return "http://localhost:8000";
  }

  return "";
}