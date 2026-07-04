"use client";

import { useEffect, useState } from "react";

import AssistantPanel from "../components/AssistantPanel";
import OnboardingPanel from "../components/OnboardingPanel";
import TaskBoard from "../components/TaskBoard";
import { readErrorMessage } from "../lib/apiError";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api-proxy";

export default function Home() {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [sessionMessage, setSessionMessage] = useState("");

  useEffect(() => {
    const existing = window.localStorage.getItem("ns_access_token") || "";
    setToken(existing);
    setSessionChecking(false);
  }, []);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    async function verifySession() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 401) {
          logout("Your session expired. Please sign in again.");
          return;
        }
        if (!res.ok) {
          setSessionMessage("Authenticated, but profile check is temporarily unavailable.");
          return;
        }
        setSessionMessage("");
      } catch {
        if (!cancelled) {
          setSessionMessage("Unable to verify session health right now.");
        }
      }
    }

    verifySession();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submitAuth(e) {
    e.preventDefault();
    setError("");
    setAuthLoading(true);
    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const payload = mode === "register" ? { email, password, name } : { email, password };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const message = await readErrorMessage(res, "Authentication failed");
        setError(message);
        return;
      }

      const data = await res.json();
      window.localStorage.setItem("ns_access_token", data.access_token);
      setToken(data.access_token);
      setPassword("");
      setSessionMessage("");
    } catch {
      setError("Unable to reach authentication service. Check network and try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  function logout(reason = "") {
    window.localStorage.removeItem("ns_access_token");
    setToken("");
    setSessionMessage(reason);
    setError("");
  }

  if (sessionChecking) {
    return (
      <main>
        <section className="panel" style={{ maxWidth: 560, margin: "24px auto" }}>
          <h1>Noble Savage OS</h1>
          <p className="notice">Restoring secure session...</p>
        </section>
      </main>
    );
  }

  if (!token) {
    return (
      <main>
        <section className="panel" style={{ maxWidth: 560, margin: "24px auto" }}>
          <h1>Noble Savage OS</h1>
          <p className="notice">Sign in to activate your AI-operated command center.</p>
          <form onSubmit={submitAuth} className="shell" style={{ marginTop: 12 }}>
            <div className="controls">
              <button type="button" className={mode === "login" ? "primary" : ""} onClick={() => setMode("login")}>
                Login
              </button>
              <button type="button" className={mode === "register" ? "primary" : ""} onClick={() => setMode("register")}>
                Register
              </button>
            </div>
            {mode === "register" ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
              />
            ) : null}
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email"
              required
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              minLength={12}
              required
            />
            {mode === "register" ? (
              <p className="notice" style={{ margin: 0 }}>
                Use 12+ characters with upper, lower, number, and symbol.
              </p>
            ) : null}
            {sessionMessage ? <p className="status-error" style={{ margin: 0 }}>{sessionMessage}</p> : null}
            {error ? <p className="status-error" style={{ margin: 0 }}>{error}</p> : null}
            <button className="primary" type="submit" disabled={authLoading}>
              {mode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="controls" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
        <button onClick={() => logout()}>Logout</button>
      </div>
      {sessionMessage ? <p className="notice">{sessionMessage}</p> : null}
      <AssistantPanel token={token} onAuthError={() => logout("Your session expired. Please sign in again.")} />
      <TaskBoard token={token} onAuthError={() => logout("Your session expired. Please sign in again.")} />
      <OnboardingPanel token={token} onAuthError={() => logout("Your session expired. Please sign in again.")} />
    </main>
  );
}
