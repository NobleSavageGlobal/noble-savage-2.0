const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_API_BASES = ["http://localhost:8000", "http://127.0.0.1:8000"];
const GITHUB_DEV_PORT_PATTERN = /-3000(?=\.app\.github\.dev$)/;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 250;

function normalizeBase(base: string): string {
  return base.trim().replace(/\/+$/, "");
}

function pushUnique(target: string[], value: string): void {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

function buildApiUrl(base: string, path: string): string {
  if (!base) {
    return path.startsWith("/") ? path : `/${path}`;
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function getRuntimeHost(runtimeHostname = ""): { hostname: string; protocol: string } {
  if (runtimeHostname) {
    return { hostname: runtimeHostname, protocol: "https:" };
  }

  if (typeof window !== "undefined") {
    return { hostname: window.location.hostname, protocol: window.location.protocol };
  }

  return { hostname: "", protocol: "https:" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(
  method: string,
  attempt: number,
  response?: Response,
  error?: unknown
): boolean {
  if (attempt >= MAX_RETRIES) {
    return false;
  }

  const normalizedMethod = method.toUpperCase();
  const idempotent = normalizedMethod === "GET" || normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS";
  if (!idempotent) {
    return false;
  }

  if (error) {
    return true;
  }

  if (!response) {
    return false;
  }

  return RETRYABLE_STATUS.has(response.status);
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!shouldRetry(method, attempt, response)) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (!shouldRetry(method, attempt, undefined, error)) {
        throw error;
      }
    }

    const backoffMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
    await sleep(backoffMs);
  }

  throw (lastError instanceof Error ? lastError : new Error("Request failed after retries"));
}

export function getApiBaseCandidates(runtimeHostname = "", runtimeProtocol = ""): string[] {
  const configured = normalizeBase(process.env.NEXT_PUBLIC_API_URL || "");
  if (configured) {
    return [configured];
  }

  const candidates: string[] = [];
  const runtime = getRuntimeHost(runtimeHostname);
  const hostname = runtime.hostname;
  const protocol = normalizeBase(runtimeProtocol || runtime.protocol || "https:");

  if (hostname) {
    if (LOCAL_HOSTS.has(hostname)) {
      LOCAL_API_BASES.forEach((base) => pushUnique(candidates, base));
    }

    if (hostname.includes(".app.github.dev")) {
      const forwardedHost = hostname.replace(GITHUB_DEV_PORT_PATTERN, "-8000");
      if (forwardedHost !== hostname) {
        pushUnique(candidates, `${protocol}//${forwardedHost}`);
        pushUnique(candidates, `https://${forwardedHost}`);
      }
    }
  }

  LOCAL_API_BASES.forEach((base) => pushUnique(candidates, base));
  return candidates;
}

export function resolveApiBase(runtimeHostname = "", runtimeProtocol = ""): string {
  return getApiBaseCandidates(runtimeHostname, runtimeProtocol)[0] || "";
}

export function resolveWebSocketBase(runtimeHostname = "", runtimeProtocol = ""): string {
  const apiBase = resolveApiBase(runtimeHostname, runtimeProtocol);
  if (!apiBase) {
    return "";
  }

  return apiBase.replace(/^http/, "ws");
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  runtimeHostname = "",
  runtimeProtocol = ""
): Promise<{ response: Response; base: string; url: string }> {
  const requestPath = path.startsWith("/") ? path : `/${path}`;
  const proxyPath = `/api-proxy${requestPath}`;

  if (typeof window !== "undefined") {
    try {
      const proxiedResponse = await fetchWithRetry(proxyPath, init);
      const contentType = proxiedResponse.headers.get("content-type") || "";
      const looksJson = contentType.includes("application/json");

      if (looksJson || proxiedResponse.status === 204 || proxiedResponse.ok) {
        return { response: proxiedResponse, base: "", url: proxyPath };
      }
    } catch {
      // Fall through to direct backend targets.
    }
  }

  const candidates = getApiBaseCandidates(runtimeHostname, runtimeProtocol);
  const failures: string[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const base = candidates[index];
    const url = buildApiUrl(base, requestPath);

    try {
      const response = await fetchWithRetry(url, init);
      const contentType = response.headers.get("content-type") || "";
      const looksJson = contentType.includes("application/json");

      if (looksJson || response.status === 204 || response.ok || index === candidates.length - 1) {
        return { response, base, url };
      }

      failures.push(`${response.status} ${response.statusText || "response"} from ${url}`);
    } catch (error) {
      failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    `Unable to reach the API. Tried ${candidates.join(", ")}. ${failures.at(-1) || "No response was returned."}`
  );
}

export async function apiJson(
  path: string,
  init: RequestInit = {},
  runtimeHostname = "",
  runtimeProtocol = ""
): Promise<{ response: Response; base: string; url: string; body: any }> {
  const { response, base, url } = await apiFetch(path, init, runtimeHostname, runtimeProtocol);
  const contentType = response.headers.get("content-type") || "";

  if (response.status === 204) {
    return { response, base, url, body: null };
  }

  if (contentType.includes("application/json")) {
    return {
      response,
      base,
      url,
      body: await response.json().catch(() => null),
    };
  }

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  throw new Error(`Expected JSON from ${url}, got ${contentType || "an unknown response type"}.`);
}