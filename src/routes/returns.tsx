import { createFileRoute, Link } from "@tanstack/react-router";
import { useSiteContent } from "@/lib/site-content";

export const Route = createFileRoute("/returns")({
  head: () => ({
    meta: [
      { title: "AQUISH — RETURNS" },
      { name: "description", content: "Returns policy." },
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
      <main className="flex-1 max-w-2xl mx-auto px-6 py-16 flex flex-col gap-6 text-xs tracking-widest leading-relaxed">
        <h1 className="text-sm">RETURNS</h1>
        <p style={{ whiteSpace: "pre-wrap" }}>{content.returns_body}</p>
      </main>
    </div>
  );
}
