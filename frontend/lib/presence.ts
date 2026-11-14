"use client";
import { useEffect, useState } from "react";

/** Counts open tabs of this app in the same browser via BroadcastChannel heartbeats.
 *  The full-stack build swaps this for WebSocket presence per record (see roadmap). */
export function usePresence(name = "nexus-presence"): number {
  const [count, setCount] = useState(1);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const id = crypto.randomUUID();
    const seen = new Map<string, number>();
    const ch = new BroadcastChannel(name);
    const beat = () => ch.postMessage({ id });
    ch.onmessage = (e) => { if (e.data?.id) seen.set(e.data.id, Date.now()); };
    const tick = () => {
      const now = Date.now();
      for (const [k, t] of seen) if (now - t > 8000) seen.delete(k);
      setCount(seen.size + 1);
    };
    beat();
    const a = setInterval(beat, 3000);
    const b = setInterval(tick, 2000);
    return () => { clearInterval(a); clearInterval(b); ch.close(); };
  }, [name]);
  return count;
}
