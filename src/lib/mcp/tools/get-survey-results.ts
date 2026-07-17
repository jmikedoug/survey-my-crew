import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, requireAuth } from "../supabase";

export default defineTool({
  name: "get_survey_results",
  title: "Get survey results",
  description: "Returns aggregated results for a survey by slug — response count, per-question rollups (average ratings, choice counts, text answers, product suggestions). The caller must own the survey; RLS blocks other users.",
  inputSchema: {
    slug: z.string().trim().min(1).max(80).describe("Survey slug, e.g. 'pop-psych-book-recs-zjj1aj'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const supabase = supabaseForUser(ctx);
    // Ownership check via RLS: only the owner sees the row.
    const { data: survey, error: sErr } = await supabase
      .from("surveys")
      .select("id, user_id")
      .eq("slug", slug)
      .maybeSingle();
    if (sErr) return textResult(sErr.message, true);
    if (!survey || survey.user_id !== ctx.getUserId()) {
      return textResult("Survey not found, or you do not own it.", true);
    }
    const { data, error } = await supabase.rpc("get_survey_results", { _slug: slug });
    if (error) return textResult(error.message, true);
    if (!data) return textResult("No results yet.", false);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { results: data as unknown },
    };
  },
});