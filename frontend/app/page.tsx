"use client";
import Hero from "@/components/Hero";
import Sections from "@/components/Sections";
import Footer from "@/components/Footer";
import Shell from "@/components/Shell";

export default function Home() {
  return (
    <Shell>
      {(openCopilot) => (
        <>
          <Hero onOpenCopilot={openCopilot} />
          <Sections />
          <Footer />
        </>
      )}
    </Shell>
  );
}
