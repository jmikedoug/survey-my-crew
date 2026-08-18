import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { describeAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Finishing sign-in · Poll Your People" },
      { name: "description", content: "Completing your sign-in to Poll Your People." },
      { property: "og:title", content: "Finishing sign-in · Poll Your People" },
      { property: "og:description", content: "Completing your sign-in to Poll Your People." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallback,
});

function savedDestination() {
  if (typeof window === "undefined") return "/mine";
  const stashed = sessionStorage.getItem("ppp.auth_redirect");
  sessionStorage.removeItem("ppp.auth_redirect");
  return stashed && stashed.startsWith("/") ? stashed : "/mine";
}

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const url = new URL(window.location.href);
      const providerError =
        url.searchParams.get("error_description") ??
        url.searchParams.get("error") ??
        new URLSearchParams(url.hash.replace(/^#/, "")).get("error_description");
      if (providerError) {
        if (!cancelled) setError(providerError);
        return;
      }

      // supabase-js may already have consumed the code (detectSessionInUrl).
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
        if (!cancelled) navigate({ to: savedDestination(), replace: true });
        return;
      }

      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          // The auto-detect path may have raced us; re-check before failing.
          const retry = await supabase.auth.getSession();
          if (retry.data.session) {
            if (!cancelled) navigate({ to: savedDestination(), replace: true });
            return;
          }
          if (!cancelled) setError(describeAuthError(exchangeError));
          return;
        }
        if (!cancelled) navigate({ to: savedDestination(), replace: true });
        return;
      }

      // Implicit-flow returns put tokens in the hash; give the client a beat.
      await new Promise((r) => setTimeout(r, 600));
      const late = await supabase.auth.getSession();
      if (cancelled) return;
      if (late.data.session) navigate({ to: savedDestination(), replace: true });
      else setError("Sign-in didn't complete — no session was returned.");
    }

    finish().catch((e) => {
      if (!cancelled) setError(describeAuthError(e));
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      {error ? (
        <>
          <h1 className="text-xl font-semibold tracking-tight">Sign-in didn't finish</h1>
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
          <Link
            to="/auth"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <div
            className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary"
            aria-hidden
          />
          <p className="mt-4 text-sm text-muted-foreground">Finishing sign-in…</p>
        </>
      )}
    </div>
  );
}
