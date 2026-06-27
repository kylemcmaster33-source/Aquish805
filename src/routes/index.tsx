import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useStore,
  addToBag,
  removeFromBag,
  updateBagQty,
  loadFromCloud,
  type Product,
} from "@/lib/store";
import { useCurrency, parsePrice } from "@/lib/currency";
import { useAuth } from "@/hooks/use-auth";
import { useSiteContent } from "@/lib/site-content";
import { Footer } from "@/components/Footer";
import { Countdown } from "@/components/Countdown";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AQUISH" },
      { name: "description", content: "AQUISH — apparel & footwear." },
    ],
  }),
  component: Storefront,
});

function Storefront() {
  const navigate = useNavigate();
  const categoriesRaw = useStore((s) => s.categories);
  const productsRaw = useStore((s) => s.products);
  const bag = useStore((s) => s.bag);
  const categories = useMemo(
    () => [...categoriesRaw].sort((a, b) => a.order - b.order),
    [categoriesRaw],
  );
  const products = useMemo(
    () =>
      productsRaw
        .filter((p) => p.status === "published")
        .sort((a, b) => a.order - b.order),
    [productsRaw],
  );
  const currency = useCurrency();
  const { content } = useSiteContent();
  // Categories, drop banner, and account/admin links are always shown —
  // admins control the footer link visibility (see UIToggles in admin).
  const showCategories = true;
  const showDrop = true;

  const [activeCat, setActiveCat] = useState<string | null>(null);
  
  const [bagOpen, setBagOpen] = useState(false);

  // Load products & categories from the cloud once.
  useEffect(() => { loadFromCloud(); }, []);

  useEffect(() => {
    if (!activeCat && categories.length > 0) setActiveCat(categories[0].id);
  }, [categories, activeCat]);

  const visible = useMemo(
    () => products.filter((p) => !activeCat || p.categoryId === activeCat),
    [products, activeCat],
  );

  const bagCount = bag.reduce((n, b) => n + b.qty, 0);

  return (
    <div className="min-h-screen aquish-bg flex flex-col">
      <header
        className="fixed top-0 left-0 right-0 z-40 aquish-bg"
      >

        <div className="grid grid-cols-[1fr_auto] md:grid-cols-3 items-center px-3 md:px-4 min-h-12 py-2 gap-2">
          <div className="text-[11px] md:text-sm tracking-widest truncate">AQUISH</div>
          {showCategories ? (
            <StackedCategories
              categories={categories}
              activeCat={activeCat}
              setActiveCat={setActiveCat}
            />
          ) : (
            <div className="hidden md:block" />
          )}
          <div className="flex justify-end items-center gap-3 md:gap-4 text-[10px] md:text-xs tracking-widest">
            <AccountLinks />
            <button onClick={() => setBagOpen(true)} className="aquish-link whitespace-nowrap">
              BAG ({bagCount})
            </button>
          </div>
        </div>
        {showCategories && categories.length > 0 && (
          <div className="md:hidden px-3 pb-2">
            <StackedCategories
              categories={categories}
              activeCat={activeCat}
              setActiveCat={setActiveCat}
              compact
            />
          </div>
        )}
      </header>

      <main className={`flex-1 ${showCategories ? "pt-[96px] md:pt-16" : "pt-12"}`}>
        <SaleBanner />
        {showDrop && <DropBanner />}
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-[60vh] text-xs tracking-widest opacity-60">
            NO PRODUCTS
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-10 px-5 md:px-10 py-6">
            {visible.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onClick={() => navigate({ to: "/product/$sku", params: { sku: p.sku } })}
              />
            ))}
          </div>
        )}
        <Footer />
      </main>



      <BagDrawer
        open={bagOpen}
        onClose={() => setBagOpen(false)}
        currency={currency}
      />
    </div>
  );
}

function SaleBanner() {
  const { content } = useSiteContent();
  if (content.sale_banner_on !== "1") return null;
  const text = content.sale_banner_text?.trim();
  if (!text) return null;
  return (
    <div
      className="text-center py-2 text-[11px] tracking-[0.25em]"
      style={{ background: "#000", color: "#fff" }}
    >
      {text}
    </div>
  );
}

function DropBanner() {
  const dropAt = useStore((s) => s.dropAt);
  if (!dropAt) return null;
  return <Countdown target={dropAt} />;
}



function StackedCategories({
  categories,
  activeCat,
  setActiveCat,
  compact = false,
}: {
  categories: { id: string; name: string }[];
  activeCat: string | null;
  setActiveCat: (id: string) => void;
  compact?: boolean;
}) {
  // Chunk categories into rows of varying sizes: 3, 2, 2, 3, 2, 2, ...
  const rowPattern = [3, 2, 2];
  const rows: { id: string; name: string }[][] = [];
  let i = 0;
  let p = 0;
  while (i < categories.length) {
    const n = rowPattern[p % rowPattern.length];
    rows.push(categories.slice(i, i + n));
    i += n;
    p += 1;
  }
  // Categories sit ~5% larger than the SKU label on the product cards.
  const fontSize = compact ? 11 : 13;
  return (
    <nav
      className={compact ? "flex flex-col items-center gap-1" : "hidden md:flex flex-col items-center gap-1"}
      aria-label="Categories"
    >
      {rows.map((row, idx) => (
        <div key={idx} className="flex justify-center gap-x-6">
          {row.map((c) => {
            const isActive = activeCat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className="tracking-widest aquish-link whitespace-nowrap"
                style={{
                  fontSize,
                  opacity: isActive ? 1 : 0.35,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}



function AccountLinks() {
  const { user } = useAuth();
  if (!user) return <Link to="/auth" className="aquish-link">ACCOUNT</Link>;
  return (
    <>
      <Link to="/admin" className="aquish-link">ADMIN</Link>
      <Link to="/account" className="aquish-link">ACCOUNT</Link>
    </>
  );
}


function ProductCard({

  product,
  onClick,
}: {
  product: Product;
  onClick: () => void;
}) {
  const img = product.colors[0]?.image;
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= product.lowStockThreshold;
  return (
    <button
      onClick={soldOut ? undefined : onClick}
      className="aquish-card text-center focus:outline-none flex flex-col"
      style={{
        border: "none",
        padding: 0,
        background: "transparent",
        cursor: soldOut ? "not-allowed" : "pointer",
      }}
    >
      <div
        className="aquish-card-imgwrap aspect-square w-full overflow-hidden"
        style={{ opacity: soldOut ? 0.55 : 1 }}
      >
        {img ? (
          <img
            src={img}
            alt={product.sku}
            className="aquish-card-img w-full h-full object-cover block"
          />
        ) : (
          <div className="w-full h-full" style={{ background: "#e5e3df" }} />
        )}
      </div>
      <div className="flex flex-col items-center gap-1 pt-[14px] pb-2 px-2" style={{ fontSize: "0.88em" }}>
        <div className="tracking-widest" style={{ fontWeight: 500 }}>{product.sku}</div>
        {soldOut && <div className="tracking-widest opacity-70" style={{ fontSize: "0.85em" }}>SOLD OUT</div>}
        {lowStock && <div className="tracking-widest opacity-60" style={{ fontSize: "0.85em" }}>LOW STOCK</div>}
      </div>

    </button>
  );
}

export function QuickView({
  product,
  onClose,
  onPrevProduct,
  onNextProduct,
  currency,
}: {
  product: Product;
  onClose: () => void;
  onPrevProduct?: () => void;
  onNextProduct?: () => void;
  currency: ReturnType<typeof useCurrency>;
}) {
  const [colorId, setColorId] = useState(product.colors[0]?.id ?? "");
  const [size, setSize] = useState("");
  const [bagOverlay, setBagOverlay] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [addedFlash, setAddedFlash] = useState(false);
  const soldOut = product.stock <= 0;

  // Reset state when product changes
  useEffect(() => {
    setColorId(product.colors[0]?.id ?? "");
    setSize("");
    setBagOverlay(false);
    setInfoOpen(false);
  }, [product.id]);

  const images = useMemo(
    () =>
      product.colors
        .map((c) => ({ id: c.id, src: c.image, name: c.name }))
        .filter((i) => i.src),
    [product.colors],
  );
  const activeIdx = Math.max(0, images.findIndex((i) => i.id === colorId));
  const current = images[activeIdx];

  const prevImg = () => {
    if (images.length < 2) return;
    setColorId(images[(activeIdx - 1 + images.length) % images.length].id);
  };
  const nextImg = () => {
    if (images.length < 2) return;
    setColorId(images[(activeIdx + 1) % images.length].id);
  };

  const descLines = product.description
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (bagOverlay) setBagOverlay(false);
        else if (infoOpen) setInfoOpen(false);
        else onClose();
      }
      if (e.key === "ArrowLeft") prevImg();
      if (e.key === "ArrowRight") nextImg();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [bagOverlay, infoOpen, activeIdx, images.length]);

  // Touch swipe: horizontal cycles images, vertical cycles products
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < 40) return;
    if (absX > absY) {
      if (dx < 0) nextImg();
      else prevImg();
    } else {
      // vertical: cycle products
      if (dy < 0) onNextProduct?.();
      else onPrevProduct?.();
    }
  };

  const handleAddToBag = () => {
    if (soldOut) return;
    addToBag({ productId: product.id, colorId, size, qty: 1 });
    setBagOverlay(false);
    setAddedFlash(true);
    setTimeout(() => {
      setAddedFlash(false);
      onClose();
    }, 900);
  };

  return (
    <div
      className="h-[100dvh] w-full aquish-bg aquish-fade-in flex flex-col overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top: product name + close */}
      <div className="grid grid-cols-3 items-center px-6 pt-5 pb-3 text-sm tracking-widest">
        <div />
        <div className="justify-self-center text-center">{product.name}</div>
        <button onClick={onClose} className="aquish-link justify-self-end text-base">
          ×
        </button>
      </div>

      {/* Image area with arrows close to product */}
      <div
        className="flex-1 flex items-center justify-center px-6 pt-2 pb-2 overflow-hidden"
        style={{ opacity: soldOut ? 0.55 : 1 }}
      >
        <div className="flex items-center gap-10 md:gap-24">
          {images.length > 1 ? (
            <button
              onClick={prevImg}
              aria-label="Previous image"
              className="aquish-link text-2xl md:text-3xl w-8 h-8 flex items-center justify-center"
              style={{ background: "transparent", border: "none" }}
            >
              ‹
            </button>
          ) : (
            <div className="w-8 h-8" />
          )}
          <div
            className="flex items-center justify-center"
            style={{ width: "min(46vh, 70vw)", height: "min(46vh, 70vw)" }}
          >
            {current?.src ? (
              <img
                src={current.src}
                alt={product.sku}
                className="max-h-full max-w-full object-contain block select-none"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full" style={{ background: "#e5e3df" }} />
            )}
          </div>
          {images.length > 1 ? (
            <button
              onClick={nextImg}
              aria-label="Next image"
              className="aquish-link text-2xl md:text-3xl w-8 h-8 flex items-center justify-center"
              style={{ background: "transparent", border: "none" }}
            >
              ›
            </button>
          ) : (
            <div className="w-8 h-8" />
          )}
        </div>
      </div>

      {/* Carousel dots */}
      {images.length > 1 && (
        <div className="flex justify-center gap-2 pb-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setColorId(img.id)}
              aria-label={img.name || `IMAGE ${i + 1}`}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                border: "none",
                padding: 0,
                background: i === activeIdx ? "#000" : "#bbb",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}

      {/* Centered stacked: PRICE / INFORMATION / ADD TO BAG — lifted ~40% */}
      <div className="flex flex-col items-center gap-2 pb-[18vh] pt-2 text-sm tracking-widest">
        <div>{currency.format(product.price)}</div>
        <button
          onClick={() => setInfoOpen(true)}
          className="aquish-link"
        >
          INFORMATION
        </button>
        <button
          onClick={() => !soldOut && setBagOverlay(true)}
          className="aquish-link inline-flex items-center gap-2"
          disabled={soldOut}
        >
          {soldOut ? "SOLD OUT" : "ADD TO BAG"}
          {!soldOut && <span aria-hidden>+</span>}
        </button>
      </div>





      {/* ADD TO BAG selector overlay */}
      {bagOverlay && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center aquish-fade-in"
          style={{ background: "rgba(245,244,240,0.96)" }}
          onClick={() => setBagOverlay(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md p-6 flex flex-col gap-6 text-sm tracking-widest aquish-bg"
            style={{ border: "1px solid #000" }}
          >
            <div className="flex items-center justify-between">
              <div>{product.name}</div>
              <button onClick={() => setBagOverlay(false)} className="aquish-link">
                ×
              </button>
            </div>

            {product.colors.length > 1 && (
              <div className="flex flex-col gap-2">
                <div className="opacity-60 text-xs">
                  COLOUR — {product.colors.find((c) => c.id === colorId)?.name}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {product.colors.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setColorId(c.id)}
                      title={c.name}
                      style={{
                        width: 24,
                        height: 24,
                        background: c.swatch,
                        outline: colorId === c.id ? "1px solid #000" : "none",
                        outlineOffset: 2,
                        border: "1px solid rgba(0,0,0,0.15)",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {product.sizes.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="opacity-60 text-xs">SIZE</div>
                <div className="flex gap-2 flex-wrap">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className="px-4 py-2 text-xs tracking-widest aquish-size-btn"
                      style={{
                        border: "1px solid #000",
                        background: size === s ? "#000" : "transparent",
                        color: size === s ? "#fff" : "#000",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              disabled={soldOut || !size || !colorId}
              onClick={handleAddToBag}
              className="w-full py-4 text-sm tracking-widest disabled:opacity-40 aquish-btn-primary"
              style={{ background: "#000", color: "#fff", border: "none" }}
            >
              {soldOut ? "SOLD OUT" : !size ? "SELECT SIZE" : "ADD TO BAG"}
            </button>
          </div>
        </div>
      )}

      {/* INFORMATION overlay */}
      {infoOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center aquish-fade-in"
          style={{ background: "rgba(245,244,240,0.96)" }}
          onClick={() => setInfoOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md p-6 flex flex-col gap-4 text-sm tracking-widest aquish-bg"
            style={{ border: "1px solid #000" }}
          >
            <div className="flex items-center justify-between">
              <div>{product.name}</div>
              <button onClick={() => setInfoOpen(false)} className="aquish-link">
                ×
              </button>
            </div>
            <div className="text-xs opacity-70">SKU — {product.sku}</div>
            <div className="text-xs opacity-70">PRODUCT ID — {product.id}</div>
            <div className="text-xs">{currency.format(product.price)}</div>
            <div
              className="flex flex-col gap-2 pt-3"
              style={{ borderTop: "1px solid #000" }}
            >
              {descLines.length === 0 ? (
                <div className="text-xs opacity-60">NO INFORMATION</div>
              ) : (
                descLines.map((l, i) => (
                  <div key={i} className="text-xs">
                    {l}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADDED TO BAG flash */}
      {addedFlash && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
          style={{ background: "rgba(245,244,240,0.85)" }}
        >
          <div className="aquish-pop text-lg tracking-widest">ADDED TO BAG</div>
        </div>
      )}
    </div>
  );
}

function BagDrawer({
  open,
  onClose,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  currency: ReturnType<typeof useCurrency>;
}) {
  const bag = useStore((s) => s.bag);
  const products = useStore((s) => s.products);
  const navigate = useNavigate();

  const items = bag.map((b, i) => {
    const p = products.find((pp) => pp.id === b.productId);
    const c = p?.colors.find((cc) => cc.id === b.colorId);
    return { i, b, p, c };
  });

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{
          background: "rgba(0,0,0,0.4)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 250ms ease",
        }}
      />
      <aside
        className="fixed top-0 right-0 h-full w-full max-w-md z-50 aquish-bg flex flex-col"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease",
          borderLeft: "1px solid #000",
        }}
      >
        <div
          className="flex items-center justify-between p-4 text-xs tracking-widest"
          style={{ borderBottom: "1px solid #000" }}
        >
          <div>BAG</div>
          <button onClick={onClose} className="aquish-link">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {items.length === 0 && (
            <div className="p-8 text-xs tracking-widest opacity-60">EMPTY</div>
          )}
          {items.map(({ i, b, p, c }) => {
            const parsed = p ? parsePrice(p.price) : null;
            const lineStr =
              p && parsed
                ? currency.format(`${parsed.code} ${(parsed.amount * b.qty).toFixed(2)}`)
                : "";
            return (
              <div
                key={i}
                className="flex gap-3 p-4 text-xs tracking-widest"
                style={{ borderBottom: "1px solid #000" }}
              >
                <div style={{ width: 80, height: 80, flexShrink: 0 }}>
                  {c?.image ? (
                    <img src={c.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" style={{ background: "#e5e3df" }} />
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <div>{p?.sku ?? "—"}</div>
                  <div>
                    {c?.name} / {b.size}
                  </div>
                  <div>{lineStr}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => updateBagQty(i, b.qty - 1)}
                      className="aquish-link px-2"
                      style={{ border: "1px solid #000" }}
                    >
                      −
                    </button>
                    <span>{b.qty}</span>
                    <button
                      onClick={() => updateBagQty(i, b.qty + 1)}
                      className="aquish-link px-2"
                      style={{ border: "1px solid #000" }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromBag(i)}
                      className="aquish-link ml-auto"
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="p-4 flex flex-col gap-3 text-xs tracking-widest"
          style={{ borderTop: "1px solid #000" }}
        >
          <button
            disabled={items.length === 0}
            onClick={() => {
              onClose();
              navigate({ to: "/checkout" });
            }}
            className="w-full py-4 text-xs tracking-widest disabled:opacity-40 aquish-btn-primary"
            style={{ background: "#000", color: "#fff", border: "none" }}
          >
            CHECKOUT
          </button>
        </div>
      </aside>
    </>
  );
}
