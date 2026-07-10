import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function serverSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/** Rewrite a URL to inject the survey owner's affiliate tag when possible, and strip any that the respondent embedded. */
export async function resolveAffiliateUrl(rawUrl: string, ownerId: string | null): Promise<string> {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    // Strip common affiliate params from user-provided links
    for (const p of ["tag", "ascsubtag", "linkCode", "linkId", "ref_", "aff", "affiliate_id"]) {
      u.searchParams.delete(p);
    }
    if (!ownerId) return u.toString();

    // Profiles are restricted to the owning user; use the admin client for this
    // narrow server-side lookup of the survey owner's affiliate tags.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("amazon_tag, etsy_tag")
      .eq("id", ownerId)
      .maybeSingle();
    if (!profile) return u.toString();

    if (/(^|\.)amazon\.[a-z.]+$/.test(host) && profile.amazon_tag) {
      u.searchParams.set("tag", profile.amazon_tag);
    } else if (/(^|\.)etsy\.com$/.test(host) && profile.etsy_tag) {
      u.searchParams.set("utm_source", profile.etsy_tag);
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

const suggestInput = z.object({ query: z.string().trim().min(1).max(120) });

type Candidate = { id: string; title: string; brand?: string; category?: string; url: string };

export const suggestProductMatches = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => suggestInput.parse(input))
  .handler(async ({ data }): Promise<{ candidates: Candidate[] }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { candidates: [] };

    const system = `You suggest real, popular product matches for a shopper's short description.
Return 3-5 candidates. Each must include a plausible product URL (prefer amazon.com or etsy.com search URLs when unsure).
Never invent URLs on unrelated domains.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: `Product the user typed: "${data.query}"` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_candidates",
                description: "Return the product candidates as JSON.",
                parameters: {
                  type: "object",
                  properties: {
                    candidates: {
                      type: "array",
                      minItems: 3,
                      maxItems: 5,
                      items: {
                        type: "object",
                        required: ["title", "url"],
                        properties: {
                          title: { type: "string" },
                          brand: { type: "string" },
                          category: { type: "string" },
                          url: { type: "string" },
                        },
                      },
                    },
                  },
                  required: ["candidates"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_candidates" } },
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error("Lovable AI error", res.status, body);
        return { candidates: [] };
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
      };
      const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return { candidates: [] };
      const parsed = JSON.parse(args) as { candidates?: Array<Omit<Candidate, "id">> };
      const candidates = (parsed.candidates ?? [])
        .filter((c) => c?.title && c?.url)
        .slice(0, 5)
        .map((c, i) => ({ id: `c${i}`, ...c }));
      return { candidates };
    } catch (err) {
      console.error(err);
      return { candidates: [] };
    }
  });