import { createFileRoute, redirect } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/aff/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );

        const { data: link, error } = await supabase
          .from("affiliate_links")
          .select("url")
          .eq("id", params.id)
          .maybeSingle();

        if (error || !link) {
          return new Response("Link not found", { status: 404 });
        }

        // Fire-and-forget click tracking; never block the redirect on it.
        supabase
          .from("affiliate_clicks")
          .insert({
            affiliate_link_id: params.id,
            referrer: request.headers.get("referer") ?? null,
          })
          .then(() => {}, () => {});

        throw redirect({ href: link.url as string });
      },
    },
  },
});