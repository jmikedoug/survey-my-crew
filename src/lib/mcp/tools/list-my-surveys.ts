import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, requireAuth } from "../supabase";

export default defineTool({
  name: "list_my_surveys",
  title: "List my surveys",
  description: "Lists surveys created by the signed-in user, newest first, with response counts and shareable slugs.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max number of surveys to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("surveys")
      .select("id, slug, title, description, category, created_at")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (error) return textResult(error.message, true);

    const ids = (data ?? []).map((s) => s.id as string);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: rc } = await supabase.from("responses").select("survey_id").in("survey_id", ids);
      counts = (rc ?? []).reduce<Record<string, number>>((m, r) => {
        const id = r.survey_id as string;
        m[id] = (m[id] ?? 0) + 1;
        return m;
      }, {});
    }
    const surveys = (data ?? []).map((s) => ({
      slug: s.slug,
      title: s.title,
      description: s.description,
      category: s.category,
      created_at: s.created_at,
      response_count: counts[s.id as string] ?? 0,
      share_url: `https://pyp.jmikedoug.com/s/${s.slug}`,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(surveys, null, 2) }],
      structuredContent: { surveys },
    };
  },
});