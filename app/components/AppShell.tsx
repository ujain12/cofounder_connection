"use client";
import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Navbar */}
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
          
            <Link href="/" className="flex items-center gap-3">
             <Image
              src="/images/logo.png"
              alt="Cofounder Connection Logo"
              width={44}
              height={44}
              className="rounded-md"
              />
              <span className="font-semibold text-lg">Cofounder Connection</span>
            </Link>

            {user && (
              <div className="flex gap-4 text-sm text-zinc-400">
                <Link href="/profile" className="hover:text-white">
                  Profile
                </Link>
                <Link href="/matches" className="hover:text-white">
                  Matches
                </Link>
                <Link href="/requests" className="hover:text-white">
                  Requests
                </Link>
                <Link href="/ai" className="hover:text-white">
                AI
                </Link>

                <Link href="/workspace">
                
                Workspace
                
                </Link>

              </div>
            )}
          </div>

          {user && (
            <button
              onClick={signOut}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm hover:bg-zinc-900"
            >
              Log Out
            </button>
          )}
        </div>
      </header>

      {/* Page Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {title && <h2 className="mb-6 text-xl font-semibold">{title}</h2>}
        {children}
      </main>
    </div>
  );
}
