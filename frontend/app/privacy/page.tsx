import type { Metadata } from "next";
import Legal from "@/components/Legal";
import { OWNER } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Notice · NEXUS" };

export default function Privacy() {
  return (
    <Legal title="Privacy Notice" updated="14 November 2026">
      <p>NEXUS is a portfolio and demonstration platform built by {OWNER.name}. This notice explains what the site stores and why.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Account data:</b> your email address and a salted scrypt hash of your password. Plain passwords are never stored.</li>
        <li><b>Session cookie:</b> one HttpOnly, signed cookie (<code>nexus_session</code>) used only to keep you signed in.</li>
        <li><b>Contact form:</b> the name, email and message you submit.</li>
        <li><b>Audit trail:</b> a record of who changed which records and when, kept in a tamper-evident hash chain.</li>
        <li><b>Usage records:</b> token counts and estimated cost of Copilot requests, tied to your account.</li>
        <li><b>Rate-limit counters:</b> short-lived counters keyed by IP address and email to block abuse.</li>
      </ul>
      <h2>AI processing</h2>
      <p>When you use the Copilot, your message is sent to a third-party language-model provider (Groq or Google Gemini). Before sending, emails and phone numbers are replaced with placeholders and restored locally in the answer. Do not enter secrets or sensitive personal data. The Copilot can only propose changes; nothing is changed until you approve.</p>
      <h2>Storage and sharing</h2>
      <p>Data is stored in the project&apos;s hosted database (Upstash Redis) or, if none is configured, in temporary server memory. Data is not sold. It is shared only with the infrastructure and AI providers needed to run the service.</p>
      <h2>Your choices</h2>
      <p>To access, correct or delete your data, email <a href={`mailto:${OWNER.email}`}>{OWNER.email}</a>. Browser-only preferences such as the theme live in local storage and can be cleared in your browser.</p>
      <h2>Contact</h2>
      <p>{OWNER.name}, {OWNER.location}.</p>
    </Legal>
  );
}
