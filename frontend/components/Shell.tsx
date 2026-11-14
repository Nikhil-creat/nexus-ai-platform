"use client";
import { useState } from "react";
import NexusCopilot from "./NexusCopilot";
import CommandPalette from "./CommandPalette";

/** Mounts the omnipresent Copilot + Cmd+K palette around any page. */
export default function Shell({ children, hero }: { children: (open: () => void) => React.ReactNode; hero?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(() => setOpen(true))}
      <NexusCopilot open={open} setOpen={setOpen} />
      <CommandPalette openCopilot={() => setOpen(true)} />
    </>
  );
}
