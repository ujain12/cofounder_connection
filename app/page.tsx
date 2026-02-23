"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import AppShell from "./components/AppShell";
import { Button, Card, Input } from "./components/ui";
import Link from "next/link";

export default function Home() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [user, setUser] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"signin" | "signup" | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function signUp() {
    if (!email || !password) return alert("Enter email + password");
    setBusy("signup");
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(null);
    if (error) return alert(error.message);
    alert("Account created ✅ Now click Sign In.");
  }

  async function signIn() {
    if (!email || !password) return alert("Enter email + password");
    setBusy("signin");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error) return alert(error.message);
  }

  // ✅ Logged OUT screen (NO AppShell here)
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
              <h1 className="text-2xl font-semibold">Cofounder Connection</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Create accounts to test matching, requests, and chat.
              </p>
            </div>

            <Card>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-zinc-400">Email</label>
                  <Input
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400">Password</label>
                  <Input
                    placeholder="••••••••"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="mt-2 flex gap-2">
                  <Button onClick={signIn} disabled={busy !== null}>
                    {busy === "signin" ? "Signing in..." : "Sign In"}
                  </Button>

                  <Button variant="ghost" onClick={signUp} disabled={busy !== null}>
                    {busy === "signup" ? "Creating..." : "Sign Up"}
                  </Button>
                </div>

                <p className="mt-2 text-xs text-zinc-500">
                  Use 2 different emails to create 2 accounts and test matching.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Logged IN screen (uses AppShell)
  return (
    <AppShell title="Home">
      <Card>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-zinc-400">{user.email}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/profile"
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm hover:bg-zinc-900"
            >
              My Profile
            </Link>
            <Link
              href="/matches"
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm hover:bg-zinc-900"
            >
              Matches
            </Link>
            <Link
              href="/requests"
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm hover:bg-zinc-900"
            >
              Requests
            </Link>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
