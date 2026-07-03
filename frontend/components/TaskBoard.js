"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readErrorMessage } from "../lib/apiError";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api-proxy";
const WS_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_FORM = {
  ws: "ws_income",
  task: "",
  prio: "P2",
  status: "Backlog",
};

export default function TaskBoard({ token }) {
  const [tasks, setTasks] = useState([]);
  const [workstreams, setWorkstreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState("");

  const counters = useMemo(() => {
    const done = tasks.filter((t) => t.status === "Done").length;
    const inProgress = tasks.filter((t) => t.status === "In Progress").length;
    const thisWeek = tasks.filter((t) => t.status === "This Week").length;
    const openP1 = tasks.filter((t) => t.prio === "P1" && t.status !== "Done").length;
    return { done, inProgress, thisWeek, openP1 };
  }, [tasks]);

  const loadTasks = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(await readErrorMessage(res, "Unable to load tasks."));
        return;
      }
      setTasks(await res.json());
    } catch {
      setError("Unable to load tasks due to network error.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadWorkstreams = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/workstreams`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(await readErrorMessage(res, "Unable to load workstreams."));
        return;
      }
      const data = await res.json();
      setWorkstreams(data);
      if (data[0]) {
        setForm((v) => ({ ...v, ws: data[0].id }));
      }
    } catch {
      setError("Unable to load workstreams due to network error.");
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadWorkstreams();
    loadTasks();

    const wsUrl = WS_BASE.replace("http", "ws") + `/ws/board?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => socket.send("subscribe");
    socket.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!payload.task) return;

      setTasks((current) => {
        const found = current.findIndex((item) => item.id === payload.task.id);
        if (found === -1) {
          return [payload.task, ...current];
        }
        const next = [...current];
        next[found] = payload.task;
        return next;
      });
    };
    return () => socket.close();
  }, [loadTasks, loadWorkstreams, token]);

  async function submitTask(e) {
    e.preventDefault();
    if (!token || !form.task.trim()) return;

    const res = await fetch(`${API_BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setForm(DEFAULT_FORM);
      setError("");
    } else {
      setError(await readErrorMessage(res, "Unable to create task."));
    }
  }

  async function updateStatus(taskId, status) {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError(await readErrorMessage(res, "Unable to update task status."));
    }
  }

  if (!token) {
    return null;
  }

  return (
    <div className="shell">
      <section className="hero">
        <h1>Noble Savage Command Center</h1>
        <p>
          A living personal chief-of-staff. Add tasks, move status, and keep a
          shared operating picture in motion.
        </p>
      </section>

      <div className="grid">
        <section className="panel">
          <h2>Task Board</h2>
          <p className="notice">
            API: {API_BASE} | Realtime updates flow through websocket events.
          </p>
          {error ? <p className="status-error">{error}</p> : null}

          <form onSubmit={submitTask} className="controls" style={{ margin: "12px 0" }}>
            <input
              value={form.task}
              onChange={(e) => setForm((v) => ({ ...v, task: e.target.value }))}
              placeholder="One concrete task to ship"
              style={{ minWidth: 240, flex: 1 }}
            />
            <select
              value={form.ws}
              onChange={(e) => setForm((v) => ({ ...v, ws: e.target.value }))}
            >
              {workstreams.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
            <select
              value={form.prio}
              onChange={(e) => setForm((v) => ({ ...v, prio: e.target.value }))}
            >
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
            <button className="primary" type="submit">
              Add task
            </button>
          </form>

          {loading ? <p>Loading tasks...</p> : null}
          {!loading && !tasks.length ? <p className="notice">No tasks yet. Add your first concrete shipping task above.</p> : null}
          {tasks.map((task) => (
            <article key={task.id} className="task-row">
              <strong>{task.task}</strong>
              <div className="badges">
                <span className="badge">{task.prio}</span>
                <span className="badge">{task.status}</span>
                <span className="badge">{task.ws}</span>
              </div>
              <div className="controls">
                <select
                  value={task.status}
                  onChange={(e) => updateStatus(task.id, e.target.value)}
                >
                  <option>Backlog</option>
                  <option>This Week</option>
                  <option>In Progress</option>
                  <option>Blocked</option>
                  <option>Done</option>
                </select>
              </div>
            </article>
          ))}
        </section>

        <aside className="panel">
          <h2>Live Counters</h2>
          <div className="metrics" style={{ marginTop: 10 }}>
            <div className="metric">
              <small>This Week</small>
              <strong>{counters.thisWeek}</strong>
            </div>
            <div className="metric">
              <small>In Progress</small>
              <strong>{counters.inProgress}</strong>
            </div>
            <div className="metric">
              <small>Open P1</small>
              <strong>{counters.openP1}</strong>
            </div>
            <div className="metric">
              <small>Done</small>
              <strong>{counters.done}</strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
