"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AssistantPanel({ token }) {
  const [knowledge, setKnowledge] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadKnowledge = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/knowledge`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return;
    setKnowledge(await res.json());
  }, [token]);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  async function addEntry(e) {
    e.preventDefault();
    if (!token || !title.trim() || !content.trim()) return;
    const res = await fetch(`${API_BASE}/api/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, content }),
    });
    if (!res.ok) return;
    setTitle("");
    setContent("");
    loadKnowledge();
  }

  async function askAssistant(e) {
    e.preventDefault();
    if (!token || !question.trim()) return;
    setLoading(true);
    const res = await fetch(`${API_BASE}/api/assistant/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setAnswer(body.answer || "");
      setCitations(body.citations || []);
    } else {
      setAnswer(body.detail || "Assistant request failed");
      setCitations([]);
    }
    setLoading(false);
  }

  if (!token) return null;

  return (
    <section className="panel">
      <h2>Chief-of-Staff Assistant</h2>
      <p className="notice">Solve problems with grounded recommendations, proactive risk calls, and concrete next actions.</p>

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
          <strong>Solution brief</strong>
          <div>{answer}</div>
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
        Stored knowledge entries: {knowledge.length}
      </div>
    </section>
  );
}
