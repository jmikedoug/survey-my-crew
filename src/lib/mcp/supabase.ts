import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/** Supabase client scoped to the authenticated MCP caller. RLS applies as that user. */
export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  const token = ctx.getToken();
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], ...(isError ? { isError: true } : {}) };
}

export function requireAuth(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    return textResult("Not authenticated", true);
  }
  return null;
}