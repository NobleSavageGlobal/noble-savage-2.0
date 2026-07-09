"use client";

import { useCallback, useEffect, useState } from "react";
import { readErrorMessage } from "../lib/apiError";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api-proxy";

export default function OnboardingPanel({ token, onAuthError }) {
  const [turn, setTurn] = useState(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuthError = useCallback((res) => {
    if (res.status === 401 && typeof onAuthError === "function") {
      onAuthError();
      return true;
    }
    return false;
  }, [onAuthError]);

  const sendTurn = useCallback(async (nextAnswer = null) => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answer: nextAnswer }),
      });
      if (handleAuthError(res)) return;
      if (res.ok) {
        const data = await res.json();
        setTurn(data);
        setAnswer("");
      } else {
        setError(await readErrorMessage(res, "Unable to advance onboarding."));
      }
    } catch {
      setError("Unable to connect to onboarding service.");
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, token]);

  const resetFlow = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleAuthError(res)) return;
      if (!res.ok) {
        setError(await readErrorMessage(res, "Unable to reset onboarding."));
        return;
      }
      await sendTurn(null);
    } catch {
      setError("Unable to reset onboarding right now.");
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, sendTurn, token]);

  useEffect(() => {
    if (!token) return;
    sendTurn(null);
  }, [sendTurn, token]);

  function onSubmit(e) {
    e.preventDefault();
    sendTurn(answer.trim() || null);
  }

  return (
    <section className="panel">
      <div className="onboarding-head">
        <h2>Setup Interview</h2>
        <button onClick={resetFlow} disabled={loading}>
          Restart flow
        </button>
      </div>

      <p className="notice">One question at a time. Confirm or edit each proposal before it is saved to your board.</p>
      {error ? <p className="status-error">{error}</p> : null}

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
        <p className="notice">Picking up where you left off&hellip;</p>
      )}

      <form onSubmit={onSubmit} className="controls u-mt-2">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Be specific. Concrete answers produce better board rows."
          className="u-field-grow"
        />
        <button className="primary" type="submit" disabled={loading}>
          Continue
        </button>
      </form>

      <div className="controls u-mt-2">
        <button onClick={() => sendTurn("yes")} disabled={loading}>
          Confirm proposal
        </button>
        <button onClick={() => sendTurn("revise")} disabled={loading}>Request revision</button>
      </div>
    </section>
  );
}
