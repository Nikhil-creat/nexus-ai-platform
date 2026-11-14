"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;
const DEMO_PASSWORD = "nexus-demo";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email.");
      if (API) {
        const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        if (!r.ok) throw new Error("Invalid credentials.");
        sessionStorage.setItem("nexus_token", (await r.json()).access_token);
      } else if (password !== DEMO_PASSWORD) {
        throw new Error(`Demo mode: the password is "${DEMO_PASSWORD}".`);
      }
      sessionStorage.setItem("nexus_auth", email);
      router.push("/admin");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24 }}>
      <form className="form" style={{ maxWidth: 420, marginTop: 0 }} onSubmit={submit} noValidate>
        <Link href="/" className="nav__logo">NEXUS</Link>
        <span className="chip" style={{ alignSelf: "flex-start" }}>[ Sign in ]</span>
        <label className="sr-only" htmlFor="e">Email</label>
        <input id="e" className="input" type="email" placeholder="Email" autoComplete="email" value={email} onChange={(ev) => setEmail(ev.target.value)} />
        <label className="sr-only" htmlFor="p">Password</label>
        <input id="p" className="input" type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(ev) => setPassword(ev.target.value)} />
        <button className="btn btn--solid" disabled={busy}>{busy ? "Checking…" : "Access"}</button>
        <div className="form__status" role="alert">{err}</div>
        {!API && <div className="form__status">Demo password: {DEMO_PASSWORD}</div>}
      </form>
    </main>
  );
}
