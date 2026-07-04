"use client";

import { useCallback, useEffect, useState } from "react";
import { readErrorMessage } from "../lib/apiError";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api-proxy";
const QUICK_PROMPTS = [
  "Give me today's single highest-leverage action and what it unblocks.",
  "Audit my current tasks and call out the one blueprint trap.",
  "Draft a hard-first execution plan for today with 3 concrete moves.",
  "What is the key risk in my current board and how do I reduce it now?",
];

export default function AssistantPanel({ token, onAuthError }) {
  const [knowledge, setKnowledge] = useState([]);
  const [workstreams, setWorkstreams] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionNote, setActionNote] = useState("");

  const handleAuthError = useCallback((res) => {
    if (res.status === 401 && typeof onAuthError === "function") {
      onAuthError();
      return true;
    }
    return false;
  }, [onAuthError]);

  const loadKnowledge = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/knowledge`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (handleAuthError(res)) return;
      if (!res.ok) {
        return;
      }
      setKnowledge(await res.json());
    } catch {
      // Keep panel usable even when list refresh fails.
    }
  }, [handleAuthError, token]);

  const loadWorkstreams = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/workstreams`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (handleAuthError(res)) return;
      if (!res.ok) return;
      setWorkstreams(await res.json());
    } catch {
      // Non-blocking for assistant usage.
    }
  }, [handleAuthError, token]);

  useEffect(() => {
    loadKnowledge();
    loadWorkstreams();
  }, [loadKnowledge, loadWorkstreams]);

  async function addEntry(e) {
    e.preventDefault();
    if (!token || !title.trim() || !content.trim()) return;
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, content }),
      });
      if (handleAuthError(res)) return;
      if (!res.ok) {
        setError(await readErrorMessage(res, "Unable to save knowledge."));
        return;
      }
      setTitle("");
      setContent("");
      loadKnowledge();
      setActionNote("Knowledge saved. Future answers can cite it.");
    } catch {
      setError("Network error while saving knowledge.");
    }
  }

  async function askAssistant(e) {
    e.preventDefault();
    if (!token || !question.trim()) return;
    setLoading(true);
    setError("");
    setActionNote("");
    try {
      const res = await fetch(`${API_BASE}/api/assistant/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      if (handleAuthError(res)) return;
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setAnswer(body.answer || "");
        setCitations(body.citations || []);
        if ((body.answer || "").includes("OPENROUTER_API_KEY")) {
          setError("AI provider is not configured on backend. Set OPENROUTER_API_KEY in Railway backend variables.");
        }
      } else {
        setAnswer(body.detail || "Assistant request failed");
        setCitations([]);
      }
    } catch {
      setAnswer("Assistant request failed due to network error.");
      setCitations([]);
      setError("Unable to connect to assistant service.");
    } finally {
      setLoading(false);
    }
  }

  async function saveDecision(status = "IN MOTION") {
    if (!token || !question.trim() || !answer.trim()) return;
    const week = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${API_BASE}/api/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        prompt: question,
        recommendation: { answer, citations },
        status,
        week_of: week,
      }),
    });
    if (handleAuthError(res)) return;
    if (!res.ok) {
      setError(await readErrorMessage(res, "Unable to save decision."));
      return;
    }
    setActionNote("Decision saved to ledger.");
  }

  async function createTaskFromAnswer() {
    if (!token || !answer.trim()) return;
    const ws = workstreams[0]?.id;
    if (!ws) {
      setError("No workstream available yet. Complete onboarding first.");
      return;
    }

    const task = answer.split("\n").find((line) => line.trim().length > 8)?.slice(0, 280) || question;
    const res = await fetch(`${API_BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ws, task, prio: "P1", status: "This Week" }),
    });
    if (handleAuthError(res)) return;
    if (!res.ok) {
      setError(await readErrorMessage(res, "Unable to create task from AI response."));
      return;
    }
    setActionNote("AI recommendation converted to a P1 task.");
  }

  if (!token) return null;

  return (
    <section className="panel">
      <h2>AI Command Deck</h2>
      <p className="notice">Use one command and let the assistant drive the next action, ledger update, and task capture.</p>
      {error ? <p className="status-error">{error}</p> : null}
      {actionNote ? <p className="notice">{actionNote}</p> : null}

      <div className="controls" style={{ marginTop: 8 }}>
        {QUICK_PROMPTS.map((prompt) => (
          <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>
            {prompt.slice(0, 48)}...
          </button>
        ))}
      </div>

      <form onSubmit={addEntry} className="shell" style={{ marginTop: 8 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Knowledge title" />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Knowledge content"
          rows={4}
          style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 10 }}
        />
        <button className="primary" type="submit">Add knowledge</button>
      </form>

      <form onSubmit={askAssistant} className="controls" style={{ marginTop: 12 }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="State the problem, decision, or command"
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="primary" type="submit" disabled={loading}>Ask</button>
      </form>

      {answer ? (
        <article className="task-row" style={{ marginTop: 10 }}>
          <strong>AI executive brief</strong>
          <div>{answer}</div>
          <div className="controls">
            <button type="button" onClick={() => saveDecision("IN MOTION")}>Save to ledger</button>
            <button type="button" onClick={createTaskFromAnswer}>Create P1 task</button>
            <button type="button" onClick={() => saveDecision("DONE")}>Mark as done</button>
          </div>
        </article>
      ) : null}

      {citations.length ? (
        <article className="task-row" style={{ marginTop: 10 }}>
          <strong>Citations used</strong>
          {citations.map((c) => (
            <div key={c.id} className="notice">- {c.title}</div>
          ))}
        </article>
      ) : null}

      <div className="notice" style={{ marginTop: 10 }}>
        Knowledge entries: {knowledge.length} | Workstreams loaded: {workstreams.length}
      </div>
    </section>
  );
}
