import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
      <div>
        <span className="chip">[ 404 ]</span>
        <h1 className="h1" style={{ fontSize: "clamp(40px,8vw,96px)" }}>Not found</h1>
        <p className="tagline">That route does not exist.</p>
        <p style={{ marginTop: 32 }}><Link className="nav__cta" href="/">Back home</Link></p>
      </div>
    </main>
  );
}
