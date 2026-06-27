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

function SuccessPage() {
  const { order } = useSearch({ from: "/checkout/success" });
  const [status, setStatus] = useState<string>("pending");
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!order) return;
    let stop = false;
    const tick = async () => {
      const { data } = await supabase
        .from("orders")
        .select("status")
        .eq("id", order)
        .maybeSingle();
      if (stop) return;
      if (data?.status) setStatus(data.status);
      if (data?.status === "paid" || tries > 20) return;
      setTimeout(() => setTries((t) => t + 1), 1500);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [order, tries]);

  const paid = status === "paid";

  return (
    <div className="min-h-screen aquish-bg aquish-fade-in flex items-center justify-center px-6">
      <div className="text-center flex flex-col gap-4 max-w-md">
        <div className="text-xl tracking-widest">
          {paid ? "ORDER CONFIRMED" : "AWAITING CONFIRMATION"}
        </div>
        <div className="text-xs tracking-widest opacity-70">
          {paid
            ? "PAYMENT RECEIVED. A CONFIRMATION HAS BEEN EMAILED."
            : "WE'RE WAITING FOR PAYFAST TO CONFIRM YOUR PAYMENT. THIS USUALLY TAKES A FEW SECONDS."}
        </div>
        {order && (
          <div className="text-[10px] tracking-widest opacity-50">
            ORDER {order.slice(0, 8).toUpperCase()} — {status.toUpperCase()}
          </div>
        )}
        <Link
          to="/account"
          className="aquish-link text-xs tracking-widest underline underline-offset-4 mt-4"
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
