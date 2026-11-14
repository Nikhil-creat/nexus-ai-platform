import { NAV, OWNER } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="footer">
      <div>© {new Date().getFullYear()} NEXUS · Built by {OWNER.name}</div>
      <div className="footer__cols">
        {NAV.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
        <a href="/admin">Admin demo</a>
        <a href={OWNER.github} target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href={OWNER.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
      </div>
      <div id="privacy-notice">Press ⌘K / Ctrl+K for commands</div>
    </footer>
  );
}
