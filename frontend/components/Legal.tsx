import Link from "next/link";
import Footer from "./Footer";

export default function Legal({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <main className="legal-page">
        <Link href="/" className="admin__brand">NEXUS</Link>
        <span className="section__eyebrow">[ Legal ]</span>
        <h1 className="section__title">{title}</h1>
        <p className="form__status">Last updated {updated}</p>
        <div className="legal-page__body">{children}</div>
      </main>
      <Footer />
    </>
  );
}
