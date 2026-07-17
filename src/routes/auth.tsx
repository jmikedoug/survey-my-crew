import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/use-auth";
import { getCreatorToken, getRespondentToken } from "@/lib/creator-token";

const searchSchema = z.object({ redirect: z.string().optional() }).partial();

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · Poll Your People" },
      { name: "description", content: "Sign in to Poll Your People to save your surveys and poll history." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  const target = typeof search.redirect === "string" && search.redirect.startsWith("/") ? search.redirect : "/mine";

  useEffect(() => {
    if (!loading && user) {
      // Google/OAuth returns to window.location.origin, which drops our ?redirect=.
      // We stashed it in sessionStorage below; restore & prefer it.
      let dest = target;
      if (typeof window !== "undefined") {
        const stashed = sessionStorage.getItem("ppp.auth_redirect");
        if (stashed && stashed.startsWith("/")) {
          dest = stashed;
          sessionStorage.removeItem("ppp.auth_redirect");
        }
      }
      // Best-effort claim of any anon surveys AND responses created on this device.
      supabase.rpc("claim_surveys", { _token: getCreatorToken() }).then(({ data }) => {
        if (typeof data === "number" && data > 0) toast.success(`Claimed ${data} earlier survey${data === 1 ? "" : "s"}.`);
      });
      supabase.rpc("claim_responses", { _token: getRespondentToken() }).then(({ data }) => {
        if (typeof data === "number" && data > 0) toast.success(`Linked ${data} earlier poll response${data === 1 ? "" : "s"} to your account.`);
      });
      navigate({ to: dest as string });
    }
  }, [user, loading, navigate, target]);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { display_name: name.trim() || email.split("@")[0] },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to confirm your account.");
  }

  async function onGoogle() {
    setBusy(true);
    // Stash the desired post-auth destination — Google's redirect_uri must be
    // a public same-origin URL, so we can't put ?redirect= there.
    if (typeof window !== "undefined" && target && target.startsWith("/")) {
      sessionStorage.setItem("ppp.auth_redirect", target);
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to save your surveys and the polls you take.
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full"
          onClick={onGoogle}
          disabled={busy}
        >
          Continue with Google
        </Button>
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="space-y-3 pt-4">
            <form onSubmit={onSignIn} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="si-email">Email</Label>
                <Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="si-pw">Password</Label>
                <Input id="si-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full rounded-full bg-gradient-brand text-white shadow-brand" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup" className="space-y-3 pt-4">
            <form onSubmit={onSignUp} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="su-name">Display name</Label>
                <Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-email">Email</Label>
                <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-pw">Password</Label>
                <Input id="su-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
              <Button type="submit" className="w-full rounded-full bg-gradient-brand text-white shadow-brand" disabled={busy}>
                {busy ? "Creating…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back home</Link>
        </p>
      </Card>
    </div>
  );
}