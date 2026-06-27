import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { claimAdminRole } from "@/lib/auth.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "AQUISH — ACCOUNT" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const claim = useServerFn(claimAdminRole);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (adminCode) {
          // attempt admin claim (only succeeds if session exists already)
          const sess = await supabase.auth.getSession();
          if (sess.data.session) {
            const r = await claim({ data: { code: adminCode } });
            if (!r.ok) setMsg("Account created. Admin code was incorrect.");
            else setMsg("Account created. Admin access granted.");
          } else {
            setMsg("Check your email to confirm your account, then sign in to claim admin.");
          }
        } else {
          setMsg("Account created. You can sign in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (adminCode) {
          const r = await claim({ data: { code: adminCode } });
          setMsg(r.ok ? "Signed in. Admin access granted." : "Signed in. Admin code was incorrect.");
        }
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen aquish-bg flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-5 text-sm tracking-widest">
        <div className="text-center text-base">AQUISH</div>
        <div className="flex justify-center gap-6 text-xs">
          <button type="button" onClick={() => setMode("signin")} className={mode === "signin" ? "underline underline-offset-4" : "aquish-link"}>SIGN IN</button>
          <button type="button" onClick={() => setMode("signup")} className={mode === "signup" ? "underline underline-offset-4" : "aquish-link"}>CREATE ACCOUNT</button>
        </div>
        <label className="flex flex-col gap-1 text-xs">
          EMAIL
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="aquish-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          PASSWORD
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="aquish-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          ADMIN CODE (OPTIONAL)
          <input type="password" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} className="aquish-input" placeholder="LEAVE BLANK FOR NORMAL ACCOUNT" />
        </label>
        <button type="submit" disabled={busy} className="py-3 text-xs tracking-widest disabled:opacity-40" style={{ background: "#000", color: "#fff", border: "none" }}>
          {busy ? "..." : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
        </button>
        {msg && <div className="text-xs text-center opacity-80">{msg}</div>}
      </form>
    </div>
  );
}
