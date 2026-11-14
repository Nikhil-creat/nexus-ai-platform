"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending"); setMsg("");
    try {
      await api("/contact", { body: f });
      setState("ok"); setMsg("Thanks — your message was received."); setF({ name: "", email: "", message: "", website: "" });
    } catch (err) {
      setState("err"); setMsg((err as Error).message);
    }
  }

  return (
    <form className="form contact-form" onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor="c-name">Name</label>
      <input id="c-name" className="input" placeholder="Name" autoComplete="name" maxLength={80} value={f.name} onChange={set("name")} />
      <label className="sr-only" htmlFor="c-email">Email</label>
      <input id="c-email" className="input" type="email" placeholder="Email" autoComplete="email" maxLength={254} value={f.email} onChange={set("email")} />
      <label className="sr-only" htmlFor="c-msg">Message</label>
      <textarea id="c-msg" className="textarea" rows={4} placeholder="How can I help?" maxLength={2000} value={f.message} onChange={set("message")} />
      {/* honeypot: hidden from people, bots fill it */}
      <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={f.website} onChange={set("website")} />
      <button className="btn btn--solid" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send message"}</button>
      <div className="form__status" role="status">{msg}</div>
    </form>
  );
}
