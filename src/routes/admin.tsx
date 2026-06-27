import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  useStore,
  addCategory,
  deleteCategory,
  upsertProduct,
  deleteProducts,
  reorderProducts,
  setDropAt,
  type Product,
  type ColorVariant,
  loadFromCloud,
  migrateLocalToCloud,
} from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { getMyAdminStatus, claimAdminRole } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSiteContent, saveContent, CONTENT_FIELDS, UI_TOGGLES } from "@/lib/site-content";


export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "AQUISH — ADMIN" }] }),
  component: AdminGate,
});

function AdminGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const checkAdmin = useServerFn(getMyAdminStatus);
  const claim = useServerFn(claimAdminRole);
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const runCheck = async () => {
    setState("checking");
    try {
      const r = await checkAdmin({});
      if (r.isAdmin) {
        await loadFromCloud();
        await migrateLocalToCloud().catch(() => null);
        setState("ok");
      } else setState("denied");
    } catch {
      setState("denied");
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    runCheck();
  }, [user, loading]);

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await claim({ data: { code: code.trim() } });
      if (r.ok) {
        setMsg("ADMIN ACCESS GRANTED");
        await runCheck();
      } else {
        setMsg("INCORRECT CODE");
      }
    } catch (err: any) {
      setMsg(err?.message ?? "SERVER ERROR — SERVICE ROLE KEY NOT CONFIGURED");
    } finally {
      setBusy(false);
    }
  };

  if (loading || state === "checking") {
    return <div className="min-h-screen aquish-bg flex items-center justify-center text-xs tracking-widest opacity-60">CHECKING…</div>;
  }
  if (state === "denied") {
    return (
      <div className="min-h-screen aquish-bg flex flex-col items-center justify-center gap-4 text-xs tracking-widest px-6">
        <div>ADMIN ACCESS REQUIRED</div>
        <form onSubmit={submitCode} className="flex flex-col gap-3 w-full max-w-xs">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ENTER ADMIN CODE"
            className="aquish-input text-center"
            autoFocus
          />
          <button type="submit" disabled={busy} className="py-3 text-xs tracking-widest disabled:opacity-40" style={{ background: "#000", color: "#fff", border: "none" }}>
            {busy ? "…" : "SUBMIT"}
          </button>
          {msg && <div className="text-center opacity-80">{msg}</div>}
        </form>
        <button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/auth" }))} className="aquish-link">SIGN OUT</button>
        <Link to="/" className="aquish-link">← STOREFRONT</Link>
      </div>
    );
  }
  return <Admin />;
}



function Admin() {
  const categoriesRaw = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const categories = useMemo(
    () => [...categoriesRaw].sort((a, b) => a.order - b.order),
    [categoriesRaw],
  );


  const [newCat, setNewCat] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const currentCat = activeCat ?? categories[0]?.id ?? null;
  const catProducts = useMemo(
    () => products.filter((p) => p.categoryId === currentCat).sort((a, b) => a.order - b.order),
    [products, currentCat],
  );

  const toggleSel = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  // drag reorder
  const dragId = useRef<string | null>(null);
  const onDragStart = (id: string) => (dragId.current = id);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (overId: string) => {
    if (!dragId.current || dragId.current === overId || !currentCat) return;
    const ids = catProducts.map((p) => p.id);
    const from = ids.indexOf(dragId.current);
    const to = ids.indexOf(overId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorderProducts(currentCat, ids);
    dragId.current = null;
  };

  return (
    <div className="min-h-screen aquish-bg text-xs tracking-widest">
      <header className="flex items-center justify-between px-4 h-12" style={{ borderBottom: "1px solid #000" }}>
        <div>AQUISH / ADMIN</div>
        <Link to="/" className="aquish-hover">← STOREFRONT</Link>
      </header>

      <div className="grid md:grid-cols-[260px_1fr]" style={{ minHeight: "calc(100vh - 48px)" }}>
        {/* Sidebar: categories */}
        <aside className="p-4 flex flex-col gap-3" style={{ borderRight: "1px solid #000" }}>
          <div>CATEGORIES</div>
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <button
                onClick={() => setActiveCat(c.id)}
                className={`aquish-hover flex-1 text-left ${currentCat === c.id ? "underline underline-offset-4" : ""}`}
              >
                {c.name}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete ${c.name}? All its products will be removed.`)) {
                    deleteCategory(c.id);
                    if (currentCat === c.id) setActiveCat(null);
                  }
                }}
                className="aquish-hover"
                title="Delete category"
              >
                ×
              </button>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCat.trim()) return;
              addCategory(newCat.trim());
              setNewCat("");
            }}
            className="flex gap-2 mt-4"
          >
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="NEW CATEGORY"
              className="flex-1 px-2 py-2 bg-transparent uppercase tracking-widest"
              style={{ border: "1px solid #000" }}
            />
            <button
              type="submit"
              className="aquish-hover px-3"
              style={{ background: "#000", color: "#fff", border: "none" }}
            >
              ADD
            </button>
          </form>

          <DropControl />
          <SaleBannerControl />
          <DiscountCodes />
          <AdminInviteCodes />
          <UIToggles />
          <SiteContentEditor />
        </aside>



        {/* Products + Orders */}
        <section className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>PRODUCTS</div>
            <div className="flex gap-2">
              {selected.size > 0 && (
                <button
                  onClick={() => {
                    if (confirm(`Delete ${selected.size} product(s)?`)) {
                      deleteProducts([...selected]);
                      setSelected(new Set());
                    }
                  }}
                  className="aquish-hover px-3 py-2"
                  style={{ background: "#000", color: "#fff", border: "none" }}
                >
                  DELETE SELECTED ({selected.size})
                </button>
              )}
              <button
                onClick={() =>
                  setEditing({
                    id: crypto.randomUUID(),
                    sku: "",
                    name: "",
                    price: "",
                    description: "",
                    categoryId: currentCat ?? "",
                    colors: [],
                    sizes: [],
                    stock: 0,
                    lowStockThreshold: 3,
                    status: "draft",
                    order: catProducts.length,
                  })
                }
                disabled={!currentCat}
                className="aquish-hover px-3 py-2 disabled:opacity-40"
                style={{ background: "#000", color: "#fff", border: "none" }}
              >
                + NEW PRODUCT
              </button>
            </div>
          </div>

          {catProducts.length === 0 && (
            <div className="opacity-60 py-10">NO PRODUCTS IN THIS CATEGORY</div>
          )}

          <div className="flex flex-col">
            {catProducts.map((p) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => onDragStart(p.id)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(p.id)}
                className="flex items-center gap-3 p-2 aquish-hover"
                style={{ borderBottom: "1px solid #000", cursor: "move" }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggleSel(p.id)}
                />
                <div style={{ width: 48, height: 48 }}>
                  {p.colors[0]?.image ? (
                    <img src={p.colors[0].image} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full" style={{ background: "#e5e3df" }} />
                  )}
                </div>
                <div className="flex-1">
                  <div>{p.sku || "—"}</div>
                  <div className="opacity-60">{p.name}</div>
                </div>
                <div>{p.price || "—"}</div>
                <div>STOCK {p.stock}</div>
                <div>{p.status === "published" ? "PUBLISHED" : "DRAFT"}</div>
                <button onClick={() => setEditing(p)} className="aquish-hover ml-2">EDIT</button>
              </div>
            ))}
          </div>

          <OrdersPanel />
        </section>
      </div>


      {editing && (
        <ProductEditor
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            upsertProduct(p);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ProductEditor({
  initial,
  categories,
  onClose,
  onSave,
}: {
  initial: Product;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSave: (p: Product) => void;
}) {
  const [p, setP] = useState<Product>(initial);
  const [sizesText, setSizesText] = useState(initial.sizes.join(", "));

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const addColor = () => {
    const c: ColorVariant = {
      id: crypto.randomUUID(),
      name: "",
      swatch: "#000000",
      image: "",
    };
    setP({ ...p, colors: [...p.colors, c] });
  };

  const updateColor = (id: string, patch: Partial<ColorVariant>) =>
    setP({ ...p, colors: p.colors.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const removeColor = (id: string) =>
    setP({ ...p, colors: p.colors.filter((c) => c.id !== id) });

  return (
    <div className="fixed inset-0 z-50 aquish-bg aquish-fade-in overflow-auto">
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-4 text-xs tracking-widest">
        <div className="flex items-center justify-between">
          <div>PRODUCT</div>
          <button onClick={onClose} className="aquish-hover">×</button>
        </div>

        <Field label="SKU">
          <input
            value={p.sku}
            onChange={(e) => setP({ ...p, sku: e.target.value.toUpperCase() })}
            className="ai"
          />
        </Field>
        <Field label="NAME">
          <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value.toUpperCase() })} className="ai" />
        </Field>
        <Field label="PRICE (E.G. R499, $30.31, €120)">
          <input
            value={p.price}
            onChange={(e) => setP({ ...p, price: e.target.value })}
            placeholder="R499"
            className="ai"
          />
        </Field>
        <Field label="DESCRIPTION (ONE DETAIL PER LINE — E.G. MATERIALS, FIT)">
          <textarea
            value={p.description}
            onChange={(e) => setP({ ...p, description: e.target.value.toUpperCase() })}
            placeholder={"SET IN SLEEVE\n100% COTTON"}
            rows={4}
            className="ai"
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </Field>
        <Field label="CATEGORY">
          <select
            value={p.categoryId}
            onChange={(e) => setP({ ...p, categoryId: e.target.value })}
            className="ai"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="SIZES (COMMA SEPARATED)">
          <input
            value={sizesText}
            onChange={(e) => {
              setSizesText(e.target.value);
              setP({
                ...p,
                sizes: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
              });
            }}
            className="ai"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="STOCK">
            <input type="number" value={p.stock} onChange={(e) => setP({ ...p, stock: parseInt(e.target.value) || 0 })} className="ai" />
          </Field>
          <Field label="LOW STOCK THRESHOLD">
            <input type="number" value={p.lowStockThreshold} onChange={(e) => setP({ ...p, lowStockThreshold: parseInt(e.target.value) || 0 })} className="ai" />
          </Field>
        </div>
        <Field label="STATUS">
          <div className="flex gap-2">
            {(["draft", "published"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setP({ ...p, status: s })}
                className="aquish-hover px-3 py-2"
                style={{
                  border: "1px solid #000",
                  background: p.status === s ? "#000" : "transparent",
                  color: p.status === s ? "#fff" : "#000",
                }}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center justify-between">
            <div>COLOURS</div>
            <button onClick={addColor} className="aquish-hover px-2 py-1" style={{ border: "1px solid #000" }}>+ ADD COLOUR</button>
          </div>
          {p.colors.map((c) => (
            <div key={c.id} className="flex flex-col gap-2 p-3" style={{ border: "1px solid #000" }}>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={c.swatch}
                  onChange={(e) => updateColor(c.id, { swatch: e.target.value })}
                  style={{ width: 36, height: 36, border: "1px solid #000", background: "transparent" }}
                />
                <input
                  value={c.name}
                  onChange={(e) => updateColor(c.id, { name: e.target.value.toUpperCase() })}
                  placeholder="COLOUR NAME"
                  className="ai flex-1"
                />
                <button onClick={() => removeColor(c.id)} className="aquish-hover">×</button>
              </div>
              <label className="flex items-center gap-3">
                {c.image ? (
                  <img src={c.image} alt="" style={{ width: 60, height: 60, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 60, height: 60, background: "#e5e3df" }} />
                )}
                <span className="aquish-hover px-2 py-1" style={{ border: "1px solid #000" }}>
                  UPLOAD IMAGE
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) updateColor(c.id, { image: await fileToDataUrl(f) });
                  }}
                />
              </label>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="aquish-hover px-3 py-2 flex-1" style={{ border: "1px solid #000" }}>CANCEL</button>
          <button
            onClick={() => onSave(p)}
            className="aquish-hover px-3 py-2 flex-1"
            style={{ background: "#000", color: "#fff", border: "none" }}
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      {children}
    </label>
  );
}

function DropControl() {
  const dropAt = useStore((s) => s.dropAt);
  const [val, setVal] = useState(dropAt ? dropAt.slice(0, 16) : "");
  useEffect(() => { setVal(dropAt ? dropAt.slice(0, 16) : ""); }, [dropAt]);
  return (
    <div className="flex flex-col gap-2 mt-6 pt-4" style={{ borderTop: "1px solid #000" }}>
      <div>NEXT DROP</div>
      <input
        type="datetime-local"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="ai"
      />
      <div className="flex gap-2">
        <button
          onClick={() => setDropAt(val ? new Date(val).toISOString() : null)}
          className="aquish-hover px-3 py-2 flex-1"
          style={{ background: "#000", color: "#fff", border: "none" }}
        >
          SAVE
        </button>
        <button
          onClick={() => { setVal(""); setDropAt(null); }}
          className="aquish-hover px-3 py-2"
          style={{ border: "1px solid #000" }}
        >
          CLEAR
        </button>
      </div>
    </div>
  );
}

type DiscountRow = {
  id: string;
  code: string;
  percent_off: number | null;
  amount_off: number | null;
  active: boolean;
  used_count: number;
  max_uses: number | null;
  expires_at: string | null;
};

function DiscountCodes() {
  const [rows, setRows] = useState<DiscountRow[]>([]);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("discount_codes")
      .select("id, code, percent_off, amount_off, active, used_count, max_uses, expires_at")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setRows((data as DiscountRow[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const p = parseFloat(percent);
    const a = parseFloat(amount);
    if ((!p || isNaN(p)) && (!a || isNaN(a))) {
      setErr("ENTER PERCENT OR AMOUNT");
      return;
    }
    const { error } = await supabase.from("discount_codes").insert({
      code: code.trim().toUpperCase(),
      percent_off: p && !isNaN(p) ? p : null,
      amount_off: a && !isNaN(a) ? a : null,
      max_uses: maxUses ? parseInt(maxUses) : null,
      currency: "GBP",
    });
    if (error) return setErr(error.message);
    setCode(""); setPercent(""); setAmount(""); setMaxUses("");
    load();
  };

  const toggle = async (r: DiscountRow) => {
    await supabase.from("discount_codes").update({ active: !r.active }).eq("id", r.id);
    load();
  };
  const remove = async (r: DiscountRow) => {
    if (!confirm(`Delete ${r.code}?`)) return;
    await supabase.from("discount_codes").delete().eq("id", r.id);
    load();
  };

  return (
    <div className="flex flex-col gap-2 mt-6 pt-4" style={{ borderTop: "1px solid #000" }}>
      <div>DISCOUNT CODES</div>
      <form onSubmit={create} className="flex flex-col gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" className="ai" maxLength={64} required />
        <div className="grid grid-cols-2 gap-2">
          <input value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="% OFF" className="ai" type="number" min="0" max="100" step="0.1" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="£ OFF" className="ai" type="number" min="0" step="0.01" />
        </div>
        <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="MAX USES (OPTIONAL)" className="ai" type="number" min="1" />
        <button type="submit" className="aquish-hover px-3 py-2" style={{ background: "#000", color: "#fff", border: "none" }}>ADD CODE</button>
        {err && <div className="opacity-70">{err.toUpperCase()}</div>}
      </form>
      <div className="flex flex-col gap-1 mt-2">
        {rows.length === 0 && <div className="opacity-60">NO CODES</div>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 py-1" style={{ borderBottom: "1px solid #000" }}>
            <div className="flex-1">
              <div>{r.code}{!r.active && " (OFF)"}</div>
              <div className="opacity-60 text-[10px]">
                {r.percent_off ? `${r.percent_off}% OFF` : `£${r.amount_off} OFF`} · USED {r.used_count}{r.max_uses ? `/${r.max_uses}` : ""}
              </div>
            </div>
            <button onClick={() => toggle(r)} className="aquish-hover">{r.active ? "PAUSE" : "RESUME"}</button>
            <button onClick={() => remove(r)} className="aquish-hover">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SiteContentEditor() {
  const { content, refresh } = useSiteContent();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const valueFor = (k: string) => (k in drafts ? drafts[k] : (content[k] ?? ""));
  const setDraft = (k: string, v: string) => setDrafts((d) => ({ ...d, [k]: v }));

  const save = async (k: string) => {
    setSavingKey(k);
    const { error } = await saveContent(k, valueFor(k));
    setSavingKey(null);
    if (!error) {
      setSavedKey(k);
      setTimeout(() => setSavedKey((s) => (s === k ? null : s)), 1200);
      await refresh();
      setDrafts((d) => {
        const { [k]: _, ...rest } = d;
        return rest;
      });
    } else {
      alert(error.message);
    }
  };

  return (
    <div className="mt-6 pt-4" style={{ borderTop: "1px solid #000" }}>
      <button onClick={() => setOpen((o) => !o)} className="aquish-hover w-full text-left">
        SITE CONTENT {open ? "−" : "+"}
      </button>
      {open && (
        <div className="flex flex-col gap-3 mt-3">
          {CONTENT_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <div className="opacity-60 text-[10px]">{f.label}</div>
              {f.multiline ? (
                <textarea
                  value={valueFor(f.key)}
                  onChange={(e) => setDraft(f.key, e.target.value)}
                  rows={4}
                  className="px-2 py-2 bg-transparent text-xs"
                  style={{ border: "1px solid #000" }}
                />
              ) : (
                <input
                  value={valueFor(f.key)}
                  onChange={(e) => setDraft(f.key, e.target.value)}
                  className="px-2 py-2 bg-transparent text-xs"
                  style={{ border: "1px solid #000" }}
                />
              )}
              <button
                onClick={() => save(f.key)}
                disabled={savingKey === f.key}
                className="aquish-hover self-end px-2 py-1 text-[10px]"
                style={{ background: "#000", color: "#fff", border: "none" }}
              >
                {savingKey === f.key ? "SAVING…" : savedKey === f.key ? "SAVED" : "SAVE"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UIToggles() {
  const { content, refresh } = useSiteContent();
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (key: string) => {
    setBusy(key);
    const next = content[key] === "0" ? "1" : "0";
    await saveContent(key, next);
    await refresh();
    setBusy(null);
  };
  const resetAll = async () => {
    setBusy("__reset");
    await Promise.all(UI_TOGGLES.map((t) => saveContent(t.key, "1")));
    await refresh();
    setBusy(null);
  };
  return (
    <div className="mt-6 pt-4 flex flex-col gap-2" style={{ borderTop: "1px solid #000" }}>
      <div className="flex items-center justify-between">
        <span>FOOTER LINKS</span>
        <button
          onClick={resetAll}
          disabled={busy === "__reset"}
          className="aquish-hover px-2 py-1 text-[10px] tracking-widest"
          style={{ border: "1px solid #000" }}
        >
          {busy === "__reset" ? "RESETTING…" : "RESET ALL"}
        </button>
      </div>
      {UI_TOGGLES.map((t) => {
        const on = content[t.key] !== "0";
        return (
          <button
            key={t.key}
            onClick={() => toggle(t.key)}
            disabled={busy === t.key}
            className="aquish-hover flex items-center justify-between px-2 py-2"
            style={{ border: "1px solid #000" }}
          >
            <span>{t.label}</span>
            <span style={{ background: on ? "#000" : "transparent", color: on ? "#fff" : "#000", padding: "1px 6px", border: "1px solid #000" }}>
              {on ? "ON" : "OFF"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SaleBannerControl() {
  const { content, refresh } = useSiteContent();
  const [text, setText] = useState(content.sale_banner_text ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(content.sale_banner_text ?? ""); }, [content.sale_banner_text]);
  const on = content.sale_banner_on === "1";
  const save = async () => {
    setBusy(true);
    await saveContent("sale_banner_text", text);
    await refresh();
    setBusy(false);
  };
  const toggle = async () => {
    setBusy(true);
    await saveContent("sale_banner_on", on ? "0" : "1");
    await refresh();
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-2 mt-6 pt-4" style={{ borderTop: "1px solid #000" }}>
      <div className="flex items-center justify-between">
        <span>SALE BANNER</span>
        <button onClick={toggle} disabled={busy} className="aquish-hover px-2 py-1 text-[10px]" style={{ border: "1px solid #000", background: on ? "#000" : "transparent", color: on ? "#fff" : "#000" }}>
          {on ? "ON" : "OFF"}
        </button>
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="80% OFF — ENDS SOON"
        className="px-2 py-2 bg-transparent text-xs tracking-widest"
        style={{ border: "1px solid #000" }}
      />
      <button onClick={save} disabled={busy} className="aquish-hover px-3 py-2" style={{ background: "#000", color: "#fff", border: "none" }}>
        SAVE TEXT
      </button>
    </div>
  );
}

type AdminInviteRow = {
  id: string;
  code: string;
  note: string;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  active: boolean;
};

function AdminInviteCodes() {
  const [rows, setRows] = useState<AdminInviteRow[]>([]);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [hours, setHours] = useState("24");
  const [maxUses, setMaxUses] = useState("1");
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("admin_invite_codes")
      .select("id, code, note, expires_at, max_uses, used_count, active")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setRows((data as AdminInviteRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const gen = () => {
    const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)];
    setCode(s);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const h = parseFloat(hours);
    const expires = h && !isNaN(h) ? new Date(Date.now() + h * 3600_000).toISOString() : null;
    const { error } = await supabase.from("admin_invite_codes").insert({
      code: code.trim().toUpperCase(),
      note: note.trim(),
      expires_at: expires,
      max_uses: maxUses ? parseInt(maxUses) : null,
    });
    if (error) return setErr(error.message);
    setCode(""); setNote(""); setHours("24"); setMaxUses("1");
    load();
  };

  const toggle = async (r: AdminInviteRow) => {
    await supabase.from("admin_invite_codes").update({ active: !r.active }).eq("id", r.id);
    load();
  };
  const remove = async (r: AdminInviteRow) => {
    if (!confirm(`Delete ${r.code}?`)) return;
    await supabase.from("admin_invite_codes").delete().eq("id", r.id);
    load();
  };

  return (
    <div className="flex flex-col gap-2 mt-6 pt-4" style={{ borderTop: "1px solid #000" }}>
      <div>ADMIN INVITE CODES</div>
      <div className="opacity-60 text-[10px]">SHARE WITH DEV/SUPPORT. EXPIRES + USAGE CAP ENFORCED.</div>
      <form onSubmit={create} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" className="ai flex-1" maxLength={64} required />
          <button type="button" onClick={gen} className="aquish-hover px-2" style={{ border: "1px solid #000" }}>GEN</button>
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="NOTE (E.G. SUPPORT — JOHN)" className="ai" />
        <div className="grid grid-cols-2 gap-2">
          <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="EXPIRES IN HOURS" className="ai" type="number" min="0" step="0.5" />
          <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="MAX USES" className="ai" type="number" min="1" />
        </div>
        <button type="submit" className="aquish-hover px-3 py-2" style={{ background: "#000", color: "#fff", border: "none" }}>ADD CODE</button>
        {err && <div className="opacity-70">{err.toUpperCase()}</div>}
      </form>
      <div className="flex flex-col gap-1 mt-2">
        {rows.length === 0 && <div className="opacity-60">NO CODES</div>}
        {rows.map((r) => {
          const expired = r.expires_at && new Date(r.expires_at).getTime() < Date.now();
          return (
            <div key={r.id} className="flex items-center gap-2 py-1" style={{ borderBottom: "1px solid #000" }}>
              <div className="flex-1">
                <div>{r.code}{!r.active && " (OFF)"}{expired && " (EXPIRED)"}</div>
                <div className="opacity-60 text-[10px]">
                  {r.note || "—"} · USED {r.used_count}{r.max_uses ? `/${r.max_uses}` : ""}
                  {r.expires_at ? ` · EXP ${new Date(r.expires_at).toLocaleString()}` : ""}
                </div>
              </div>
              <button onClick={() => toggle(r)} className="aquish-hover">{r.active ? "PAUSE" : "RESUME"}</button>
              <button onClick={() => remove(r)} className="aquish-hover">×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type OrderRow = {
  id: string;
  email: string;
  items: Array<{ sku: string; name: string; color: string; size: string; qty: number; unitPriceGbp: number }>;
  subtotal: number;
  discount_code: string | null;
  discount_amount: number;
  total: number;
  currency: string;
  status: string;
  shipping_address: Record<string, string>;
  created_at: string;
};

function OrdersPanel() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, email, items, subtotal, discount_code, discount_amount, total, currency, status, shipping_address, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) setErr(error.message);
    else setRows((data as unknown as OrderRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    load();
  };

  return (
    <div className="mt-10 pt-6" style={{ borderTop: "1px solid #000" }}>
      <div className="flex items-center justify-between mb-3">
        <div>ORDERS ({rows?.length ?? "…"})</div>
        <button onClick={load} className="aquish-hover">REFRESH</button>
      </div>
      {err && <div className="opacity-70 mb-2">{err.toUpperCase()}</div>}
      {rows && rows.length === 0 && <div className="opacity-60 py-6">NO ORDERS YET</div>}
      <div className="flex flex-col">
        {rows?.map((o) => {
          const open = openId === o.id;
          return (
            <div key={o.id} style={{ borderBottom: "1px solid #000" }}>
              <button
                onClick={() => setOpenId(open ? null : o.id)}
                className="flex items-center gap-3 p-2 w-full text-left aquish-hover"
              >
                <div className="flex-1">
                  <div>{o.email}</div>
                  <div className="opacity-60 text-[10px]">
                    {new Date(o.created_at).toLocaleString()} · {o.items.length} ITEM(S)
                  </div>
                </div>
                <div>{o.currency} {o.total.toFixed(2)}</div>
                <div className="px-2 py-1" style={{ border: "1px solid #000" }}>{o.status.toUpperCase()}</div>
              </button>
              {open && (
                <div className="p-3 grid md:grid-cols-2 gap-4" style={{ background: "rgba(0,0,0,0.03)" }}>
                  <div className="flex flex-col gap-1">
                    <div className="opacity-60">ITEMS</div>
                    {o.items.map((it, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <div>{it.sku} · {it.name} · {it.color || "—"} · {it.size || "—"} × {it.qty}</div>
                        <div>£{(it.unitPriceGbp * it.qty).toFixed(2)}</div>
                      </div>
                    ))}
                    <div className="opacity-60 mt-2">TOTALS</div>
                    <div className="flex justify-between"><span>SUBTOTAL</span><span>£{o.subtotal.toFixed(2)}</span></div>
                    {o.discount_code && (
                      <div className="flex justify-between"><span>{o.discount_code}</span><span>−£{o.discount_amount.toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between"><span>TOTAL</span><span>{o.currency} {o.total.toFixed(2)}</span></div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="opacity-60">SHIPPING</div>
                    <div>{o.shipping_address.firstName} {o.shipping_address.lastName}</div>
                    <div>{o.shipping_address.address} {o.shipping_address.apt}</div>
                    <div>{o.shipping_address.city}, {o.shipping_address.region} {o.shipping_address.postal}</div>
                    <div>{o.shipping_address.country}</div>
                    {o.shipping_address.phone && <div>{o.shipping_address.phone}</div>}
                    <div className="opacity-60 mt-2">STATUS</div>
                    <div className="flex gap-2 flex-wrap">
                      {["pending", "paid", "shipped", "delivered", "cancelled"].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(o.id, s)}
                          className="aquish-hover px-2 py-1 text-[10px]"
                          style={{
                            border: "1px solid #000",
                            background: o.status === s ? "#000" : "transparent",
                            color: o.status === s ? "#fff" : "#000",
                          }}
                        >
                          {s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

