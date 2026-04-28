"use client";

import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email_confirmed_at) router.push("/home");
      setCheckingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user?.email_confirmed_at) router.push("/home");
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, router]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  }

  if (checkingSession) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text-muted)", fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--bg)", color: "var(--text-primary)" }}>

      {/* ── Left: Brand panel ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 56px" }}>
        <div style={{ maxWidth: 480 }}>

          <Image
            src="/images/logo.png"
            alt="Cofounder Connections"
            width={200}
            height={200}
            style={{ objectFit: "contain", display: "block", marginBottom: 0 }}
            priority
          />

          <h1 style={{ fontSize: 38, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.035em", marginBottom: 20 }}>
            <em style={{ fontStyle: "italic", color: "var(--accent)" }}>Trust</em> comes<br />before everything.
          </h1>

          <p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 28, maxWidth: 400 }}>
            Cofounder Connections helps you find someone who shares your vision — and gives you the tools to stay aligned, accountable, and honest with each other.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { n: "01", title: "Get matched", desc: "Describe who you're looking for and we'll surface founders whose skills and values complement yours." },
              { n: "02", title: "Agree on the important things", desc: "Set roles, equity, and working expectations before you start — in a shared, editable agreement." },
              { n: "03", title: "Build with accountability", desc: "Shared tasks, weekly check-ins, and gentle nudges keep both founders aligned week over week." },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "var(--accent)", flexShrink: 0 }}>
                  {s.n}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{s.title}</p>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Sign-in panel ── */}
      <div style={{ width: 440, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 40px", background: "var(--surface)", borderLeft: "1px solid var(--border)" }}>
        <div style={{ width: "100%", maxWidth: 350, textAlign: "center" }}>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.025em" }}>
            Join the community
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 32, lineHeight: 1.6 }}>
            Sign in with your Google account to get started. We use Google to verify your identity and keep the community trusted.
          </p>

          {/* Google Sign In */}
          <button onClick={handleGoogleSignIn} disabled={googleLoading}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: "var(--radius)",
              border: "1px solid var(--border)", background: "var(--bg-deep)",
              color: "var(--text-primary)", fontSize: 15, fontWeight: 600,
              cursor: googleLoading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              opacity: googleLoading ? 0.6 : 1, transition: "all 0.12s",
            }}>
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          {error && (
            <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "var(--radius)", padding: "10px 14px", marginTop: 16, fontSize: 13, color: "#dc2626" }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 32, padding: "20px 0", borderTop: "1px solid var(--border)" }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
              We review every application to keep this a trusted space for serious founders and builders.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}