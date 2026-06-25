"use client";

import { useEffect, useState } from "react";

export default function OnboardingPanel({ token, apiBase }) {
  const [turn, setTurn] = useState(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  async function sendTurn(nextAnswer = null) {
    if (!token) return;
    setLoading(true);
    const res = await fetch(`${apiBase}/api/onboarding/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ answer: nextAnswer }),
    });
    if (res.ok) {
      const data = await res.json();
      setTurn(data);
      setAnswer("");
    }
    setLoading(false);
  }

  async function resetFlow() {
    if (!token) return;
    setLoading(true);
    await fetch(`${apiBase}/api/onboarding/reset`, {
      method: "POST",
      headers: { ...authHeaders },
    });
    setLoading(false);
    sendTurn(null);
  }

  useEffect(() => {
    if (!token) return;
    sendTurn(null);
  }, [token]);

  function onSubmit(e) {
    e.preventDefault();
    sendTurn(answer.trim() || null);
  }

  return (
    <section className="panel">
      <div className="onboarding-head">
        <h2>Onboarding Bot</h2>
        <button onClick={resetFlow} disabled={loading}>
          Reset
        </button>
      </div>

      <p className="notice">One question at a time. Confirm proposals before write.</p>

      {turn ? (
        <>
          <p style={{ fontWeight: 600 }}>{turn.question}</p>
          {turn.note ? <p className="notice">{turn.note}</p> : null}

          {turn.proposals?.length ? (
            <div className="proposal-list">
              {turn.proposals.map((item, idx) => (
                <article key={`${item.type}-${idx}`} className="proposal-item">
                  <strong>{item.type === "workstream" ? item.name : item.task}</strong>
                  <div className="badges">
                    {item.tier ? <span className="badge">{item.tier}</span> : null}
                    {item.prio ? <span className="badge">{item.prio}</span> : null}
                    {item.ws ? <span className="badge">{item.ws}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {turn.summary?.length ? (
            <div className="notice">
              {turn.summary.map((line, idx) => (
                <div key={`${line}-${idx}`}>- {line}</div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="notice">Starting onboarding...</p>
      )}

      <form onSubmit={onSubmit} className="controls" style={{ marginTop: 10 }}>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Your answer"
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="primary" type="submit" disabled={loading}>
          Send
        </button>
      </form>

      <div className="controls" style={{ marginTop: 8 }}>
        <button onClick={() => sendTurn("yes")} disabled={loading}>
          Confirm
        </button>
        <button onClick={() => sendTurn("revise")}>Revise</button>
      </div>
    </section>
  );
}
