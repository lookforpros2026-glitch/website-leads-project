"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from "firebase/auth";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase-client";

type Props = {
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
    messagingSenderId: string;
  } | null;
  missing: string[];
};

export function LoginClient({ firebaseConfig, missing }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!firebaseConfig) throw new Error("Firebase config missing");

      await setPersistence(firebaseAuth, browserSessionPersistence);
      const creds = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      const idToken = await creds.user.getIdToken(true);
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Login failed");
      router.prefetch("/admin/pages/gallery");
      router.replace("/admin/pages/gallery");
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-900 px-4">
      <div className="glass-card p-8 w-full max-w-md border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-semibold mb-2">Admin Login</h1>
        <p className="text-slate-600 mb-6 text-sm">Sign in with your Firebase Auth admin account.</p>
        {missing.length > 0 && (
          <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm mb-3">
            Missing Firebase client env vars: {missing.join(", ")}. Restart dev server after fixing `.env.local`.
          </div>
        )}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 text-sm rounded-xl border border-neutral-200 bg-white px-3 focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
            />
          </div>
          <div>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 text-sm rounded-xl border border-neutral-200 bg-white px-3 focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
            />
          </div>
          {error && <div className="text-rose-600 text-sm">{error}</div>}
          <button
            className="h-10 w-full rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
            disabled={loading || !!missing.length}
            type="submit"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
