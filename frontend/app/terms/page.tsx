import type { Metadata } from "next";
import Legal from "@/components/Legal";
import { OWNER } from "@/lib/site";

export const metadata: Metadata = { title: "Service Contract · NEXUS" };

export default function Terms() {
  return (
    <Legal title="Service Contract" updated="14 November 2026">
      <p>By creating an account or using NEXUS you agree to the following.</p>
      <h2>Purpose</h2>
      <p>NEXUS is a demonstration and portfolio project provided free of charge and &quot;as is&quot;, with no uptime or data-retention guarantee.</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to break authentication, probe other users&apos; data, or overload the service.</li>
        <li>Do not upload unlawful content or data you have no right to process.</li>
        <li>Do not enter confidential or regulated personal data (health, financial, government IDs).</li>
      </ul>
      <h2>AI output</h2>
      <p>Answers from the Copilot may be wrong. Review every proposed action before approving it; you are responsible for actions you approve.</p>
      <h2>Accounts</h2>
      <p>Accounts may be suspended or removed to protect the service. Keep your password private.</p>
      <h2>Liability</h2>
      <p>To the extent permitted by law, the author is not liable for losses arising from use of this demonstration service.</p>
      <h2>Contact</h2>
      <p><a href={`mailto:${OWNER.email}`}>{OWNER.email}</a></p>
    </Legal>
  );
}
