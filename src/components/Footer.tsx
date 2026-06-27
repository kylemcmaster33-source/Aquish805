import { Link } from "@tanstack/react-router";
import { useSiteContent, FOOTER_LINKS } from "@/lib/site-content";

export function Footer() {
  const { content } = useSiteContent();
  const visible = FOOTER_LINKS.filter((l) => content[l.key] !== "0");
  if (visible.length === 0) return null;
  return (
    <footer
      className="mt-8 px-4 py-6"
      style={{ fontSize: 11, letterSpacing: "0.25em", lineHeight: 1.4 }}
    >
      <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2">
        {visible.map((l) => (
          <Link key={l.key} to={l.to} className="aquish-link">{l.label}</Link>
        ))}
      </nav>
    </footer>
  );
}
