import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, textResult, requireAuth } from "../supabase";

export default defineTool({
  name: "get_my_profile",
  title: "Get my profile",
  description: "Returns the signed-in user's Poll Your People profile (display name, optional demographics used for audience matching, affiliate tags).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, age_range, gender, location_region, amazon_tag, etsy_tag")
      .eq("id", ctx.getUserId())
      .maybeSingle();
    if (error) return textResult(error.message, true);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? {}, null, 2) }],
      structuredContent: { profile: data ?? null },
    };
  },
});