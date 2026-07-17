import { createFileRoute } from "@tanstack/react-router";
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
          .select("url, survey_id")
          .eq("id", params.id)
          .maybeSingle();

        if (error || !link || !link.survey_id) {
          return new Response("Link not found", { status: 404 });
        }

        // Validate destination against an allow-list of trusted retailer domains
        // to prevent the endpoint from being used as an open redirect.
        const ALLOWED_HOSTS = [
          /(^|\.)amazon\.[a-z.]+$/i,
          /(^|\.)amzn\.to$/i,
          /(^|\.)etsy\.com$/i,
          /(^|\.)etsy\.me$/i,
        ];
        let destination: URL;
        try {
          destination = new URL(link.url as string);
        } catch {
          return new Response("Invalid destination", { status: 400 });
        }
        if (destination.protocol !== "https:" && destination.protocol !== "http:") {
          return new Response("Invalid destination", { status: 400 });
        }
        if (!ALLOWED_HOSTS.some((re) => re.test(destination.hostname))) {
          return new Response("Destination not allowed", { status: 400 });
        }

        // Fire-and-forget click tracking; never block the redirect on it.
        supabase
          .from("affiliate_clicks")
          .insert({
            affiliate_link_id: params.id,
            referrer: request.headers.get("referer") ?? null,
          })
          .then(() => {}, () => {});

        return new Response(null, {
          status: 302,
          headers: { Location: destination.toString() },
        });
      },
    },
  },
});