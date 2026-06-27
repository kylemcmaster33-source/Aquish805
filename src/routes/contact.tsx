import { createFileRoute, Link } from "@tanstack/react-router";
import { useSiteContent } from "@/lib/site-content";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "AQUISH — CONTACT" },
      { name: "description", content: "Contact AQUISH." },
    ],
  }),
  component: Page,
});

function Page() {
  const { content } = useSiteContent();
  return (
    <div className="min-h-screen aquish-bg aquish-fade-in flex flex-col">
      <header className="h-12 flex items-center px-4" style={{ borderBottom: "1px solid #000" }}>
        <Link to="/" className="aquish-link text-xs tracking-widest">← AQUISH</Link>
      </header>
      <main className="flex-1 max-w-2xl mx-auto px-6 py-16 flex flex-col gap-6 tracking-widest leading-relaxed" style={{ fontSize: 10, fontWeight: 400 }}>
        <h1 style={{ fontSize: 6, opacity: 0.6, fontWeight: 400, letterSpacing: "0.0506em" }}>CONTACT</h1>
        <p>GENERAL — {content.contact_general}</p>
        <p>ORDERS — {content.contact_orders}</p>
        <p>PRESS — {content.contact_press}</p>
      </main>
    </div>
  );
}
