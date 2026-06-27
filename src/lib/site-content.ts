import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ContentMap = Record<string, string>;

export const DEFAULT_CONTENT: ContentMap = {
  contact_general: "HELLO@AQUISH.COM",
  contact_orders: "ORDERS@AQUISH.COM",
  contact_press: "PRESS@AQUISH.COM",
  about_body: "AQUISH IS A STUDIO PROJECT EXPLORING MINIMAL UTILITY GARMENTS.",
  shipping_body: "ORDERS SHIP WITHIN 3–5 BUSINESS DAYS. TRACKING PROVIDED VIA EMAIL.",
  returns_body: "RETURNS ACCEPTED WITHIN 14 DAYS OF DELIVERY. ITEMS MUST BE UNWORN.",
  terms_body: "BY USING THIS SITE YOU AGREE TO OUR TERMS OF SERVICE.",
  privacy_body: "WE COLLECT MINIMAL DATA NECESSARY TO FULFILL YOUR ORDERS.",
  // Per-link footer visibility ('1' = show, '0' = hide)
  ui_link_shipping: "1",
  ui_link_returns: "1",
  ui_link_about: "1",
  ui_link_contact: "1",
  ui_link_terms: "1",
  ui_link_privacy: "1",
  drop_at: "",
  // Sale banner
  sale_banner_on: "0",
  sale_banner_text: "",
};

const CONTENT_KEYS = Object.keys(DEFAULT_CONTENT);

export function useSiteContent() {
  const [content, setContent] = useState<ContentMap>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("site_content").select("key,value");
    const next: ContentMap = { ...DEFAULT_CONTENT };
    for (const row of data ?? []) next[row.key] = row.value ?? "";
    for (const k of CONTENT_KEYS) if (!(k in next)) next[k] = DEFAULT_CONTENT[k];
    setContent(next);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { content, loading, refresh };
}

export async function saveContent(key: string, value: string) {
  return supabase.from("site_content").upsert({ key, value }, { onConflict: "key" });
}

export const CONTENT_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "contact_general", label: "CONTACT — GENERAL EMAIL" },
  { key: "contact_orders", label: "CONTACT — ORDERS EMAIL" },
  { key: "contact_press", label: "CONTACT — PRESS EMAIL" },
  { key: "about_body", label: "ABOUT — BODY", multiline: true },
  { key: "shipping_body", label: "SHIPPING — BODY", multiline: true },
  { key: "returns_body", label: "RETURNS — BODY", multiline: true },
  { key: "terms_body", label: "TERMS OF SERVICE", multiline: true },
  { key: "privacy_body", label: "PRIVACY POLICY", multiline: true },
  { key: "sale_banner_text", label: "SALE BANNER TEXT (E.G. '80% OFF — ENDS SOON')" },
];


export const FOOTER_LINKS: { key: string; label: string; to: string }[] = [
  { key: "ui_link_shipping", label: "SHIPPING", to: "/shipping" },
  { key: "ui_link_returns", label: "RETURNS", to: "/returns" },
  { key: "ui_link_about", label: "ABOUT", to: "/about" },
  { key: "ui_link_contact", label: "CONTACT", to: "/contact" },
  { key: "ui_link_terms", label: "TERMS", to: "/terms" },
  { key: "ui_link_privacy", label: "PRIVACY", to: "/privacy" },
];

export const UI_TOGGLES = FOOTER_LINKS.map((l) => ({ key: l.key, label: `FOOTER — ${l.label}` }));
