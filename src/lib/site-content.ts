import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ContentMap = Record<string, string>;

export const DEFAULT_CONTENT: ContentMap = {
  contact_general: "AQUISHCLOTHING@GMAIL.COM",
  contact_orders: "AQUISHCLOTHING@GMAIL.COM",
  contact_press: "AQUISHCLOTHING@GMAIL.COM",
  about_body:
    "AQUISH IS AN INDEPENDENT APPAREL LABEL BUILT AROUND MINIMAL, UTILITY-DRIVEN GARMENTS. WE DESIGN IN SMALL DROPS, FOCUS ON CLEAN SILHOUETTES AND HONEST MATERIALS, AND SHIP DIRECTLY FROM THE STUDIO. FOR ANY ENQUIRIES PLEASE REACH OUT AT AQUISHCLOTHING@GMAIL.COM.",
  shipping_body:
    "ORDERS ARE DISPATCHED WITHIN 3–5 BUSINESS DAYS. TRACKING IS PROVIDED VIA EMAIL ONCE YOUR PARCEL LEAVES THE STUDIO. DELIVERY TIMES VARY BY REGION. FOR ANY SHIPPING QUESTIONS CONTACT AQUISHCLOTHING@GMAIL.COM.",
  returns_body:
    "RETURNS ARE ACCEPTED WITHIN 14 DAYS OF DELIVERY. ITEMS MUST BE UNWORN, UNWASHED AND IN ORIGINAL PACKAGING WITH ALL TAGS ATTACHED. TO START A RETURN EMAIL AQUISHCLOTHING@GMAIL.COM WITH YOUR ORDER NUMBER.",
  terms_body:
    "BY USING THIS SITE YOU AGREE TO OUR TERMS OF SERVICE. ALL CONTENT, IMAGERY AND PRODUCT DESIGNS ARE THE PROPERTY OF AQUISH. PRICES AND AVAILABILITY MAY CHANGE WITHOUT NOTICE. ORDERS ARE SUBJECT TO ACCEPTANCE AND AVAILABILITY. FOR QUESTIONS CONTACT AQUISHCLOTHING@GMAIL.COM.",
  privacy_body:
    "WE COLLECT ONLY THE MINIMAL INFORMATION REQUIRED TO PROCESS AND DELIVER YOUR ORDERS — NAME, EMAIL, SHIPPING ADDRESS AND PAYMENT REFERENCE. YOUR DATA IS NEVER SOLD. PAYMENTS ARE HANDLED BY PAYFAST. FOR DATA REQUESTS EMAIL AQUISHCLOTHING@GMAIL.COM.",
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
const CACHE_KEY = "aquish.site_content.v1";

function readCache(): ContentMap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContentMap;
    const next: ContentMap = { ...DEFAULT_CONTENT, ...parsed };
    return next;
  } catch { return null; }
}

function writeCache(map: ContentMap) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

export function useSiteContent() {
  const [content, setContent] = useState<ContentMap>(() => readCache() ?? DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("site_content").select("key,value");
    const next: ContentMap = { ...DEFAULT_CONTENT };
    for (const row of data ?? []) next[row.key] = row.value ?? "";
    for (const k of CONTENT_KEYS) if (!(k in next)) next[k] = DEFAULT_CONTENT[k];
    setContent(next);
    writeCache(next);
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
