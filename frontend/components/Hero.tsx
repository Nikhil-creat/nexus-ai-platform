"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { MEDIA, NAV } from "@/lib/site";

export default function Hero({ onOpenCopilot }: { onOpenCopilot?: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    menuRef.current?.toggleAttribute("inert", !open);
    document.body.classList.toggle("menu-open", open);
    return () => document.body.classList.remove("menu-open");
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) { setOpen(false); toggleRef.current?.focus(); }
    };
    const onResize = () => { if (window.innerWidth >= 901) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); };
  }, [open]);

  const join = () => { setOpen(false); router.push(`/login?mode=register${email ? `&email=${encodeURIComponent(email)}` : ""}`); };

  return (
    <header className="hero" style={{ "--poster": `url(${MEDIA.poster})` } as CSSProperties}>
      <div className="hero__media">
        <video autoPlay muted loop playsInline preload="auto" poster={MEDIA.poster}>
          <source src={MEDIA.video} type="video/mp4" />
        </video>
      </div>
      <div className="hero__scrim" />

      <nav className="nav" aria-label="Primary">
        <a className="nav__logo" href="#top">NEXUS</a>
        <div className="nav__cluster">
          <div className="nav__links">
            {NAV.map((n) => <a key={n.href} className="nav__link" href={n.href}>{n.label}</a>)}
          </div>
          <button className="nav__cta" onClick={join}>Join up</button>
          <button
            ref={toggleRef}
            className={`toggle ${open ? "is-open" : ""}`}
            aria-expanded={open}
            aria-controls="mobileMenu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <div
        id="mobileMenu"
        className={`menu ${open ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        aria-hidden={!open}
        ref={menuRef}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      >
        {NAV.map((n, i) => (
          <a key={n.href} className="menu__link menu__item" style={{ "--i": i } as CSSProperties} href={n.href} onClick={() => setOpen(false)}>
            {n.label}
          </a>
        ))}
        <button className="menu__cta menu__item" style={{ "--i": NAV.length } as CSSProperties} onClick={join}>Join up</button>
      </div>

      <div className="hero__body" id="top">
        <div className="panel">
          <span className="chip">[ Voice entry ]</span>
          <h1 className="h1">NEXUS</h1>
          <p className="tagline">Autonomous admin panels, built by agents.</p>

          <form
            className="form"
            action="#"
            method="post"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const v = email.trim();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return setStatus("Enter a valid email first.");
              router.push(`/login?mode=register&email=${encodeURIComponent(v)}`);
            }}
          >
            <label className="sr-only" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" name="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="btn btn--ghost">Create account with email</button>
            <button type="button" className="btn btn--solid" onClick={() => router.push("/login")}>Access</button>
            <div className="form__status" role="status">{status}</div>
          </form>

          <a className="referral" href="#invite" onClick={(e) => { e.preventDefault(); onOpenCopilot?.(); }}>
            Ask the Copilot about NEXUS
          </a>
        </div>
      </div>

      <div className="legal">
        Opening a NEXUS account signals that you accept our{" "}
        <a href="/privacy">Privacy Notice</a> and <a href="/terms">Service Contract</a>.
      </div>
    </header>
  );
}
