import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Claim the admin role by providing the secret ADMIN_INVITE_CODE.
 * Must be called by an authenticated user. Comparison is constant-time-ish via
 * length check + char-by-char loop to reduce trivial timing leaks.
 */
export const claimAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const submitted = data.code.trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let granted = false;

    // 1) Environment master code (constant-time-ish compare)
    const expected = process.env.ADMIN_INVITE_CODE;
    if (expected) {
      const a = Buffer.from(submitted);
      const b = Buffer.from(expected);
      let ok = a.length === b.length;
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) ok = false;
      if (ok) granted = true;
    }

    // 2) Temporary invite codes (DB) — expires_at + max_uses respected
    if (!granted) {
      const { data: row } = await supabaseAdmin
        .from("admin_invite_codes")
        .select("*")
        .eq("code", submitted)
        .eq("active", true)
        .maybeSingle();
      if (row) {
        const notExpired = !row.expires_at || new Date(row.expires_at).getTime() > Date.now();
        const underCap = row.max_uses == null || row.used_count < row.max_uses;
        if (notExpired && underCap) {
          granted = true;
          await supabaseAdmin
            .from("admin_invite_codes")
            .update({ used_count: row.used_count + 1 })
            .eq("id", row.id);
        }
      }
    }

    if (!granted) return { ok: false as const };

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
    return { ok: true as const };
  });


export const getMyAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isAdmin: !!data };
  });
