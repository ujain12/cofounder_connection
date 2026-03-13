"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type MatchRow = {
  id: string;
  user_id: string;
  candidate_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  bio?: string | null;
  stage?: string | null;
};

type AcceptedMatchOption = {
  match_id: string;
  founder_a_id: string;
  founder_b_id: string;
  other_id: string;
  other: ProfileRow | null;
};

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high";

type TaskRow = {
  id: string;
  match_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  category: string | null;
  blocker_notes: string | null;
  last_edited_by: string | null;
  last_edited_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type TaskForm = {
  title: string;
  description: string;
  assigned_to: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  category: string;
  blocker_notes: string;
};

const emptyForm: TaskForm = {
  title: "",
  description: "",
  assigned_to: "",
  status: "todo",
  priority: "medium",
  due_date: "",
  category: "",
  blocker_notes: "",
};

type ViewTab = "board" | "create" | "details";

const STATUS_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "in_progress", label: "In Progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

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

  useEffect(() => {
    loadAcceptedMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedMatchId) {
      setTasks([]);
      setSelectedTaskId(null);
      return;
    }

    loadTasks(selectedMatchId);

    const channel = supabase
      .channel(`tasks-sync-${selectedMatchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "founder_tasks",
          filter: `match_id=eq.${selectedMatchId}`,
        },
        async () => {
          await loadTasks(selectedMatchId, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMatchId, supabase]);

  async function loadAcceptedMatches() {
    setLoadingMatches(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setLoadingMatches(false);
      return;
    }

    const userId = userData.user.id;
    setMe(userId);

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    if (myProfile?.full_name) {
      setMyName(myProfile.full_name);
    }

    const { data: acc, error: accErr } = await supabase
      .from("matches")
      .select("id,user_id,candidate_id,status,created_at")
      .eq("status", "accepted");

    if (accErr) {
      console.error(accErr);
      alert("Failed to load accepted matches.");
      setLoadingMatches(false);
      return;
    }

    const accepted = ((acc as MatchRow[]) ?? []).filter(
      (m) => m.user_id === userId || m.candidate_id === userId
    );

    const otherIds = Array.from(
      new Set(
        accepted.map((m) => (m.user_id === userId ? m.candidate_id : m.user_id))
      )
    );

    let otherProfiles: ProfileRow[] = [];
    if (otherIds.length > 0) {
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id,full_name,bio,stage")
        .in("id", otherIds);

      if (profErr) {
        console.error(profErr);
      } else {
        otherProfiles = (profs as ProfileRow[]) ?? [];
      }
    }

    const hydrated: AcceptedMatchOption[] = accepted.map((m) => {
      const otherId = m.user_id === userId ? m.candidate_id : m.user_id;
      return {
        match_id: m.id,
        founder_a_id: m.user_id,
        founder_b_id: m.candidate_id,
        other_id: otherId,
        other: otherProfiles.find((p) => p.id === otherId) ?? null,
      };
    });

    setMatches(hydrated);
    setSelectedMatchId(hydrated[0]?.match_id || "");
    setLoadingMatches(false);
  }

  async function loadTasks(matchId: string, silent = false) {
    if (!silent) setLoadingTasks(true);

    const { data, error } = await supabase
      .from("founder_tasks")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      if (!silent) alert("Failed to load tasks.");
      if (!silent) setLoadingTasks(false);
      return;
    }

    const rows = (data as TaskRow[]) ?? [];
    setTasks(rows);

    if (rows.length > 0) {
      setSelectedTaskId((prev) => (prev && rows.some((t) => t.id === prev) ? prev : rows[0].id));
    } else {
      setSelectedTaskId(null);
    }

    if (!silent) setLoadingTasks(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingTaskId(null);
  }

  function startCreate() {
    resetForm();
    setViewTab("create");
  }

  function startEdit(task: TaskRow) {
    setEditingTaskId(task.id);
    setForm({
      title: task.title ?? "",
      description: task.description ?? "",
      assigned_to: task.assigned_to ?? "",
      status: task.status,
      priority: task.priority,
      due_date: task.due_date ?? "",
      category: task.category ?? "",
      blocker_notes: task.blocker_notes ?? "",
    });
    setViewTab("create");
  }

  async function saveTask() {
    if (!me) {
      alert("You must be logged in.");
      return;
    }

    const selectedMatch = matches.find((m) => m.match_id === selectedMatchId);
    if (!selectedMatch) {
      alert("Please select a valid accepted match.");
      return;
    }

    if (!form.title.trim()) {
      alert("Please add a task title.");
      return;
    }

    setSaving(true);

    const assigneeName =
      form.assigned_to === me
        ? myName
        : selectedMatch.other?.id === form.assigned_to
        ? selectedMatch.other?.full_name ?? "Matched Founder"
        : null;

    const payload = {
      match_id: selectedMatch.match_id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to || null,
      assigned_to_name: assigneeName,
      created_by: editingTaskId ? undefined : me,
      created_by_name: editingTaskId ? undefined : myName,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      category: form.category.trim() || null,
      blocker_notes: form.blocker_notes.trim() || null,
      last_edited_by: me,
      last_edited_by_name: myName,
    };

    let error = null;

    if (editingTaskId) {
      const res = await supabase
        .from("founder_tasks")
        .update(payload)
        .eq("id", editingTaskId);
      error = res.error;
    } else {
      const res = await supabase.from("founder_tasks").insert(payload);
      error = res.error;
    }

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Failed to save task: " + error.message);
      return;
    }

    await loadTasks(selectedMatch.match_id, true);
    resetForm();
    setViewTab("board");
  }

  async function deleteTask(taskId: string) {
    const ok = window.confirm("Delete this ticket?");
    if (!ok) return;

    const { error } = await supabase.from("founder_tasks").delete().eq("id", taskId);

    if (error) {
      console.error(error);
      alert("Failed to delete ticket.");
      return;
    }

    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
      setViewTab("board");
    }
  }

  async function moveTaskToStatus(taskId: string, nextStatus: TaskStatus) {
    if (!me) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === nextStatus) return;

    const { error } = await supabase
      .from("founder_tasks")
      .update({
        status: nextStatus,
        last_edited_by: me,
        last_edited_by_name: myName,
      })
      .eq("id", taskId);

    if (error) {
      console.error(error);
      alert("Failed to move ticket.");
    }
  }

  const selectedMatch = matches.find((m) => m.match_id === selectedMatchId);

  const assigneeOptions = [
    me ? { id: me, name: `${myName} (You)` } : null,
    selectedMatch?.other
      ? {
          id: selectedMatch.other.id,
          name: selectedMatch.other.full_name ?? "Matched Founder",
        }
      : null,
  ].filter(Boolean) as { id: string; name: string }[];

  const visibleTasks = tasks.filter((task) => {
    const q = search.trim().toLowerCase();

    const searchOk =
      !q ||
      task.title.toLowerCase().includes(q) ||
      (task.description ?? "").toLowerCase().includes(q) ||
      (task.category ?? "").toLowerCase().includes(q) ||
      (task.assigned_to_name ?? "").toLowerCase().includes(q);

    const priorityOk = priorityFilter === "all" || task.priority === priorityFilter;

    let assigneeOk = true;
    if (assigneeFilter === "mine") assigneeOk = task.assigned_to === me;
    else if (assigneeFilter === "cofounder")
      assigneeOk = !!selectedMatch?.other && task.assigned_to === selectedMatch.other.id;
    else if (assigneeFilter === "unassigned") assigneeOk = !task.assigned_to;

    return searchOk && priorityOk && assigneeOk;
  });

  const selectedTask =
    tasks.find((t) => t.id === selectedTaskId) || null;

  const totalCount = tasks.length;
  const myCount = tasks.filter((t) => t.assigned_to === me).length;
  const cofounderCount = selectedMatch?.other
    ? tasks.filter((t) => t.assigned_to === selectedMatch.other.id).length
    : 0;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const blockedCount = tasks.filter((t) => t.status === "blocked").length;

  return (
    <main className="min-h-screen bg-[#0b0d10] text-white px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <p className="text-sm text-zinc-400">Workspace / Tasks</p>
          <h1 className="text-4xl font-bold mt-2">Founder Ticket Board</h1>
          <p className="text-zinc-400 mt-3 max-w-3xl">
            Shared ticket board for both founders. Move tickets across progress stages,
            open them for details, and keep accountability visible.
          </p>
        </div>

        {loadingMatches ? (
          <Panel>Loading accepted matches...</Panel>
        ) : matches.length === 0 ? (
          <Panel dashed>
            <h2 className="text-2xl font-semibold mb-3">No accepted founder match yet</h2>
            <p className="text-zinc-400 max-w-2xl">
              The Workspace stays available, but Tasks unlock only after a founder match is accepted.
            </p>
          </Panel>
        ) : (
          <>
            <div className="mb-6 rounded-2xl border border-sky-900 bg-sky-950/30 px-4 py-3 text-sm text-sky-200">
              These tickets are shared between both matched founders. Click a ticket to open details,
              or drag it across columns to update progress.
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <Panel className="lg:col-span-2">
                <h2 className="text-lg font-semibold mb-4">Matched Founder</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Select Match">
                    <select
                      value={selectedMatchId}
                      onChange={(e) => {
                        setSelectedMatchId(e.target.value);
                        resetForm();
                        setViewTab("board");
                      }}
                      className="w-full rounded-2xl bg-[#111318] border border-zinc-700 px-4 py-3 outline-none"
                    >
                      {matches.map((match) => (
                        <option key={match.match_id} value={match.match_id}>
                          {match.other?.full_name ?? "Unnamed founder"}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="rounded-2xl bg-[#111318] border border-zinc-800 px-4 py-3">
                    <p className="text-sm text-zinc-400">Active Partner</p>
                    <p className="font-semibold mt-1">
                      {selectedMatch?.other?.full_name ?? "Unnamed founder"}
                    </p>
                    <p className="text-sm text-zinc-500 mt-2">
                      {selectedMatch?.other?.stage ?? "No stage added"}
                    </p>
                  </div>
                </div>
              </Panel>

              <Panel>
                <h2 className="text-lg font-semibold mb-4">Board Snapshot</h2>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Total" value={totalCount} />
                  <MiniStat label="Mine" value={myCount} />
                  <MiniStat label="Cofounder" value={cofounderCount} />
                  <MiniStat label="Blocked" value={blockedCount} />
                </div>
                <div className="mt-3">
                  <MiniStat label="Done" value={doneCount} />
                </div>
              </Panel>
            </div>

            <div className="mb-6 flex flex-wrap gap-3">
              <TabButton active={viewTab === "board"} onClick={() => setViewTab("board")}>
                View Tickets
              </TabButton>

              <TabButton active={viewTab === "create"} onClick={startCreate}>
                {editingTaskId ? "Edit Ticket" : "Create Ticket"}
              </TabButton>

              {selectedTask ? (
                <TabButton active={viewTab === "details"} onClick={() => setViewTab("details")}>
                  Ticket Details
                </TabButton>
              ) : null}
            </div>

            {viewTab === "board" && (
              <>
                <Panel className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Field label="Search">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search tickets..."
                        className="w-full rounded-2xl bg-[#111318] border border-zinc-700 px-4 py-3 outline-none"
                      />
                    </Field>

                    <Field label="Priority">
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="w-full rounded-2xl bg-[#111318] border border-zinc-700 px-4 py-3 outline-none"
                      >
                        <option value="all">All</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </Field>

                    <Field label="Assignee">
                      <select
                        value={assigneeFilter}
                        onChange={(e) => setAssigneeFilter(e.target.value)}
                        className="w-full rounded-2xl bg-[#111318] border border-zinc-700 px-4 py-3 outline-none"
                      >
                        <option value="all">All</option>
                        <option value="mine">My Tickets</option>
                        <option value="cofounder">Cofounder Tickets</option>
                        <option value="unassigned">Unassigned</option>
                      </select>
                    </Field>

                    <div className="flex items-end gap-3">
                      <button
                        type="button"
                        onClick={() => selectedMatchId && loadTasks(selectedMatchId)}
                        className="rounded-2xl border border-zinc-700 px-4 py-3 hover:bg-zinc-800"
                      >
                        Refresh
                      </button>
                      <button
                        type="button"
                        onClick={startCreate}
                        className="rounded-2xl bg-white text-black px-4 py-3 font-semibold hover:opacity-90"
                      >
                        New Ticket
                      </button>
                    </div>
                  </div>
                </Panel>

                {loadingTasks ? (
                  <Panel>Loading tickets...</Panel>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
                    {STATUS_COLUMNS.map((column) => {
                      const columnTasks = visibleTasks.filter((t) => t.status === column.key);

                      return (
                        <div
                          key={column.key}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={async () => {
                            if (draggingTaskId) {
                              await moveTaskToStatus(draggingTaskId, column.key);
                              setDraggingTaskId(null);
                            }
                          }}
                          className="rounded-3xl border border-zinc-800 bg-[#12151b] p-4 min-h-[420px]"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">{column.label}</h2>
                            <span className="text-sm text-zinc-400">{columnTasks.length}</span>
                          </div>

                          <div className="space-y-4">
                            {columnTasks.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-zinc-700 px-4 py-10 text-center text-sm text-zinc-500">
                                Drop tickets here
                              </div>
                            ) : (
                              columnTasks.map((task) => (
                                <TicketPaperCard
                                  key={task.id}
                                  task={task}
                                  selected={selectedTaskId === task.id}
                                  onClick={() => {
                                    setSelectedTaskId(task.id);
                                    setViewTab("details");
                                  }}
                                  onDragStart={() => setDraggingTaskId(task.id)}
                                  onDragEnd={() => setDraggingTaskId(null)}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {viewTab === "create" && (
              <Panel>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold">
                      {editingTaskId ? "Edit Ticket" : "Create New Ticket"}
                    </h2>
                    <p className="text-zinc-400 mt-1">
                      Create a clean work ticket and assign it to yourself or your cofounder.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setViewTab("board");
                    }}
                    className="rounded-2xl border border-zinc-700 px-4 py-2 hover:bg-zinc-800"
                  >
                    Back to Board
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Ticket Title"
                    value={form.title}
                    onChange={(v) => setForm((p) => ({ ...p, title: v }))}
                    placeholder="Build onboarding flow"
                  />

                  <Input
                    label="Category / Project"
                    value={form.category}
                    onChange={(v) => setForm((p) => ({ ...p, category: v }))}
                    placeholder="MVP / Product / Design"
                  />

                  <Field label="Assign To">
                    <select
                      value={form.assigned_to}
                      onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                      className="w-full rounded-2xl bg-[#111318] border border-zinc-700 px-4 py-3 outline-none"
                    >
                      <option value="">Unassigned</option>
                      {assigneeOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Due Date">
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                      className="w-full rounded-2xl bg-[#111318] border border-zinc-700 px-4 py-3 outline-none"
                    />
                  </Field>

                  <Field label="Status">
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          status: e.target.value as TaskStatus,
                        }))
                      }
                      className="w-full rounded-2xl bg-[#111318] border border-zinc-700 px-4 py-3 outline-none"
                    >
                      <option value="todo">Todo</option>
                      <option value="in_progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </select>
                  </Field>

                  <Field label="Priority">
                    <select
                      value={form.priority}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          priority: e.target.value as TaskPriority,
                        }))
                      }
                      className="w-full rounded-2xl bg-[#111318] border border-zinc-700 px-4 py-3 outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </Field>
                </div>

                <div className="mt-4">
                  <TextArea
                    label="What is this ticket about?"
                    value={form.description}
                    onChange={(v) => setForm((p) => ({ ...p, description: v }))}
                    placeholder="Write the objective, deliverable, and context..."
                    rows={5}
                  />
                </div>

                <div className="mt-4">
                  <TextArea
                    label="Blocker Notes"
                    value={form.blocker_notes}
                    onChange={(v) => setForm((p) => ({ ...p, blocker_notes: v }))}
                    placeholder="Optional blockers, risks, or dependencies..."
                    rows={4}
                  />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={saveTask}
                    disabled={saving}
                    className="rounded-2xl bg-white text-black px-5 py-3 font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editingTaskId ? "Update Ticket" : "Create Ticket"}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-2xl border border-zinc-700 px-5 py-3 hover:bg-zinc-800"
                  >
                    Reset
                  </button>
                </div>
              </Panel>
            )}

            {viewTab === "details" && (
              <Panel>
                {!selectedTask ? (
                  <div className="text-zinc-400">No ticket selected.</div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge type="status" value={selectedTask.status} />
                          <Badge type="priority" value={selectedTask.priority} />
                        </div>
                        <h2 className="text-3xl font-bold">{selectedTask.title}</h2>
                        <p className="text-zinc-400 mt-2">
                          {selectedTask.category || "No category"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(selectedTask)}
                          className="rounded-2xl border border-zinc-700 px-4 py-2 hover:bg-zinc-800"
                        >
                          Edit Ticket
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTask(selectedTask.id)}
                          className="rounded-2xl border border-red-900 px-4 py-2 text-red-300 hover:bg-red-950/30"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewTab("board")}
                          className="rounded-2xl border border-zinc-700 px-4 py-2 hover:bg-zinc-800"
                        >
                          Back to Board
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <TicketDetail label="Assigned To" value={selectedTask.assigned_to_name || "Unassigned"} />
                      <TicketDetail label="Created By" value={selectedTask.created_by_name || "Unknown"} />
                      <TicketDetail label="Due Date" value={selectedTask.due_date || "-"} />
                      <TicketDetail label="Last Edited By" value={selectedTask.last_edited_by_name || "-"} />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <TicketDetail
                        label="Description"
                        value={selectedTask.description || "No description added."}
                        multiline
                      />
                      <TicketDetail
                        label="Blocker Notes"
                        value={selectedTask.blocker_notes || "No blocker notes."}
                        multiline
                      />
                    </div>

                    <div className="mt-6 text-sm text-zinc-500">
                      Created: {new Date(selectedTask.created_at).toLocaleString()}
                      <br />
                      Updated: {new Date(selectedTask.updated_at).toLocaleString()}
                    </div>
                  </>
                )}
              </Panel>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Panel({
  children,
  className = "",
  dashed = false,
}: {
  children: React.ReactNode;
  className?: string;
  dashed?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-6 bg-[#141821] border ${
        dashed ? "border-dashed border-zinc-700" : "border-zinc-800"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-5 py-3 font-medium transition ${
        active
          ? "bg-white text-black"
          : "border border-zinc-700 text-white hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#111318] border border-zinc-800 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

function TicketPaperCard({
  task,
  selected,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  task: TaskRow;
  selected: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`w-full text-left rounded-[22px] border p-4 transition shadow-sm ${
        selected
          ? "border-amber-300 bg-[#f8f2df] text-black shadow-[0_0_0_1px_rgba(251,191,36,0.5)]"
          : "border-[#d9ceb3] bg-[#f6efdc] text-black hover:-translate-y-0.5"
      }`}
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(255,255,255,0.08))",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base leading-tight">{task.title}</h3>
          <p className="text-xs mt-1 text-zinc-700">
            {task.assigned_to_name || "Unassigned"}
          </p>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <PaperBadge type="status" value={task.status} />
          <PaperBadge type="priority" value={task.priority} />
        </div>
      </div>

      <p className="text-sm mt-4 line-clamp-3 text-zinc-800">
        {task.description || "No description added."}
      </p>

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-600">
        <span>{task.category || "No category"}</span>
        <span>{task.due_date ? `Due ${task.due_date}` : "No due date"}</span>
      </div>
    </button>
  );
}

function PaperBadge({
  type,
  value,
}: {
  type: "status" | "priority";
  value: string;
}) {
  let classes = "text-[11px] rounded-full px-3 py-1 font-medium ";

  if (type === "status") {
    if (value === "todo") classes += "bg-zinc-200 text-zinc-800";
    else if (value === "in_progress") classes += "bg-blue-100 text-blue-800";
    else if (value === "blocked") classes += "bg-yellow-100 text-yellow-800";
    else if (value === "done") classes += "bg-green-100 text-green-800";
  } else {
    if (value === "low") classes += "bg-zinc-200 text-zinc-800";
    else if (value === "medium") classes += "bg-purple-100 text-purple-800";
    else if (value === "high") classes += "bg-red-100 text-red-800";
  }

  return <span className={classes}>{formatLabel(value)}</span>;
}

function Badge({
  type,
  value,
}: {
  type: "status" | "priority";
  value: string;
}) {
  let classes = "text-xs rounded-full px-3 py-1 ";

  if (type === "status") {
    if (value === "todo") classes += "bg-zinc-800 text-zinc-200";
    else if (value === "in_progress") classes += "bg-blue-950 text-blue-300";
    else if (value === "blocked") classes += "bg-yellow-950 text-yellow-300";
    else if (value === "done") classes += "bg-green-950 text-green-300";
  } else {
    if (value === "low") classes += "bg-zinc-800 text-zinc-200";
    else if (value === "medium") classes += "bg-purple-950 text-purple-300";
    else if (value === "high") classes += "bg-red-950 text-red-300";
  }

  return <span className={classes}>{formatLabel(value)}</span>;
}

function TicketDetail({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#111318] p-4">
      <p className="text-sm text-zinc-500 mb-2">{label}</p>
      <p className={`${multiline ? "whitespace-pre-wrap" : ""} text-white`}>
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-2">{label}</label>
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-[#111318] border border-zinc-700 px-4 py-3 outline-none"
      />
    </Field>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl bg-[#111318] border border-zinc-700 px-4 py-3 outline-none resize-none"
      />
    </Field>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((v) => v.charAt(0).toUpperCase() + v.slice(1))
    .join(" ");
}