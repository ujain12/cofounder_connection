"use client";

import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";

type Profile = {
  full_name: string;
  bio: string;
  timezone: string;
  hours_per_week: number | null;
  stage: string;
  goals: string;
};

const emptyProfile: Profile = {
  full_name: "",
  bio: "",
  timezone: "",
  hours_per_week: null,
  stage: "",
  goals: "",
};

type Provider = "openai" | "anthropic" | "hf";

const MODELS: Record<Provider, { id: string; label: string }[]> = {
  openai: [
    { id: "gpt-4o-mini", label: "gpt-4o-mini (fast/cheap)" },
    { id: "gpt-4o", label: "gpt-4o (higher quality)" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
  ],
  hf: [
    { id: "google/gemma-2-2b-it", label: "gemma-2-2b-it" },
    { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral-7B-Instruct" },
  ],
};

type EnhanceResponse = {
  bio?: string;
  goals?: string;
  stage?: string;
  timezone?: string;
  hours_per_week?: number | null;
  summary?: string[];
};

type MissingItem = {
  field: "bio" | "goals" | "stage" | "timezone" | "hours_per_week";
  reason: string;
  suggestion: string;
};

type MissingResponse = {
  missing?: MissingItem[];
  suggested_fields?: {
    bio?: string;
    goals?: string;
    stage?: string;
    timezone?: string;
    hours_per_week?: number | null;
  };
  overall_feedback?: string[];
};

export default function ProfilePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState(MODELS.openai[0].id);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOut, setAiOut] = useState("");
  const [aiMode, setAiMode] = useState<"enhance" | "missing">("enhance");

  const [enhanceData, setEnhanceData] = useState<EnhanceResponse | null>(null);
  const [missingData, setMissingData] = useState<MissingResponse | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          full_name: data.full_name ?? "",
          bio: data.bio ?? "",
          timezone: data.timezone ?? "",
          hours_per_week: data.hours_per_week ?? null,
          stage: data.stage ?? "",
          goals: data.goals ?? "",
        });
      }

      setLoading(false);
    })();
  }, [supabase]);

  async function saveProfile() {
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      alert("Not logged in");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      ...profile,
    });

    setSaving(false);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    alert("Profile saved ✅");
  }

  function onProviderChange(p: Provider) {
    setProvider(p);
    setModel(MODELS[p][0]?.id ?? "");
  }

  async function runAI(kind: "enhance" | "missing") {
    setAiMode(kind);
    setAiOut("");
    setEnhanceData(null);
    setMissingData(null);
    setAiBusy(true);

    const task = kind === "enhance" ? "rewrite_profile" : "profile_missing";

    try {
      const r = await fetch("/api/ai/context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          model,
          task,
          payload: profile,
        }),
      });

      const j = await r.json();
      setAiBusy(false);

      if (!j.ok) {
        alert(j.error || "AI failed");
        return;
      }

      setAiOut(j.output_text || "");

      if (kind === "enhance") {
        setEnhanceData(j.parsed ?? null);
      } else {
        setMissingData(j.parsed ?? null);
      }
    } catch (error) {
      setAiBusy(false);
      alert("AI request failed.");
      console.error(error);
    }
  }

  function applyField(
    field: keyof Pick<Profile, "bio" | "goals" | "stage" | "timezone" | "hours_per_week">,
    value: string | number | null | undefined
  ) {
    if (value === undefined) return;
    setProfile((prev) => ({
      ...prev,
      [field]: value as never,
    }));
  }

  if (loading) {
    return <div className="p-8 text-white">Loading...</div>;
  }

  return (
    <main className="mx-auto max-w-5xl p-6 text-white">
      <div className="mb-6">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">
          ← Home
        </Link>
      </div>

      <h1 className="text-4xl font-bold mb-6">My Profile</h1>

      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <input
          className="w-full rounded-xl border border-zinc-800 bg-black p-3"
          placeholder="Full name"
          value={profile.full_name}
          onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
        />

        <textarea
          className="w-full rounded-xl border border-zinc-800 bg-black p-3 h-32"
          placeholder="Description / Bio"
          value={profile.bio}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="w-full rounded-xl border border-zinc-800 bg-black p-3"
            placeholder="Timezone"
            value={profile.timezone}
            onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
          />

          <input
            className="w-full rounded-xl border border-zinc-800 bg-black p-3"
            type="number"
            placeholder="Hours per week"
            value={profile.hours_per_week ?? ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                hours_per_week: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>

        <input
          className="w-full rounded-xl border border-zinc-800 bg-black p-3"
          placeholder="Stage"
          value={profile.stage}
          onChange={(e) => setProfile({ ...profile, stage: e.target.value })}
        />

        <textarea
          className="w-full rounded-xl border border-zinc-800 bg-black p-3 h-24"
          placeholder="Goals"
          value={profile.goals}
          onChange={(e) => setProfile({ ...profile, goals: e.target.value })}
        />

        <button
          onClick={saveProfile}
          disabled={saving}
          className="rounded-xl bg-white text-black py-3 px-4 font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">AI Profile Tools</h2>

          <div className="flex items-center gap-2">
            <select
              className="rounded-xl border border-zinc-800 bg-black p-2 text-sm"
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as Provider)}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Claude</option>
              <option value="hf">HuggingFace</option>
            </select>

            <select
              className="rounded-xl border border-zinc-800 bg-black p-2 text-sm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {MODELS[provider].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => runAI("enhance")}
            disabled={aiBusy}
            className="rounded-xl border border-zinc-800 px-4 py-2 hover:bg-zinc-900 disabled:opacity-50"
          >
            {aiBusy && aiMode === "enhance" ? "Running..." : "Enhance my profile"}
          </button>

          <button
            onClick={() => runAI("missing")}
            disabled={aiBusy}
            className="rounded-xl border border-zinc-800 px-4 py-2 hover:bg-zinc-900 disabled:opacity-50"
          >
            {aiBusy && aiMode === "missing" ? "Running..." : "What am I missing?"}
          </button>
        </div>

        {enhanceData && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black p-4 space-y-4">
            <h3 className="text-lg font-semibold">Enhanced Suggestions</h3>

            {enhanceData.summary?.length ? (
              <ul className="list-disc pl-5 text-sm text-zinc-300">
                {enhanceData.summary.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            ) : null}

            <SuggestionCard
              label="Description / Bio"
              value={enhanceData.bio}
              onApply={() => applyField("bio", enhanceData.bio)}
            />

            <SuggestionCard
              label="Goals"
              value={enhanceData.goals}
              onApply={() => applyField("goals", enhanceData.goals)}
            />

            <SuggestionCard
              label="Stage"
              value={enhanceData.stage}
              onApply={() => applyField("stage", enhanceData.stage)}
            />

            <SuggestionCard
              label="Timezone"
              value={enhanceData.timezone}
              onApply={() => applyField("timezone", enhanceData.timezone)}
            />

            <SuggestionCard
              label="Hours per week"
              value={
                enhanceData.hours_per_week !== undefined &&
                enhanceData.hours_per_week !== null
                  ? String(enhanceData.hours_per_week)
                  : undefined
              }
              onApply={() => applyField("hours_per_week", enhanceData.hours_per_week ?? null)}
            />
          </div>
        )}

        {missingData && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black p-4 space-y-4">
            <h3 className="text-lg font-semibold">Missing or Weak Areas</h3>

            {missingData.overall_feedback?.length ? (
              <ul className="list-disc pl-5 text-sm text-zinc-300">
                {missingData.overall_feedback.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            ) : null}

            {missingData.missing?.length ? (
              <div className="space-y-3">
                {missingData.missing.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-zinc-800 p-4">
                    <p className="font-medium capitalize">{item.field}</p>
                    <p className="text-sm text-zinc-400 mt-1">{item.reason}</p>
                    <p className="text-sm text-zinc-200 mt-3 whitespace-pre-wrap">
                      {item.suggestion}
                    </p>
                    <button
                      onClick={() =>
                        applyField(
                          item.field,
                          item.field === "hours_per_week"
                            ? Number(item.suggestion) || profile.hours_per_week
                            : item.suggestion
                        )
                      }
                      className="mt-3 rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
                    >
                      Apply to {item.field}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3">
              <SuggestionCard
                label="Suggested Description / Bio"
                value={missingData.suggested_fields?.bio}
                onApply={() => applyField("bio", missingData.suggested_fields?.bio)}
              />

              <SuggestionCard
                label="Suggested Goals"
                value={missingData.suggested_fields?.goals}
                onApply={() => applyField("goals", missingData.suggested_fields?.goals)}
              />

              <SuggestionCard
                label="Suggested Stage"
                value={missingData.suggested_fields?.stage}
                onApply={() => applyField("stage", missingData.suggested_fields?.stage)}
              />

              <SuggestionCard
                label="Suggested Timezone"
                value={missingData.suggested_fields?.timezone}
                onApply={() => applyField("timezone", missingData.suggested_fields?.timezone)}
              />

              <SuggestionCard
                label="Suggested Hours per week"
                value={
                  missingData.suggested_fields?.hours_per_week !== undefined &&
                  missingData.suggested_fields?.hours_per_week !== null
                    ? String(missingData.suggested_fields.hours_per_week)
                    : undefined
                }
                onApply={() =>
                  applyField(
                    "hours_per_week",
                    missingData.suggested_fields?.hours_per_week ?? null
                  )
                }
              />
            </div>
          </div>
        )}

        <div className="mt-4 whitespace-pre-wrap text-sm text-zinc-400">
          {aiOut ? aiOut : "Run a tool to see AI output here."}
        </div>
      </div>
    </main>
  );
}

function SuggestionCard({
  label,
  value,
  onApply,
}: {
  label: string;
  value?: string;
  onApply: () => void;
}) {
  if (!value) return null;

  return (
    <div className="rounded-xl border border-zinc-800 p-4">
      <p className="text-sm font-medium text-zinc-300">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-100">{value}</p>
      <button
        onClick={onApply}
        className="mt-3 rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
      >
        Apply to {label}
      </button>
    </div>
  );
}