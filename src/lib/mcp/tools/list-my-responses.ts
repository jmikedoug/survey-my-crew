import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, requireAuth } from "../supabase";

export default defineTool({
  name: "list_my_responses",
  title: "List polls I've answered",
  description: "Lists surveys the signed-in user has responded to, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max entries to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("responses")
      .select("id, created_at, surveys!inner(slug, title, category)")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (error) return textResult(error.message, true);
    const rows = (data ?? []).map((r) => {
      const s = r.surveys as unknown as { slug: string; title: string; category: string | null };
      return {
        response_id: r.id,
        submitted_at: r.created_at,
        slug: s?.slug,
        title: s?.title,
        category: s?.category ?? null,
        share_url: s?.slug ? `https://pyp.jmikedoug.com/s/${s.slug}` : null,
      };
    });
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { responses: rows },
    };
  },
});