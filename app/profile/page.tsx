"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { ALL_TAGS, CATEGORY_COLORS } from "@/lib/tags";

export default function ProfilePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [profile, setProfile] = useState<any>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: "", bio: "", goals: "", stage: "", hours_per_week: "",
    linkedin_url: "", github_url: "",
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const TAG_CATEGORIES = Array.from(new Set(ALL_TAGS.map(t => t.category)));

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        setProfile(data);
        setForm({
          full_name:     data.full_name    ?? "",
          bio:           data.bio          ?? "",
          goals:         data.goals        ?? "",
          stage:         data.stage        ?? "",
          hours_per_week:data.hours_per_week?.toString() ?? "",
          linkedin_url:  data.linkedin_url ?? "",
          github_url:    data.github_url   ?? "",
        });
        setAvatarUrl(data.avatar_url ?? null);
      }

      const { data: tagsData } = await supabase.from("profile_tags").select("tag").eq("user_id", user.id);
      setSelectedTags((tagsData ?? []).map((t: any) => t.tag));
      setLoading(false);
    })();
  }, [supabase]);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    const updates = {
      ...form,
      hours_per_week: form.hours_per_week ? parseInt(form.hours_per_week) : null,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("profiles").upsert({ id: userId, ...updates });
    await supabase.from("profile_tags").delete().eq("user_id", userId);
    if (selectedTags.length > 0) {
      await supabase.from("profile_tags").insert(selectedTags.map(tag => ({ user_id: userId, tag })));
    }
    setSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!userId || !e.target.files?.[0]) return;
    setUploading(true);
    const file = e.target.files[0];
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(publicUrl);
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
    }
    setUploading(false);
  }

  async function handleRemoveAvatar() {
    if (!userId) return;
    setAvatarUrl(null);
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : prev.length < 8 ? [...prev, tag] : prev
    );
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete account.");
        setDeleting(false);
        return;
      }
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      alert("Something went wrong.");
      setDeleting(false);
    }
  }

  if (loading) return <AppShell title="My Profile"><p style={{ color: "var(--text-muted)", padding: 40 }}>Loading…</p></AppShell>;

  const stages = ["Idea", "Pre-seed", "MVP", "Seed", "Series A+"];

  return (
    <AppShell eyebrow="You" title="My Profile">
      <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Profile Photo */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, boxShadow: "var(--shadow-sm)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Profile Photo</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Shown to other founders when they browse profiles.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", background: "var(--accent-soft)", border: "2px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : (form.full_name ? form.full_name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase() : "?")}
            </div>
            <div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>JPG, PNG or WebP. Max 5MB.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-block", textTransform: "none", letterSpacing: "normal" }}>
                  {uploading ? "Uploading…" : "Change"}
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }}/>
                </label>
                {avatarUrl && (
                  <button onClick={handleRemoveAvatar} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Remove</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Your Tags</h2>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius-pill)", padding: "3px 10px" }}>{selectedTags.length}/8</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Select up to 8 tags. These help the AI search agent find the right matches for you.</p>

          {TAG_CATEGORIES.map(cat => {
            const catTags = ALL_TAGS.filter(t => t.category === cat);
            const colors = CATEGORY_COLORS[cat];
            return (
              <div key={cat} style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 8 }}>{cat}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {catTags.map(tag => {
                    const sel = selectedTags.includes(tag.label);
                    return (
                      <button key={tag.label} onClick={() => toggleTag(tag.label)}
                        style={{ padding: "5px 12px", borderRadius: "var(--radius-pill)", border: `1px solid ${sel ? colors.border : "var(--border)"}`, background: sel ? colors.bg : "var(--surface)", color: sel ? colors.text : "var(--text-muted)", fontSize: 12, fontWeight: sel ? 700 : 500, cursor: "pointer", transition: "all 0.12s" }}>
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Profile Details */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, boxShadow: "var(--shadow-sm)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Profile Details</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Used by the AI agent to match you with compatible founders.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {[
              { key: "full_name", label: "Full Name",       type: "text",  placeholder: "Your full name"     },
              { key: "bio",       label: "Bio",             type: "area",  placeholder: "Tell other founders about yourself…" },
              { key: "goals",     label: "What you're building", type: "area", placeholder: "Describe the problem you want to solve and your vision…" },
              { key: "linkedin_url", label: "LinkedIn URL", type: "text",  placeholder: "https://linkedin.com/in/…" },
              { key: "github_url",   label: "GitHub URL",   type: "text",  placeholder: "https://github.com/…"     },
            ].map(f => (
              <div key={f.key}>
                <label>{f.label}</label>
                {f.type === "area"
                  ? <textarea value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} rows={3} style={{ width: "100%", resize: "vertical" }}/>
                  : <input type="text" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: "100%" }}/>
                }
              </div>
            ))}

            {/* Stage */}
            <div>
              <label>Stage</label>
              <select value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))} style={{ width: "100%" }}>
                <option value="">Select your stage</option>
                {stages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Hours */}
            <div>
              <label>Hours per week</label>
              <input type="number" value={form.hours_per_week} onChange={e => setForm(p => ({ ...p, hours_per_week: e.target.value }))} placeholder="e.g. 40" style={{ width: "100%" }}/>
            </div>
          </div>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border-sub)", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: "11px 28px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </div>

        {/* ── Delete Account ── */}
        <div style={{ background: "var(--surface)", border: "1px solid rgba(229,90,110,0.2)", borderRadius: "var(--radius-lg)", padding: 24, boxShadow: "var(--shadow-sm)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>Danger Zone</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Permanently delete your account and all data. This cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)}
              style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "var(--radius)", padding: "11px 24px", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Delete My Account
            </button>
          ) : (
            <div style={{ background: "rgba(229,90,110,0.05)", border: "1px solid rgba(229,90,110,0.15)", borderRadius: "var(--radius)", padding: 20 }}>
              <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12, fontWeight: 600 }}>
                This will permanently delete your profile, matches, messages, and all account data.
              </p>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#dc2626", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Type DELETE to confirm
              </label>
              <input
                placeholder="Type DELETE"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                style={{ width: "100%", marginBottom: 14 }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== "DELETE" || deleting}
                  style={{
                    background: deleteConfirmText === "DELETE" ? "#dc2626" : "rgba(220,38,38,0.15)",
                    border: "none", borderRadius: "var(--radius)", padding: "11px 24px", color: "#fff",
                    fontSize: 13, fontWeight: 700,
                    cursor: deleteConfirmText === "DELETE" && !deleting ? "pointer" : "not-allowed",
                    opacity: deleteConfirmText === "DELETE" ? 1 : 0.4,
                  }}>
                  {deleting ? "Deleting…" : "Permanently Delete Account"}
                </button>
                <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                  style={{ padding: "11px 24px", background: "transparent", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}