"use client";

import { useEffect, useState } from "react";

import { readErrorMessage } from "../lib/apiError";

const STEP_ORDER = [
  "orient",
  "big_rocks",
  "confirm_workstreams",
  "chokepoint",
  "confirm_chokepoint",
  "rhythm",
  "done",
];

export default function OnboardingPanel({ token, apiBase, onAuthExpired }) {
  const [turn, setTurn] = useState(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const currentStep = turn?.step || "orient";
  const stepIndex = Math.max(STEP_ORDER.indexOf(currentStep), 0);
  const progressPercent = Math.round(((stepIndex + 1) / STEP_ORDER.length) * 100);

  function jumpToTaskBoard() {
    const node = document.getElementById("task-board");
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function seedAssistantPrompt(prompt) {
    window.localStorage.setItem("ns_assistant_seed", prompt);
    const node = document.getElementById("assistant-panel");
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function sendTurn(nextAnswer = null) {
    if (!token) return;
    if (!apiBase) {
      setError("Backend URL is missing. Set NEXT_PUBLIC_API_URL.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/onboarding/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ answer: nextAnswer }),
      });
      if (res.status === 401) {
        onAuthExpired?.();
        return;
      }
      if (!res.ok) {
        setError(await readErrorMessage(res, "Could not continue onboarding."));
        return;
      }
      const data = await res.json();
      setTurn(data);
      setAnswer("");
    } catch {
      setError("Could not continue onboarding.");
    } finally {
      setLoading(false);
    }
  }

  async function resetFlow() {
    if (!token) return;
    if (!apiBase) {
      setError("Backend URL is missing. Set NEXT_PUBLIC_API_URL.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/onboarding/reset`, {
        method: "POST",
        headers: { ...authHeaders },
      });
      if (res.status === 401) {
        onAuthExpired?.();
        return;
      }
      if (!res.ok) {
        setError(await readErrorMessage(res, "Could not reset onboarding."));
        return;
      }
      await sendTurn(null);
    } catch {
      setError("Could not reset onboarding.");
    } finally {
      setLoading(false);
    }
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
      <div id="onboarding-panel" style={{ position: "relative", top: -80 }} />
      <div className="onboarding-head">
        <h2>Onboarding Bot</h2>
        <button onClick={resetFlow} disabled={loading}>
          Reset
        </button>
      </div>

      <p className="notice">One question at a time. Confirm proposals as we go so your board updates with every decision.</p>
      <div className="notice" style={{ marginTop: 6 }}>Progress: {progressPercent}%</div>
      <div className="step-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
        <div className="step-track-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      {error ? <p style={{ color: "#dc2626" }}>{error}</p> : null}

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

          {turn.complete ? (
            <article className="task-row" style={{ marginTop: 10 }}>
              <strong>Next best actions</strong>
              <div className="notice">Onboarding is complete. Choose your next move so momentum continues immediately.</div>
              <div className="controls" style={{ marginTop: 8 }}>
                <button type="button" onClick={jumpToTaskBoard}>
                  Open task board
                </button>
                <button
                  type="button"
                  onClick={() =>
                    seedAssistantPrompt(
                      "Generate my execution plan for the next 72 hours. Use my pinned P1 chokepoint and return ordered actions with owners and due windows."
                    )
                  }
                >
                  Draft 72-hour plan
                </button>
                <button
                  type="button"
                  onClick={() =>
                    seedAssistantPrompt(
                      "Create my weekly brief from current tasks. Return top priorities, blockers, and one must-ship action today."
                    )
                  }
                >
                  Build weekly brief
                </button>
              </div>
            </article>
          ) : null}
        </>
      ) : (
        <p className="notice">Loading onboarding state<span className="loading-dots" aria-hidden="true" /></p>
      )}

      {!turn?.complete ? (
        <>
          <form onSubmit={onSubmit} className="controls" style={{ marginTop: 10 }}>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your response"
              style={{ flex: 1, minWidth: 220 }}
              disabled={loading}
            />
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send"}
            </button>
          </form>

          <div className="controls" style={{ marginTop: 8 }}>
            <button onClick={() => sendTurn("yes")} disabled={loading}>
              Confirm
            </button>
            <button onClick={() => sendTurn("revise")} disabled={loading}>
              Revise
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
