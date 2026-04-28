"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import AppShell from "../../components/AppShell";

type MatchRow = { id: string; user_id: string; candidate_id: string; status: "pending" | "accepted" | "declined"; created_at: string; };
type ProfileRow = { id: string; full_name: string | null; bio?: string | null; stage?: string | null; };
type AcceptedMatchOption = { match_id: string; founder_a_id: string; founder_b_id: string; other_id: string; other: ProfileRow | null; };
type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high";
type TaskRow = { id: string; match_id: string; title: string; description: string | null; assigned_to: string | null; assigned_to_name: string | null; created_by: string; created_by_name: string | null; status: TaskStatus; priority: TaskPriority; due_date: string | null; category: string | null; blocker_notes: string | null; last_edited_by: string | null; last_edited_by_name: string | null; created_at: string; updated_at: string; };
type TaskForm = { title: string; description: string; assigned_to: string; status: TaskStatus; priority: TaskPriority; due_date: string; category: string; blocker_notes: string; };
type ViewTab = "board" | "create" | "details";

const emptyForm: TaskForm = { title: "", description: "", assigned_to: "", status: "todo", priority: "medium", due_date: "", category: "", blocker_notes: "" };
const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "todo", label: "Todo", color: "var(--text-muted)" },
  { key: "in_progress", label: "In Progress", color: "var(--accent)" },
  { key: "blocked", label: "Blocked", color: "var(--amber)" },
  { key: "done", label: "Done", color: "var(--green)" },
];

const S = {
  panel: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" as any, padding: 20, boxShadow: "var(--shadow-sm)" } as React.CSSProperties,
  input: { width: "100%", padding: "10px 14px" } as React.CSSProperties,
  label: { display: "block" as const, fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 5 } as React.CSSProperties,
  btnPrimary: { background: "var(--accent)", border: "none", borderRadius: "var(--radius)" as any, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
  btnGhost: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" as any, padding: "10px 20px", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" } as React.CSSProperties,
};

function statusColor(s: TaskStatus) { return { todo: "var(--text-muted)", in_progress: "var(--accent)", blocked: "var(--amber)", done: "var(--green)" }[s]; }
function priorityColor(p: TaskPriority) { return { low: "var(--text-muted)", medium: "var(--accent)", high: "#dc2626" }[p]; }
function fmt(v: string) { return v.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" "); }

export default function TasksPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [me, setMe] = useState<string | null>(null);
  const [myName, setMyName] = useState("Founder");
  const [matches, setMatches] = useState<AcceptedMatchOption[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>("board");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  useEffect(() => { loadAcceptedMatches(); }, []);
  useEffect(() => {
    if (!selectedMatchId) { setTasks([]); setSelectedTaskId(null); return; }
    loadTasks(selectedMatchId);
    const ch = supabase.channel(`tasks-sync-${selectedMatchId}`).on("postgres_changes", { event: "*", schema: "public", table: "founder_tasks", filter: `match_id=eq.${selectedMatchId}` }, async () => await loadTasks(selectedMatchId, true)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedMatchId, supabase]);

  async function loadAcceptedMatches() {
    setLoadingMatches(true);
    const { data: ud } = await supabase.auth.getUser();
    if (!ud.user) { setLoadingMatches(false); return; }
    setMe(ud.user.id);
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", ud.user.id).maybeSingle();
    if (prof?.full_name) setMyName(prof.full_name);
    const { data: acc } = await supabase.from("matches").select("id,user_id,candidate_id,status,created_at").eq("status", "accepted");
    const accepted = ((acc as MatchRow[]) ?? []).filter(m => m.user_id === ud.user!.id || m.candidate_id === ud.user!.id);
    const otherIds = Array.from(new Set(accepted.map(m => m.user_id === ud.user!.id ? m.candidate_id : m.user_id)));
    let otherProfiles: ProfileRow[] = [];
    if (otherIds.length > 0) { const { data: p } = await supabase.from("profiles").select("id,full_name,bio,stage").in("id", otherIds); otherProfiles = (p as ProfileRow[]) ?? []; }
    const hydrated = accepted.map(m => { const otherId = m.user_id === ud.user!.id ? m.candidate_id : m.user_id; return { match_id: m.id, founder_a_id: m.user_id, founder_b_id: m.candidate_id, other_id: otherId, other: otherProfiles.find(p => p.id === otherId) ?? null }; });
    setMatches(hydrated); setSelectedMatchId(hydrated[0]?.match_id || ""); setLoadingMatches(false);
  }

  async function loadTasks(matchId: string, silent = false) {
    if (!silent) setLoadingTasks(true);
    const { data, error } = await supabase.from("founder_tasks").select("*").eq("match_id", matchId).order("created_at", { ascending: false });
    if (error) { if (!silent) setLoadingTasks(false); return; }
    const rows = (data as TaskRow[]) ?? [];
    setTasks(rows);
    if (rows.length > 0) setSelectedTaskId(p => p && rows.some(t => t.id === p) ? p : rows[0].id);
    else setSelectedTaskId(null);
    if (!silent) setLoadingTasks(false);
  }

  async function saveTask() {
    if (!me || !form.title.trim()) { alert("Add a title."); return; }
    const sm = matches.find(m => m.match_id === selectedMatchId);
    if (!sm) { alert("Select a match."); return; }
    setSaving(true);
    const assigneeName = form.assigned_to === me ? myName : sm.other?.id === form.assigned_to ? sm.other?.full_name ?? "Cofounder" : null;
    const payload = { match_id: sm.match_id, title: form.title.trim(), description: form.description.trim() || null, assigned_to: form.assigned_to || null, assigned_to_name: assigneeName, created_by: editingTaskId ? undefined : me, created_by_name: editingTaskId ? undefined : myName, status: form.status, priority: form.priority, due_date: form.due_date || null, category: form.category.trim() || null, blocker_notes: form.blocker_notes.trim() || null, last_edited_by: me, last_edited_by_name: myName };
    let error = null;
    if (editingTaskId) { const r = await supabase.from("founder_tasks").update(payload).eq("id", editingTaskId); error = r.error; }
    else { const r = await supabase.from("founder_tasks").insert(payload); error = r.error; }
    setSaving(false);
    if (error) { alert("Failed: " + error.message); return; }
    await loadTasks(sm.match_id, true); setForm(emptyForm); setEditingTaskId(null); setViewTab("board");
  }

  async function deleteTask(id: string) { if (!window.confirm("Delete?")) return; await supabase.from("founder_tasks").delete().eq("id", id); setSelectedTaskId(null); setViewTab("board"); }
  async function moveTask(taskId: string, status: TaskStatus) { if (!me) return; await supabase.from("founder_tasks").update({ status, last_edited_by: me, last_edited_by_name: myName }).eq("id", taskId); }

  const sm = matches.find(m => m.match_id === selectedMatchId);
  const assigneeOptions = [me ? { id: me, name: `${myName} (You)` } : null, sm?.other ? { id: sm.other.id, name: sm.other.full_name ?? "Cofounder" } : null].filter(Boolean) as { id: string; name: string }[];

  const visible = tasks.filter(t => {
    const q = search.trim().toLowerCase();
    const sOk = !q || t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q) || (t.assigned_to_name ?? "").toLowerCase().includes(q);
    const pOk = priorityFilter === "all" || t.priority === priorityFilter;
    let aOk = true;
    if (assigneeFilter === "mine") aOk = t.assigned_to === me;
    else if (assigneeFilter === "cofounder") aOk = !!sm?.other && t.assigned_to === sm.other.id;
    else if (assigneeFilter === "unassigned") aOk = !t.assigned_to;
    return sOk && pOk && aOk;
  });

  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null;
  const totalCount = tasks.length, doneCount = tasks.filter(t => t.status === "done").length;
  const myCount = tasks.filter(t => t.assigned_to === me).length;
  const coCount = sm?.other ? tasks.filter(t => t.assigned_to === sm.other!.id).length : 0;
  const blockedCount = tasks.filter(t => t.status === "blocked").length;

  if (loadingMatches) return <AppShell title="Tasks"><div style={{ color: "var(--text-muted)", padding: 40 }}>Loading matches...</div></AppShell>;

  if (matches.length === 0) return (
    <AppShell title="Tasks">
      <div style={{ ...S.panel, textAlign: "center", padding: 60, maxWidth: 600, margin: "0 auto" }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>No accepted matches yet</p>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Tasks unlock after a founder match is accepted.</p>
      </div>
    </AppShell>
  );

  const snapshots = [
    { label: "Total", value: totalCount, color: "var(--accent)" },
    { label: "Mine", value: myCount, color: "var(--accent)" },
    { label: "Cofounder", value: coCount, color: "var(--accent)" },
    { label: "Blocked", value: blockedCount, color: "var(--amber)" },
    { label: "Done", value: doneCount, color: "var(--green)" },
  ];

  return (
    <AppShell title="Founder Ticket Board">
      <div style={{ maxWidth: 1200 }}>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Shared board for both founders. Drag tickets across columns or click to view details.</p>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={S.panel}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 14 }}>Matched Founder</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={S.label}>Select Match</label>
                <select style={S.input} value={selectedMatchId} onChange={(e) => { setSelectedMatchId(e.target.value); setForm(emptyForm); setViewTab("board"); }}>
                  {matches.map(m => <option key={m.match_id} value={m.match_id}>{m.other?.full_name ?? "Unnamed"}</option>)}
                </select>
              </div>
              <div style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "10px 14px" }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Active Partner</p>
                <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{sm?.other?.full_name ?? "Unnamed"}</p>
                <p style={{ fontSize: 12, color: "var(--accent)", marginTop: 2 }}>{sm?.other?.stage ?? "No stage"}</p>
              </div>
            </div>
          </div>
          <div style={S.panel}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 14 }}>Snapshot</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {snapshots.map((snap) => (
                <div key={snap.label} style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>{snap.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: snap.color, marginTop: 2 }}>{snap.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { key: "board" as ViewTab, label: "View Tickets" },
            { key: "create" as ViewTab, label: editingTaskId ? "Edit Ticket" : "Create Ticket" },
            ...(selectedTask ? [{ key: "details" as ViewTab, label: "Ticket Details" }] : []),
          ].map((t) => (
            <button key={t.key} onClick={() => setViewTab(t.key)} style={viewTab === t.key ? S.btnPrimary : S.btnGhost}>{t.label}</button>
          ))}
        </div>

        {viewTab === "board" && (
          <>
            <div style={{ ...S.panel, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                <div><label style={S.label}>Search</label><input style={S.input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets..." /></div>
                <div><label style={S.label}>Priority</label><select style={S.input} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="all">All</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                <div><label style={S.label}>Assignee</label><select style={S.input} value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}><option value="all">All</option><option value="mine">Mine</option><option value="cofounder">Cofounder</option><option value="unassigned">Unassigned</option></select></div>
                <button onClick={() => { setForm(emptyForm); setEditingTaskId(null); setViewTab("create"); }} style={S.btnPrimary}>New Ticket</button>
              </div>
            </div>

            {loadingTasks ? <div style={{ color: "var(--text-muted)", padding: 20 }}>Loading tickets...</div> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                {STATUS_COLUMNS.map(col => {
                  const colTasks = visible.filter(t => t.status === col.key);
                  return (
                    <div key={col.key} onDragOver={e => e.preventDefault()} onDrop={async () => { if (draggingTaskId) { await moveTask(draggingTaskId, col.key); setDraggingTaskId(null); await loadTasks(selectedMatchId, true); } }}
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 14, minHeight: 400 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{col.label}</span>
                        </div>
                        <span className="pill">{colTasks.length}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {colTasks.length === 0 ? (
                          <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius)", padding: "24px 12px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Drop here</div>
                        ) : colTasks.map(task => (
                          <button key={task.id} type="button" draggable onDragStart={() => setDraggingTaskId(task.id)} onDragEnd={() => setDraggingTaskId(null)}
                            onClick={() => { setSelectedTaskId(task.id); setViewTab("details"); }}
                            style={{ textAlign: "left", background: selectedTaskId === task.id ? "var(--bg-deep)" : "var(--bg)", border: `1px solid ${selectedTaskId === task.id ? "var(--accent-border)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: 14, cursor: "pointer", width: "100%" }}>
                            <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.3 }}>{task.title}</p>
                            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>{task.assigned_to_name || "Unassigned"}</p>
                            {task.description && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{task.description}</p>}
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span className="pill" style={{ color: statusColor(task.status) }}>{fmt(task.status)}</span>
                              <span className="pill" style={{ color: priorityColor(task.priority) }}>{task.priority}</span>
                            </div>
                            {task.due_date && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Due {task.due_date}</p>}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {viewTab === "create" && (
          <div style={S.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{editingTaskId ? "Edit Ticket" : "Create New Ticket"}</p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Assign it to yourself or your cofounder.</p>
              </div>
              <button onClick={() => { setForm(emptyForm); setEditingTaskId(null); setViewTab("board"); }} style={S.btnGhost}>Back</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div><label style={S.label}>Ticket Title</label><input style={S.input} value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Build onboarding flow" /></div>
              <div><label style={S.label}>Category</label><input style={S.input} value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} placeholder="MVP / Product / Design" /></div>
              <div><label style={S.label}>Assign To</label><select style={S.input} value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}><option value="">Unassigned</option>{assigneeOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div><label style={S.label}>Due Date</label><input type="date" style={S.input} value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
              <div><label style={S.label}>Status</label><select style={S.input} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as TaskStatus }))}><option value="todo">Todo</option><option value="in_progress">In Progress</option><option value="blocked">Blocked</option><option value="done">Done</option></select></div>
              <div><label style={S.label}>Priority</label><select style={S.input} value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as TaskPriority }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            </div>
            <div style={{ marginTop: 14 }}><label style={S.label}>Description</label><textarea style={{ ...S.input, resize: "vertical" }} rows={4} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Objective, deliverable, context..." /></div>
            <div style={{ marginTop: 14 }}><label style={S.label}>Blocker Notes</label><textarea style={{ ...S.input, resize: "vertical" }} rows={3} value={form.blocker_notes} onChange={e => setForm(p => ({ ...p, blocker_notes: e.target.value }))} placeholder="Optional blockers or risks..." /></div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveTask} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : editingTaskId ? "Update Ticket" : "Create Ticket"}</button>
              <button onClick={() => { setForm(emptyForm); setEditingTaskId(null); }} style={S.btnGhost}>Reset</button>
            </div>
          </div>
        )}

        {viewTab === "details" && selectedTask && (
          <div style={S.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span className="pill" style={{ color: statusColor(selectedTask.status) }}>{fmt(selectedTask.status)}</span>
                  <span className="pill" style={{ color: priorityColor(selectedTask.priority) }}>{selectedTask.priority}</span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{selectedTask.title}</h2>
                <p style={{ color: "var(--accent)", fontSize: 13, marginTop: 4 }}>{selectedTask.category || "No category"}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setEditingTaskId(selectedTask.id); setForm({ title: selectedTask.title, description: selectedTask.description ?? "", assigned_to: selectedTask.assigned_to ?? "", status: selectedTask.status, priority: selectedTask.priority, due_date: selectedTask.due_date ?? "", category: selectedTask.category ?? "", blocker_notes: selectedTask.blocker_notes ?? "" }); setViewTab("create"); }} style={S.btnGhost}>Edit</button>
                <button onClick={() => deleteTask(selectedTask.id)} style={{ ...S.btnGhost, color: "#dc2626", borderColor: "rgba(220,38,38,0.2)" }}>Delete</button>
                <button onClick={() => setViewTab("board")} style={S.btnGhost}>Back</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[["Assigned To", selectedTask.assigned_to_name || "Unassigned"], ["Created By", selectedTask.created_by_name || "Unknown"], ["Due Date", selectedTask.due_date || "—"], ["Last Edited", selectedTask.last_edited_by_name || "—"]].map(([l, v]) => (
                <div key={l} style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 6 }}>{l}</p>
                  <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{v}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[["Description", selectedTask.description || "No description."], ["Blocker Notes", selectedTask.blocker_notes || "No blockers."]].map(([l, v]) => (
                <div key={l} style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>{l}</p>
                  <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{v}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 14 }}>Created {new Date(selectedTask.created_at).toLocaleString()} · Updated {new Date(selectedTask.updated_at).toLocaleString()}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}