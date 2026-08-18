// SELF-HOST REPLACEMENT for the Lovable-generated OAuth broker.
// Copy this over src/integrations/lovable/index.ts after migrating.
// It keeps the exact same call signature used by src/routes/auth.tsx, so no
// other file needs to change — it just goes straight to Supabase Auth.
import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      opts?: SignInOptions,
    ) => {
      if (provider === "lovable") {
        return { error: new Error("Provider not available outside Lovable") };
      }
      const { error } = await supabase.auth.signInWithOAuth({
        // Supabase names the Microsoft provider "azure".
        provider: provider === "microsoft" ? "azure" : provider,
        options: {
          redirectTo:
            opts?.redirect_uri ??
            (typeof window !== "undefined" ? window.location.origin : undefined),
          queryParams: opts?.extraParams,
        },
      });
      if (error) return { error };
      // Full-page redirect: Supabase navigates away and restores the session
      // itself on return.
      return { redirected: true as const };
    },
  },
};
