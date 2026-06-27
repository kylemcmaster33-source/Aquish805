import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "AQUISH — ORDER RECEIVED" },
      { name: "description", content: "AQUISH order confirmation." },
    ],
  }),
  validateSearch: (s) =>
    z.object({ order: z.string().uuid().optional() }).parse(s),
  component: SuccessPage,
});

const STATUS_STEPS = ["pending", "paid", "processing", "shipped", "delivered"] as const;
type Status = (typeof STATUS_STEPS)[number] | string;

const STATUS_LABEL: Record<string, string> = {
  pending: "AWAITING PAYMENT",
  paid: "PAYMENT CONFIRMED",
  processing: "PREPARING ORDER",
  shipped: "SHIPPED",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
  refunded: "REFUNDED",
};

function SuccessPage() {
  const { order } = useSearch({ from: "/checkout/success" });
  const [status, setStatus] = useState<Status>("pending");
  const [tracking, setTracking] = useState<string | null>(null);

  // Initial fetch + realtime subscription + slow poll fallback.
  useEffect(() => {
    if (!order) return;
    let cancelled = false;

    const apply = (row: any) => {
      if (cancelled || !row) return;
      if (row.status) setStatus(row.status);
      if (row.tracking_number) setTracking(row.tracking_number);
    };

    const fetchOnce = async () => {
      const { data } = await supabase
        .from("orders")
        .select("status, tracking_number")
        .eq("id", order)
        .maybeSingle();
      apply(data);
    };

    fetchOnce();

    const channel = supabase
      .channel(`order-${order}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order}` },
        (payload) => apply(payload.new),
      )
      .subscribe();

    // Poll every 4s as a fallback in case realtime isn't enabled on the table.
    const poll = setInterval(fetchOnce, 4000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [order]);

  const paid = status !== "pending" && status !== "cancelled";
  const currentIdx = STATUS_STEPS.indexOf(status as any);

  return (
    <div className="min-h-screen aquish-bg aquish-fade-in flex items-center justify-center px-6">
      <div className="text-center flex flex-col gap-5 max-w-md w-full">
        <div className="text-xl tracking-widest">
          {status === "cancelled"
            ? "ORDER CANCELLED"
            : paid
              ? "ORDER CONFIRMED"
              : "AWAITING CONFIRMATION"}
        </div>
        <div className="text-xs tracking-widest opacity-70">
          {STATUS_LABEL[status] ?? status.toUpperCase()}
        </div>

        {/* Progress bar */}
        {status !== "cancelled" && status !== "refunded" && (
          <div className="flex items-center gap-1 pt-2">
            {STATUS_STEPS.map((s, i) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 2,
                  background: "#000",
                  opacity: i <= currentIdx ? 1 : 0.15,
                  transition: "opacity 400ms ease",
                }}
                title={STATUS_LABEL[s]}
              />
            ))}
          </div>
        )}

        {order && (
          <div className="text-[10px] tracking-widest opacity-50 pt-2">
            ORDER {order.slice(0, 8).toUpperCase()}
          </div>
        )}

        {tracking && (
          <div className="text-[11px] tracking-widest">
            TRACKING — {tracking}
          </div>
        )}

        <Link
          to="/account"
          className="aquish-link text-xs tracking-widest underline underline-offset-4 mt-2"
        >
          VIEW ORDERS
        </Link>
        <Link
          to="/"
          className="aquish-link text-xs tracking-widest underline underline-offset-4"
        >
          CONTINUE SHOPPING
        </Link>
      </div>
    </div>
  );
}
