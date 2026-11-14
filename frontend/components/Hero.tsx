"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MEDIA, NAV } from "@/lib/site";

export default function Hero({ onOpenCopilot }: { onOpenCopilot?: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
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

  const join = () => { setOpen(false); document.getElementById("email")?.focus(); };

  return (
    <header className="hero" style={{ ["--poster" as string]: `url(${MEDIA.poster})` }}>
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
        {...(open ? {} : ({ inert: true } as Record<string, unknown>))}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      >
        {NAV.map((n, i) => (
          <a key={n.href} className="menu__link menu__item" style={{ ["--i" as string]: i }} href={n.href} onClick={() => setOpen(false)}>
            {n.label}
          </a>
        ))}
        <button className="menu__cta menu__item" style={{ ["--i" as string]: 4 }} onClick={join}>Join up</button>
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
              setStatus("Demo mode — no email is sent. Press Access to explore.");
            }}
          >
            <label className="sr-only" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" name="email" placeholder="Email" autoComplete="email" />
            <button type="submit" className="btn btn--ghost">Proceed using email</button>
            <button type="button" className="btn btn--solid" onClick={() => router.push("/login")}>Access</button>
            <div className="form__status" role="status">{status}</div>
          </form>

          <a className="referral" href="#invite" onClick={(e) => { e.preventDefault(); onOpenCopilot?.(); }}>
            I&apos;ve got an invite key
          </a>
        </div>
      </div>

      <div className="legal">
        Opening a NEXUS account signals that you accept our{" "}
        <a href="#privacy-notice">Privacy Notice</a> and <a href="#service-contract">Service Contract</a>.
      </div>
    </header>
  );
}
