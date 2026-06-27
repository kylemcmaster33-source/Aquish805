import { Link } from "@tanstack/react-router";
import { useSiteContent, FOOTER_LINKS } from "@/lib/site-content";

export function Footer() {
  const { content } = useSiteContent();
  const visible = FOOTER_LINKS.filter((l) => content[l.key] !== "0");
  if (visible.length === 0) return null;
  return (
    <footer
      className="mt-3 px-2 py-1 flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 md:gap-1"
      style={{ borderTop: "1px solid #000", fontSize: 7, letterSpacing: "0.15em", lineHeight: 1.2 }}
    >
      <div>© AQUISH</div>
      <nav className="flex flex-wrap gap-1.5 md:gap-2">
        {visible.map((l) => (
          <Link key={l.key} to={l.to} className="aquish-link">{l.label}</Link>
        ))}
      </nav>
    </footer>
  );
}
