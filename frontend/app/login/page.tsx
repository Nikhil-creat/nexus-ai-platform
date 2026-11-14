"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useSession, type SessionUser } from "@/lib/session";

export default function Login() {
  const router = useRouter();
  const setUser = useSession((s) => s.setUser);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("mode") === "register") setMode("register");
    const e = p.get("email");
    if (e) setEmail(e);
    api<{ user: SessionUser | null }>("/auth/me").then((r) => { if (r.user) { setUser(r.user); router.replace("/admin"); } }).catch(() => undefined);
  }, [router, setUser]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await api<{ user: SessionUser }>(`/auth/${mode}`, { method: "POST", body: { email, password } });
      setUser(r.user);
      router.push("/admin");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="form auth__box" onSubmit={submit} noValidate>
        <Link href="/" className="nav__logo">NEXUS</Link>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "login"} className={`tab ${mode === "login" ? "is-active" : ""}`} onClick={() => { setMode("login"); setErr(""); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={`tab ${mode === "register" ? "is-active" : ""}`} onClick={() => { setMode("register"); setErr(""); }}>Create account</button>
        </div>
        <label className="sr-only" htmlFor="e">Email</label>
        <input id="e" className="input" type="email" placeholder="Email" autoComplete="email" value={email} onChange={(ev) => setEmail(ev.target.value)} />
        <label className="sr-only" htmlFor="p">Password</label>
        <input id="p" className="input" type="password" placeholder={mode === "register" ? "Password (8+ characters)" : "Password"} autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(ev) => setPassword(ev.target.value)} />
        <button className="btn btn--solid" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Access"}</button>
        <div className="form__status" role="alert">{err}</div>
        <p className="form__status">New accounts start as viewers. An admin can raise your role.</p>
        <Link className="referral" href="/" style={{ alignSelf: "flex-start", marginTop: 8 }}>← Back to site</Link>
      </form>
    </main>
  );
}
