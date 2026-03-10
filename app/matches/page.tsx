"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { Button, Card, Input } from "../components/ui";

type Candidate = {
  id: string;
  full_name: string | null;
  bio: string | null;
  stage: string | null;
  goals: string | null;
  hours_per_week: number | null;
};

type MatchRow = {
  id: string;
  user_id: string;
  candidate_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

type Connection = {
  match_id: string;
  other_id: string;
  other?: { id: string; full_name: string | null; bio: string | null } | null;
};

export default function MatchesPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [myActions, setMyActions] = useState<MatchRow[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  const [query, setQuery] = useState("");

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMe(null);
      setCandidates([]);
      setMyActions([]);
      setConnections([]);
      setLoading(false);
      return;
    }

    setMe(user.id);

    // 1) Load my outgoing actions
    const { data: actions, error: actErr } = await supabase
      .from("matches")
      .select("id,user_id,candidate_id,status,created_at")
      .eq("user_id", user.id);

    if (actErr) {
      console.error(actErr);
      alert("Failed loading your actions (RLS).");
      setLoading(false);
      return;
    }

    const actionsRows = (actions as MatchRow[]) ?? [];
    setMyActions(actionsRows);

    const actedCandidateIds = new Set(actionsRows.map((r) => r.candidate_id));

    // 2) Load candidates (profiles)
    const { data: profs, error: profErr } = await supabase
      .from("profiles")
      .select("id,full_name,bio,stage,goals,hours_per_week")
      .neq("id", user.id)
      .limit(80);

    if (profErr) {
      console.error(profErr);
      alert("Failed loading candidates (RLS).");
      setLoading(false);
      return;
    }

    const allCandidates = ((profs as any) ?? []) as Candidate[];
    const filteredCandidates = allCandidates
      .filter((p) => !actedCandidateIds.has(p.id))
      .slice(0, 30);

    setCandidates(filteredCandidates);

    // 3) Load accepted matches where I'm either side
    const { data: acc, error: accErr } = await supabase
      .from("matches")
      .select("id,user_id,candidate_id,status,created_at")
      .eq("status", "accepted");

    if (accErr) {
      console.error(accErr);
      alert("Failed loading connections (RLS).");
      setLoading(false);
      return;
    }

    const accepted = ((acc as any) ?? []) as MatchRow[];
    const mineAccepted = accepted.filter(
      (m) => m.user_id === user.id || m.candidate_id === user.id
    );

    const connectionRows: Connection[] = mineAccepted.map((m) => {
      const otherId = m.user_id === user.id ? m.candidate_id : m.user_id;
      return { match_id: m.id, other_id: otherId, other: null };
    });

    // 4) Load other profiles for display
    const otherIds = Array.from(new Set(connectionRows.map((c) => c.other_id)));

    let otherProfiles: any[] = [];
    if (otherIds.length > 0) {
      const { data: ops, error: opsErr } = await supabase
        .from("profiles")
        .select("id,full_name,bio")
        .in("id", otherIds);

      if (opsErr) {
        console.error(opsErr);
        otherProfiles = [];
      } else {
        otherProfiles = (ops as any[]) ?? [];
      }
    }

    const mergedConnections = connectionRows.map((c) => ({
      ...c,
      other: otherProfiles.find((p) => p.id === c.other_id) ?? null,
    }));

    setConnections(mergedConnections);

    setLoading(false);
  }

  function alreadyActed(candidateId: string) {
    return myActions.some((r) => r.candidate_id === candidateId);
  }

  async function like(candidateId: string) {
    if (!me) return;
    if (alreadyActed(candidateId)) return alert("You already acted on this user.");

    const { error } = await supabase.from("matches").insert({
      user_id: me,
      candidate_id: candidateId,
      status: "pending",
    });

    if (error) return alert("Like failed: " + error.message);

    await loadAll();
  }

  async function decline(candidateId: string) {
    if (!me) return;
    if (alreadyActed(candidateId)) return alert("You already acted on this user.");

    const { error } = await supabase.from("matches").insert({
      user_id: me,
      candidate_id: candidateId,
      status: "declined",
    });

    if (error) return alert("Decline failed: " + error.message);

    await loadAll();
  }

  const visibleCandidates = candidates.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.full_name ?? "").toLowerCase().includes(q) ||
      (c.bio ?? "").toLowerCase().includes(q) ||
      (c.stage ?? "").toLowerCase().includes(q) ||
      (c.goals ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <AppShell title="Matches">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Find Cofounders</h1>
          <p className="text-sm text-zinc-400">
            Like someone to send a request. If they accept, they appear in Connections and you can chat.
          </p>
        </div>

        {/* Connections */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connections</h2>
          <span className="text-sm text-zinc-400">{connections.length} connected</span>
        </div>

        {connections.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-300">
              No connections yet. When someone likes you → accept in Requests → connection appears here for BOTH users.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {connections.map((c) => (
              <Card key={c.match_id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold">
                      {c.other?.full_name ?? "Unnamed"}
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">{c.other?.bio ?? ""}</div>
                  </div>

                  <a
                    href={`/chat/${c.match_id}`}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm hover:bg-zinc-900"
                  >
                    Open Chat →
                  </a>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Browse Founders</h2>
          <Input
            placeholder="Search by name, bio, stage, goals..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Candidates */}
        {loading ? (
          <Card>
            <p className="text-sm text-zinc-300">Loading...</p>
          </Card>
        ) : visibleCandidates.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-300">
              No candidates found (or you already acted on everyone).
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleCandidates.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="text-base font-semibold">{c.full_name || "Unnamed"}</div>
                    <div className="mt-1 text-sm text-zinc-400">{c.bio || ""}</div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
                    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1">
                      Stage: {c.stage || "-"}
                    </span>
                    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1">
                      Hours/week: {c.hours_per_week ?? "-"}
                    </span>
                  </div>

                  <div className="text-sm text-zinc-400">
                    <span className="text-zinc-300">Goals:</span> {c.goals || "-"}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <Button onClick={() => like(c.id)}>Like</Button>
                    <Button variant="ghost" onClick={() => decline(c.id)}>
                      Decline
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}