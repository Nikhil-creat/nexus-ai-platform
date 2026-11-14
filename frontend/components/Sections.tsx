import { CAPABILITIES, LIMITS, OWNER, PROJECTS, SECURITY } from "@/lib/site";

const Cell = ({ n, t, d }: { n?: string; t: string; d: string }) => (
  <article className="cell">
    {n && <span className="cell__n">{n}</span>}
    <h3 className="cell__t">{t}</h3>
    <p className="cell__d">{d}</p>
  </article>
);

export default function Sections() {
  return (
    <main>
      <section className="section" id="platform">
        <span className="section__eyebrow">[ Platform ]</span>
        <h2 className="section__title">One API in. A full operations OS out.</h2>
        <p className="section__lead">
          Point NEXUS at an OpenAPI spec, a database or a raw payload. It infers schemas and relations, scaffolds a typed
          Refine admin, and hands you an agentic copilot that can act on your data — with a human approving anything destructive.
        </p>
        <div className="pipeline" aria-label="Pipeline">
          {[["Ingest", "OpenAPI · JSON · CSV"], ["Infer", "Keys · relations · widgets"], ["Generate", "Refine · Zod · views"], ["Verify", "tsc in sandbox"], ["Approve", "Human gate"], ["Operate", "Copilot · RAG · CNN"]].map(([a, b]) => (
            <div key={a}><b>{a}</b>{b}</div>
          ))}
        </div>
        <div className="grid">
          {CAPABILITIES.map(([n, t, d]) => <Cell key={n} n={n} t={t} d={d} />)}
        </div>
      </section>

      <section className="section" id="security">
        <span className="section__eyebrow">[ Security &amp; limits ]</span>
        <h2 className="section__title">Zero-trust by default.</h2>
        <div className="grid">
          {SECURITY.map(([t, d], i) => <Cell key={t} n={String(i + 1).padStart(2, "0")} t={t} d={d} />)}
        </div>
        <ul className="limits" aria-label="Known limitations">
          {LIMITS.map((l) => <li key={l}>— {l}</li>)}
        </ul>
      </section>

      <section className="section" id="builder">
        <span className="section__eyebrow">[ Builder ]</span>
        <h2 className="section__title">{OWNER.name}</h2>
        <p className="section__lead">{OWNER.role}<br />{OWNER.college}<br />{OWNER.location}</p>
        <div className="stats">
          {OWNER.stats.map((s) => <div className="stat" key={s.v}><b>{s.k}</b><span>{s.v}</span></div>)}
        </div>
        <div className="tags">{OWNER.skills.map((s) => <span className="tag" key={s}>{s}</span>)}</div>
        <div className="grid">
          {PROJECTS.map(([t, d]) => <Cell key={t} t={t} d={d} />)}
        </div>
      </section>

      <section className="section" id="contact">
        <span className="section__eyebrow">[ Contact ]</span>
        <h2 className="section__title">Let&apos;s build something autonomous.</h2>
        <div className="contact-links">
          <a href={`mailto:${OWNER.email}`}>Email</a>
          <a href={OWNER.github} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href={OWNER.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
      </section>
    </main>
  );
}
